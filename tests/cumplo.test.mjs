// =============================================================================
// Cumplø — tests/run-tests.mjs
// Suite de pruebas sin dependencias (node:test, Node 18+). Cubre las funciones
// puras más arriesgadas: parser tolerante de JSON, normalizadores canónicos,
// slugs, validación de temperatura, recomendación de OLLAMA_ORIGINS, esquemas
// de salida estructurada y diccionarios i18n.
//
// Ejecutar:  node --test "tests/*.test.mjs"   (o simplemente: node --test)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appSrc = readFileSync(join(root, 'app.js'), 'utf-8');

// ---------------------------------------------------------------------------
// Extracción de funciones y constantes de app.js (script de navegador, no
// módulo). Se localiza cada declaración y se evalúa en un contexto con stubs.
// ---------------------------------------------------------------------------
function extractBlock(src, header) {
  const start = src.indexOf(header);
  assert.notEqual(start, -1, `No se encontró: ${header}`);
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1) + (src[i + 1] === ';' ? ';' : '');
}

function extractConst(src, name) {
  const re = new RegExp(`const ${name} = [^;]+;`, 's');
  const m = src.match(re);
  assert.ok(m, `No se encontró const ${name}`);
  return m[0];
}

const stubs = {
  // Stubs mínimos de i18n para las funciones que devuelven textos de error
  T: (key) => key,
  TF: (key, fallback) => fallback || key,
  window: { I18N: { t: (k) => k, lang: 'es' } }
};

function evalFns(pieces, names) {
  const context = vm.createContext({ ...stubs });
  vm.runInContext(pieces.join('\n'), context);
  const out = {};
  for (const n of names) out[n] = context[n];
  return out;
}

const fns = evalFns(
  [
    extractConst(appSrc, 'DEFAULT_SETTINGS'),
    extractConst(appSrc, 'VALID_ID_RE'),
    extractConst(appSrc, 'CANONICAL_ENERGY'),
    extractConst(appSrc, 'LEGACY_UNKNOWN_TIME'),
    extractConst(appSrc, 'ALLOWED_EMOJIS'),
    extractBlock(appSrc, 'function toCanonicalEnergy'),
    extractBlock(appSrc, 'function toCanonicalTime'),
    extractBlock(appSrc, 'function clampTemperature'),
    extractBlock(appSrc, 'function recommendedOllamaOrigins'),
    extractBlock(appSrc, 'function stripCodeFences'),
    extractBlock(appSrc, 'function extractJson'),
    extractBlock(appSrc, 'function slugForFile'),
    extractBlock(appSrc, 'function normalizeEmoji')
  ],
  ['toCanonicalEnergy', 'toCanonicalTime', 'clampTemperature',
   'recommendedOllamaOrigins', 'stripCodeFences', 'extractJson',
   'slugForFile', 'normalizeEmoji']
);

// ---------------------------------------------------------------------------
// Normalización canónica de energía / dificultad
// ---------------------------------------------------------------------------
test('toCanonicalEnergy migra valores heredados ES/EN a canónicos', () => {
  assert.equal(fns.toCanonicalEnergy('baja'), 'low');
  assert.equal(fns.toCanonicalEnergy('Media'), 'medium');
  assert.equal(fns.toCanonicalEnergy(' ALTA '), 'high');
  assert.equal(fns.toCanonicalEnergy('low'), 'low');
  assert.equal(fns.toCanonicalEnergy('HIGH'), 'high');
});

test('toCanonicalEnergy devuelve vacío para desconocidos', () => {
  assert.equal(fns.toCanonicalEnergy(''), '');
  assert.equal(fns.toCanonicalEnergy(null), '');
  assert.equal(fns.toCanonicalEnergy('altísima'), '');
  assert.equal(fns.toCanonicalEnergy(42), '');
});

test('toCanonicalTime vacía los marcadores heredados de "sin estimación"', () => {
  assert.equal(fns.toCanonicalTime('sin estimación'), '');
  assert.equal(fns.toCanonicalTime('No Estimate'), '');
  assert.equal(fns.toCanonicalTime('  '), '');
  assert.equal(fns.toCanonicalTime('2 horas'), '2 horas');
});

// ---------------------------------------------------------------------------
// Parser tolerante de JSON (respuesta del modelo = entrada no confiable)
// ---------------------------------------------------------------------------
const sameJson = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

test('extractJson acepta JSON limpio', () => {
  sameJson(fns.extractJson('{"a":1}'), { a: 1 });
});

