//! Named Pipe IPC 网关，协议与 Python `multiprocessing.connection`（AF_PIPE）兼容：
//! - 管道为 MESSAGE 模式
//! - 每次 `send_bytes` 发送/接收一条完整消息（无 4 字节长度前缀）

use std::collections::HashMap;
use std::io;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use serde_json::{json, Value};

pub const IPC_PIPE_NAME: &str = r"\\.\pipe\rpa_script_bridge";
const PIPE_BUFFER_SIZE: u32 = 8192;

pub type RequestHandler = Arc<dyn Fn(u64, Value) + Send + Sync + 'static>;
pub type ClientCloseHandler = Arc<dyn Fn(u64) + Send + Sync + 'static>;
pub type AcceptHandler = Arc<dyn Fn(u64) + Send + Sync + 'static>;
pub type ErrorHandler = Arc<dyn Fn(io::Error) + Send + Sync + 'static>;

static FIRST_PIPE_INSTANCE: AtomicBool = AtomicBool::new(true);

struct GatewayInner {
    clients: Mutex<HashMap<u64, Arc<PipeStream>>>,
    next_client_id: AtomicU64,
    max_workers: usize,
    on_request: RequestHandler,
    on_client_close: ClientCloseHandler,
    on_accept: Option<AcceptHandler>,
}

pub struct IpcGateway {
    inner: Arc<GatewayInner>,
}

impl IpcGateway {
    pub fn new(
        on_request: RequestHandler,
        on_client_close: ClientCloseHandler,
        on_accept: Option<AcceptHandler>,
        max_workers: usize,
    ) -> Self {
        Self {
            inner: Arc::new(GatewayInner {
                clients: Mutex::new(HashMap::new()),
                next_client_id: AtomicU64::new(1),
                max_workers,
                on_request,
                on_client_close,
                on_accept,
            }),
        }
    }

    pub fn get_pool_status(&self) -> Value {
        let clients = self
            .inner
            .clients
            .lock()
            .expect("clients lock poisoned")
            .len();
        json!({
            "poolThreads": clients,
            "poolMaxWorkers": self.inner.max_workers,
            "clients": clients,
        })
    }

    pub fn send_to(&self, client_id: u64, payload: &Value) -> io::Result<bool> {
        let client = {
            let clients = self
                .inner
                .clients
                .lock()
                .expect("clients lock poisoned");
            clients.get(&client_id).cloned()
        };
        let Some(client) = client else {
            return Ok(false);
        };

        let wire = format!("{}\n", serde_json::to_string(payload)?);
        client.send_bytes(wire.as_bytes())?;
        Ok(true)
    }

    pub fn broadcast(&self, payload: &Value) {
        let ids: Vec<u64> = {
            let clients = self
                .inner
                .clients
                .lock()
                .expect("clients lock poisoned");
            clients.keys().copied().collect()
        };
        for client_id in ids {
            let _ = self.send_to(client_id, payload);
        }
    }

    pub fn run_server_loop(self: Arc<Self>, on_error: ErrorHandler) {
        #[cfg(not(windows))]
        {
            let _ = (self, on_error);
            return;
        }

        #[cfg(windows)]
        loop {
            match accept_client() {
                Ok(stream) => {
                    let client_id = self
                        .inner
                        .next_client_id
                        .fetch_add(1, Ordering::Relaxed);
                    {
                        let mut clients = self
                            .inner
                            .clients
                            .lock()
                            .expect("clients lock poisoned");
                        clients.insert(client_id, Arc::new(stream));
                    }

                    let gateway = Arc::clone(&self);
                    thread::spawn(move || handle_client(gateway, client_id));
                }
                Err(err) => {
                    on_error(err);
                    break;
                }
            }
        }
    }
}

fn handle_client(gateway: Arc<IpcGateway>, client_id: u64) {
    let client = {
        let clients = gateway
            .inner
            .clients
            .lock()
            .expect("clients lock poisoned");
        clients.get(&client_id).cloned()
    };

    let Some(client) = client else {
        return;
    };

    if let Some(on_accept) = &gateway.inner.on_accept {
        on_accept(client_id);
    }

    loop {
        let payload = match client.recv_bytes() {
            Ok(data) => data,
            Err(_) => break,
        };

        let raw = match String::from_utf8(payload) {
            Ok(text) => text.trim().to_string(),
            Err(_) => continue,
        };
        if raw.is_empty() {
            continue;
        }

        let req = match serde_json::from_str::<Value>(&raw) {
            Ok(value) => value,
            Err(_) => continue,
        };

        (gateway.inner.on_request)(client_id, req);
    }

    {
        let mut clients = gateway
            .inner
            .clients
            .lock()
            .expect("clients lock poisoned");
        clients.remove(&client_id);
    }
    (gateway.inner.on_client_close)(client_id);
}

struct PipeStream {
    #[cfg(windows)]
    handle: windows::Win32::Foundation::HANDLE,
    read_lock: Mutex<()>,
    write_lock: Mutex<()>,
}

#[cfg(windows)]
unsafe impl Send for PipeStream {}

#[cfg(windows)]
unsafe impl Sync for PipeStream {}

impl PipeStream {
    fn send_bytes(&self, data: &[u8]) -> io::Result<()> {
        let _guard = self.write_lock.lock().expect("write lock poisoned");
        self.write_all(data)
    }

    fn recv_bytes(&self) -> io::Result<Vec<u8>> {
        let _guard = self.read_lock.lock().expect("read lock poisoned");
        self.read_message()
    }

