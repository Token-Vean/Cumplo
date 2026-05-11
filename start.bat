@echo off
REM ===========================================================================
REM Cumplo - Arranque Windows
REM Levanta el servidor local de Cumplo en 127.0.0.1:8765, abre la aplicacion
REM y permite apagar la sesion desde la propia interfaz.
REM No arranca ni configura Ollama: Ollama debe estar instalado y corriendo
REM por su cuenta (es un servicio en Windows). La conexion entre Cumplo y
REM Ollama requiere configurar la variable de entorno OLLAMA_ORIGINS una vez.
REM Lee docs\INSTALAR-OLLAMA.es.md para los detalles.
REM ===========================================================================

REM Forzar UTF-8 en la consola para que los acentos y el simbolo o-barrada se
REM vean bien en cmd.exe.
chcp 65001 >nul 2>&1

setlocal
set PORT=8765
set HOST=127.0.0.1
set URL=http://%HOST%:%PORT%/index.html

cd /d "%~dp0"

REM Comprobar Python 3.
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo.
  echo   X Python no esta instalado o no esta en el PATH.
  echo     Cumplo necesita Python 3 para servir los archivos estaticos.
  echo     Descargalo desde https://www.python.org/downloads/
  echo     IMPORTANTE: durante la instalacion, marca "Add Python to PATH".
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
python server.py --host %HOST% --port %PORT%

endlocal
