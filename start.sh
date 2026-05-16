#!/usr/bin/env bash
# ===========================================================================
# Cumplø · Arranque Linux/macOS
#
# Levanta el servidor local de Cumplø en 127.0.0.1:8765, abre la aplicación
# en el navegador y permite apagar la sesión desde la propia interfaz.
#
# No instala ni configura Ollama. Para la primera configuración en macOS usa:
#   Configurar_Cumplo_macOS.command
# ===========================================================================

set -euo pipefail

PORT="8765"
HOST="127.0.0.1"
URL="http://${HOST}:${PORT}/index.html"

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo ""
  echo " X Python 3 no está instalado o no está en el PATH."
  echo " Cumplø necesita Python 3.8 o posterior para servir los archivos estáticos."
  echo " Instálalo desde https://www.python.org/downloads/"
  echo ""
  exit 1
fi

if ! python3 - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if sys.version_info >= (3, 8) else 1)
PY
then
  echo ""
  echo " X Cumplø necesita Python 3.8 o posterior."
  echo " Versión detectada: $(python3 --version 2>&1)"
  echo ""
  exit 1
fi

# Aviso no bloqueante si Ollama no responde.
if ! curl -s --max-time 1 "http://${HOST}:11434/api/tags" >/dev/null 2>&1; then
  echo ""
  echo " ! Ollama no responde en http://${HOST}:11434"
  echo " Cumplø arrancará igualmente, pero la generación de tareas no funcionará"
  echo " hasta que Ollama esté instalado, abierto y configurado."
  echo " Consulta docs/INSTALAR-OLLAMA.es.md."
  echo ""
fi

# Abrir el navegador en segundo plano.
(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
  fi
) &

# Servir solo en localhost; no exponer en la red.
exec python3 server.py --host "$HOST" --port "$PORT"
