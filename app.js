// =============================================================================
// Cumplø — app.js  ·  v0.8.0-beta
// Gestión local de proyectos, tareas y subtareas. La respuesta del modelo se
// trata como entrada no confiable: se parsea, normaliza, recorta y se renderiza
// siempre mediante nodos DOM/textContent, nunca mediante HTML generado por IA.
// =============================================================================

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------
const PROJECTS_STORAGE_KEY = "cumplo_projects_v2";
const SETTINGS_KEY = "cumplo_settings_v1";
const EXPORT_PROJECT_SCHEMA_VERSION = "cumplo.project.v2";
const EXPORT_LIBRARY_SCHEMA_VERSION = "cumplo.projects.v2";
const APP_VERSION = "0.8.0-beta";

const LEGACY_STATE_KEYS    = ["cumplo_state_v1", "tareas_locales_state_v1"];
const LEGACY_SETTINGS_KEYS = ["tareas_locales_settings_v1"];

const DEFAULT_SETTINGS = { temperature: 0.25, ephemeral: false };
const DEFAULT_SPICE = 3;
const MAX_DEPTH = 1;        // jerarquía de producto: Proyecto → Tareas → Subtareas
const SAVE_DEBOUNCE_MS = 300;
const IMPORT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB: evita bloqueos por JSON enormes
const VALID_ID_RE = /^[a-z0-9][a-z0-9_.:-]{1,127}$/i;

const ALLOWED_EMOJIS = new Set([
  "📝","✉️","📞","🗂️","📁","📚","🔎","💻","🛠️","🧮",
  "💶","🧾","🗓️","🤝","👥","🧠","🧹","🛒","🚚","🚪",
  "🏛️","🍽️","🎯","⚠️","✅"
]);

function T(key, params) { return window.I18N.t(key, params); }
function TF(key, fallback, params) {
  const value = T(key, params);
  return value === key ? fallback : value;
}

// -----------------------------------------------------------------------------
// Estado en memoria
// -----------------------------------------------------------------------------
let library = emptyLibrary();
let state = emptyProjectSkeleton();
let uiState = {
  spice: DEFAULT_SPICE,
  branchSpice: DEFAULT_SPICE,
  branchTargetId: null,
  hideDone: false,
  emojiFilter: null,
  textFilter: "",
  projectFilter: "",
  showArchived: false,
  descEditingId: null
};

function emptyLibrary() {
  return {
    schema_version: EXPORT_LIBRARY_SCHEMA_VERSION,
    app_version: APP_VERSION,
    active_project_id: null,
    projects: []
  };
}

function emptyProjectSkeleton() {
  return {
    id: "",
    title: "",
    summary: "",
    category: "",
    difficulty: "",
    estimated_total_time: "",
    status: "active",
    created_at: "",
    updated_at: "",
    tasks: []
  };
}

// -----------------------------------------------------------------------------
// Referencias DOM
// -----------------------------------------------------------------------------
const els = {
  taskInput:           document.getElementById("taskInput"),
  spiceScale:          document.getElementById("spiceScale"),
  spiceHint:           document.getElementById("spiceHint"),
  profileSelect:       document.getElementById("profileSelect"),
  generateBtn:         document.getElementById("generateBtn"),
  addManualBtn:        document.getElementById("addManualBtn"),
  statusBox:           document.getElementById("statusBox"),
  tasksRoot:           document.getElementById("tasksRoot"),
  taskCount:           document.getElementById("taskCount"),
  taskMeta:            document.getElementById("taskMeta"),
  taskToolbar:         document.getElementById("taskToolbar"),
  filterBar:           document.getElementById("filterBar"),
  searchInput:         document.getElementById("searchInput"),
  hideDoneToggle:      document.getElementById("hideDoneToggle"),
  clearDataBtn:        document.getElementById("clearDataBtn"),
  newPlanBtn:          document.getElementById("newPlanBtn"),
  expandAllBtn:        document.getElementById("expandAllBtn"),
  collapseAllBtn:      document.getElementById("collapseAllBtn"),
  settingsDialog:      document.getElementById("settingsDialog"),
  openSettingsBtn:     document.getElementById("openSettingsBtn"),
  modelSelect:         document.getElementById("modelSelect"),
  modelHint:           document.getElementById("modelHint"),
  temperatureInput:    document.getElementById("temperatureInput"),
  saveSettingsBtn:     document.getElementById("saveSettingsBtn"),
  redetectBtn:         document.getElementById("redetectBtn"),
  exportBtn:           document.getElementById("exportBtn"),
  exportDialog:        document.getElementById("exportDialog"),
  exportCloseBtn:      document.getElementById("exportCloseBtn"),
  dlgExportMarkdownBtn: document.getElementById("dlgExportMarkdownBtn"),
  dlgExportJsonBtn:    document.getElementById("dlgExportJsonBtn"),
  dlgExportAllJsonBtn: document.getElementById("dlgExportAllJsonBtn"),
  dlgImportInput:      document.getElementById("dlgImportInput"),
  branchDialog:        document.getElementById("branchDialog"),
  branchSpiceScale:    document.getElementById("branchSpiceScale"),
  branchSpiceHint:     document.getElementById("branchSpiceHint"),
  branchTaskPreview:   document.getElementById("branchTaskPreview"),
  branchReplaceToggle: document.getElementById("branchReplaceToggle"),
  branchRunBtn:        document.getElementById("branchRunBtn"),
  branchCancelBtn:     document.getElementById("branchCancelBtn"),
  ollamaStatus:        document.getElementById("ollamaStatus"),
  shutdownBtn:         document.getElementById("shutdownBtn"),
  footerVersion:       document.getElementById("footerVersion"),
  ephemeralToggle:     document.getElementById("ephemeralToggle"),
  ollamaDiagnostics:   document.getElementById("ollamaDiagnostics"),
  retryOllamaBtn:      document.getElementById("retryOllamaBtn"),
  projectsList:        document.getElementById("projectsList"),
  projectsCount:       document.getElementById("projectsCount"),
  projectSearchInput:  document.getElementById("projectSearchInput"),
  showArchivedToggle:  document.getElementById("showArchivedToggle"),
  duplicateProjectBtn: document.getElementById("duplicateProjectBtn"),
  archiveProjectBtn:   document.getElementById("archiveProjectBtn"),
  deleteProjectBtn:    document.getElementById("deleteProjectBtn"),
  renameProjectBtn:    document.getElementById("renameProjectBtn")
};

