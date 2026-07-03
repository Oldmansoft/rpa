//! Chrome Native Messaging 桥：stdin/stdout 长度前缀 JSON 帧。

use std::io::{self, Read, Write};
use std::sync::Mutex;

use serde_json::Value;

#[cfg(windows)]
pub fn configure_windows_binary_stdio() {
    extern "C" {
        fn _setmode(fd: i32, mode: i32) -> i32;
    }
    const O_BINARY: i32 = 0x8000;
    unsafe {
        _setmode(0, O_BINARY);
        _setmode(1, O_BINARY);
    }
}

#[cfg(not(windows))]
pub fn configure_windows_binary_stdio() {}

fn read_message<R: Read>(reader: &mut R) -> io::Result<Option<Value>> {
    let mut header = [0u8; 4];
    match reader.read_exact(&mut header) {
        Ok(()) => {}
        Err(err) if err.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(err) => return Err(err),
    }

    let message_len = u32::from_le_bytes(header) as usize;
    let mut payload = vec![0u8; message_len];
    reader.read_exact(&mut payload)?;

    let value = serde_json::from_slice(&payload)?;
    Ok(Some(value))
}

fn write_message<W: Write>(writer: &mut W, payload: &Value) -> io::Result<()> {
    let encoded = serde_json::to_vec(payload)?;
    writer.write_all(&(encoded.len() as u32).to_le_bytes())?;
    writer.write_all(&encoded)?;
    writer.flush()?;
    Ok(())
}

pub struct NativeBridge {
    stdin: Mutex<io::Stdin>,
    stdout: Mutex<io::Stdout>,
}

impl NativeBridge {
    pub fn new() -> Self {
        Self {
            stdin: Mutex::new(io::stdin()),
            stdout: Mutex::new(io::stdout()),
        }
    }

    pub fn send(&self, payload: &Value) -> io::Result<()> {
        let mut stdout = self.stdout.lock().expect("stdout lock poisoned");
        write_message(&mut *stdout, payload)
    }

    pub fn run_read_loop<F>(&self, mut on_message: F) -> io::Result<()>
    where
        F: FnMut(Value),
    {
        let mut stdin = self.stdin.lock().expect("stdin lock poisoned");
        loop {
            match read_message(&mut *stdin)? {
                Some(msg) => on_message(msg),
                None => break,
            }
        }
        Ok(())
    }
}
