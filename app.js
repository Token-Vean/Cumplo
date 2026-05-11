// =============================================================================
// Cumplø — app.js
// Estado, render y handlers. Tratamos la respuesta del modelo como entrada
// no confiable: parsea, normaliza, recorta longitudes y nunca inserta HTML
// generado por el modelo (sólo textContent / nodos DOM).
//
// Bilingüe ES/EN: todos los strings dinámicos pasan por I18N.t(). El idioma
// activo se inyecta también en los prompts enviados a Ollama, de modo que la
// respuesta del modelo viene en el mismo idioma que la interfaz.
// =============================================================================

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------
const STORAGE_KEY  = "cumplo_state_v1";
const SETTINGS_KEY = "cumplo_settings_v1";

const LEGACY_STATE_KEYS    = ["tareas_locales_state_v1"];
const LEGACY_SETTINGS_KEYS = ["tareas_locales_settings_v1"];

const DEFAULT_SETTINGS = { temperature: 0.25 };
const DEFAULT_SPICE = 3;

const ALLOWED_EMOJIS = new Set([
  "📝","✉️","📞","🗂️","📁","📚","🔎","💻","🛠️","🧮",
  "💶","🧾","🗓️","🤝","👥","🧠","🧹","🛒","🚚","🚪",
  "🏛️","🍽️","🎯","⚠️","✅"
]);

// Atajo cómodo para I18N.t.
function T(key, params) { return window.I18N.t(key, params); }

// -----------------------------------------------------------------------------
// Estado en memoria
// -----------------------------------------------------------------------------
let state = emptyState();
let uiState = {
  spice: DEFAULT_SPICE,
  branchSpice: DEFAULT_SPICE,
  branchTargetId: null,
  hideDone: false,
  emojiFilter: null
};

function emptyState() {
  return {
    title: "",
    summary: "",
    category: "",
    difficulty: "",
    estimated_total_time: "",
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
  filterBar:           document.getElementById("filterBar"),
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
  dlgImportInput:      document.getElementById("dlgImportInput"),
  branchDialog:        document.getElementById("branchDialog"),
  branchSpiceScale:    document.getElementById("branchSpiceScale"),
  branchSpiceHint:     document.getElementById("branchSpiceHint"),
  branchTaskPreview:   document.getElementById("branchTaskPreview"),
  branchReplaceToggle: document.getElementById("branchReplaceToggle"),
  branchRunBtn:        document.getElementById("branchRunBtn"),
  branchCancelBtn:     document.getElementById("branchCancelBtn"),
  ollamaStatus:        document.getElementById("ollamaStatus"),
  shutdownBtn:         document.getElementById("shutdownBtn")
};

const langBtns = document.querySelectorAll(".lang-btn");

// -----------------------------------------------------------------------------
// Settings de la app
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
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// -----------------------------------------------------------------------------
// Estado del plan
// -----------------------------------------------------------------------------
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    let migrated = false;
    if (!raw) {
      for (const k of LEGACY_STATE_KEYS) {
        raw = localStorage.getItem(k);
        if (raw) { migrated = true; break; }
      }
    }
    if (!raw) return;
    state = normalizePlan(JSON.parse(raw));
    if (migrated) saveState();
  } catch {
    state = emptyState();
  }
}

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------
function setStatus(message, type = "") {
  els.statusBox.textContent = message;
  els.statusBox.className = `status-box ${type}`.trim();
}

function uid(prefix = "t") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

// Acepta "baja|media|alta" y "low|medium|high"; normaliza a un valor canónico
// según el idioma actual (lo que se muestra al usuario).
const ENERGY_MAP = {
  baja: { es: 'baja', en: 'low' },     low:    { es: 'baja', en: 'low' },
  media:{ es: 'media', en: 'medium' }, medium: { es: 'media', en: 'medium' },
  alta: { es: 'alta', en: 'high' },    high:   { es: 'alta', en: 'high' }
};