const langBtns = document.querySelectorAll(".lang-btn");
let activeGenerateController = null;
let activeBranchController = null;

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------
function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function setStatus(message, type = "") {
  els.statusBox.textContent = message;
  els.statusBox.className = `status-box ${type}`.trim();
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() { return new Date().toISOString(); }

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeInternalId(value, prefix = "id") {
  const v = String(value || "").trim();
  return VALID_ID_RE.test(v) ? v : uid(prefix);
}

function freshId(prefix, seen) {
  let id;
  do { id = uid(prefix); } while (seen.has(id));
  return id;
}

function stripCodeFences(text) {
  return String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractJson(text) {
  const cleaned = stripCodeFences(text);
  try { return JSON.parse(cleaned); }
  catch {
    const first = cleaned.indexOf("{");
    const last  = cleaned.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      throw new Error(T('err.parser.noJson'));
    }
    return JSON.parse(cleaned.slice(first, last + 1));
  }
}

function projectHasContent(project) {
  return Boolean(project && (project.title || project.summary || (project.tasks || []).length));
}

function displayProjectTitle(project) {
  return project && project.title ? project.title : T('meta.noTitle');
}

function slugForFile(value, fallback = "cumplo-project") {
  return String(value || fallback)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || fallback;
}

// Acepta "baja|media|alta" y "low|medium|high"; normaliza al idioma actual.
const ENERGY_MAP = {
  baja: { es: 'baja', en: 'low' },     low:    { es: 'baja', en: 'low' },
  media:{ es: 'media', en: 'medium' }, medium: { es: 'media', en: 'medium' },
  alta: { es: 'alta', en: 'high' },    high:   { es: 'alta', en: 'high' }
};

function normalizeEnergy(value) {
  const key = String(value || '').toLowerCase();
  if (ENERGY_MAP[key]) return ENERGY_MAP[key][window.I18N.lang] || ENERGY_MAP[key].es;
  return T('task.energy.unknown');
}

function normalizeEmoji(value) {
  const v = String(value || "").trim();
  const candidate = [...v][0] || "";
  if (ALLOWED_EMOJIS.has(v)) return v;
  if (ALLOWED_EMOJIS.has(candidate)) return candidate;
  if (ALLOWED_EMOJIS.has(candidate + "\uFE0F")) return candidate + "\uFE0F";
  return "📝";
}

function normalizeStatus(value) {
  return String(value || "active") === "archived" ? "archived" : "active";
}

function normalizeTask(task, index = 0, depth = 0) {
  const safe = task && typeof task === "object" ? task : {};
  const subtasks = (depth < MAX_DEPTH && Array.isArray(safe.subtasks))
    ? safe.subtasks.slice(0, 60).map((t, i) => normalizeTask(t, i, depth + 1))
    : [];
  return {
    id:             normalizeInternalId(safe.id, depth === 0 ? `task${index}` : `subtask${index}`),
    title:          String(safe.title || T('prompt.newSubtask.title')).slice(0, 240),
    emoji:          normalizeEmoji(safe.emoji),
    description:    String(safe.description || "").slice(0, 1000),
    estimated_time: String(safe.estimated_time || T('task.time.unknown')).slice(0, 80),
    energy:         normalizeEnergy(safe.energy),
    done:           Boolean(safe.done),
    collapsed:      Boolean(safe.collapsed),
    subtasks
  };
}

function ensureUniqueTaskIds(tasks, seen = new Set()) {
  for (const task of tasks || []) {
    if (!task || typeof task !== "object") continue;
    if (!task.id || seen.has(task.id) || !VALID_ID_RE.test(task.id)) {
      task.id = freshId("task", seen);
    }
    seen.add(task.id);
    ensureUniqueTaskIds(task.subtasks || [], seen);
  }
  return tasks;
}

function normalizeProject(project, opts = {}) {
  const safe = project && typeof project === "object" ? project : {};
  const created = String(safe.created_at || opts.created_at || nowIso()).slice(0, 40);
  const updated = String(safe.updated_at || opts.updated_at || created).slice(0, 40);
  const tasks = Array.isArray(safe.tasks)
    ? safe.tasks.slice(0, 100).map((t, i) => normalizeTask(t, i, 0))
    : [];
  ensureUniqueTaskIds(tasks);
  return {
    id:                   normalizeInternalId(safe.id || opts.id, "project"),
    title:                String(safe.title || "").slice(0, 200),
    summary:              String(safe.summary || "").slice(0, 1000),
    category:             String(safe.category || "").slice(0, 60),
    difficulty:           safe.difficulty ? normalizeEnergy(safe.difficulty) : "",
    estimated_total_time: String(safe.estimated_total_time || "").slice(0, 100),
    status:               normalizeStatus(safe.status),
    created_at:           created,
    updated_at:           updated,
    tasks
  };
}

function newProject(seed = {}) {
  const n = nowIso();
  return normalizeProject({
    id: uid("project"),
    title: "",
    summary: "",
    category: "",
    difficulty: "",
    estimated_total_time: "",
    status: "active",
    created_at: n,
    updated_at: n,
    tasks: [],
    ...seed
  });
}

function ensureUniqueProjectIds(projects) {
  const seen = new Set();
  for (const project of projects || []) {
    if (!project.id || seen.has(project.id) || !VALID_ID_RE.test(project.id)) {
      project.id = freshId("project", seen);
    }
    seen.add(project.id);
    ensureUniqueTaskIds(project.tasks || []);
  }
  return projects;
}

function normalizeLibrary(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};
  const sourceProjects = Array.isArray(safe.projects) ? safe.projects : [];
  const projects = sourceProjects.slice(0, 250).map(p => normalizeProject(p));
  ensureUniqueProjectIds(projects);
  let active = String(safe.active_project_id || "");
  if (!projects.some(p => p.id === active)) active = projects[0] ? projects[0].id : null;
  return {
    schema_version: EXPORT_LIBRARY_SCHEMA_VERSION,
    app_version: APP_VERSION,
    active_project_id: active,
    projects
  };
}

function countTasks(tasks) {
  return tasks.reduce((acc, task) => acc + 1 + countTasks(task.subtasks || []), 0);
}

function countRootTasks(tasks) { return (tasks || []).length; }

function countSubtasks(tasks) {
  return (tasks || []).reduce((acc, task) => acc + (task.subtasks || []).length + countSubtasks(task.subtasks || []), 0);
}

function countDone(tasks) {
  return tasks.reduce((acc, task) => acc + (task.done ? 1 : 0) + countDone(task.subtasks || []), 0);
}

function collectEmojis(tasks, map = new Map()) {
  for (const task of tasks) {
    const e = task.emoji || "📝";
    map.set(e, (map.get(e) || 0) + 1);
    collectEmojis(task.subtasks || [], map);
  }
  return map;
}

