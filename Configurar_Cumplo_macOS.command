#!/usr/bin/env bash
# ===========================================================================
# Cumplø - Configuración inicial para macOS
#
# Ejecutar una sola vez antes del primer uso.
# - Comprueba Python.
# - Comprueba Ollama.
# - Configura OLLAMA_ORIGINS para Cumplø.
# - Reinicia Ollama si es posible.
# - Descarga el modelo local recomendado.
# ===========================================================================

set -u

PORT="8765"
ORIGINS="http://127.0.0.1:${PORT},http://localhost:${PORT}"
MODEL="gemma3n:e2b"

cd "$(dirname "$0")"

clear 2>/dev/null || true

echo "========================================"
echo " Cumplø - configuración inicial macOS"
echo "========================================"
echo ""

# 1. Comprobar Python.
if ! command -v python3 >/dev/null 2>&1; then
  echo "X No se ha encontrado Python 3."
  echo ""
  echo "Cumplø necesita Python 3.8 o posterior."
  echo "Se abrirá la página oficial de descarga."
  open "https://www.python.org/downloads/" >/dev/null 2>&1 || true
  echo ""
  read -r -p "Pulsa Intro para cerrar... " _
  exit 1
fi

if ! python3 - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if sys.version_info >= (3, 8) else 1)
PY
then
  echo "X La versión de Python instalada es demasiado antigua."
  python3 --version
  echo "Instala Python 3.8 o posterior desde https://www.python.org/downloads/"
  echo ""
  read -r -p "Pulsa Intro para cerrar... " _
  exit 1
fi

echo "OK - Python detectado: $(python3 --version 2>&1)"
echo ""

# 2. Comprobar Ollama.
OLLAMA_CMD=""
if command -v ollama >/dev/null 2>&1; then
  OLLAMA_CMD="$(command -v ollama)"
elif [ -x "/Applications/Ollama.app/Contents/Resources/ollama" ]; then
  OLLAMA_CMD="/Applications/Ollama.app/Contents/Resources/ollama"
fi

if [ -z "$OLLAMA_CMD" ] && [ ! -d "/Applications/Ollama.app" ]; then
  echo "X No se ha encontrado Ollama."
  echo ""
  echo "Instala Ollama desde la página oficial y vuelve a ejecutar este archivo."
  open "https://ollama.com/download" >/dev/null 2>&1 || true
  echo ""
  read -r -p "Pulsa Intro para cerrar... " _
  exit 1
fi

echo "OK - Ollama localizado."
echo ""

# 3. Configurar OLLAMA_ORIGINS para procesos lanzados por launchd.
echo "Configurando OLLAMA_ORIGINS..."
launchctl setenv OLLAMA_ORIGINS "$ORIGINS"
export OLLAMA_ORIGINS="$ORIGINS"
echo "OK - OLLAMA_ORIGINS=$ORIGINS"
echo ""

# 4. Reiniciar Ollama para que lea la variable nueva.
echo "Reiniciando Ollama si estaba abierto..."
osascript -e 'quit app "Ollama"' >/dev/null 2>&1 || true
sleep 2
open -a Ollama >/dev/null 2>&1 || true
sleep 5

# Si el comando ollama no estaba en PATH antes de abrir la app, volver a comprobar.
if [ -z "$OLLAMA_CMD" ]; then
  if command -v ollama >/dev/null 2>&1; then
    OLLAMA_CMD="$(command -v ollama)"
  elif [ -x "/Applications/Ollama.app/Contents/Resources/ollama" ]; then
    OLLAMA_CMD="/Applications/Ollama.app/Contents/Resources/ollama"
  fi
fi

if [ -z "$OLLAMA_CMD" ]; then
  echo "X Ollama está instalado, pero no se encuentra el comando 'ollama'."
  echo "Abre Ollama manualmente y comprueba su instalación."
  echo ""
  read -r -p "Pulsa Intro para cerrar... " _
  exit 1
fi

echo "Comprobando servicio local de Ollama..."
if ! curl -s --max-time 4 "http://127.0.0.1:11434/" >/dev/null 2>&1; then
  echo "! No se ha podido confirmar que Ollama esté respondiendo todavía."
  echo "Abre Ollama manualmente desde Aplicaciones y, después, vuelve a ejecutar este archivo."
  echo ""
  read -r -p "Pulsa Intro para cerrar... " _
  exit 1
fi

echo "OK - Ollama está respondiendo."
echo ""

# 5. Descargar modelo recomendado.
echo "Descargando el modelo recomendado: $MODEL"
echo "Este paso puede tardar varios minutos la primera vez."
echo ""
"$OLLAMA_CMD" pull "$MODEL"
if [ $? -ne 0 ]; then
  echo ""
  echo "X No se ha podido descargar el modelo $MODEL."
  echo "Comprueba la conexión a internet y que Ollama esté abierto."
  echo ""
  read -r -p "Pulsa Intro para cerrar... " _
  exit 1
fi

echo ""
echo "========================================"
echo " Configuración completada"
echo "========================================"
echo ""
echo "Ahora puedes abrir Cumplø con:"
echo "  Abrir_Cumplo_macOS.command"
echo ""
read -r -p "Pulsa Intro para cerrar... " _
