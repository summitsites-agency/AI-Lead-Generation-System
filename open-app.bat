@echo off
rem Waits for the dev server to boot, then opens the app in a NEW Chrome window,
rem regardless of the system default browser.
set "URL=http://localhost:3000"

rem Give the server a few seconds to start listening.
rem (full path to Windows timeout so it works regardless of PATH)
"%SystemRoot%\System32\timeout.exe" /t 6 /nobreak >nul 2>nul

set "CHROME="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if exist "%%~P" set "CHROME=%%~P"

if defined CHROME (
  start "" "%CHROME%" --new-window "%URL%"
) else (
  echo Chrome was not found - opening your default browser instead.
  start "" "%URL%"
)