function branchMatchesEmoji(task, emoji) {
  if (!emoji) return true;
  if ((task.emoji || "📝") === emoji) return true;
  return (task.subtasks || []).some(s => branchMatchesEmoji(s, emoji));
}

function branchMatchesText(task, needle) {
  if (!needle) return true;
  const hay = (task.title + " " + (task.description || "")).toLowerCase();
  if (hay.includes(needle)) return true;
  return (task.subtasks || []).some(s => branchMatchesText(s, needle));
}

function isWholeDone(task) {
  return task.done && (task.subtasks || []).every(isWholeDone);
}

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------
function loadSettings() {
  try {
    let raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      for (const k of LEGACY_SETTINGS_KEYS) {
        raw = localStorage.getItem(k);
        if (raw) break;
      }
    }
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn("Cumplø: no se pudieron guardar las preferencias", e);
    setStatus(T('status.save.quotaError'), "error");
  }
}

function isEphemeralMode() {
  return Boolean(loadSettings().ephemeral);
}

// -----------------------------------------------------------------------------
// Persistencia de proyectos
// -----------------------------------------------------------------------------
function removePersistentState() {
  try {
    localStorage.removeItem(PROJECTS_STORAGE_KEY);
    for (const k of LEGACY_STATE_KEYS) localStorage.removeItem(k);
  } catch (e) {
    console.warn("Cumplø: no se pudo borrar el estado persistido", e);
  }
}

function getActiveProjectIndex() {
  return library.projects.findIndex(p => p.id === state.id);
}

function syncStateIntoLibrary({ touch = true } = {}) {
  if (!state || typeof state !== "object") state = newProject();
  if (!state.id) state.id = uid("project");
  if (!state.created_at) state.created_at = nowIso();
  if (touch) state.updated_at = nowIso();
  state = normalizeProject(state);
  const index = library.projects.findIndex(p => p.id === state.id);
  if (index >= 0) library.projects[index] = state;
  else library.projects.unshift(state);
  ensureUniqueProjectIds(library.projects);
  library.active_project_id = state.id;
}

function saveState(opts = {}) {
  syncStateIntoLibrary(opts);
  if (isEphemeralMode()) {
    removePersistentState();
    return;
  }
  try {
    const payload = {
      schema_version: EXPORT_LIBRARY_SCHEMA_VERSION,
      app_version: APP_VERSION,
      saved_at: nowIso(),
      active_project_id: library.active_project_id,
      projects: library.projects
    };
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Cumplø: no se pudo guardar el estado", e);
    setStatus(T('status.save.quotaError'), "error");
  }
}

const saveStateDebounced = debounce(saveState, SAVE_DEBOUNCE_MS);

function loadState() {
  if (isEphemeralMode()) {
    removePersistentState();
    library = emptyLibrary();
    state = newProject();
    library.projects = [state];
    library.active_project_id = state.id;
    return;
  }

  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      library = normalizeLibrary(JSON.parse(raw));
      if (!library.projects.length) {
        state = newProject();
        library.projects = [state];
        library.active_project_id = state.id;
      } else {
        state = library.projects.find(p => p.id === library.active_project_id) || library.projects[0];
      }
      saveState({ touch: false });
      return;
    }

    let legacyRaw = null;
    for (const k of LEGACY_STATE_KEYS) {
      legacyRaw = localStorage.getItem(k);
      if (legacyRaw) break;
    }
    if (legacyRaw) {
      const legacy = normalizeProject(JSON.parse(legacyRaw), { id: uid("project") });
      if (!legacy.title) legacy.title = TF('projects.migratedTitle', 'Proyecto recuperado');
      library = emptyLibrary();
      library.projects = [legacy];
      library.active_project_id = legacy.id;
      state = legacy;
      saveState({ touch: false });
      return;
    }
  } catch (e) {
    console.warn("Cumplø: no se pudo cargar el estado", e);
  }

  library = emptyLibrary();
  state = newProject();
  library.projects = [state];
  library.active_project_id = state.id;
}

// -----------------------------------------------------------------------------
// Spice scale
// -----------------------------------------------------------------------------
function mountSpiceScale(container, current, onChange, hintEl) {
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pepper" + (i <= current ? " active" : "");
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(i === current));
    btn.setAttribute("aria-label", T('spice.level.aria', { n: i }));
    btn.dataset.level = String(i);
    btn.textContent = "🌶️";
    btn.addEventListener("click", () => onChange(i));
    container.appendChild(btn);
  }
  if (hintEl) hintEl.textContent = T(`spice.hint.${current}`);
}

function setSpice(level) {
  uiState.spice = level;
  mountSpiceScale(els.spiceScale, uiState.spice, setSpice, els.spiceHint);
}

function setBranchSpice(level) {
  uiState.branchSpice = level;
  mountSpiceScale(els.branchSpiceScale, uiState.branchSpice, setBranchSpice, els.branchSpiceHint);
}

// -----------------------------------------------------------------------------
// Ollama status + selector de modelo
// -----------------------------------------------------------------------------
function renderOllamaStatus() {
  const ol = window.CumploOllama;
  const label = els.ollamaStatus.querySelector(".label");

  if (ol.available === null) {
    els.ollamaStatus.dataset.state = "unknown";
    label.textContent = T('ollama.checking');
    return;
  }
  if (ol.available === false) {
    els.ollamaStatus.dataset.state = "off";
    label.textContent = T('ollama.notDetected');
    els.ollamaStatus.title = ol.lastDetectError || T('ollama.notDetected.title');
    return;
  }
  els.ollamaStatus.dataset.state = "on";
  if (ol.activeModel) label.textContent = T('ollama.activeModel', { model: ol.activeModel });
  else if (ol.models.length) label.textContent = T('ollama.someModels', { count: ol.models.length });
  else label.textContent = T('ollama.noModel');
  els.ollamaStatus.title = T('ollama.detectedCount', { count: ol.models.length });
}

function renderModelSelect() {
  const ol = window.CumploOllama;
  const select = els.modelSelect;
  const current = ol.activeModel;
  select.innerHTML = "";

  if (!ol.models.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = T('settings.model.empty');
    select.appendChild(opt);
    select.disabled = true;
    els.modelHint.textContent = ol.available ? T('settings.hint.noModels') : T('settings.hint.noOllama');
    return;
  }

  select.disabled = false;
  for (const m of ol.models) {
    const opt = document.createElement("option");
    opt.value = m.name;
    opt.textContent = m.name;
    if (m.name === current) opt.selected = true;
    select.appendChild(opt);
  }
  els.modelHint.textContent = T('settings.hint.models', { count: ol.models.length });
}

