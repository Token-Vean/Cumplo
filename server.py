#!/usr/bin/env python3
"""
Cumplø · servidor local

Servidor HTTP estático limitado a localhost con dos endpoints internos
(/__cumplo_health, /__cumplo_shutdown). No expone Cumplø en la red y no
requiere dependencias externas.

Patrón derivado de Compo v0.1.13:
- Verificación de Origin / Sec-Fetch-Site en los endpoints internos.
- Cabeceras de seguridad endurecidas: CSP, Permissions-Policy,
  Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy.
- El header Server: no revela versión específica.
- Mensaje claro si el puerto está ocupado, sin stack trace.
- Comprobación de versión mínima de Python.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

__version__ = "0.5.0"

# Versión mínima de Python.
if sys.version_info < (3, 8):
    sys.stderr.write(
        "Cumplo requires Python 3.8 or later. "
        f"Detected: {sys.version.split()[0]}\n"
    )
    sys.exit(1)

# Orígenes considerados propios de Cumplø.
ALLOWED_ORIGINS_TEMPLATE = (
    "http://localhost:{port}",
    "http://127.0.0.1:{port}",
)

# Content Security Policy. Solo permitimos conectar a Ollama en su puerto
# habitual (11434) y al propio origen. Sin scripts/imágenes externas.
CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self' data:; "
    "connect-src 'self' http://localhost:11434 http://127.0.0.1:11434; "
    "font-src 'self'; "
    "form-action 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "object-src 'none'"
)

# Permissions-Policy: una app local no necesita ninguna API sensible.
PERMISSIONS_POLICY = (
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
    "magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()"
)


def _is_allowed_origin(value, allowed):
    if not value:
        return False
    return value in allowed


class CumploServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    allowed_origins = ()


class CumploHandler(SimpleHTTPRequestHandler):
    server_version = "CumploLocalHTTP"
    sys_version = ""

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", PERMISSIONS_POLICY)
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Content-Security-Policy", CSP)
        super().end_headers()

    def _origin_ok(self):
        """Acepta endpoints internos solo si Origin o Sec-Fetch-Site demuestran
        que la petición sale del propio Cumplø (mitigación CSRF)."""
        allowed = self.server.allowed_origins
        origin = self.headers.get("Origin")
        sfs = self.headers.get("Sec-Fetch-Site")

        if origin is not None:
            return _is_allowed_origin(origin, allowed)
        if sfs == "same-origin":
            return True
        return False

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/__cumplo_health":
            if not self._origin_ok():
                self.send_error(403, "Forbidden")
                return
            self._send_json({"ok": True, "app": "Cumplo", "version": __version__})
            return
        # Si la raíz es /, servir index.html.
        if path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path != "/__cumplo_shutdown":
            self.send_error(404, "Not found")
            return

        if not self._origin_ok():
            self._send_json({"ok": False, "error": "forbidden_origin"}, status=403)
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(min(length, 4096))

        self._send_json({
            "ok": True,
            "message": "Cumplo local server is shutting down. You can close this browser tab."
        })

        def stop():
            print(
                "\n  Cumplo: apagado solicitado desde la interfaz. Cerrando servidor local...\n",
                flush=True,
            )
            self.server.shutdown()

        threading.Timer(0.35, stop).start()

    def log_message(self, fmt, *args):
        try:
            line = fmt % args
        except Exception:
            line = fmt
        print("  [Cumplo] " + line, flush=True)


def _bind_server(host, port, handler):
    try:
        return CumploServer((host, port), handler)
    except OSError as exc:
        if exc.errno in (98, 48, 10048):  # EADDRINUSE Linux / macOS / Windows
            sys.stderr.write(
                f"\n  X El puerto {port} ya esta en uso.\n"
                f"    Otra instancia de Cumplo (o de algun otro programa) esta\n"
                f"    escuchando en ese puerto. Cierra esa instancia o arranca\n"
                f"    Cumplo en otro puerto:\n\n"
                f"      python server.py --port 8766\n\n"
            )
            sys.exit(2)
        raise


def main():
    parser = argparse.ArgumentParser(description="Servidor local de Cumplo")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    if args.host not in ("127.0.0.1", "localhost"):
        sys.stderr.write(
            f"\n  !  Atencion: vinculando a {args.host} en lugar de 127.0.0.1.\n"
            f"     Cumplo esta pensada para uso local. Vincular a otra interfaz\n"
            f"     expone la aplicacion a tu red local; no se recomienda.\n\n"
        )

    root = Path(__file__).resolve().parent
    os.chdir(root)

    server = _bind_server(args.host, args.port, CumploHandler)
    server.allowed_origins = tuple(
        tpl.format(port=args.port) for tpl in ALLOWED_ORIGINS_TEMPLATE
    )

    url = f"http://{args.host}:{args.port}/index.html"
    print("", flush=True)
    print("  Cumplo - servidor local", flush=True)
    print("  -----------------------", flush=True)
    print(f"  URL:     {url}", flush=True)
    print(f"  Puerto:  {args.port}", flush=True)
    print(f"  Version: {__version__}", flush=True)
    print("", flush=True)
    print("  Puedes apagar Cumplo desde la interfaz o con Ctrl+C.", flush=True)
    print("", flush=True)

    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\n  Cumplo: apagado manual con Ctrl+C.\n", flush=True)
    finally:
        try:
            server.server_close()
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
