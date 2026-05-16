@echo off
REM ===========================================================================
REM Cumplø - Arranque Windows
REM
REM Levanta el servidor local de Cumplø en 127.0.0.1:8765, abre la aplicación
REM en el navegador y permite apagar la sesión desde la propia interfaz.
REM
REM No instala ni configura Ollama. Para la primera configuración en Windows usa:
REM   Configurar_Cumplo_Windows.bat
REM ===========================================================================

chcp 65001 >nul 2>&1
setlocal

set "PORT=8765"
set "HOST=127.0.0.1"
set "URL=http://%HOST%:%PORT%/index.html"
set "PYTHON_CMD="

cd /d "%~dp0"

REM Comprobar Python 3. Primero python; si no está en PATH, usar el lanzador py -3.
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        set "PYTHON_CMD=py -3"
    )
)

if "%PYTHON_CMD%"=="" (
    echo.
    echo X Python 3 no está instalado o no está en el PATH.
    echo Cumplø necesita Python 3.8 o posterior para servir los archivos estáticos.
    echo Descárgalo desde https://www.python.org/downloads/
    echo IMPORTANTE: durante la instalación, marca "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)

%PYTHON_CMD% -c "import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo X Cumplø necesita Python 3.8 o posterior.
    echo Versión detectada:
    %PYTHON_CMD% --version
    echo.
    pause
    exit /b 1
)

REM Aviso no bloqueante si Ollama no responde.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:11434/api/tags' ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo ! Ollama no responde en http://127.0.0.1:11434
    echo Cumplø arrancará igualmente, pero la generación de tareas no funcionará
    echo hasta que Ollama esté instalado, abierto y configurado.
    echo Consulta docs\INSTALAR-OLLAMA.es.md.
    echo.
)

echo.
echo Cumplø - servidor local
echo -----------------------
echo URL: %URL%
echo Puerto: %PORT%
echo.
echo Puedes apagar Cumplø desde la interfaz o con Ctrl+C.
echo.

REM Abrir el navegador con un pequeño retraso para que el servidor esté listo.
start "" /min cmd /c "timeout /t 2 /nobreak >nul && start "" "%URL%""

REM Servir solo en localhost. server.py expone /__cumplo_shutdown para el botón
REM "Apagar" de la interfaz.
%PYTHON_CMD% server.py --host %HOST% --port %PORT%

endlocal
