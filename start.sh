#!/usr/bin/env bash
# ===========================================================================
# Cumplø · Arranque Linux/macOS
# Levanta el servidor local de Cumplø en 127.0.0.1:8765, abre la aplicación
# y permite apagar la sesión desde la propia interfaz.
# No arranca ni configura Ollama: Ollama debe estar instalado y corriendo
# por su cuenta. La conexión entre Cumplø y Ollama requiere configurar la
# variable OLLAMA_ORIGINS una vez. Lee docs/INSTALAR-OLLAMA.es.md.
# ===========================================================================

set -e

PORT=8765
HOST=127.0.0.1
URL="http://${HOST}:${PORT}/index.html"

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo ""
  echo "  ✗ Python 3 no está instalado o no está en el PATH."
  echo "    Cumplø necesita Python 3 para servir los archivos estáticos."
  echo "    Instálalo desde https://www.python.org/downloads/ o con tu gestor"
  echo "    de paquetes (apt install python3 / brew install python3 / etc.)."
  echo ""
  exit 1
fi

# Aviso (sin bloquear) si Ollama no responde.
if ! curl -s --max-time 1 "http://${HOST}:11434/api/tags" >/dev/null 2>&1; then
  echo ""
  echo "  ⚠  Ollama no responde en http://${HOST}:11434"
  echo "     Cumplø arrancará igualmente, pero la generación de tareas no"
  echo "     funcionará hasta que Ollama esté en marcha. Consulta"
  echo "     docs/INSTALAR-OLLAMA.es.md."
  echo ""
fi

# Abrir el navegador en segundo plano.
( sleep 1 && {
  if   command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  elif command -v open      >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1
  fi
} ) &

# Servir solo en localhost (no exponer en la red).
exec python3 server.py --host "$HOST" --port "$PORT"
