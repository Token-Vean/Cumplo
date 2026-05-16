@echo off
REM ===========================================================================
REM Cumplø - Configuración inicial para Windows
REM
REM Ejecutar una sola vez antes del primer uso.
REM - Comprueba Python.
REM - Comprueba Ollama.
REM - Configura OLLAMA_ORIGINS para Cumplø.
REM - Reinicia Ollama si es posible.
REM - Descarga el modelo local recomendado.
REM ===========================================================================

chcp 65001 >nul 2>&1
setlocal EnableExtensions

set "PORT=8765"
set "ORIGINS=http://127.0.0.1:%PORT%,http://localhost:%PORT%"
set "MODEL=gemma3n:e2b"
set "PYTHON_CMD="
set "OLLAMA_CMD="

cd /d "%~dp0"

echo.
echo ========================================
echo  Cumplø - configuración inicial Windows
echo ========================================
echo.

REM 1. Comprobar Python.
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if %ERRORLEVEL% equ 0 set "PYTHON_CMD=py -3"
)

if "%PYTHON_CMD%"=="" (
    echo X No se ha encontrado Python 3.
    echo.
    echo Cumplø necesita Python 3.8 o posterior.
    echo Se abrirá la página oficial de descarga.
    echo Durante la instalación, marca la opción:
    echo   Add python.exe to PATH
    echo.
    start "" "https://www.python.org/downloads/"
    pause
    exit /b 1
)

%PYTHON_CMD% -c "import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo X La versión de Python instalada es demasiado antigua.
    %PYTHON_CMD% --version
    echo.
    echo Instala Python 3.8 o posterior desde https://www.python.org/downloads/
    pause
    exit /b 1
)

echo OK - Python detectado:
%PYTHON_CMD% --version

echo.

REM 2. Localizar Ollama.
where ollama >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "OLLAMA_CMD=ollama"
) else if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    set "OLLAMA_CMD=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
) else if exist "%LOCALAPPDATA%\Ollama\ollama.exe" (
    set "OLLAMA_CMD=%LOCALAPPDATA%\Ollama\ollama.exe"
)

if "%OLLAMA_CMD%"=="" (
    echo X No se ha encontrado Ollama.
    echo.
    echo Instala Ollama desde la página oficial y vuelve a ejecutar este archivo.
    echo Se abrirá la página de descarga.
    echo.
    start "" "https://ollama.com/download"
    pause
    exit /b 1
)

echo OK - Ollama detectado.
echo.

REM 3. Configurar OLLAMA_ORIGINS para el usuario actual.
echo Configurando OLLAMA_ORIGINS...
setx OLLAMA_ORIGINS "%ORIGINS%" >nul
set "OLLAMA_ORIGINS=%ORIGINS%"
echo OK - OLLAMA_ORIGINS=%ORIGINS%
echo.

REM 4. Reiniciar Ollama para que lea la variable nueva.
echo Reiniciando Ollama si estaba abierto...
taskkill /IM ollama.exe /F >nul 2>&1
ping 127.0.0.1 -n 3 >nul
start "" "%OLLAMA_CMD%"
ping 127.0.0.1 -n 6 >nul

echo Comprobando servicio local de Ollama...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 'http://127.0.0.1:11434/' ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ! No se ha podido confirmar que Ollama esté respondiendo todavía.
    echo Abre Ollama manualmente desde el menú Inicio y, después, vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

echo OK - Ollama está respondiendo.
echo.

REM 5. Descargar modelo recomendado.
echo Descargando el modelo recomendado: %MODEL%
echo Este paso puede tardar varios minutos la primera vez.
echo.
"%OLLAMA_CMD%" pull %MODEL%
if %ERRORLEVEL% neq 0 (
    echo.
    echo X No se ha podido descargar el modelo %MODEL%.
    echo Comprueba la conexión a internet y que Ollama esté abierto.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Configuración completada
echo ========================================
echo.
echo Ahora puedes abrir Cumplø con:
echo   Abrir_Cumplo_Windows.bat
echo o con:
echo   start.bat
echo.
pause
endlocal
