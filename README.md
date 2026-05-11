# Cumplø

Cumplø es una herramienta local, sin nube, para descomponer tareas grandes en pasos accionables usando un modelo de lenguaje ejecutado en este mismo equipo a través de [Ollama](https://ollama.com). Está inspirada en el patrón *Magic ToDo* de Goblin Tools.

Versión: **0.3.0**.

## Filosofía

- Funcionamiento totalmente local. Tus tareas no salen del equipo.
- HTML, CSS y JavaScript puro. Sin frameworks, sin CDN, sin build.
- Sin cookies, sin analítica, sin telemetría.
- El estado se guarda en `localStorage` y solo en este navegador.
- Servidor local `server.py` que solo escucha en `127.0.0.1` con cabeceras de seguridad endurecidas (CSP, Permissions-Policy, COOP, CORP).
- La CSP restringe `connect-src` exclusivamente al origen propio y a `http://localhost:11434` (Ollama). Cumplø no puede llamar a ningún otro servidor.
- La respuesta del modelo se trata como entrada **no confiable**: se parsea, normaliza, recorta y nunca se inserta como HTML.

## Funcionalidades

- Escala de desglose **1–5** (peppers) tipo Goblin Tools.
- **Desglose por rama**: botón "✨ Desglosar más" por tarea, con su propio nivel 1–5.
- **Emoji por tarea** (asignado por el modelo a partir de lista cerrada).
- **Filtro por emoji** sobre el árbol completo.
- **Toggle "Ocultar completadas"**.
- **Detección dinámica de modelos**: Cumplø descubre los modelos descargados en Ollama y permite elegir el activo.
- **Indicador de estado de Ollama** en la cabecera (verde / rojo / pulsante).
- **Botón Apagar** que detiene el servidor local desde la propia interfaz.
- Importar y exportar JSON. Exportar a Markdown.
- **Perfiles**: general, personal, trabajo, investigación doctoral, eventos, formación, archivo y documentación.

## Arranque

| Sistema | Comando |
|---|---|
| Windows | doble clic en `start.bat` |
| macOS | `./start.sh` |
| Linux  | `./start.sh` |

El primer arranque solo levanta el servidor local en `127.0.0.1:8765` y abre el navegador. **Cumplø no arranca ni configura Ollama**: Ollama debe estar instalado y corriendo por su cuenta (en Windows se instala como servicio, en macOS como app de barra de menú, en Linux con systemd).

**Antes del primer uso**: configura `OLLAMA_ORIGINS` para permitir el origen `http://127.0.0.1:8765`. Es un ajuste único por equipo y está documentado paso a paso en [`docs/INSTALAR-OLLAMA.es.md`](docs/INSTALAR-OLLAMA.es.md).

## Requisitos

- **Python 3.8+** para servir los ficheros estáticos (`server.py`).
- **Ollama** instalado, corriendo y con `OLLAMA_ORIGINS` configurado.

## Esquema del plan

```json
{
  "title": "string",
  "summary": "string",
  "category": "string corta",
  "difficulty": "baja | media | alta",
  "estimated_total_time": "string",
  "tasks": [
    {
      "id": "string",
      "title": "string",
      "emoji": "string (un solo emoji)",
      "description": "string",
      "estimated_time": "string",
      "energy": "baja | media | alta",
      "done": false,
      "subtasks": []
    }
  ]
}
```

Cumplø es tolerante con planes que no traigan `emoji` o `category`: asigna valores por defecto.

## Seguridad (medidas heredadas del patrón Compo)

- Servidor solo en `127.0.0.1` (no expuesto a la red).
- Cabeceras enviadas por HTTP **y** duplicadas en `<meta>` del HTML:
  - `Content-Security-Policy` estricta (`default-src 'self'`, `connect-src` limitado a Ollama).
  - `Permissions-Policy` sin permisos sensibles (camera, geolocation, etc.).
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: no-referrer`.
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
- Endpoints internos (`/__cumplo_health`, `/__cumplo_shutdown`) verifican `Origin` o `Sec-Fetch-Site` para mitigar CSRF.
- Validación regex del nombre de modelo antes de cualquier llamada a Ollama.
- Timeouts en todas las llamadas (`AbortController`): 2.5 s para detección, 180 s para generación.
- Parseo defensivo del JSON del modelo: longitudes recortadas, número de tareas limitado, sin renderizado como HTML.
- Header `Server:` sin versión específica (reduce fingerprinting).

## Limitaciones

- No tiene sincronización entre dispositivos.
- No hay base de datos ni autenticación.
- No incluye adjuntos.
- La calidad del desglose depende del modelo local.

## Estructura del repositorio

```
cumplo/
├── index.html
├── styles.css
├── prompts.js        # SYSTEM_PROMPT y SYSTEM_PROMPT_BRANCH
├── ollama.js         # window.CumploOllama: detect, chat, setActiveModel
├── app.js            # estado, render, handlers, normalización
├── server.py         # servidor local con seguridad endurecida
├── start.sh          # arranque Linux/macOS
├── start.bat         # arranque Windows
├── README.md
├── CHANGELOG.md
├── assets/
│   └── cumplo-logo.svg
├── docs/
│   └── INSTALAR-OLLAMA.es.md
└── examples/
    └── ejemplo-plan.json
```

## Notas

- El patrón de seguridad y arquitectura está derivado de [Compo v0.1.13](https://github.com/vvillapalosUCM/) — gracias a esa base por resolver de antemano los problemas de CORS, CSP y arranque limpio en Windows.

## Licencia

Pendiente de definir.