function renderOllamaDiagnostics() {
  if (!els.ollamaDiagnostics) return;
  const ol = window.CumploOllama;
  const origin = window.location && window.location.origin ? window.location.origin : "http://127.0.0.1:8765";
  const recommended = "http://127.0.0.1:8765,http://localhost:8765";
  els.ollamaDiagnostics.innerHTML = "";

  const rows = [
    [T('diag.status'), ol.available === null ? T('diag.status.checking') : (ol.available ? T('diag.status.ok') : T('diag.status.fail'))],
    [T('diag.models'), ol.models && ol.models.length ? String(ol.models.length) : "0"],
    [T('diag.activeModel'), ol.activeModel || "—"],
    [T('diag.origin'), origin],
    [T('diag.recommendedOrigins'), recommended]
  ];
  if (ol.lastDetectError) rows.push([T('diag.lastError'), ol.lastDetectError]);

  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "diagnostic-row";
    const k = document.createElement("strong");
    k.textContent = label;
    const v = document.createElement("span");
    v.textContent = value;
    row.append(k, v);
    els.ollamaDiagnostics.appendChild(row);
  }
}

function renderEphemeralToggle() {
  if (!els.ephemeralToggle) return;
  els.ephemeralToggle.checked = isEphemeralMode();
}

// -----------------------------------------------------------------------------
// Render principal
// -----------------------------------------------------------------------------
function render() {
  renderProjectSidebar();

  const total = countTasks(state.tasks);
  const done  = countDone(state.tasks);
  const root  = countRootTasks(state.tasks);
  const subs  = countSubtasks(state.tasks);
  els.taskCount.textContent = total
    ? TF('tasks.counter.detailed', `${done}/${total} elementos completados · ${root} tareas · ${subs} subtareas`, { done, total, root, subs })
    : T('tasks.empty');

  renderMeta();
  renderToolbar();

  if (!state.tasks.length) {
    els.tasksRoot.className = "tasks-root empty-state";
    els.tasksRoot.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = T('tasks.emptyState');
    els.tasksRoot.appendChild(p);
    return;
  }

  els.tasksRoot.className = "tasks-root";
  els.tasksRoot.innerHTML = "";
  els.tasksRoot.appendChild(renderTaskList(state.tasks, 0));
}

function renderProjectSidebar() {
  if (!els.projectsList) return;
  syncStateIntoLibrary({ touch: false });

  const all = library.projects.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const activeCount = all.filter(p => p.status !== "archived").length;
  const archivedCount = all.length - activeCount;
  if (els.projectsCount) {
    els.projectsCount.textContent = TF(
      'projects.counter',
      `${activeCount} proyectos activos · ${archivedCount} archivados`,
      { active: activeCount, archived: archivedCount }
    );
  }

  const needle = uiState.projectFilter.trim().toLowerCase();
  const visible = all.filter(p => {
    if (!uiState.showArchived && p.status === "archived") return false;
    if (!needle) return true;
    return `${p.title} ${p.summary} ${p.category}`.toLowerCase().includes(needle);
  });

  els.projectsList.innerHTML = "";
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "muted project-empty";
    empty.textContent = TF('projects.empty', 'No hay proyectos que mostrar.');
    els.projectsList.appendChild(empty);
    return;
  }

  for (const project of visible) {
    els.projectsList.appendChild(renderProjectCard(project));
  }

  if (els.archiveProjectBtn) {
    const archived = state.status === "archived";
    els.archiveProjectBtn.textContent = archived ? TF('projects.restore', 'Restaurar') : TF('projects.archive', 'Archivar');
  }
}

function renderProjectCard(project) {
  const card = document.createElement("article");
  card.className = "project-card" + (project.id === state.id ? " active" : "") + (project.status === "archived" ? " archived" : "");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "project-card-main";
  button.setAttribute("aria-current", project.id === state.id ? "true" : "false");
  button.addEventListener("click", () => selectProject(project.id));

  const title = document.createElement("strong");
  title.className = "project-card-title";
  title.textContent = displayProjectTitle(project);

  const total = countTasks(project.tasks || []);
  const done = countDone(project.tasks || []);
  const root = countRootTasks(project.tasks || []);
  const subs = countSubtasks(project.tasks || []);
  const meta = document.createElement("span");
  meta.className = "project-card-meta";
  meta.textContent = TF('projects.card.meta', `${root} tareas · ${subs} subtareas · ${done}/${total}`, { root, subs, done, total });

  const updated = document.createElement("span");
  updated.className = "project-card-date";
  updated.textContent = formatDate(project.updated_at);

  button.append(title, meta, updated);
  card.appendChild(button);
  return card;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat(window.I18N.lang === "en" ? "en-GB" : "es-ES", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
    }).format(d);
  } catch {
    return String(value).slice(0, 16);
  }
}

function renderMeta() {
  const hasMeta = state.title || state.summary || state.estimated_total_time || state.category;
  if (!hasMeta) {
    els.taskMeta.classList.add("hidden");
    els.taskMeta.innerHTML = "";
    return;
  }
  els.taskMeta.classList.remove("hidden");
  els.taskMeta.innerHTML = "";

  const items = [
    [TF('meta.project', 'Proyecto'), displayProjectTitle(state)],
    [T('meta.category'), state.category || "—"],
    [T('meta.difficulty'), state.difficulty || T('task.energy.unknown')],
    [T('meta.totalTime'), state.estimated_total_time || T('task.time.unknown')]
  ];

  for (const [label, value] of items) {
    const card = document.createElement("div");
    card.className = "meta-card";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const span = document.createElement("span");
    span.textContent = value;
    card.append(strong, span);
    els.taskMeta.appendChild(card);
  }
}

function renderToolbar() {
  if (!state.tasks.length) {
    els.taskToolbar.classList.add("hidden");
    els.filterBar.innerHTML = "";
    return;
  }
  els.taskToolbar.classList.remove("hidden");
  renderFilterBar();
}

function renderFilterBar() {
  const counts = collectEmojis(state.tasks);
  els.filterBar.innerHTML = "";
  if (counts.size === 0) return;

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "chip" + (uiState.emojiFilter === null ? " active" : "");
  allChip.textContent = T('tasks.filter.all', { n: countTasks(state.tasks) });
  allChip.addEventListener("click", () => {
    uiState.emojiFilter = null;
    render();
  });
  els.filterBar.appendChild(allChip);

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [emoji, n] of entries) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (uiState.emojiFilter === emoji ? " active" : "");
    chip.textContent = `${emoji} ${n}`;
    chip.addEventListener("click", () => {
      uiState.emojiFilter = uiState.emojiFilter === emoji ? null : emoji;
      render();
    });
    els.filterBar.appendChild(chip);
  }
}

