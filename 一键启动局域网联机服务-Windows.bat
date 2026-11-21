@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "APP_DIR="

if exist "%SCRIPT_DIR%项目完整源码\reverse-ux-wakeup\server\lan-standalone-server.cjs" (
  set "APP_DIR=%SCRIPT_DIR%项目完整源码\reverse-ux-wakeup"
) else if exist "%SCRIPT_DIR%reverse-ux-wakeup\server\lan-standalone-server.cjs" (
  set "APP_DIR=%SCRIPT_DIR%reverse-ux-wakeup"
) else if exist "%SCRIPT_DIR%server\lan-standalone-server.cjs" (
  set "APP_DIR=%SCRIPT_DIR%"
)

set "FALLBACK_HTML=%SCRIPT_DIR%醒醒分钱了-4部联机手机同屏版.html"

echo ==============================================================
echo  《醒醒！分钱了》(Rise ^& Fine) — Windows 局域网联机一键启动器
echo ==============================================================

set "NODE_EXE="
for /f "delims=" %%i in ('where node 2^>nul') do (
  if not defined NODE_EXE set "NODE_EXE=%%i"
)

if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.volta\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.volta\bin\node.exe"
if not defined NODE_EXE if exist "%NVM_SYMLINK%\node.exe" set "NODE_EXE=%NVM_SYMLINK%\node.exe"

if not defined NODE_EXE (
  echo.
  echo [提示] 当前电脑未检测到 Node.js 环境。
  if exist "%FALLBACK_HTML%" (
    echo [自动切换] 正在为您直接打开免安装「醒醒分钱了-4部联机手机同屏版.html」...
    start "" "%FALLBACK_HTML%"
    timeout /t 2 >nul
    exit /b 0
  ) else (
    echo 请直接双击同目录下的 HTML 文件体验完整功能！
    pause
    exit /b 0
  )
)

if not defined APP_DIR (
  if exist "%FALLBACK_HTML%" (
    start "" "%FALLBACK_HTML%"
    exit /b 0
  )
)

echo [就绪] 已定位 Node.js: "%NODE_EXE%"
echo [启动] 正在免依赖启动 Rise ^& Fine 局域网多手机扫码同步服务...
echo.
cd /d "%APP_DIR%"
"%NODE_EXE%" "%APP_DIR%\server\lan-standalone-server.cjs" --open
pause
