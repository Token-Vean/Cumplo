/* ===========================================================================
   Cumplø · i18n
   Motor de traducciones síncrono. Diccionarios inline para máxima fiabilidad
   en local (sin fetch, sin async, sin condición de carrera con la CSP).

   Uso:
     I18N.t('header.newPlan')                 → "Nuevo plan" / "New plan"
     I18N.t('status.exported', {file: 'x.md'})→ con sustitución de {file}
     I18N.set('en')                           → cambia idioma y re-aplica al DOM
     I18N.apply()                             → recorre el DOM y traduce

   Atributos HTML soportados:
     data-i18n="key"                  → reemplaza textContent
     data-i18n-placeholder="key"      → reemplaza placeholder
     data-i18n-title="key"            → reemplaza title
     data-i18n-aria-label="key"       → reemplaza aria-label
   =========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'cumplo_lang';
  const FALLBACK = 'es';
  const SUPPORTED = ['es', 'en'];

  const dict = {
    es: {
      // App / meta
      'app.title':                'Cumplø — Desglose local de tareas con Ollama',
      'app.lang.html':            'es',

      // Header
      'header.subtitle':          'Descompón tareas grandes en pasos pequeños, ordenados y editables. Todo en local, sin enviar nada a la nube.',
      'header.newPlan':           'Nuevo plan',
      'header.newPlan.title':     'Borrar las tareas actuales y empezar de nuevo',
      'header.export':            'Exportar',
      'header.export.title':      'Descargar el plan en Markdown o JSON',
      'header.settings':          'Configuración',
      'header.shutdown':          'Apagar',
      'header.shutdown.title':    'Apagar el servidor local de Cumplø',
      'header.lang.es':           'ES',
      'header.lang.en':           'EN',
      'header.lang.switch':       'Cambiar idioma',

      // Ollama status
      'ollama.checking':          'Comprobando Ollama…',
      'ollama.notDetected':       'Ollama no detectado',
      'ollama.notDetected.title': 'Pulsa Configuración → Reintentar detección.',
      'ollama.noModel':           'Ollama · sin modelos descargados',
      'ollama.someModels':        'Ollama · {count} modelo(s) disponibles',
      'ollama.activeModel':       'Ollama · {model}',
      'ollama.detectedCount':     '{count} modelos detectados.',

      // Composer panel
      'composer.title':           'Nueva tarea',
      'composer.intro':           'Describe una tarea general. El modelo local propondrá un árbol de subtareas.',
      'composer.label.task':      'Tarea principal',
      'composer.placeholder':     'Ej.: Preparar la reunión mensual de la Junta Directiva',
      'composer.label.spice':     'Nivel de desglose',
      'composer.label.profile':   'Perfil',
      'composer.generate':        'Desglosar tarea',
      'composer.cancel':          'Cancelar generación',
      'composer.addManual':       'Añadir manualmente',
      'composer.shortcut':        'Atajo: Ctrl + Enter para desglosar.',

      // Profile options
      'profile.general':          'General',
      'profile.personal':         'Personal',
      'profile.work':             'Trabajo',
      'profile.research':         'Investigación doctoral',
      'profile.events':           'Gestión de eventos',
      'profile.training':         'Formación',
      'profile.archives':         'Archivo y documentación',

      // Spice hints
      'spice.hint.1':             'Mínimo: solo los pasos imprescindibles.',
      'spice.hint.2':             'Ligero: pasos generales con poca anidación.',
      'spice.hint.3':             'Equilibrado: pasos claros sin micro-detalle.',
      'spice.hint.4':             'Detallado: subtareas concretas en los bloques complejos.',
      'spice.hint.5':             'Máximo: micro-pasos pequeños, anidados cuando ayude.',
      'spice.aria':               'Nivel de desglose, de 1 a 5',
      'spice.level.aria':         'Nivel {n} de 5',

      // Tasks panel
      'tasks.title':              'Lista de tareas',
      'tasks.empty':              'Sin tareas todavía.',
      'tasks.counter':            '{done}/{total} tareas completadas.',
      'tasks.hideDone':           'Ocultar completadas',
      'tasks.expand':             'Expandir',
      'tasks.collapse':           'Contraer',
      'tasks.emptyState':         'No hay tareas. Crea una tarea nueva o importa un archivo JSON.',
      'tasks.filter.all':         'Todas ({n})',
      'tasks.filter.aria':        'Filtrar por categoría',
      'tasks.search.placeholder': 'Buscar en tareas y descripciones…',
      'tasks.search.aria':        'Buscar tareas',

      // Task meta cards
      'meta.plan':                'Plan',
      'meta.category':            'Categoría',
      'meta.difficulty':          'Dificultad',
      'meta.totalTime':           'Tiempo total',
      'meta.noTitle':             'Sin título',

      // Task card
      'task.time':                'Tiempo: {value}',
      'task.energy':              'Energía: {value}',
      'task.energy.unknown':      'media',
      'task.time.unknown':        'sin estimación',
      'task.title.aria':          'Título de la tarea',
      'task.action.expandMore':   '✨ Desglosar más',
      'task.action.expandMore.title': 'Pedirle al modelo local más subtareas de esta tarea',
      'task.action.addSub':       '+ Subtarea',
      'task.action.editDesc':     'Editar descripción',
      'task.action.delete':       'Borrar',
      'task.action.expand':       'Expandir',
      'task.action.collapse':     'Contraer',
      'task.check.aria':          'Marcar como completada',
      'task.noDescription':       'Sin descripción.',
      'task.descEditor.save':     'Guardar descripción',
      'task.descEditor.cancel':   'Cancelar',

      // Confirmations
      'confirm.newPlan':          '¿Empezar un plan nuevo? Se descartarán todas las tareas actuales (los ajustes y el modelo activo se conservan).',
      'confirm.deleteTask':       '¿Borrar esta tarea y sus subtareas?',
      'confirm.clearAll':         '¿Borrar TODOS los datos guardados en este navegador (tareas, modelo activo y preferencias)? Esta acción no se puede deshacer.',
      'confirm.shutdown':         '¿Apagar el servidor local de Cumplø? Tendrás que volver a ejecutar start.bat/start.sh para usarlo otra vez.',
      'confirm.editDesc':         'Descripción de la tarea:',
      'prompt.newSubtask.title':  'Definir nueva subtarea',
      'prompt.newSubtask.manual': 'Nueva tarea',

      // Status messages
      'status.generating':        'Generando desglose con Ollama local…',
      'status.generated':         'Tarea desglosada correctamente.',
      'status.canceling':         'Cancelando generación…',
      'status.cancelled':         'Generación cancelada.',
      'status.error.empty':       'Escribe una tarea principal antes de generar el desglose.',
      'status.error.tooLong':     'La tarea es demasiado larga. Reduce el texto inicial.',
      'status.error.prefix':      'Error: {message}',
      'status.added':             'Tarea añadida manualmente.',
      'status.newPlan':           'Plan nuevo iniciado.',
      'status.cleared':           'Todos los datos locales han sido borrados.',
      'status.exportedMd':        'Plan exportado como {file}.',
      'status.exportedJson':      'Plan exportado como {file}.',
      'status.imported':          'JSON importado correctamente.',
      'status.import.error':      'No se pudo importar el JSON: {message}',
      'status.export.empty':      'No hay tareas que exportar. Genera o añade tareas antes.',
      'status.branch.start':      'Pidiendo al modelo local más subtareas…',
      'status.branch.added':      'Añadidas {n} subtareas a "{title}".',
      'status.settings.saved':    'Configuración guardada.',
      'status.detect.retrying':   'Reintentando detección…',
      'status.shutdown.failed':   'No se pudo apagar el servidor: {message}',
      'status.save.quotaError':   'No se pudo guardar (almacenamiento lleno o navegación privada).',
      'status.ephemeral.enabled': 'Modo efímero activado. El plan persistido se ha borrado.',
      'status.ephemeral.disabled':'Modo efímero desactivado. El plan actual vuelve a guardarse localmente.',

      // Settings dialog
      'settings.title':           'Configuración',
      'settings.label.model':     'Modelo activo',
      'settings.model.empty':     '— Sin modelos detectados —',
      'settings.hint.noOllama':   'Ollama no responde. Comprueba que está arrancado y que OLLAMA_ORIGINS permite http://127.0.0.1:8765 (ver docs/INSTALAR-OLLAMA.es.md). Después pulsa Reintentar detección.',
      'settings.hint.noModels':   'Ollama responde pero no hay modelos descargados. Ejecuta: ollama pull gemma3n:e2b',
      'settings.hint.models':     '{count} modelo(s) detectados. El modelo activo se usa para todas las generaciones.',
      'settings.label.temp':      'Temperatura',
      'settings.redetect':        'Reintentar detección',
      'settings.save':            'Guardar',
      'settings.note':            'Endpoint: http://localhost:11434 (fijo). Cumplø no permite cambiarlo para mantener la CSP estricta.',
      'settings.close.aria':      'Cerrar',

      // Branch dialog
      'branch.title':             'Desglosar esta tarea',
      'branch.preview':           'Tarea: {emoji} {title}',
      'branch.replace':           'Sustituir subtareas existentes (por defecto se añaden)',
      'branch.cancel':            'Cancelar',
      'branch.run':               'Desglosar',
      'branch.cancelGeneration':  'Cancelar generación',

      // Export dialog
      'export.title':             'Exportar plan',
      'export.intro':             'Descarga el plan actual en el formato que prefieras. Los datos quedan en tu equipo: la descarga es local, no se sube nada a la nube.',
      'export.markdown':          'Markdown (.md)',
      'export.json':              'JSON (.json)',
      'export.label.import':      'Importar plan desde JSON',
      'export.import.hint':       'Sustituye las tareas actuales por las del fichero JSON elegido.',
      'export.close':             'Cerrar',

      // Utility / info panel
      'util.title':               'Información y reset',
      'util.intro':                'Acerca de Cumplø y opciones avanzadas.',
      'util.clearAll':            'Borrar todos los datos',
      'util.clearAll.title':      'Borra TODO: tareas, modelo activo y preferencias',
      'util.privacy.summary':     'Privacidad y funcionamiento',
      'util.privacy.p1':          'Cumplø no incluye analítica, cookies ni dependencias externas. Las tareas se guardan en el almacenamiento local del navegador salvo que actives el modo efímero. La generación automática requiere Ollama ejecutándose en este mismo equipo.',
      'util.privacy.p2':          'El servidor local solo escucha en 127.0.0.1, está protegido por una CSP estricta y solo permite hablar con Ollama en su puerto 11434.',
      'util.ephemeral.label':     'Modo efímero: no guardar tareas en este navegador',
      'util.ephemeral.hint':      'Al activarlo, Cumplø borra el plan persistido y mantiene los cambios solo en memoria hasta cerrar o recargar la pestaña.',
      'util.noOllama.summary':    '¿No conecta con Ollama?',
      'util.noOllama.intro':      'La causa habitual es que la variable de entorno OLLAMA_ORIGINS no incluye el origen de esta aplicación. Es un ajuste único en cada equipo:',
      'util.noOllama.win':        'Windows: Inicio → "Variables de entorno" → variable de usuario OLLAMA_ORIGINS con valor http://127.0.0.1:8765,http://localhost:8765. Cierra y reabre Ollama.',
      'util.noOllama.mac':        'macOS: launchctl setenv OLLAMA_ORIGINS "http://127.0.0.1:8765,http://localhost:8765" y reinicia Ollama desde la barra de menú.',
      'util.noOllama.linux':      'Linux (systemd): sudo systemctl edit ollama.service y añade Environment="OLLAMA_ORIGINS=http://127.0.0.1:8765,http://localhost:8765". Después sudo systemctl restart ollama.',
      'util.noOllama.retry':      'Reintentar detección',
      'util.noOllama.docs':       'El detalle completo está en docs/INSTALAR-OLLAMA.es.md.',
      'diag.status':              'Estado',
      'diag.status.checking':     'comprobando',
      'diag.status.ok':           'Ollama detectado',
      'diag.status.fail':         'Ollama no detectado',
      'diag.models':              'Modelos detectados',
      'diag.activeModel':         'Modelo activo',
      'diag.origin':              'Origen actual',
      'diag.recommendedOrigins':  'OLLAMA_ORIGINS recomendado',
      'diag.lastError':           'Último error',

      // Shutdown screen
      'shutdown.title':           'Cumplø apagado',
      'shutdown.message':         'Puedes cerrar esta pestaña. El servidor local se ha detenido.',

      // Footer
      'footer.tagline':           'Local · Sin nube · MIT',

      // Ollama errors (used from ollama.js)
      'err.aborted.generate':     'La generación local ha superado el tiempo máximo. Prueba con un modelo más ligero, reduce la tarea de entrada o vuelve a intentarlo.',
      'err.aborted.other':        'La operación con Ollama ha superado el tiempo máximo.',
      'err.network.cors':         'No se pudo conectar con Ollama en http://localhost:11434. Causas frecuentes: (1) Ollama no está arrancado. (2) La variable OLLAMA_ORIGINS no incluye http://127.0.0.1:8765 ni http://localhost:8765, por lo que el navegador bloquea la petición por CORS. Lee docs/INSTALAR-OLLAMA.es.md para configurarlo (es un ajuste único).',
      'err.http.404.generate':    'El modelo seleccionado no se encontró en Ollama. Descárgalo con "ollama pull <modelo>" o elige otro.',
      'err.http.404.other':       'Ollama no encontró el recurso o modelo solicitado.',
      'err.http.400':             'Ollama rechazó la solicitud. Revisa el modelo seleccionado y vuelve a intentarlo.',
      'err.http.500':             'Ollama devolvió un error interno. Puede faltar memoria, el modelo puede estar corrupto o la solicitud puede ser demasiado larga.',
      'err.http.503':             'Ollama no está disponible temporalmente o está ocupado. Espera unos segundos y vuelve a intentarlo.',
      'err.http.generic':         'Ollama devolvió HTTP {status}.',
      'err.modelName':            'Nombre de modelo no válido.',
      'err.noActiveModel':        'No hay modelo activo. Selecciona o descarga uno en Configuración.',
      'err.noContent':            'Ollama no devolvió contenido. Prueba con otro modelo o reduce la tarea.',
      'err.unparseable':          'Ollama devolvió una respuesta no interpretable. Vuelve a intentarlo o cambia de modelo.',
      'err.parser.noJson':        'El modelo no devolvió JSON válido.',
      'err.parser.noSubs':        'El modelo no devolvió subtareas utilizables.',
      'err.import.tooLarge':      'El archivo supera el límite de {mb} MB.',
      'err.unknown':              'Error desconocido al comunicarse con Ollama.'
    },

    en: {
      // App / meta
      'app.title':                'Cumplø — Local task breakdown with Ollama',
      'app.lang.html':            'en',

      // Header
      'header.subtitle':          'Break large tasks into small, ordered, editable steps. Everything stays local — nothing is sent to the cloud.',
      'header.newPlan':           'New plan',
      'header.newPlan.title':     'Discard the current tasks and start fresh',
      'header.export':            'Export',
      'header.export.title':      'Download the plan as Markdown or JSON',
      'header.settings':          'Settings',
      'header.shutdown':          'Shut down',
      'header.shutdown.title':    'Shut down Cumplø\u2019s local server',
      'header.lang.es':           'ES',
      'header.lang.en':           'EN',
      'header.lang.switch':       'Switch language',

      // Ollama status
      'ollama.checking':          'Checking Ollama…',
      'ollama.notDetected':       'Ollama not detected',
      'ollama.notDetected.title': 'Open Settings → Retry detection.',
      'ollama.noModel':           'Ollama · no models downloaded',
      'ollama.someModels':        'Ollama · {count} model(s) available',
      'ollama.activeModel':       'Ollama · {model}',
      'ollama.detectedCount':     '{count} models detected.',

      // Composer panel
      'composer.title':           'New task',
      'composer.intro':           'Describe a high-level task. The local model will propose a tree of subtasks.',
      'composer.label.task':      'Main task',
      'composer.placeholder':     'e.g.: Prepare the monthly board meeting',
      'composer.label.spice':     'Breakdown level',
      'composer.label.profile':   'Profile',
      'composer.generate':        'Break down task',
      'composer.cancel':          'Cancel generation',
      'composer.addManual':       'Add manually',
      'composer.shortcut':        'Shortcut: Ctrl + Enter to break down.',

      // Profile options
      'profile.general':          'General',
      'profile.personal':         'Personal',
      'profile.work':             'Work',
      'profile.research':         'Doctoral research',
      'profile.events':           'Event management',
      'profile.training':         'Training',
      'profile.archives':         'Archives & records',

      // Spice hints
      'spice.hint.1':             'Minimum: only the essential steps.',
      'spice.hint.2':             'Light: general steps with little nesting.',
      'spice.hint.3':             'Balanced: clear steps, no micro-detail.',
      'spice.hint.4':             'Detailed: concrete subtasks in complex blocks.',
      'spice.hint.5':             'Maximum: small micro-steps, nested when useful.',
      'spice.aria':               'Breakdown level, 1 to 5',
      'spice.level.aria':         'Level {n} of 5',

      // Tasks panel
      'tasks.title':              'Task list',
      'tasks.empty':              'No tasks yet.',
      'tasks.counter':            '{done}/{total} tasks completed.',
      'tasks.hideDone':           'Hide completed',
      'tasks.expand':             'Expand',
      'tasks.collapse':           'Collapse',
      'tasks.emptyState':         'No tasks. Create a new one or import a JSON file.',
      'tasks.filter.all':         'All ({n})',
      'tasks.filter.aria':        'Filter by category',
      'tasks.search.placeholder': 'Search in tasks and descriptions…',
      'tasks.search.aria':        'Search tasks',

      // Task meta cards
      'meta.plan':                'Plan',
      'meta.category':            'Category',
      'meta.difficulty':          'Difficulty',
      'meta.totalTime':           'Total time',
      'meta.noTitle':             'No title',

      // Task card
      'task.time':                'Time: {value}',
      'task.energy':              'Energy: {value}',
      'task.energy.unknown':      'medium',
      'task.time.unknown':        'no estimate',
      'task.action.expandMore':   '✨ Break down further',
      'task.action.expandMore.title': 'Ask the local model for more subtasks of this one',
      'task.action.addSub':       '+ Subtask',
      'task.action.editDesc':     'Edit description',
      'task.action.delete':       'Delete',
      'task.action.expand':       'Expand',
      'task.action.collapse':     'Collapse',
      'task.check.aria':          'Mark as completed',
      'task.noDescription':       'No description.',
      'task.descEditor.save':     'Save description',
      'task.descEditor.cancel':   'Cancel',

      // Confirmations
      'confirm.newPlan':          'Start a new plan? All current tasks will be discarded (settings and active model are kept).',
      'confirm.deleteTask':       'Delete this task and its subtasks?',
      'confirm.clearAll':         'Delete ALL data stored in this browser (tasks, active model, preferences)? This cannot be undone.',
      'confirm.shutdown':         'Shut down Cumplø\u2019s local server? You\u2019ll need to run start.bat/start.sh again to use it.',
      'confirm.editDesc':         'Task description:',
      'prompt.newSubtask.title':  'Define a new subtask',
      'prompt.newSubtask.manual': 'New task',

      // Status messages
      'status.generating':        'Generating breakdown with local Ollama…',
      'status.generated':         'Task broken down successfully.',
      'status.canceling':         'Cancelling generation…',
      'status.cancelled':         'Generation cancelled.',
      'status.error.empty':       'Write a main task before generating the breakdown.',
      'status.error.tooLong':     'The task is too long. Shorten the initial text.',
      'status.error.prefix':      'Error: {message}',
      'status.added':             'Task added manually.',
      'status.newPlan':           'New plan started.',
      'status.cleared':           'All local data has been deleted.',
      'status.exportedMd':        'Plan exported as {file}.',
      'status.exportedJson':      'Plan exported as {file}.',
      'status.imported':          'JSON imported successfully.',
      'status.import.error':      'Could not import the JSON: {message}',
      'status.export.empty':      'No tasks to export. Generate or add tasks first.',
      'status.branch.start':      'Asking the local model for more subtasks…',
      'status.branch.added':      'Added {n} subtasks to "{title}".',
      'status.settings.saved':    'Settings saved.',
      'status.detect.retrying':   'Retrying detection…',
      'status.shutdown.failed':   'Could not shut down the server: {message}',
      'status.save.quotaError':   'Could not save (storage full or private browsing).',
      'status.ephemeral.enabled': 'Ephemeral mode enabled. The persisted plan has been deleted.',
      'status.ephemeral.disabled':'Ephemeral mode disabled. The current plan is stored locally again.',

      // Settings dialog
      'settings.title':           'Settings',
      'settings.label.model':     'Active model',
      'settings.model.empty':     '— No models detected —',
      'settings.hint.noOllama':   'Ollama is not responding. Check that it is running and that OLLAMA_ORIGINS allows http://127.0.0.1:8765 (see docs/INSTALAR-OLLAMA.es.md). Then press Retry detection.',
      'settings.hint.noModels':   'Ollama responds but no models are downloaded. Run: ollama pull gemma3n:e2b',
      'settings.hint.models':     '{count} model(s) detected. The active model is used for all generations.',
      'settings.label.temp':      'Temperature',
      'settings.redetect':        'Retry detection',
      'settings.save':            'Save',
      'settings.note':            'Endpoint: http://localhost:11434 (fixed). Cumplø does not let you change it in order to keep a strict CSP.',
      'settings.close.aria':      'Close',

      // Branch dialog
      'branch.title':             'Break down this task',
      'branch.preview':           'Task: {emoji} {title}',
      'branch.replace':           'Replace existing subtasks (by default they are appended)',
      'branch.cancel':            'Cancel',
      'branch.run':               'Break down',
      'branch.cancelGeneration':  'Cancel generation',

      // Export dialog
      'export.title':             'Export plan',
      'export.intro':             'Download the current plan in the format you prefer. Data stays on your device: the download is local, nothing is uploaded.',
      'export.markdown':          'Markdown (.md)',
      'export.json':              'JSON (.json)',
      'export.label.import':      'Import plan from JSON',
      'export.import.hint':       'Replaces current tasks with those of the selected JSON file.',
      'export.close':             'Close',

      // Utility / info panel
      'util.title':               'Info & reset',
      'util.intro':               'About Cumplø and advanced options.',
      'util.clearAll':            'Delete all data',
      'util.clearAll.title':      'Delete EVERYTHING: tasks, active model and preferences',
      'util.privacy.summary':     'Privacy and how it works',
      'util.privacy.p1':          'Cumplø has no analytics, no cookies and no external dependencies. Tasks are stored in the browser\u2019s local storage unless you enable ephemeral mode. Automatic generation requires Ollama running on this same machine.',
      'util.privacy.p2':          'The local server only listens on 127.0.0.1, is protected by a strict CSP and only allows talking to Ollama on its port 11434.',
      'util.ephemeral.label':     'Ephemeral mode: do not store tasks in this browser',
      'util.ephemeral.hint':      'When enabled, Cumplø deletes the persisted plan and keeps changes in memory only until the tab is closed or reloaded.',
      'util.noOllama.summary':    'Not connecting to Ollama?',
      'util.noOllama.intro':      'The usual cause is that the OLLAMA_ORIGINS environment variable does not include this app\u2019s origin. It is a one-off setting per machine:',
      'util.noOllama.win':        'Windows: Start → "Environment variables" → user variable OLLAMA_ORIGINS with value http://127.0.0.1:8765,http://localhost:8765. Quit and reopen Ollama.',
      'util.noOllama.mac':        'macOS: launchctl setenv OLLAMA_ORIGINS "http://127.0.0.1:8765,http://localhost:8765" and restart Ollama from the menu bar.',
      'util.noOllama.linux':      'Linux (systemd): sudo systemctl edit ollama.service and add Environment="OLLAMA_ORIGINS=http://127.0.0.1:8765,http://localhost:8765". Then sudo systemctl restart ollama.',
      'util.noOllama.retry':      'Retry detection',
      'util.noOllama.docs':       'Full details in docs/INSTALAR-OLLAMA.es.md.',
      'diag.status':              'Status',
      'diag.status.checking':     'checking',
      'diag.status.ok':           'Ollama detected',
      'diag.status.fail':         'Ollama not detected',
      'diag.models':              'Detected models',
      'diag.activeModel':         'Active model',
      'diag.origin':              'Current origin',
      'diag.recommendedOrigins':  'Recommended OLLAMA_ORIGINS',
      'diag.lastError':           'Last error',

      // Shutdown screen
      'shutdown.title':           'Cumplø stopped',
      'shutdown.message':         'You can close this tab. The local server has been stopped.',

      // Footer
      'footer.tagline':           'Local · No cloud · MIT',

      // Ollama errors
      'err.aborted.generate':     'Local generation exceeded the time limit. Try a lighter model, shorten the input task or retry.',
      'err.aborted.other':        'The Ollama operation exceeded the time limit.',
      'err.network.cors':         'Could not connect to Ollama at http://localhost:11434. Common causes: (1) Ollama is not running. (2) The OLLAMA_ORIGINS variable does not include http://127.0.0.1:8765 or http://localhost:8765, so the browser blocks the request via CORS. See docs/INSTALAR-OLLAMA.es.md to configure it (it\u2019s a one-off).',
      'err.http.404.generate':    'The selected model was not found in Ollama. Download it with "ollama pull <model>" or choose another one.',
      'err.http.404.other':       'Ollama did not find the requested resource or model.',
      'err.http.400':             'Ollama rejected the request. Check the selected model and retry.',
      'err.http.500':             'Ollama returned an internal error. Memory might be low, the model could be corrupt, or the request too long.',
      'err.http.503':             'Ollama is temporarily unavailable or busy. Wait a few seconds and retry.',
      'err.http.generic':         'Ollama returned HTTP {status}.',
      'err.modelName':            'Invalid model name.',
      'err.noActiveModel':        'No active model. Select or download one in Settings.',
      'err.noContent':            'Ollama returned no content. Try another model or shorten the task.',
      'err.unparseable':          'Ollama returned an unreadable response. Retry or switch model.',
      'err.parser.noJson':        'The model did not return valid JSON.',
      'err.parser.noSubs':        'The model did not return usable subtasks.',
      'err.import.tooLarge':      'The file exceeds the {mb} MB limit.',
      'err.unknown':              'Unknown error while talking to Ollama.'
    }
  };

  function readStored() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.includes(v) ? v : null;
    } catch { return null; }
  }

  function detectInitial() {
    const stored = readStored();
    if (stored) return stored;
    const nav = (navigator.language || '').toLowerCase().split('-')[0];
    return SUPPORTED.includes(nav) ? nav : FALLBACK;
  }

  let current = detectInitial();

  function t(key, params) {
    const table = dict[current] || dict[FALLBACK];
    let raw = table[key];
    if (raw === undefined) raw = dict[FALLBACK][key];
    if (raw === undefined) return key;
    if (params) {
      for (const k of Object.keys(params)) {
        raw = raw.split('{' + k + '}').join(String(params[k]));
      }
    }
    return raw;
  }

  function apply() {
    document.documentElement.setAttribute('lang', t('app.lang.html'));
    document.title = t('app.title');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });

    // Notificar a app.js para que re-renderice strings dinámicos.
    document.dispatchEvent(new CustomEvent('cumplo:lang-changed', { detail: { lang: current } }));
  }

  function set(lang) {
    if (!SUPPORTED.includes(lang) || lang === current) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    apply();
  }

  window.I18N = {
    t,
    set,
    apply,
    get lang() { return current; },
    SUPPORTED
  };
})();