function renderTaskList(tasks, depth = 0) {
  const ul = document.createElement("ul");
  ul.className = depth === 0 ? "task-list" : "task-list subtask-list";
  const needle = uiState.textFilter.trim().toLowerCase();
  for (const task of tasks) {
    if (uiState.emojiFilter && !branchMatchesEmoji(task, uiState.emojiFilter)) continue;
    if (needle && !branchMatchesText(task, needle)) continue;
    if (uiState.hideDone && task.done && (task.subtasks || []).every(s => isWholeDone(s))) continue;
    ul.appendChild(renderTaskItem(task, depth));
  }
  return ul;
}

function renderTaskItem(task, depth = 0) {
  const li = document.createElement("li");
  li.className = `task-item ${task.done ? "done" : ""} ${depth > 0 ? "is-subtask" : "is-task"}`;

  const card = document.createElement("article");
  card.className = "task-card";

  const main = document.createElement("div");
  main.className = "task-main";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.done;
  checkbox.title = T('task.check.aria');
  checkbox.setAttribute("aria-label", T('task.check.aria'));
  checkbox.addEventListener("change", () => {
    task.done = checkbox.checked;
    saveState();
    render();
  });

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toggle-btn";
  toggle.textContent = task.collapsed ? "+" : "−";
  toggle.title = task.collapsed ? T('task.action.expand') : T('task.action.collapse');
  toggle.setAttribute("aria-expanded", String(!task.collapsed));
  toggle.disabled = !(task.subtasks && task.subtasks.length);
  toggle.addEventListener("click", () => {
    task.collapsed = !task.collapsed;
    saveState();
    render();
  });

  const content = document.createElement("div");
  content.className = "task-content";

  const titleRow = document.createElement("div");
  titleRow.className = "task-title-row";

  const emojiSpan = document.createElement("span");
  emojiSpan.className = "task-emoji";
  emojiSpan.textContent = task.emoji || "📝";

  const title = document.createElement("input");
  title.type = "text";
  title.className = "task-title";
  title.setAttribute("aria-label", depth === 0 ? T('task.title.aria') : TF('subtask.title.aria', 'Título de la subtarea'));
  title.value = task.title;
  title.maxLength = 240;
  title.addEventListener("input", () => {
    task.title = title.value.slice(0, 240);
    saveStateDebounced();
  });
  title.addEventListener("blur", () => saveState());

  titleRow.append(emojiSpan, title);

  const descContainer = document.createElement("div");
  descContainer.className = "task-description-container";
  if (uiState.descEditingId === task.id) renderDescriptionEditor(descContainer, task);
  else renderDescriptionReader(descContainer, task);

  const details = document.createElement("div");
  details.className = "task-details";

  const time = document.createElement("span");
  time.className = "pill";
  time.textContent = T('task.time', { value: task.estimated_time || T('task.time.unknown') });

  const energy = document.createElement("span");
  energy.className = "pill";
  energy.textContent = T('task.energy', { value: task.energy || T('task.energy.unknown') });

  details.append(time, energy);
  content.append(titleRow, descContainer, details);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  if (depth === 0) {
    const expandAiBtn = smallButton(T('task.action.expandMore'), () => openBranchDialog(task));
    expandAiBtn.title = T('task.action.expandMore.title');

    const addBtn = smallButton(T('task.action.addSub'), () => {
      task.subtasks.push({
        id: uid("subtask"),
        title: T('prompt.newSubtask.title'),
        emoji: "📝",
        description: "",
        estimated_time: T('task.time.unknown'),
        energy: T('task.energy.unknown'),
        done: false,
        collapsed: false,
        subtasks: []
      });
      task.collapsed = false;
      saveState();
      render();
    });
    actions.append(expandAiBtn, addBtn);
  }

  const editBtn = smallButton(T('task.action.editDesc'), () => {
    uiState.descEditingId = task.id;
    render();
  });

  const deleteBtn = smallButton(T('task.action.delete'), () => {
    if (confirm(T('confirm.deleteTask'))) {
      removeTaskById(state.tasks, task.id);
      saveState();
      render();
    }
  });
  deleteBtn.classList.add("danger-small");

  actions.append(editBtn, deleteBtn);
  main.append(checkbox, toggle, content, actions);
  card.appendChild(main);

  if (task.subtasks && task.subtasks.length && !task.collapsed) {
    card.appendChild(renderTaskList(task.subtasks, depth + 1));
  }

  li.appendChild(card);
  return li;
}

function renderDescriptionReader(container, task) {
  container.innerHTML = "";
  const desc = document.createElement("p");
  desc.className = "task-description";
  desc.textContent = task.description || T('task.noDescription');
  container.appendChild(desc);
}

function renderDescriptionEditor(container, task) {
  container.innerHTML = "";
  const ta = document.createElement("textarea");
  ta.className = "task-description-editor";
  ta.value = task.description || "";
  ta.maxLength = 1000;
  ta.rows = 3;
  ta.setAttribute("aria-label", T('task.action.editDesc'));

  setTimeout(() => {
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, 0);

  const actions = document.createElement("div");
  actions.className = "task-description-actions";

  const saveBtn = smallButton(T('task.descEditor.save'), () => {
    task.description = ta.value.slice(0, 1000);
    uiState.descEditingId = null;
    saveState();
    render();
  });

  const cancelBtn = smallButton(T('task.descEditor.cancel'), () => {
    uiState.descEditingId = null;
    render();
  });

  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveBtn.click();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelBtn.click();
    }
  });

  actions.append(saveBtn, cancelBtn);
  container.append(ta, actions);
}

function smallButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "small-btn";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function removeTaskById(tasks, id) {
  const index = tasks.findIndex(task => task.id === id);
  if (index >= 0) { tasks.splice(index, 1); return true; }
  for (const task of tasks) {
    if (removeTaskById(task.subtasks || [], id)) return true;
  }
  return false;
}

function findTaskById(tasks, id, depth = 0) {
  for (const t of tasks) {
    if (t.id === id) return { task: t, depth };
    const sub = findTaskById(t.subtasks || [], id, depth + 1);
    if (sub) return sub;
  }
  return null;
}

function setAllCollapsed(tasks, collapsed) {
  for (const task of tasks) {
    task.collapsed = collapsed;
    setAllCollapsed(task.subtasks || [], collapsed);
  }
}

// -----------------------------------------------------------------------------
// Gestión de proyectos
// -----------------------------------------------------------------------------
function selectProject(id) {
  if (!id || id === state.id) return;
  syncStateIntoLibrary({ touch: false });
  const next = library.projects.find(p => p.id === id);
  if (!next) return;
  state = next;
  library.active_project_id = state.id;
  uiState.emojiFilter = null;
  uiState.textFilter = "";
  uiState.descEditingId = null;
  if (els.searchInput) els.searchInput.value = "";
  saveState({ touch: false });
  render();
  setStatus(TF('status.project.selected', 'Proyecto seleccionado.'), "ok");
}