function normalizeEnergy(value) {
  const key = String(value || '').toLowerCase();
  if (ENERGY_MAP[key]) return ENERGY_MAP[key][window.I18N.lang] || ENERGY_MAP[key].es;
  return T('task.energy.unknown');  // "media" / "medium"
}

function normalizeEmoji(value) {
  const v = String(value || "").trim();
  const candidate = [...v][0] || "";
  if (ALLOWED_EMOJIS.has(v)) return v;
  if (ALLOWED_EMOJIS.has(candidate)) return candidate;
  if (ALLOWED_EMOJIS.has(candidate + "\uFE0F")) return candidate + "\uFE0F";
  return "📝";
}

function normalizeTask(task, index = 0) {
  const safe = task && typeof task === "object" ? task : {};
  const subtasks = Array.isArray(safe.subtasks)
    ? safe.subtasks.slice(0, 40).map((t, i) => normalizeTask(t, i))
    : [];
  return {
    id:             typeof safe.id === "string" && safe.id.trim() ? safe.id.trim() : uid(`t${index}`),
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

function normalizePlan(plan) {
  const safe = plan && typeof plan === "object" ? plan : {};
  const tasks = Array.isArray(safe.tasks)
    ? safe.tasks.slice(0, 80).map((t, i) => normalizeTask(t, i))
    : [];
  return {
    title:                String(safe.title   || "").slice(0, 200),
    summary:              String(safe.summary || "").slice(0, 1000),
    category:             String(safe.category || "").slice(0, 60),
    difficulty:           normalizeEnergy(safe.difficulty),
    estimated_total_time: String(safe.estimated_total_time || T('task.time.unknown')).slice(0, 100),
    tasks
  };
}

function normalizeBranch(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};
  const arr = Array.isArray(safe.tasks) ? safe.tasks : [];
  return arr.slice(0, 40).map((t, i) => normalizeTask(t, i));
}

function countTasks(tasks) {
  return tasks.reduce((acc, task) => acc + 1 + countTasks(task.subtasks || []), 0);
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

function isWholeDone(task) {
  return task.done && (task.subtasks || []).every(isWholeDone);
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
  if (ol.activeModel) {
    label.textContent = T('ollama.activeModel', { model: ol.activeModel });
  } else if (ol.models.length) {
    label.textContent = T('ollama.someModels', { count: ol.models.length });
  } else {
    label.textContent = T('ollama.noModel');
  }
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
    els.modelHint.textContent = ol.available
      ? T('settings.hint.noModels')
      : T('settings.hint.noOllama');
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

// -----------------------------------------------------------------------------
// Render principal
// -----------------------------------------------------------------------------
function render() {
  const total = countTasks(state.tasks);
  const done  = countDone(state.tasks);
  els.taskCount.textContent = total
    ? T('tasks.counter', { done, total })
    : T('tasks.empty');

  renderMeta();
  renderFilterBar();

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
  els.tasksRoot.appendChild(renderTaskList(state.tasks));
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
    [T('meta.plan'),       state.title    || T('meta.noTitle')],
    [T('meta.category'),   state.category || "—"],
    [T('meta.difficulty'), state.difficulty || T('task.energy.unknown')],
    [T('meta.totalTime'),  state.estimated_total_time || T('task.time.unknown')]
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

function renderFilterBar() {
  const counts = collectEmojis(state.tasks);
  if (counts.size === 0) {
    els.filterBar.classList.add("hidden");
    els.filterBar.innerHTML = "";
    return;
  }
  els.filterBar.classList.remove("hidden");
  els.filterBar.innerHTML = "";

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

function renderTaskList(tasks) {
  const ul = document.createElement("ul");
  ul.className = "task-list";
  for (const task of tasks) {
    if (uiState.emojiFilter && !branchMatchesEmoji(task, uiState.emojiFilter)) continue;
    if (uiState.hideDone && task.done && (task.subtasks || []).every(s => isWholeDone(s))) continue;
    ul.appendChild(renderTaskItem(task));
  }
  return ul;
}

function renderTaskItem(task) {
  const li = document.createElement("li");
  li.className = `task-item ${task.done ? "done" : ""}`;

  const card = document.createElement("article");
  card.className = "task-card";

  const main = document.createElement("div");
  main.className = "task-main";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.done;
  checkbox.title = T('task.check.aria');
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
  title.className = "task-title";
  title.value = task.title;
  title.addEventListener("input", () => {
    task.title = title.value.slice(0, 240);
    saveState();
  });

  titleRow.append(emojiSpan, title);

  const desc = document.createElement("p");
  desc.className = "task-description";
  desc.textContent = task.description || T('task.noDescription');

  const details = document.createElement("div");
  details.className = "task-details";

  const time = document.createElement("span");
  time.className = "pill";
  time.textContent = T('task.time',   { value: task.estimated_time || T('task.time.unknown') });

  const energy = document.createElement("span");
  energy.className = "pill";
  energy.textContent = T('task.energy', { value: task.energy || T('task.energy.unknown') });

  details.append(time, energy);
  content.append(titleRow, desc, details);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const expandAiBtn = smallButton(T('task.action.expandMore'), () => openBranchDialog(task));
  expandAiBtn.title = T('task.action.expandMore.title');

  const addBtn = smallButton(T('task.action.addSub'), () => {
    task.subtasks.push({
      id: uid("sub"),
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

  const editBtn = smallButton(T('task.action.editDesc'), () => {
    const value = prompt(T('confirm.editDesc'), task.description || "");
    if (value !== null) {
      task.description = value.slice(0, 1000);
      saveState();
      render();
    }
  });

  const deleteBtn = smallButton(T('task.action.delete'), () => {
    if (confirm(T('confirm.deleteTask'))) {
      removeTaskById(state.tasks, task.id);
      saveState();
      render();
    }
  });
  deleteBtn.classList.add("danger-small");

  actions.append(expandAiBtn, addBtn, editBtn, deleteBtn);
  main.append(checkbox, toggle, content, actions);
  card.appendChild(main);

  if (task.subtasks && task.subtasks.length && !task.collapsed) {
    card.appendChild(renderTaskList(task.subtasks));
  }

  li.appendChild(card);
  return li;
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

function findTaskById(tasks, id) {
  for (const t of tasks) {
    if (t.id === id) return t;
    const sub = findTaskById(t.subtasks || [], id);
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
// Exportaciones
// -----------------------------------------------------------------------------
function planToMarkdown() {
  const lines = [];
  lines.push(`# ${state.title || T('meta.noTitle')}`);
  if (state.category)             lines.push("", `${T('meta.category')}: ${state.category}`);
  if (state.summary)              lines.push("", state.summary);
  if (state.estimated_total_time) lines.push("", `${T('meta.totalTime')}: ${state.estimated_total_time}`);
  if (state.difficulty)           lines.push(`${T('meta.difficulty')}: ${state.difficulty}`);
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

  walk(state.tasks);
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

// -----------------------------------------------------------------------------
// Diálogo de expansión de rama
// -----------------------------------------------------------------------------
function openBranchDialog(task) {
  uiState.branchTargetId = task.id;
  uiState.branchSpice = uiState.spice;
  els.branchTaskPreview.textContent = T('branch.preview', { emoji: task.emoji || "📝", title: task.title });
  els.branchReplaceToggle.checked = false;
  setBranchSpice(uiState.branchSpice);
  els.branchDialog.showModal();
}

async function runBranchExpansion() {
  const targetId = uiState.branchTargetId;
  const target = targetId ? findTaskById(state.tasks, targetId) : null;
  if (!target) { els.branchDialog.close(); return; }

  const settings = loadSettings();
  const replace = els.branchReplaceToggle.checked;
  const lang = window.I18N.lang;
  els.branchRunBtn.disabled = true;
  setStatus(T('status.branch.start'));

  try {
    const raw = await window.CumploOllama.chat({
      system: buildSystemPromptBranch(lang),
      user:   buildBranchUserPrompt({
        parentTitle:       target.title,
        parentDescription: target.description,
        spice:             uiState.branchSpice,
        profile:           els.profileSelect.value,
        lang
      }),
      options: { temperature: Number(settings.temperature) }
    });
    const parsed = extractJson(raw);
    const newSubs = normalizeBranch(parsed);
    if (!newSubs.length) throw new Error(T('err.parser.noSubs'));

    if (replace) target.subtasks = newSubs;
    else target.subtasks = (target.subtasks || []).concat(newSubs);
    target.collapsed = false;

    saveState();
    render();
    els.branchDialog.close();
    setStatus(T('status.branch.added', { n: newSubs.length, title: target.title }), "ok");
  } catch (error) {
    console.error(error);
    setStatus(T('status.error.prefix', { message: error.message }), "error");
  } finally {
    els.branchRunBtn.disabled = false;
  }
}

// -----------------------------------------------------------------------------
// Handler: generar desglose
// -----------------------------------------------------------------------------
els.generateBtn.addEventListener("click", async () => {
  const task = els.taskInput.value.trim();
  if (!task) { setStatus(T('status.error.empty'), "error"); return; }
  if (task.length > 2000) { setStatus(T('status.error.tooLong'), "error"); return; }

  const settings = loadSettings();
  const lang = window.I18N.lang;
  setStatus(T('status.generating'));
  els.generateBtn.disabled = true;

  try {
    const raw = await window.CumploOllama.chat({
      system: buildSystemPrompt(lang),
      user:   buildUserPrompt({ task, spice: uiState.spice, profile: els.profileSelect.value, lang }),
      options: { temperature: Number(settings.temperature) }
    });
    const parsed = extractJson(raw);
    state = normalizePlan(parsed);
    saveState();
    render();
    setStatus(T('status.generated'), "ok");
  } catch (error) {
    console.error(error);
    setStatus(T('status.error.prefix', { message: error.message }), "error");
  } finally {
    els.generateBtn.disabled = false;
  }
});

// -----------------------------------------------------------------------------
// Manual: añadir tarea sin modelo
// -----------------------------------------------------------------------------
els.addManualBtn.addEventListener("click", () => {
  const title = els.taskInput.value.trim() || T('prompt.newSubtask.manual');
  if (!state.title) {
    state.title      = T('meta.noTitle');
    state.summary    = "";
    state.category   = "—";
    state.difficulty = T('task.energy.unknown');
    state.estimated_total_time = T('task.time.unknown');
  }
  state.tasks.push({
    id: uid("manual"),
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

// -----------------------------------------------------------------------------
// Nuevo plan
// -----------------------------------------------------------------------------
els.newPlanBtn.addEventListener("click", () => {
  const hasTasks = state.tasks.length > 0 || state.title;
  if (hasTasks && !confirm(T('confirm.newPlan'))) return;
  state = emptyState();
  uiState.emojiFilter = null;
  uiState.hideDone = false;
  els.hideDoneToggle.checked = false;
  els.taskInput.value = "";
  saveState();
  render();
  setStatus(T('status.newPlan'), "ok");
});

// -----------------------------------------------------------------------------
// Exportar / importar (dialog)
// -----------------------------------------------------------------------------
els.exportBtn.addEventListener("click", () => els.exportDialog.showModal());
els.exportCloseBtn.addEventListener("click", () => els.exportDialog.close());

els.dlgExportMarkdownBtn.addEventListener("click", () => {
  if (!state.tasks.length) {
    setStatus(T('status.export.empty'), "error");
    els.exportDialog.close();
    return;
  }
  const file = "cumplo-plan.md";
  downloadText(file, planToMarkdown(), "text/markdown;charset=utf-8");
  els.exportDialog.close();
  setStatus(T('status.exportedMd', { file }), "ok");
});

els.dlgExportJsonBtn.addEventListener("click", () => {
  if (!state.tasks.length) {
    setStatus(T('status.export.empty'), "error");
    els.exportDialog.close();
    return;
  }
  const file = "cumplo-plan.json";
  downloadText(file, JSON.stringify(state, null, 2), "application/json;charset=utf-8");
  els.exportDialog.close();
  setStatus(T('status.exportedJson', { file }), "ok");
});

els.dlgImportInput.addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    state = normalizePlan(JSON.parse(text));
    saveState();
    render();
    els.exportDialog.close();
    setStatus(T('status.imported'), "ok");
  } catch (error) {
    setStatus(T('status.import.error', { message: error.message }), "error");
  } finally {
    event.target.value = "";
  }
});

// -----------------------------------------------------------------------------
// Borrar TODO (reset total)
// -----------------------------------------------------------------------------
els.clearDataBtn.addEventListener("click", () => {
  if (!confirm(T('confirm.clearAll'))) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  try { window.CumploOllama.writeActiveModel(null); } catch {}
  for (const k of LEGACY_STATE_KEYS)    localStorage.removeItem(k);
  for (const k of LEGACY_SETTINGS_KEYS) localStorage.removeItem(k);
  state = emptyState();
  uiState.emojiFilter = null;
  uiState.hideDone = false;
  if (els.hideDoneToggle) els.hideDoneToggle.checked = false;
  render();
  setStatus(T('status.cleared'), "ok");
});

// -----------------------------------------------------------------------------
// Otros handlers
// -----------------------------------------------------------------------------
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

els.openSettingsBtn.addEventListener("click", () => {
  const s = loadSettings();
  els.temperatureInput.value = s.temperature;
  renderModelSelect();
  els.settingsDialog.showModal();
});

els.saveSettingsBtn.addEventListener("click", () => {
  saveSettings({
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
  els.redetectBtn.disabled = false;
});

els.branchRunBtn.addEventListener("click", runBranchExpansion);
els.branchCancelBtn.addEventListener("click", () => els.branchDialog.close());

// -----------------------------------------------------------------------------
// Botón Apagar
// -----------------------------------------------------------------------------
els.shutdownBtn.addEventListener("click", async () => {
  if (!confirm(T('confirm.shutdown'))) return;
  try {
    await fetch("/__cumplo_shutdown", { method: "POST" });
    document.body.innerHTML = `
      <div style="padding:40px; text-align:center; font-family:system-ui, sans-serif;">
        <h1>${T('shutdown.title')}</h1>
        <p>${T('shutdown.message')}</p>
      </div>`;
  } catch (e) {
    setStatus(T('status.shutdown.failed', { message: e.message }), "error");
  }
});

// -----------------------------------------------------------------------------
// Conmutador de idioma
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Reaccionar a cambios de idioma: re-renderizar todo lo dinámico
// -----------------------------------------------------------------------------
document.addEventListener("cumplo:lang-changed", () => {
  refreshLangButtons();
  setSpice(uiState.spice);
  setBranchSpice(uiState.branchSpice);
  renderOllamaStatus();
  renderModelSelect();
  render();
});

// -----------------------------------------------------------------------------
// Listener del estado de Ollama
// -----------------------------------------------------------------------------
document.addEventListener("cumplo:ollama-changed", () => {
  renderOllamaStatus();
  if (els.settingsDialog && els.settingsDialog.open) renderModelSelect();
});

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------
window.I18N.apply();           // aplica traducciones a [data-i18n] estáticos
refreshLangButtons();
loadState();
setSpice(DEFAULT_SPICE);
setBranchSpice(DEFAULT_SPICE);
render();
renderOllamaStatus();
window.CumploOllama.init();
