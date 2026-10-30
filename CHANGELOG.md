# Changelog

## Sin publicar

### Licencia

- Cumplø pasa de MIT a **AGPL-3.0-or-later**, la misma licencia que el resto de la suite Token&Vean. `LICENSE` contiene el texto íntegro de la AGPL-3.0 y el pie de la interfaz lo indica. Las versiones publicadas hasta la 0.8.8 se distribuyeron bajo MIT y conservan esa licencia.

## 0.8.1-beta — Seguridad, datos canónicos y robustez de generación

### Seguridad

- El servidor nunca sirve rutas ocultas: cualquier segmento que empiece por punto (`.git/`, `.env`, `.gitignore`…) devuelve 404, aunque exista en el directorio de instalación.
- Las peticiones **HEAD** pasan ahora por la misma validación de Host que GET y POST; antes eludían la mitigación de DNS rebinding.
- Eliminado `os.chdir()`: el directorio raíz se inyecta en el handler (`directory=`), de modo que el proceso no retiene la carpeta de instalación en Windows.
- `Cache-Control: no-cache` en los estáticos: tras actualizar Cumplø, el navegador revalida `app.js`/`index.html` en lugar de servir versiones antiguas cacheadas.
- Límite duro de 2.000.000 de caracteres a la respuesta del modelo: una generación desbocada se aborta en vez de bloquear la pestaña en `JSON.parse`.
- La temperatura se valida y acota a `[0, 2]`; entradas vacías o no numéricas recuperan el valor por defecto en lugar de propagar `NaN` u `0` involuntarios.

### Añadido

- **Generación en streaming**: la interfaz muestra el progreso (caracteres recibidos) y el timeout pasa a ser de inactividad (2 min sin datos nuevos) en lugar de un tope global arbitrario.
- **Salida estructurada**: la petición a Ollama incluye un JSON Schema (`format`) que restringe la generación al esquema esperado. Si la versión local de Ollama no lo soporta (HTTP 400), se reintenta automáticamente sin él.
- **Reintento de reparación**: si la respuesta no parsea como JSON, se reintenta una única vez con temperatura 0 e instrucción reforzada antes de mostrar error.
- **Deshacer (Ctrl+Z)**: hasta 30 instantáneas de la biblioteca, tomadas antes de aplicar una generación, desglosar una rama, borrar una tarea o proyecto e importar.
- **Confirmación al regenerar**: descomponer sobre un proyecto que ya tiene contenido pide confirmación en lugar de sustituirlo en silencio.
- **Sincronización multi-pestaña**: si otra pestaña guarda cambios, la biblioteca se recarga aquí en lugar de pisarse mutuamente (last-write-wins silencioso).
- **Preservación de foco**: al re-renderizar, el foco de teclado y la selección de texto se restauran (checkboxes, títulos, plegado). Relevante para uso con teclado y lector de pantalla.
- **Suite de tests** sin dependencias (`node --test tests/`), integrada en el workflow de CI.

### Cambiado

- **Valores canónicos**: `energy` y `difficulty` se almacenan siempre como `low | medium | high` (o vacío si se desconoce) y se traducen únicamente al renderizar y exportar a Markdown. Los datos heredados en español o inglés migran automáticamente al cargar o importar. Esto elimina la mezcla de idiomas en bibliotecas usadas alternando ES/EN.
- El límite de 250 proyectos se aplica **en escritura** (importar, crear, duplicar) con aviso explícito; antes el exceso se truncaba en silencio al recargar la página.
- La recomendación de `OLLAMA_ORIGINS` del panel de diagnóstico se deriva del origen real de la página, por lo que es correcta también al arrancar con `--port` distinto de 8765.

## 0.8.0-beta — Gestión local de proyectos

### Añadido

- Nueva jerarquía funcional: **Proyecto → Tareas → Subtareas**.
- Panel lateral de **proyectos guardados** con búsqueda, selección y contador de activos/archivados.
- Acciones de proyecto: **renombrar**, **duplicar**, **archivar/restaurar** y **eliminar**.
- Persistencia local de múltiples proyectos en `localStorage` mediante el esquema `cumplo.projects.v2`.
- Migración automática desde el esquema anterior de plan único (`cumplo_state_v1`).
- Exportación del proyecto actual en JSON (`cumplo.project.v2`) y exportación completa de la biblioteca de proyectos en JSON (`cumplo.projects.v2`).
- Importación de uno o varios proyectos desde JSON sin sobrescribir los ya existentes.
- Workflows de repositorio para checks básicos de seguridad y sintaxis.

