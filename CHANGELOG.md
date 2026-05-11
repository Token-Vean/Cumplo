# Changelog

## 0.5.0 — Bilingüe ES/EN

### Idioma de la herramienta

- Nuevo módulo `i18n.js` con diccionarios inline para español e inglés (sin fetch, sin async, sin condición de carrera con la CSP).
- Conmutador **ES / EN** en la cabecera. La elección se persiste en `localStorage` (clave `cumplo_lang`). Idioma por defecto: el del navegador, con fallback a español.
- Todo el texto visible está traducido: cabecera, paneles, diálogos (Configuración, Exportar, Desglosar), estados de Ollama, botones de acción de cada tarjeta, mensajes de estado/error, confirmaciones (`confirm()` / `prompt()`).
- Atributos HTML soportados por el motor de traducción: `data-i18n` (textContent), `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label`.

### El modelo responde en el idioma elegido

- `prompts.js` parametrizado por idioma: `buildSystemPrompt(lang)`, `buildUserPrompt({..., lang})`, equivalentes para "branch".
- Cada llamada al modelo lleva una directiva explícita "Respond exclusively in Spanish/English. All field values MUST be written in [lang]".
- `PROFILE_INSTRUCTIONS` y `SPICE_INSTRUCTIONS` ahora son objetos bilingües; el granularity y el profile que entran al prompt se escriben en el idioma elegido.
- El esquema JSON solicitado al modelo ajusta los enums según el idioma: `baja|media|alta` en español, `low|medium|high` en inglés. La normalización de energy/difficulty en `app.js` acepta ambos vocabularios.

### Otros

- Eliminado el bloque "Sobre Cumplø" del panel de utilidades, según petición.
- Los `pill` de tiempo y energía, el contador de tareas y los nombres de las meta-cards (Plan, Categoría, Dificultad, Tiempo total) se re-renderizan al cambiar idioma sin recargar la página.

## 0.4.0 — Identidad visual y acciones de plan

### Identidad

- **Logo original integrado**: banner naranja "Cumplø — Goal breakdown assistant" en la cabecera y favicon cuadrado del mismo logo (`assets/cumplo-banner.png` y `assets/cumplo-favicon.png`).
- Eliminado el placeholder SVG anterior. Bloque "eyebrow + h1 + subtitle" sustituido por el banner real.

### Acciones de plan en la cabecera

- Nuevo botón **"Nuevo plan"** en la cabecera. Pide confirmación y descarta solo las tareas actuales; conserva el modelo activo, la temperatura y demás preferencias.
- Nuevo botón **"Exportar"** en la cabecera, que abre un diálogo con tres acciones agrupadas: descargar como Markdown (.md), descargar como JSON (.json), o importar un plan desde un JSON existente. Antes estaban escondidas en el panel inferior de utilidades.
- El panel inferior se renombra a **"Información y reset"**. Mantiene solo **"Borrar todos los datos"** (reset total: tareas + modelo activo + preferencias), claramente distinto del "Nuevo plan" del header.
- El reset total ahora también limpia la preferencia de modelo activo guardada por `CumploOllama` y las claves legacy de tareas-locales.

### Otros

- Layout de cabecera reorganizado: banner del logo + subtítulo a la izquierda, botones de estado/acciones a la derecha.

## 0.3.1 — Layout de tarjetas

- Las acciones de cada tarea ("✨ Desglosar más", "+ Subtarea", "Editar descripción", "Borrar") ya no comparten fila con el título: pasan a una fila propia en la parte inferior de la tarjeta, separadas por un divisor discreto. Evita que los botones tapen el título cuando este es largo.

## 0.3.0 — Arquitectura tipo Compo

Reescritura del arranque y de la conexión con Ollama siguiendo el patrón de Compo v0.1.13, que ya estaba probado en el entorno habitual de uso. Resuelve el problema de "no se conecta con Ollama" que aparecía en Windows con v0.2.x.

### Diagnóstico del problema de v0.2.x

El script de arranque intentaba ejecutar `ollama serve` con `OLLAMA_ORIGINS="*"`. En Windows Ollama ya corre como servicio (lo instala así su instalador), por lo que el segundo proceso colisionaba en el puerto 11434 y nunca llegaba a responder. Resultado: timeout de 15 s y aplicación inservible.

### Cambios estructurales

- **Nuevo `server.py`**: servidor estático en Python con CSP, Permissions-Policy, COOP/CORP y endpoints internos `/__cumplo_health` y `/__cumplo_shutdown` (con verificación de Origin para CSRF). Solo escucha en `127.0.0.1`.
- **`start.bat` simplificado**: `chcp 65001` para UTF-8, lanza `python server.py`, abre el navegador. **No toca Ollama**.
- **`start.sh` simplificado**: equivalente para Linux/macOS. Avisa si Ollama no responde, pero no intenta arrancarlo.
- **`start.ps1` eliminado**: ya no era necesario; `start.bat` basta.

### Cliente Ollama reescrito (`ollama.js`)

- Namespace global `window.CumploOllama` (antes funciones sueltas).
- `detect()` con `AbortController` y timeout de 2.5 s.
- `chat({ system, user, options })` con timeout de 180 s.
- **Detección dinámica de modelos**: enumera los modelos descargados con `/api/tags` y permite al usuario elegir el activo desde Configuración. Ya no se fija un modelo concreto en código.
- `pickDefaultModel()` con preferencia: `gemma3n:e2b` → `gemma4:e2b` → `qwen2.5:7b-instruct` → primero disponible.
- Validación regex del nombre de modelo (`MODEL_NAME_RE`).
- Mensajes de error diferenciados por tipo (`AbortError`, `TypeError`, HTTP 4xx/5xx).
- Eventos `cumplo:ollama-changed` para que la UI reaccione al cambio de estado.

### UI

- **Indicador de estado de Ollama** en la cabecera: pulsante mientras detecta, verde cuando funciona, rojo con tooltip cuando falla.
- **Botón "Apagar"** en la cabecera, llama a `/__cumplo_shutdown` y deja la pestaña con un mensaje de cierre.
- **Configuración** simplificada: ya no hay campo de endpoint; el modelo es un `<select>` con los modelos detectados; botón "Reintentar detección".
- CSP en `<meta>` del HTML para reforzar la del servidor.
- Logo SVG actualizado (Ø grande con check tenue).

### Conexión con Ollama

- **Endpoint fijo** en `http://localhost:11434`. No es configurable desde la UI (mantener la CSP estricta lo requiere).
- **`OLLAMA_ORIGINS`** se documenta como ajuste único del sistema operativo, con valor específico `http://127.0.0.1:8765,http://localhost:8765` (NUNCA `*`).
- Documentación detallada en `docs/INSTALAR-OLLAMA.es.md` con pasos para Windows, macOS y Linux.

### Correcciones colaterales

- **Encoding UTF-8 en CMD** (`chcp 65001` al inicio de `start.bat`): los caracteres `ø`, acentos, viñetas se renderizan correctamente.
- **Sin `format: "json"`** en las llamadas: modelos pequeños lo rompían. El parser tolerante de `extractJson` cubre los casos.
- Bug del `index.html` raíz: `server.py` redirige `/` a `/index.html` para acceso directo a `http://127.0.0.1:8765/`.

## 0.2.x — descartadas

Las versiones 0.2.0 y 0.2.1 quedan superadas por 0.3.0. El intento de arrancar Ollama desde el script no era viable en Windows.

## 0.1.0 — tareas-locales (origen)

Versión inicial bajo el nombre `tareas-locales`, base de funcionalidad: HTML estático + Ollama + localStorage + exportación a Markdown/JSON.
