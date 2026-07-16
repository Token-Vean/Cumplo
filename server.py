#!/usr/bin/env python3
"""
Cumplø · servidor local

Servidor HTTP estático limitado a localhost con dos endpoints internos
(`/__cumplo_health`, `/__cumplo_shutdown`). No expone Cumplø en la red y no
requiere dependencias externas.

Patrón derivado de Compo v0.1.13, endurecido hasta 0.8.1-beta:
- Verificación de Origin / Sec-Fetch-Site en los endpoints internos.
- Validación de Host en todas las respuestas (mitiga DNS rebinding),
  incluida ahora también en peticiones HEAD.
- Cabeceras de seguridad endurecidas: CSP, Permissions-Policy,
  Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy.
- Bloqueo de rutas ocultas: nunca se sirven ficheros ni directorios cuyo
  nombre empiece por punto (.git, .env, .gitignore, etc.).
- `Cache-Control: no-cache` en los estáticos para que las actualizaciones
  de la aplicación no queden atrapadas en la caché del navegador.
- Sin `os.chdir()`: el directorio raíz se pasa al handler, de modo que el
  proceso no retiene la carpeta de instalación (bloqueo de carpetas en
  Windows).
- El header Server no revela versión específica.
- Mensaje claro si el puerto está ocupado, sin stack trace.
- Comprobación de versión mínima de Python.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

__version__ = "0.8.1-beta"

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

# Hosts permitidos en el header Host. Mitiga DNS rebinding: si una página
# maliciosa intenta hablar con 127.0.0.1 a través de un dominio rebound, el
# header Host llevará su dominio y no coincidirá con esta lista.
ALLOWED_HOSTS_TEMPLATE = (
    "127.0.0.1:{port}",
    "localhost:{port}",
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


def _is_allowed_origin(value: str | None, allowed: tuple[str, ...]) -> bool:
    if not value:
        return False
    return value in allowed


def _has_hidden_segment(path: str) -> bool:
    """
    True si alguna parte de la ruta empieza por punto: /.git/config,
    /docs/.secreto, /.env… Estas rutas nunca se sirven, aunque existan en
    el directorio raíz (defensa en profundidad frente a residuos de
    desarrollo empaquetados por error).
    """
    clean = path.split("?", 1)[0].split("#", 1)[0]
    return any(segment.startswith(".") for segment in clean.split("/") if segment)


class CumploServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    allowed_origins: tuple[str, ...] = ()
    allowed_hosts: tuple[str, ...] = ()


class CumploHandler(SimpleHTTPRequestHandler):
    server_version = "CumploLocalHTTP"
    sys_version = ""

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", PERMISSIONS_POLICY)
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Content-Security-Policy", CSP)
        # Los endpoints JSON envían su propio Cache-Control: no-store y marcan
        # _cache_header_sent. Para el resto (estáticos), no-cache obliga a
        # revalidar y evita servir app.js/index.html obsoletos tras actualizar.
        if not getattr(self, "_cache_header_sent", False):
            self.send_header("Cache-Control", "no-cache")
        self._cache_header_sent = False
        super().end_headers()

    def _host_ok(self) -> bool:
        """
        Valida que el header Host venga de una de las direcciones esperadas
        (mitigación de DNS rebinding). Una página maliciosa rebound a
        127.0.0.1 seguiría enviando su propio dominio en Host.
        """
        host = (self.headers.get("Host") or "").strip().lower()
        if not host:
            return False
        return host in self.server.allowed_hosts

    def _origin_ok(self) -> bool:
        """
        Acepta endpoints internos solo si Origin o Sec-Fetch-Site demuestran
        que la petición sale del propio Cumplø (mitigación CSRF).
        """
        allowed = self.server.allowed_origins
        origin = self.headers.get("Origin")
        sec_fetch_site = self.headers.get("Sec-Fetch-Site")
        if origin is not None:
            return _is_allowed_origin(origin, allowed)
        if sec_fetch_site == "same-origin":
            return True
        return False

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self._cache_header_sent = True
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _static_guard(self) -> bool:
        """Comprobaciones comunes a GET y HEAD. Devuelve False si ya respondió."""
        if not self._host_ok():
            self.send_error(421, "Misdirected Request")
            return False
        if _has_hidden_segment(self.path):
            self.send_error(404, "Not found")
            return False
        return True

    def do_GET(self) -> None:  # noqa: N802
        if not self._static_guard():
            return

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

    def do_HEAD(self) -> None:  # noqa: N802
        # HEAD comparte las mismas defensas que GET (antes las eludía).
        if not self._static_guard():
            return
        if self.path.split("?", 1)[0] == "/":
            self.path = "/index.html"
        super().do_HEAD()

    def do_POST(self) -> None:  # noqa: N802
        # Defensa DNS rebinding también en POST.
        if not self._host_ok():
            self.send_error(421, "Misdirected Request")
            return

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

        self._send_json(
            {
                "ok": True,
                "message": "Cumplo local server is shutting down. You can close this browser tab.",
            }
        )

        def stop() -> None:
            print(
                "\n Cumplo: apagado solicitado desde la interfaz. Cerrando servidor local...\n",
                flush=True,
            )
            self.server.shutdown()

        threading.Timer(0.35, stop).start()

    def log_message(self, fmt: str, *args) -> None:
        try:
            line = fmt % args
        except Exception:
            line = fmt
        print(" [Cumplo] " + line, flush=True)


def _bind_server(host: str, port: int, handler) -> CumploServer:
    try:
        return CumploServer((host, port), handler)
    except OSError as exc:
        if exc.errno in (98, 48, 10048):  # EADDRINUSE Linux / macOS / Windows
            sys.stderr.write(
                f"\n X El puerto {port} ya está en uso.\n"
                " Otra instancia de Cumplø (o de algún otro programa) está\n"
                " escuchando en ese puerto. Cierra esa instancia o arranca\n"
                " Cumplø en otro puerto:\n\n"
                " python server.py --port 8766\n\n"
            )
            sys.exit(2)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Servidor local de Cumplø")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    if args.host not in ("127.0.0.1", "localhost"):
        sys.stderr.write(
            f"\n ! Atención: vinculando a {args.host} en lugar de 127.0.0.1.\n"
            " Cumplø está pensada para uso local. Vincular a otra interfaz\n"
            " expone la aplicación a tu red local; no se recomienda.\n\n"
        )

    root = Path(__file__).resolve().parent

    # Sin os.chdir(): el directorio raíz se inyecta en el handler. El proceso
    # no retiene la carpeta de instalación (evita el bloqueo de carpeta en
    # Windows corregido originalmente en la rama 0.8.6).
    handler = partial(CumploHandler, directory=str(root))

    server = _bind_server(args.host, args.port, handler)
    server.allowed_origins = tuple(
        template.format(port=args.port) for template in ALLOWED_ORIGINS_TEMPLATE
    )
    server.allowed_hosts = tuple(
        template.format(port=args.port) for template in ALLOWED_HOSTS_TEMPLATE
    )

    url = f"http://{args.host}:{args.port}/index.html"
    print("", flush=True)
    print(" Cumplø - servidor local", flush=True)
    print(" -----------------------", flush=True)
    print(f" URL: {url}", flush=True)
    print(f" Puerto: {args.port}", flush=True)
    print(f" Versión: {__version__}", flush=True)
    print("", flush=True)
    print(" Puedes apagar Cumplø desde la interfaz o con Ctrl+C.", flush=True)
    print("", flush=True)

    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\n Cumplø: apagado manual con Ctrl+C.\n", flush=True)
    finally:
        try:
            server.server_close()
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
