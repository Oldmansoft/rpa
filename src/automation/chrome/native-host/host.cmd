@echo off
setlocal
cd /d "%~dp0"

REM Native Messaging host launcher for Windows.
REM Chrome 会向宿主进程传入扩展 origin 等参数，需转发给 Python（%*）。
REM 启用日志：取消下一行注释，或在外部设置 RPA_NATIVE_HOST_LOG=1
REM set RPA_NATIVE_HOST_LOG=1

if /I "%RPA_NATIVE_HOST_LOG%"=="1" goto :with_log
if /I "%RPA_NATIVE_HOST_LOG%"=="true" goto :with_log
if /I "%RPA_NATIVE_HOST_LOG%"=="yes" goto :with_log
if /I "%RPA_NATIVE_HOST_LOG%"=="on" goto :with_log

"C:\Programs\Python\Python310\python.exe" "%~dp0host.py" %*
goto :done

:with_log
"C:\Programs\Python\Python310\python.exe" "%~dp0host.py" %* 2>>"%~dp0host-error.log"

:done
endlocal