### Cambiado

- La interfaz deja de hablar de “plan” como unidad principal y adopta “proyecto” como entidad superior.
- El prompt interno de Ollama fuerza una estructura de dos niveles bajo proyecto: tareas y subtareas.
- El botón principal pasa a **Descomponer proyecto**.
- El modo efímero afecta a la biblioteca de proyectos completa, no solo a un plan activo.
- El límite de profundidad se reduce al modelo funcional previsto: tareas y subtareas.

### Compatibilidad

- Los JSON antiguos con envoltorio `plan` siguen pudiendo importarse como proyectos.
- Si el navegador contiene datos de la versión 0.7, Cumplø crea un proyecto recuperado y lo incorpora a la biblioteca local.

## 0.7.0-beta — Beta pública: privacidad, control de generación y marca original

### Privacidad y persistencia

- Añadido **modo efímero**: el usuario puede trabajar sin persistir tareas en `localStorage`. Al activarlo, Cumplø borra el plan guardado y mantiene los cambios solo en memoria hasta cerrar o recargar la pestaña.
- El guardado del estado respeta el modo efímero y elimina restos de claves heredadas del plan.

### Robustez funcional

- Añadida normalización de **identificadores internos únicos** para tareas y subtareas. Si el modelo o un JSON importado aporta IDs repetidos, inválidos o vacíos, Cumplø los regenera antes de renderizar y antes de operar sobre el árbol.
- Añadido límite de importación JSON de **2 MB** para evitar bloqueos del navegador por ficheros excesivos.
- La exportación JSON incorpora metadatos: `schema_version`, `app_version`, `exported_at` y `plan`. La importación mantiene compatibilidad con el esquema anterior sin envoltorio.

### Control de generación

- Añadida **cancelación explícita** de generación principal y de desglose por rama mediante `AbortController`.
- Los botones de generación cambian a modo cancelación durante la petición a Ollama y muestran estado de cancelación claro.

### Diagnóstico de Ollama

- Añadido panel de diagnóstico en la sección de ayuda: estado, número de modelos detectados, modelo activo, origen actual, valor recomendado de `OLLAMA_ORIGINS` y último error conocido.
- Añadido botón de reintento de detección fuera del diálogo de configuración.

### Interfaz y marca

- Incorporado el logo horizontal original de Cumplø como imagen optimizada (`assets/cumplo-brand.png`).
- Ajuste visual a una apariencia más profesional: cabecera tipo producto, superficies neutras, acento naranja de marca, tarjetas más ejecutivas y estados de cancelación.
- Mejora menor de accesibilidad: `aria-label` en checkboxes y títulos editables, `aria-expanded` en toggles.

### Distribución Windows

- `start.bat` usa `python` si está disponible y, como alternativa, `py -3`. También verifica Python 3.8+ antes de arrancar.

### Marca y documentación

- Eliminadas las menciones a herramientas externas de desglose de tareas en README y prompts. Cumplø queda descrito como herramienta propia de planificación local-first.

---

## 0.6.0-beta — Beta definitiva: refuerzo de seguridad, edición inline y diseño profesional

### Seguridad

- **Validación de Host en `server.py`**: todas las peticiones (incluidas las de ficheros estáticos) verifican que el header `Host` coincida con `127.0.0.1:<port>` o `localhost:<port>`. Mitiga DNS rebinding: una página maliciosa con un dominio rebound a 127.0.0.1 envía su propio dominio en `Host` y recibe HTTP 421 (Misdirected Request). Antes solo lo verificaban los endpoints internos.
- **CSP coherente con el código**: eliminados los tres usos de `style="..."` inline (`index.html` × 2 y la pantalla de apagado en `app.js`) que violaban silenciosamente la CSP `style-src 'self'`. Sustituidos por clases CSS (`spacer-top-sm`, `spacer-top-md`, `shutdown-screen`).
- **`normalizeTask` con `MAX_DEPTH = 6`**: cota dura de anidación. Un JSON importado con anidación patológica ya no provoca stack overflow al normalizar ni al renderizar.
- **`saveState` y `saveSettings` con `try/catch`**: tolera `QuotaExceededError`, navegación privada y cualquier escenario donde `localStorage` no acepte escrituras. Muestra un mensaje claro en el status box en lugar de fallar silenciosamente.
- **Pantalla de apagado construida con `createElement`** en lugar de `innerHTML` con template literal: respeta la CSP estricta y elimina la última superficie de inyección desde traducciones (aunque las traducciones son inline y controladas, la práctica defensiva queda completa).