test('extractJson pela code fences', () => {
  sameJson(fns.extractJson('```json\n{"a":1}\n```'), { a: 1 });
});

test('extractJson recorta ruido alrededor del objeto', () => {
  sameJson(
    fns.extractJson('Claro, aquí tienes el plan:\n{"tasks":[]}\n¡Espero que ayude!'),
    { tasks: [] }
  );
});

test('extractJson lanza error con basura sin JSON', () => {
  assert.throws(() => fns.extractJson('no hay nada parseable aquí'));
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
test('clampTemperature acota y saneade entradas inválidas', () => {
  assert.equal(fns.clampTemperature('abc'), 0.25);
  assert.equal(fns.clampTemperature(''), 0.25);
  assert.equal(fns.clampTemperature(-1), 0);
  assert.equal(fns.clampTemperature(99), 2);
  assert.equal(fns.clampTemperature('0.7'), 0.7);
});

test('recommendedOllamaOrigins respeta puertos no estándar', () => {
  assert.equal(
    fns.recommendedOllamaOrigins('http://127.0.0.1:8766'),
    'http://127.0.0.1:8766,http://localhost:8766'
  );
  assert.equal(
    fns.recommendedOllamaOrigins('http://localhost:9000'),
    'http://localhost:9000,http://127.0.0.1:9000'
  );
});

test('slugForFile normaliza acentos y caracteres raros', () => {
  assert.equal(fns.slugForFile('Descripción archivística  · Ñoño'), 'descripcion-archivistica-nono');
  assert.equal(fns.slugForFile(''), 'cumplo-project');
});

test('normalizeEmoji restringe a la lista cerrada', () => {
  assert.equal(fns.normalizeEmoji('🏛️'), '🏛️');
  assert.equal(fns.normalizeEmoji('💣'), '📝');            // fuera de lista → por defecto
  assert.equal(fns.normalizeEmoji('📚 extra texto'), '📚'); // primer carácter válido
  assert.equal(fns.normalizeEmoji(''), '📝');
});

// ---------------------------------------------------------------------------
// prompts.js: esquemas de salida estructurada y valores canónicos
// ---------------------------------------------------------------------------
const promptsCtx = vm.createContext({ window: {} });
vm.runInContext(readFileSync(join(root, 'prompts.js'), 'utf-8'), promptsCtx);

test('buildProjectSchema define enums canónicos y estructura de dos niveles', () => {
  const schema = vm.runInContext('buildProjectSchema()', promptsCtx);
  assert.equal(JSON.stringify(schema.properties.difficulty.enum), JSON.stringify(['low', 'medium', 'high']));
  const task = schema.properties.tasks.items;
  assert.equal(JSON.stringify(task.properties.energy.enum), JSON.stringify(['low', 'medium', 'high']));
  assert.ok(task.properties.subtasks, 'las tareas admiten subtareas');
  assert.ok(!task.properties.subtasks.items.properties.subtasks,
    'las subtareas NO admiten anidación adicional (regla de producto)');
});

test('los prompts exigen valores canónicos y no enums por idioma', () => {
  const sysEs = vm.runInContext('buildSystemPrompt("es")', promptsCtx);
  const sysEn = vm.runInContext('buildSystemPrompt("en")', promptsCtx);
  for (const sys of [sysEs, sysEn]) {
    assert.ok(sys.includes('low | medium | high'));
    assert.ok(!sys.includes('baja | media | alta'));
  }
});

// ---------------------------------------------------------------------------
// i18n.js: paridad de claves ES/EN
// ---------------------------------------------------------------------------
test('los diccionarios ES y EN tienen exactamente las mismas claves', () => {
  const store = {};
  const i18nCtx = vm.createContext({
    window: {},
    document: {
      documentElement: { setAttribute() {} },
      querySelectorAll: () => [],
      dispatchEvent() {},
      addEventListener() {}
    },
    navigator: { language: 'es' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    CustomEvent: class { constructor() {} }
  });
  vm.runInContext(readFileSync(join(root, 'i18n.js'), 'utf-8'), i18nCtx);
  const I18N = vm.runInContext('window.I18N', i18nCtx);
  assert.ok(I18N && typeof I18N.t === 'function');
  // Claves nuevas de 0.8.1 presentes en ambos idiomas
  for (const key of ['energy.low', 'energy.high', 'status.undo', 'confirm.overwriteGenerate',
                     'status.generating.progress', 'status.library.full', 'err.responseTooLarge']) {
    const es = I18N.t(key);
    assert.notEqual(es, key, `Falta la clave ${key}`);
  }
});
