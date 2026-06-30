@echo off
setlocal

cd /d "%~dp0"

echo ========================================
echo SOREVID VideoGET - Dev Updater
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay Git. Hay cai Git truoc khi chay file nay.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay npm. Hay cai Node.js truoc khi chay file nay.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] Thu muc hien tai khong phai la Git repository.
  echo Hay dat file nay trong thu muc da clone cua du an.
  pause
  exit /b 1
)

echo [1/4] Dang kiem tra code moi nhat tu Git...
git fetch --prune
if errorlevel 1 (
  echo [ERROR] Khong the ket noi hoac fetch code moi tu Git.
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2^>nul') do set "UPSTREAM=%%i"
if "%UPSTREAM%"=="" (
  echo [ERROR] Nhanh hien tai chua co upstream remote.
  echo Hay chay: git branch --set-upstream-to=origin/main
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('git rev-parse HEAD') do set "OLD_HEAD=%%i"

echo [2/4] Dang cap nhat code...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo [ERROR] Khong the pull tu dong.
  echo Co the may dang co thay doi local hoac lich su Git bi lech.
  echo Hay commit/stash thay doi local roi chay lai file nay.
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('git rev-parse HEAD') do set "NEW_HEAD=%%i"

if "%OLD_HEAD%"=="%NEW_HEAD%" (
  echo Code dang la ban moi nhat.
) else (
  echo Da cap nhat code moi.
)

echo.
echo [3/4] Dang dam bao dependencies san sang...
call npm install
if errorlevel 1 (
  echo [ERROR] Cai dat dependencies that bai.
  pause
  exit /b 1
)

echo.
echo [4/4] Dang chay npm run dev ^(tauri dev^)...
echo.
call npm run dev

set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo Tauri dev da dung voi ma: %EXIT_CODE%
pause
exit /b %EXIT_CODE%
