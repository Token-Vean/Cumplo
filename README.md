# Cumplø

Cumplø es una herramienta local, sin nube, para descomponer tareas grandes en pasos accionables usando un modelo de lenguaje ejecutado en este mismo equipo a través de [Ollama](https://ollama.com). Forma parte de una suite local-first orientada a trabajo profesional, planificación y productividad con IA local.

**Versión: 0.7.0-beta** · Beta pública.

## Filosofía

- Funcionamiento totalmente local. Tus tareas no salen del equipo.
- HTML, CSS y JavaScript puro. Sin frameworks, sin CDN, sin build.
- Sin cookies, sin analítica, sin telemetría.
- El estado se guarda en `localStorage` y solo en este navegador; el modo efímero permite trabajar sin persistir tareas.
- Servidor local `server.py` que solo escucha en `127.0.0.1` con cabeceras de seguridad endurecidas (CSP, Permissions-Policy, COOP, CORP) y validación de Host (mitigación DNS rebinding).
- La CSP restringe `connect-src` exclusivamente al origen propio y a `http://localhost:11434` (Ollama). Cumplø no puede llamar a ningún otro servidor.
- La respuesta del modelo se trata como entrada **no confiable**: se parsea, normaliza, recorta longitudes, se acota la profundidad de subtareas y nunca se inserta como HTML.

## Funcionalidades

- Escala de desglose **1–5** para ajustar la granularidad del plan.
- **Desglose por rama**: botón "Desglosar más" por tarea, con su propio nivel 1–5.
- **Emoji por tarea** (asignado por el modelo a partir de lista cerrada).
- **Filtro por emoji** y **buscador por texto** sobre el árbol completo.
- **Toggle "Ocultar completadas"**.
- **Edición inline** de la descripción de cada tarea (sin diálogos modales bloqueantes).
- **Detección dinámica de modelos**: Cumplø descubre los modelos descargados en Ollama y permite elegir el activo.
- **Indicador de estado de Ollama** en la cabecera (verde / rojo / pulsante) y panel de diagnóstico con origen actual, modelos detectados y valor recomendado de `OLLAMA_ORIGINS`.
- **Botón Apagar** que detiene el servidor local desde la propia interfaz.
- **Atajo de teclado**: `Ctrl + Enter` en el textarea para desglosar.
- **Bilingüe ES / EN**, con conmutador y persistencia de idioma.
- **Stylesheet de impresión** para sacar el plan en papel sin botones ni paneles auxiliares.
- Importar y exportar JSON con metadatos de versión (`schema_version`, `app_version`, `exported_at`). Exportar a Markdown.
- **Perfiles**: general, personal, trabajo, investigación doctoral, eventos, formación, archivo y documentación.
- **Modo efímero**: borra el plan persistido y conserva los cambios solo en memoria hasta cerrar o recargar la pestaña.
- **Cancelación de generación**: durante una llamada a Ollama, el botón principal permite abortar la petición.

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

Cumplø es tolerante con planes que no traigan `emoji` o `category`: asigna valores por defecto. La profundidad máxima de anidación admitida es **6 niveles**. Los identificadores internos de tareas se verifican y se regeneran cuando faltan, son inválidos o están duplicados.

## Seguridad (endurecida hasta 0.7.0-beta)

- Servidor solo en `127.0.0.1` (no expuesto a la red).
- **Validación de Host** en todas las respuestas: mitiga DNS rebinding. Un dominio rebound a 127.0.0.1 envía su propio dominio en `Host` y obtiene HTTP 421 (Misdirected Request).
- Cabeceras enviadas por HTTP **y** duplicadas en `<meta>` del HTML:
  - `Content-Security-Policy` estricta (`default-src 'self'`, `connect-src` limitado a Ollama, **sin `'unsafe-inline'`** en `style-src` ni `script-src`).
  - `Permissions-Policy` sin permisos sensibles (camera, geolocation, etc.).
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: no-referrer`.
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
- Endpoints internos (`/__cumplo_health`, `/__cumplo_shutdown`) verifican `Origin` o `Sec-Fetch-Site` para mitigar CSRF.
- Validación regex del nombre de modelo antes de cualquier llamada a Ollama.
- Timeouts y cancelación explícita en llamadas a Ollama (`AbortController`): 2.5 s para detección, 180 s para generación.
- Parseo defensivo del JSON del modelo: longitudes recortadas, número de tareas limitado (80 raíz, 40 subtareas por nivel), profundidad acotada a 6 niveles, identificadores únicos, sin renderizado como HTML.
- `localStorage` con `try/catch` (no rompe en modo privado o con cuota agotada) y modo efímero para evitar persistencia de tareas.
- Límite de importación JSON de 2 MB para evitar bloqueos del navegador por ficheros excesivos.
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
├── prompts.js        # SYSTEM_PROMPT y SYSTEM_PROMPT_BRANCH bilingüe
├── ollama.js         # window.CumploOllama: detect, chat, setActiveModel
├── app.js            # estado, render, handlers, normalización
├── i18n.js           # motor de traducciones inline ES/EN
├── server.py         # servidor local con seguridad endurecida
├── start.sh          # arranque Linux/macOS
├── start.bat         # arranque Windows
├── LICENSE           # MIT
├── README.md
├── CHANGELOG.md
├── assets/
│   ├── cumplo-logo.svg
│   ├── cumplo-brand.png    (logo horizontal optimizado)
│   ├── cumplo-banner.png
│   └── cumplo-favicon.png
├── docs/
│   └── INSTALAR-OLLAMA.es.md
└── examples/
    └── ejemplo-plan.json
```

## Suite local-first

Cumplø es la pieza de **gestión de tareas** de la suite. Las otras piezas:

- **Compo**: composición/asistencia documental local (patrón base de seguridad).
- **Pomo**: motor local de evaluación previa al tratamiento documental.
- **Velo**: detección y redacción de datos sensibles en PDF.
- **PlumA**: asistente de descripción archivística.

Todas comparten: arquitectura local, sin telemetría, sin nube, CSP estricta y conexión exclusiva a Ollama local.

## Licencia

[MIT](LICENSE) — Copyright (c) 2026 Víctor Villapalos Pardiñas.