    fn read_message(&self) -> io::Result<Vec<u8>> {
        #[cfg(windows)]
        {
            use windows::Win32::Foundation::{GetLastError, ERROR_MORE_DATA};
            use windows::Win32::Storage::FileSystem::ReadFile;
            use windows::Win32::System::Pipes::PeekNamedPipe;

            let mut buf = vec![0u8; 65_536];
            let mut bytes_read = 0u32;
            let ok = unsafe {
                ReadFile(
                    self.handle,
                    Some(&mut buf),
                    Some(&mut bytes_read),
                    None,
                )
            };
            if ok.is_ok() {
                buf.truncate(bytes_read as usize);
                return Ok(buf);
            }

            let err = unsafe { GetLastError() };
            if err != ERROR_MORE_DATA {
                return Err(io::Error::last_os_error());
            }

            buf.truncate(bytes_read as usize);
            let mut remaining = 0u32;
            unsafe {
                PeekNamedPipe(
                    self.handle,
                    None,
                    0,
                    None,
                    Some(&mut remaining),
                    None,
                )
                .map_err(|_| io::Error::last_os_error())?;
            }
            if remaining > 0 {
                let mut extra = vec![0u8; remaining as usize];
                let mut extra_read = 0u32;
                unsafe {
                    ReadFile(
                        self.handle,
                        Some(&mut extra),
                        Some(&mut extra_read),
                        None,
                    )
                    .map_err(|_| io::Error::last_os_error())?;
                }
                extra.truncate(extra_read as usize);
                buf.extend_from_slice(&extra);
            }
            Ok(buf)
        }

        #[cfg(not(windows))]
        {
            Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "named pipe IPC is only supported on Windows",
            ))
        }
    }

    fn write_all(&self, data: &[u8]) -> io::Result<()> {
        #[cfg(windows)]
        {
            use windows::Win32::Storage::FileSystem::WriteFile;

            let mut offset = 0;
            while offset < data.len() {
                let mut bytes_written = 0u32;
                let ok = unsafe {
                    WriteFile(
                        self.handle,
                        Some(&data[offset..]),
                        Some(&mut bytes_written),
                        None,
                    )
                };
                if ok.is_err() {
                    return Err(io::Error::last_os_error());
                }
                if bytes_written == 0 {
                    return Err(io::Error::new(
                        io::ErrorKind::WriteZero,
                        "failed to write to pipe",
                    ));
                }
                offset += bytes_written as usize;
            }
            Ok(())
        }

        #[cfg(not(windows))]
        {
            let _ = data;
            Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "named pipe IPC is only supported on Windows",
            ))
        }
    }
}

#[cfg(windows)]
fn accept_client() -> io::Result<PipeStream> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{
        CloseHandle, ERROR_IO_PENDING, ERROR_PIPE_CONNECTED,
    };
    use windows::Win32::Storage::FileSystem::{
        FILE_FLAG_FIRST_PIPE_INSTANCE, FILE_FLAG_OVERLAPPED, PIPE_ACCESS_DUPLEX,
    };
    use windows::Win32::System::IO::{GetOverlappedResult, OVERLAPPED};
    use windows::Win32::System::Threading::{CreateEventW, WaitForSingleObject, INFINITE};
    use windows::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, NMPWAIT_WAIT_FOREVER, PIPE_READMODE_MESSAGE,
        PIPE_TYPE_MESSAGE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
    };

    let wide: Vec<u16> = OsStr::new(IPC_PIPE_NAME)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut open_mode = PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED;
    if FIRST_PIPE_INSTANCE.swap(false, Ordering::Relaxed) {
        open_mode |= FILE_FLAG_FIRST_PIPE_INSTANCE;
    }

    let handle = unsafe {
        CreateNamedPipeW(
            PCWSTR(wide.as_ptr()),
            open_mode,
            PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
            PIPE_UNLIMITED_INSTANCES,
            PIPE_BUFFER_SIZE,
            PIPE_BUFFER_SIZE,
            NMPWAIT_WAIT_FOREVER,
            None,
        )
    };

    if handle.is_invalid() {
        return Err(io::Error::last_os_error());
    }

    unsafe {
        let event = CreateEventW(None, true, false, None)
            .map_err(|_| io::Error::last_os_error())?;
        let mut overlapped = OVERLAPPED {
            hEvent: event,
            ..Default::default()
        };

        let connect_result = ConnectNamedPipe(handle, Some(std::ptr::addr_of_mut!(overlapped)));
        if connect_result.is_err() {
            let err = io::Error::last_os_error();
            let code = err.raw_os_error().unwrap_or_default();
            if code == ERROR_PIPE_CONNECTED.0 as i32 {
                let _ = CloseHandle(event);
                return Ok(PipeStream {
                    handle,
                    read_lock: Mutex::new(()),
                    write_lock: Mutex::new(()),
                });
            }
            if code != ERROR_IO_PENDING.0 as i32 {
                let _ = CloseHandle(event);
                let _ = CloseHandle(handle);
                return Err(err);
            }

            let wait = WaitForSingleObject(event, INFINITE);
            if wait != windows::Win32::Foundation::WAIT_OBJECT_0 {
                let _ = CloseHandle(event);
                let _ = CloseHandle(handle);
                return Err(io::Error::last_os_error());
            }

            let mut transferred = 0u32;
            let ok = GetOverlappedResult(handle, &overlapped, &mut transferred, false);
            let _ = CloseHandle(event);
            if ok.is_err() {
                let _ = CloseHandle(handle);
                return Err(io::Error::last_os_error());
            }
        } else {
            let _ = CloseHandle(event);
        }
    }

    Ok(PipeStream {
        handle,
        read_lock: Mutex::new(()),
        write_lock: Mutex::new(()),
    })
}

#[cfg(windows)]
impl Drop for PipeStream {
    fn drop(&mut self) {
        use windows::Win32::Foundation::CloseHandle;
        let _ = unsafe { CloseHandle(self.handle) };
    }
}
