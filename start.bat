@echo off
REM ===========================================================================
REM Cumplo - Arranque Windows
REM Levanta el servidor local de Cumplo en 127.0.0.1:8765, abre la aplicacion
REM y permite apagar la sesion desde la propia interfaz.
REM No arranca ni configura Ollama: Ollama debe estar instalado y corriendo
REM por su cuenta. La conexion entre Cumplo y Ollama requiere configurar
REM OLLAMA_ORIGINS una vez. Lee docs\INSTALAR-OLLAMA.es.md.
REM ===========================================================================

chcp 65001 >nul 2>&1

setlocal
set PORT=8765
set HOST=127.0.0.1
set URL=http://%HOST%:%PORT%/index.html
set PYTHON_CMD=

cd /d "%~dp0"

REM Comprobar Python 3. Primero python; si no esta en PATH, usar el lanzador py -3.
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
  set PYTHON_CMD=python
) else (
  where py >nul 2>&1
  if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=py -3
  )
)

if "%PYTHON_CMD%"=="" (
  echo.
  echo   X Python 3 no esta instalado o no esta en el PATH.
  echo     Cumplo necesita Python 3 para servir los archivos estaticos.
  echo     Descargalo desde https://www.python.org/downloads/
  echo     IMPORTANTE: durante la instalacion, marca "Add Python to PATH".
  echo     Si usas Microsoft Store, comprueba que el lanzador "py" esta disponible.
  echo.
  pause
  exit /b 1
)

%PYTHON_CMD% -c "import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)" >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo.
  echo   X Cumplo necesita Python 3.8 o posterior.
  echo     Version detectada:
  %PYTHON_CMD% --version
  echo.
  pause
  exit /b 1
)

echo.
echo   Cumplo - servidor local
echo   -----------------------
echo   URL:    %URL%
echo   Puerto: %PORT%
echo.
echo   Puedes apagar Cumplo desde la interfaz o con Ctrl+C.
echo.

REM Abrir el navegador con un pequeno retraso para que el servidor este listo.
start "" /min cmd /c "timeout /t 2 /nobreak >nul && start """" %URL%"

REM Servir solo en localhost. server.py expone /__cumplo_shutdown para el
REM boton "Apagar" de la interfaz.
%PYTHON_CMD% server.py --host %HOST% --port %PORT%

endlocal