function createBlankProject() {
  syncStateIntoLibrary({ touch: false });
  state = newProject({ title: "" });
  library.projects.unshift(state);
  library.active_project_id = state.id;
  uiState.emojiFilter = null;
  uiState.textFilter = "";
  uiState.descEditingId = null;
  els.taskInput.value = "";
  if (els.searchInput) els.searchInput.value = "";
  saveState({ touch: false });
  render();
  setStatus(T('status.newPlan'), "ok");
}

function renameActiveProject() {
  const current = state.title || "";
  const next = prompt(TF('projects.rename.prompt', 'Nuevo nombre del proyecto:'), current);
  if (next === null) return;
  state.title = String(next).trim().slice(0, 200);
  saveState();
  render();
  setStatus(TF('status.project.renamed', 'Proyecto renombrado.'), "ok");
}

function duplicateActiveProject() {
  syncStateIntoLibrary({ touch: false });
  const copy = clone(state);
  const n = nowIso();
  copy.id = uid("project");
  copy.title = TF('projects.copyOf', 'Copia de {title}', { title: displayProjectTitle(state) });
  copy.status = "active";
  copy.created_at = n;
  copy.updated_at = n;
  ensureUniqueTaskIds(copy.tasks || [], new Set());
  state = normalizeProject(copy);
  library.projects.unshift(state);
  library.active_project_id = state.id;
  saveState({ touch: false });
  render();
  setStatus(TF('status.project.duplicated', 'Proyecto duplicado.'), "ok");
}

function toggleArchiveActiveProject() {
  state.status = state.status === "archived" ? "active" : "archived";
  saveState();
  render();
  setStatus(state.status === "archived" ? TF('status.project.archived', 'Proyecto archivado.') : TF('status.project.restored', 'Proyecto restaurado.'), "ok");
}

function deleteActiveProject() {
  if (!confirm(TF('confirm.deleteProject', '¿Borrar este proyecto y todas sus tareas y subtareas? Esta acción no se puede deshacer.'))) return;
  const id = state.id;
  library.projects = library.projects.filter(p => p.id !== id);
  if (!library.projects.length) library.projects.push(newProject());
  const next = library.projects.find(p => p.status !== "archived") || library.projects[0];
  state = next;
  library.active_project_id = state.id;
  saveState({ touch: false });
  render();
  setStatus(TF('status.project.deleted', 'Proyecto eliminado.'), "ok");
}

// -----------------------------------------------------------------------------
// Exportación/importación
// -----------------------------------------------------------------------------
function buildProjectExportPayload(project = state) {
  return {
    schema_version: EXPORT_PROJECT_SCHEMA_VERSION,
    app_version: APP_VERSION,
    exported_at: nowIso(),
    project
  };
}

function buildLibraryExportPayload() {
  syncStateIntoLibrary({ touch: false });
  return {
    schema_version: EXPORT_LIBRARY_SCHEMA_VERSION,
    app_version: APP_VERSION,
    exported_at: nowIso(),
    active_project_id: library.active_project_id,
    projects: library.projects
  };
}

function extractProjectFromImport(payload) {
  if (payload && typeof payload === "object" && payload.project && typeof payload.project === "object") return payload.project;
  if (payload && typeof payload === "object" && payload.plan && typeof payload.plan === "object") return payload.plan;
  return payload;
}

function projectToMarkdown(project = state) {
  const lines = [];
  lines.push(`# ${project.title || T('meta.noTitle')}`);
  if (project.category)             lines.push("", `${T('meta.category')}: ${project.category}`);
  if (project.summary)              lines.push("", project.summary);
  if (project.estimated_total_time) lines.push("", `${T('meta.totalTime')}: ${project.estimated_total_time}`);
  if (project.difficulty)           lines.push(`${T('meta.difficulty')}: ${project.difficulty}`);
  lines.push("");

  function walk(tasks, depth = 0) {
    for (const task of tasks) {
      const indent = "  ".repeat(depth);
      const emoji = task.emoji ? `${task.emoji} ` : "";
      lines.push(`${indent}- [${task.done ? "x" : " "}] ${emoji}${task.title}`);
      if (task.description)    lines.push(`${indent}  - ${task.description}`);
      if (task.estimated_time) lines.push(`${indent}  - ${T('meta.totalTime')}: ${task.estimated_time}`);
      if (task.energy)         lines.push(`${indent}  - ${T('task.energy', { value: task.energy })}`);
      walk(task.subtasks || [], depth + 1);
    }
  }

  walk(project.tasks || []);
  return lines.join("\n");
}

function downloadText(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importPayload(payload) {
  syncStateIntoLibrary({ touch: false });
  let imported = [];

  if (payload && typeof payload === "object" && Array.isArray(payload.projects)) {
    imported = payload.projects.slice(0, 250).map(p => normalizeProject(p));
  } else {
    imported = [normalizeProject(extractProjectFromImport(payload))];
  }

  const existingIds = new Set(library.projects.map(p => p.id));
  for (const project of imported) {
    if (!project.title) project.title = TF('projects.importedTitle', 'Proyecto importado');
    if (existingIds.has(project.id)) project.id = freshId("project", existingIds);
    existingIds.add(project.id);
    project.created_at = project.created_at || nowIso();
    project.updated_at = nowIso();
    library.projects.unshift(project);
  }
  state = imported[0];
  library.active_project_id = state.id;
  saveState({ touch: false });
}

// -----------------------------------------------------------------------------
// Diálogo de expansión de tarea
// -----------------------------------------------------------------------------
function openBranchDialog(task) {
  uiState.branchTargetId = task.id;
  uiState.branchSpice = uiState.spice;
  els.branchTaskPreview.textContent = T('branch.preview', { emoji: task.emoji || "📝", title: task.title });
  els.branchReplaceToggle.checked = false;
  setBranchSpice(uiState.branchSpice);
  els.branchDialog.showModal();
}

function setBranchBusy(busy) {
  if (!els.branchRunBtn) return;
  els.branchRunBtn.textContent = busy ? T('branch.cancelGeneration') : T('branch.run');
  els.branchRunBtn.classList.toggle("is-cancel", busy);
}

function normalizeBranch(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};
  const arr = Array.isArray(safe.tasks) ? safe.tasks : [];
  return ensureUniqueTaskIds(arr.slice(0, 60).map((t, i) => normalizeTask(t, i, 1)));
}

