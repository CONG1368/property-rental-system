@echo off
REM Wrapper for electron-builder's 7za.exe
REM Adds -x!darwin -snl to skip macOS symlinks that require admin on Windows
setlocal enabledelayedexpansion

set REAL_7ZA=%~dp0..\node_modules\7zip-bin\win\x64\7za-real.exe

REM Rebuild command line with exclusions
set "OUT_ARGS="
set "CMD_FOUND="
for %%a in (%*) do (
  if "%%a"=="x" (
    set "OUT_ARGS=!OUT_ARGS! x -x!darwin -snl"
    set CMD_FOUND=1
  ) else (
    set "OUT_ARGS=!OUT_ARGS! %%a"
  )
)

if not defined CMD_FOUND set "OUT_ARGS=%*"

"%REAL_7ZA%" !OUT_ARGS!