### Diseño visual profesional

- **Sistema de tokens de diseño** en `:root`: paleta sage/crema refinada, escala de spacing 4px (`--sp-1` a `--sp-12`), escala tipográfica 12/13/14/15/16/18/22/28/36 con line-heights nombrados, escala de sombras (`--shadow-xs`/`sm`/`md`/`lg`) y de radios (`--radius-xs`/`sm`/`md`/`lg`).
- **Logo SVG sage** en lugar del banner naranja PNG (`cumplo-banner.png`): el banner queda en `assets/` por compatibilidad pero ya no se usa. Coherente con el resto de la suite (Compo, Pomo).
- **Cabecera reestructurada**: marca + título + subtítulo a la izquierda con jerarquía tipográfica clara; chips de estado y acciones agrupados a la derecha.
- **Sistema unificado de botones**: `btn-primary`, `btn-secondary`, `btn-tertiary`, `btn-ghost`, `btn-danger` con estados hover/focus/disabled consistentes. Sustituye al conjunto heterogéneo anterior (`primary-btn`, `secondary-btn`, `danger-btn`).
- **Tarjetas de tarea**: grid de 3 columnas para checkbox + toggle + contenido, con fila de acciones separada por divisor punteado discreto. Las tareas completadas atenúan título y descripción.
- **Estado vacío** con patrón sutil y borde punteado en lugar de panel plano.
- **Indicador de Ollama**: chip redondeado con estados coloreados (verde/rojo/pulsante ámbar) y mensaje contextual.
- **Diálogos** con backdrop con `backdrop-filter` y sombra profunda; acciones separadas por divisor sutil.
- **Footer** con marca, versión leída del propio `/__cumplo_health` y tagline.

### Funcionalidades nuevas

- **Edición inline de descripción**: al pulsar "Editar descripción" la tarjeta despliega un `<textarea>` dentro de la propia tarjeta, con botones Guardar/Cancelar y atajos `Ctrl/Cmd + Enter` (guardar) y `Esc` (cancelar). Sustituye al `prompt()` nativo, que era mono-línea y bloqueante.
- **Filtro por texto** en la barra superior del panel de tareas: busca de forma incremental (debounced 150 ms) en títulos y descripciones de toda la jerarquía. Compatible con el filtro por emoji.
- **Atajo de teclado** `Ctrl/Cmd + Enter` en el textarea principal para disparar "Desglosar tarea".
- **Versión visible en el footer**: leída en runtime desde `/__cumplo_health` del propio servidor local; un solo punto de verdad.
- **Stylesheet de impresión** (`@media print`): oculta cabecera, paneles laterales, formularios y botones; expande todo el árbol; usa contraste alto en tinta; añade pie de página "Cumplø — plan impreso · local · sin nube". Pensado para sacar planes a papel sin más maquetación.

### Rendimiento y robustez

- **Debounce de 300 ms** al guardar el título de tarea: deja de serializar todo el plan a `localStorage` en cada tecla. `blur` fuerza el guardado inmediato.
- Recursión de `normalizeBranch` arrancando en `depth=1` (las subtareas devueltas por el modelo en una expansión por rama son por definición hijas de otra tarea, así que ya consumen un nivel).
- Manejo defensivo de `localStorage.removeItem` en el reset total (no rompe si el navegador no permite escrituras).

### Licencia

- Cumplø se publica bajo licencia **MIT** (fichero `LICENSE`). Hasta 0.5.0 figuraba como "pendiente de definir".

### Documentación

- README sincronizado a 0.6.0-beta. Listado completo de funcionalidades reordenado. Sección de seguridad ampliada con la mitigación de DNS rebinding y la cota de profundidad.
- Encaje explícito en la suite local-first (Compo, Pomo, Velo, PlumA).

---

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