async function runBranchExpansion() {
  if (activeBranchController) {
    activeBranchController.abort();
    setStatus(T('status.canceling'));
    return;
  }

  const found = uiState.branchTargetId ? findTaskById(state.tasks, uiState.branchTargetId) : null;
  const target = found ? found.task : null;
  if (!target || found.depth !== 0) { els.branchDialog.close(); return; }

  const settings = loadSettings();
  const replace = els.branchReplaceToggle.checked;
  const lang = window.I18N.lang;
  activeBranchController = new AbortController();
  setBranchBusy(true);
  setStatus(T('status.branch.start'));

  try {
    const raw = await window.CumploOllama.chat({
      system: buildSystemPromptBranch(lang),
      user: buildBranchUserPrompt({
        parentTitle: target.title,
        parentDescription: target.description,
        spice: uiState.branchSpice,
        profile: els.profileSelect.value,
        lang
      }),
      options: { temperature: Number(settings.temperature) },
      signal: activeBranchController.signal
    });
    const parsed = extractJson(raw);
    const newSubs = normalizeBranch(parsed);
    if (!newSubs.length) throw new Error(T('err.parser.noSubs'));

    if (replace) target.subtasks = newSubs;
    else target.subtasks = (target.subtasks || []).concat(newSubs);
    target.collapsed = false;
    ensureUniqueTaskIds(state.tasks);

    saveState();
    render();
    els.branchDialog.close();
    setStatus(T('status.branch.added', { n: newSubs.length, title: target.title }), "ok");
  } catch (error) {
    console.error(error);
    if (activeBranchController && activeBranchController.signal.aborted) setStatus(T('status.cancelled'), "warn");
    else setStatus(T('status.error.prefix', { message: error.message }), "error");
  } finally {
    activeBranchController = null;
    setBranchBusy(false);
  }
}

// -----------------------------------------------------------------------------
// Handler: generar proyecto
// -----------------------------------------------------------------------------
function setGenerateBusy(busy) {
  if (!els.generateBtn) return;
  els.generateBtn.textContent = busy ? T('composer.cancel') : T('composer.generate');
  els.generateBtn.classList.toggle("is-cancel", busy);
}

async function runGenerate() {
  if (activeGenerateController) {
    activeGenerateController.abort();
    setStatus(T('status.canceling'));
    return;
  }

  const projectText = els.taskInput.value.trim();
  if (!projectText) { setStatus(T('status.error.empty'), "error"); return; }
  if (projectText.length > 2000) { setStatus(T('status.error.tooLong'), "error"); return; }

  const settings = loadSettings();
  const lang = window.I18N.lang;
  const previous = state;
  activeGenerateController = new AbortController();
  setGenerateBusy(true);
  setStatus(T('status.generating'));

  try {
    const raw = await window.CumploOllama.chat({
      system: buildSystemPrompt(lang),
      user: buildUserPrompt({ task: projectText, spice: uiState.spice, profile: els.profileSelect.value, lang }),
      options: { temperature: Number(settings.temperature) },
      signal: activeGenerateController.signal
    });
    const parsed = extractJson(raw);
    const n = nowIso();
    state = normalizeProject({
      ...parsed,
      id: previous.id || uid("project"),
      status: previous.status || "active",
      created_at: previous.created_at || n,
      updated_at: n
    });
    saveState({ touch: false });
    render();
    setStatus(T('status.generated'), "ok");
  } catch (error) {
    console.error(error);
    if (activeGenerateController && activeGenerateController.signal.aborted) setStatus(T('status.cancelled'), "warn");
    else setStatus(T('status.error.prefix', { message: error.message }), "error");
  } finally {
    activeGenerateController = null;
    setGenerateBusy(false);
  }
}

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------
els.generateBtn.addEventListener("click", runGenerate);

els.taskInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    runGenerate();
  }
});

els.addManualBtn.addEventListener("click", () => {
  const title = els.taskInput.value.trim() || T('prompt.newSubtask.manual');
  if (!state.title) {
    state.title = TF('projects.manualTitle', 'Proyecto manual');
    state.summary = "";
    state.category = "—";
    state.difficulty = T('task.energy.unknown');
    state.estimated_total_time = T('task.time.unknown');
  }
  state.tasks.push({
    id: uid("task"),
    title: title.slice(0, 240),
    emoji: "📝",
    description: "",
    estimated_time: T('task.time.unknown'),
    energy: T('task.energy.unknown'),
    done: false,
    collapsed: false,
    subtasks: []
  });
  els.taskInput.value = "";
  saveState();
  render();
  setStatus(T('status.added'), "ok");
});

els.newPlanBtn.addEventListener("click", createBlankProject);
if (els.renameProjectBtn) els.renameProjectBtn.addEventListener("click", renameActiveProject);
if (els.duplicateProjectBtn) els.duplicateProjectBtn.addEventListener("click", duplicateActiveProject);
if (els.archiveProjectBtn) els.archiveProjectBtn.addEventListener("click", toggleArchiveActiveProject);
if (els.deleteProjectBtn) els.deleteProjectBtn.addEventListener("click", deleteActiveProject);

if (els.projectSearchInput) {
  els.projectSearchInput.addEventListener("input", debounce(() => {
    uiState.projectFilter = els.projectSearchInput.value;
    renderProjectSidebar();
  }, 120));
}
if (els.showArchivedToggle) {
  els.showArchivedToggle.addEventListener("change", () => {
    uiState.showArchived = els.showArchivedToggle.checked;
    renderProjectSidebar();
  });
}

// Exportar / importar
els.exportBtn.addEventListener("click", () => els.exportDialog.showModal());
els.exportCloseBtn.addEventListener("click", () => els.exportDialog.close());

els.dlgExportMarkdownBtn.addEventListener("click", () => {
  if (!state.tasks.length) {
    setStatus(T('status.export.empty'), "error");
    els.exportDialog.close();
    return;
  }
  const file = `${slugForFile(state.title, "cumplo-project")}.md`;
  downloadText(file, projectToMarkdown(state), "text/markdown;charset=utf-8");
  els.exportDialog.close();
  setStatus(T('status.exportedMd', { file }), "ok");
});

els.dlgExportJsonBtn.addEventListener("click", () => {
  if (!state.tasks.length && !state.title) {
    setStatus(T('status.export.empty'), "error");
    els.exportDialog.close();
    return;
  }
  const file = `${slugForFile(state.title, "cumplo-project")}.json`;
  downloadText(file, JSON.stringify(buildProjectExportPayload(state), null, 2), "application/json;charset=utf-8");
  els.exportDialog.close();
  setStatus(T('status.exportedJson', { file }), "ok");
});

if (els.dlgExportAllJsonBtn) {
  els.dlgExportAllJsonBtn.addEventListener("click", () => {
    const file = "cumplo-projects.json";
    downloadText(file, JSON.stringify(buildLibraryExportPayload(), null, 2), "application/json;charset=utf-8");
    els.exportDialog.close();
    setStatus(TF('status.exportedAllJson', 'Biblioteca de proyectos exportada como {file}.', { file }), "ok");
  });
}

els.dlgImportInput.addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > IMPORT_MAX_BYTES) {
      throw new Error(T('err.import.tooLarge', { mb: Math.round(IMPORT_MAX_BYTES / 1024 / 1024) }));
    }
    const text = await file.text();
    const parsed = JSON.parse(text);
    importPayload(parsed);
    render();
    els.exportDialog.close();
    setStatus(T('status.imported'), "ok");
  } catch (error) {
    setStatus(T('status.import.error', { message: error.message }), "error");
  } finally {
    event.target.value = "";
  }
});

// Reset total
els.clearDataBtn.addEventListener("click", () => {
  if (!confirm(T('confirm.clearAll'))) return;
  try {
    removePersistentState();
    localStorage.removeItem(SETTINGS_KEY);
    for (const k of LEGACY_SETTINGS_KEYS) localStorage.removeItem(k);
  } catch (e) {
    console.warn("Cumplø: localStorage no accesible al limpiar", e);
  }
  try { window.CumploOllama.writeActiveModel(null); } catch {}
  library = emptyLibrary();
  state = newProject();
  library.projects = [state];
  library.active_project_id = state.id;
  uiState.emojiFilter = null;
  uiState.hideDone = false;
  uiState.textFilter = "";
  uiState.projectFilter = "";
  uiState.showArchived = false;
  uiState.descEditingId = null;
  if (els.hideDoneToggle) els.hideDoneToggle.checked = false;
  if (els.showArchivedToggle) els.showArchivedToggle.checked = false;
  if (els.searchInput) els.searchInput.value = "";
  if (els.projectSearchInput) els.projectSearchInput.value = "";
  render();
  setStatus(T('status.cleared'), "ok");
});

els.expandAllBtn.addEventListener("click", () => {
  setAllCollapsed(state.tasks, false);
  saveState();
  render();
});

els.collapseAllBtn.addEventListener("click", () => {
  setAllCollapsed(state.tasks, true);
  saveState();
  render();
});

els.hideDoneToggle.addEventListener("change", () => {
  uiState.hideDone = els.hideDoneToggle.checked;
  render();
});

const onSearchInput = debounce(() => {
  uiState.textFilter = els.searchInput.value;
  render();
}, 150);
if (els.searchInput) els.searchInput.addEventListener("input", onSearchInput);

els.openSettingsBtn.addEventListener("click", () => {
  const s = loadSettings();
  els.temperatureInput.value = s.temperature;
  renderModelSelect();
  els.settingsDialog.showModal();
});

els.saveSettingsBtn.addEventListener("click", () => {
  const currentSettings = loadSettings();
  saveSettings({
    ...currentSettings,
    temperature: Number(els.temperatureInput.value || DEFAULT_SETTINGS.temperature)
  });
  const chosen = els.modelSelect.value;
  if (chosen) window.CumploOllama.setActiveModel(chosen);
  els.settingsDialog.close();
  setStatus(T('status.settings.saved'), "ok");
});

els.redetectBtn.addEventListener("click", async () => {
  els.redetectBtn.disabled = true;
  els.modelHint.textContent = T('status.detect.retrying');
  await window.CumploOllama.detect();
  renderModelSelect();
  renderOllamaDiagnostics();
  els.redetectBtn.disabled = false;
});

els.branchRunBtn.addEventListener("click", runBranchExpansion);
els.branchCancelBtn.addEventListener("click", () => {
  if (activeBranchController) activeBranchController.abort();
  els.branchDialog.close();
});

if (els.ephemeralToggle) {
  els.ephemeralToggle.addEventListener("change", () => {
    const settings = loadSettings();
    settings.ephemeral = els.ephemeralToggle.checked;
    saveSettings(settings);
    if (settings.ephemeral) {
      removePersistentState();
      setStatus(T('status.ephemeral.enabled'), "ok");
    } else {
      saveState();
      setStatus(T('status.ephemeral.disabled'), "ok");
    }
    renderEphemeralToggle();
  });
}
if (els.retryOllamaBtn) {
  els.retryOllamaBtn.addEventListener("click", async () => {
    els.retryOllamaBtn.disabled = true;
    setStatus(T('status.detect.retrying'));
    await window.CumploOllama.detect();
    els.retryOllamaBtn.disabled = false;
    renderOllamaDiagnostics();
  });
}

// Botón Apagar
els.shutdownBtn.addEventListener("click", async () => {
  if (!confirm(T('confirm.shutdown'))) return;
  try {
    await fetch("/__cumplo_shutdown", { method: "POST" });
    renderShutdownScreen();
  } catch (e) {
    setStatus(T('status.shutdown.failed', { message: e.message }), "error");
  }
});

function renderShutdownScreen() {
  document.body.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "shutdown-screen";
  const h1 = document.createElement("h1");
  h1.textContent = T('shutdown.title');
  const p = document.createElement("p");
  p.textContent = T('shutdown.message');
  wrap.append(h1, p);
  document.body.appendChild(wrap);
}

// Idioma
function refreshLangButtons() {
  const current = window.I18N.lang;
  langBtns.forEach(btn => {
    if (btn.dataset.lang === current) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

langBtns.forEach(btn => {
  btn.addEventListener("click", () => window.I18N.set(btn.dataset.lang));
});

document.addEventListener("cumplo:lang-changed", () => {
  refreshLangButtons();
  setSpice(uiState.spice);
  setBranchSpice(uiState.branchSpice);
  renderOllamaStatus();
  renderModelSelect();
  renderOllamaDiagnostics();
  renderEphemeralToggle();
  setGenerateBusy(Boolean(activeGenerateController));
  setBranchBusy(Boolean(activeBranchController));
  render();
});

document.addEventListener("cumplo:ollama-changed", () => {
  renderOllamaStatus();
  renderOllamaDiagnostics();
  if (els.settingsDialog && els.settingsDialog.open) renderModelSelect();
});

async function loadFooterVersion() {
  if (!els.footerVersion) return;
  try {
    const res = await fetch("/__cumplo_health", { method: "GET" });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.version) els.footerVersion.textContent = "v" + data.version;
  } catch {}
}

// Boot
window.I18N.apply();
refreshLangButtons();
loadState();
setSpice(DEFAULT_SPICE);
setBranchSpice(DEFAULT_SPICE);
render();
renderEphemeralToggle();
renderOllamaStatus();
renderOllamaDiagnostics();
window.CumploOllama.init();
loadFooterVersion();
