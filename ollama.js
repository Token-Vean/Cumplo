/* ===========================================================================
   Cumplø · Ollama client
   Comunicación con la API local de Ollama. No realiza ninguna llamada de red
   más allá de http://localhost:11434 / http://127.0.0.1:11434. La CSP del
   servidor restringe connect-src a ese origen para que esta promesa sea
   verificable por el usuario.

   Patrón derivado de Compo v0.1.13.
   =========================================================================== */

(function () {
  'use strict';

  const ENDPOINT = 'http://localhost:11434';
  const DETECT_TIMEOUT_MS   = 2500;
  const GENERATE_TIMEOUT_MS = 180000;

  // Allowlist de modelos recomendados para el flujo de Cumplø. Lista curada:
  // modelos pequeños/medianos que rinden bien con el system prompt de
  // planificación. Cuando el usuario tenga modelos descargados por su cuenta,
  // también aparecerán en la lista de modelos disponibles.
  const RECOMMENDED_MODELS = [
    { id: 'gemma3n:e2b',         sizeGB: 5.6, ramMinGB: 12, label: 'Equilibrado (Gemma 3n e2b)' },
    { id: 'gemma4:e2b',          sizeGB: 7.2, ramMinGB: 16, label: 'Reciente (Gemma 4 e2b)'      },
    { id: 'qwen2.5:7b-instruct', sizeGB: 4.7, ramMinGB: 12, label: 'Sólido (Qwen 2.5 7B)'         },
    { id: 'qwen3:8b',            sizeGB: 5.2, ramMinGB: 16, label: 'Alternativa (Qwen 3 8B)'      },
    { id: 'llama3.1:8b',         sizeGB: 4.7, ramMinGB: 12, label: 'Generalista (Llama 3.1 8B)'   },
    { id: 'phi3.5:3.8b',         sizeGB: 2.2, ramMinGB: 8,  label: 'Ligero (Phi 3.5 3.8B)'        }
  ];

  // Validación defensiva del nombre de modelo: solo lo que el registro de
  // Ollama acepta (alfanumérico, guiones, puntos, dos puntos, barras).
  const MODEL_NAME_RE = /^[a-z0-9][a-z0-9._:/-]{0,127}$/i;

  function isValidModelName(name) {
    if (typeof name !== 'string') return false;
    if (name.length < 2 || name.length > 128) return false;
    if (!MODEL_NAME_RE.test(name)) return false;
    if (/[\s'"<>;&|`$()]/.test(name)) return false;
    return true;
  }

  // ------------------------------------------------------------------------- //
  // Mensajes de error legibles. Usan I18N si está disponible; si no, fallback ES.
  // ------------------------------------------------------------------------- //
  function tt(key, fallback, params) {
    if (window.I18N && typeof window.I18N.t === 'function') {
      const v = window.I18N.t(key, params);
      // Si la traducción es la propia clave, significa "no encontrado": fallback.
      if (v !== key) return v;
    }
    if (params && fallback) {
      let out = fallback;
      for (const k of Object.keys(params)) out = out.split('{' + k + '}').join(String(params[k]));
      return out;
    }
    return fallback;
  }

  function friendlyFetchError(err, action) {
    if (err && err.name === 'AbortError') {
      return action === 'generate'
        ? tt('err.aborted.generate', 'Local generation exceeded the time limit.')
        : tt('err.aborted.other',    'The Ollama operation exceeded the time limit.');
    }
    if (err && err.name === 'TypeError') {
      return tt('err.network.cors', 'Could not connect to Ollama at http://localhost:11434.');
    }
    return err && err.message ? err.message : tt('err.unknown', 'Unknown error while talking to Ollama.');
  }

  function friendlyHttpError(status, details, action) {
    const suffix = details ? ` (${details})` : '';
    if (status === 404) {
      return (action === 'generate'
        ? tt('err.http.404.generate', 'Model not found.')
        : tt('err.http.404.other',    'Resource not found.')) + suffix;
    }
    if (status === 400) return tt('err.http.400', 'Ollama rejected the request.') + suffix;
    if (status === 500) return tt('err.http.500', 'Ollama internal error.') + suffix;
    if (status === 503) return tt('err.http.503', 'Ollama temporarily unavailable.') + suffix;
    return tt('err.http.generic', 'Ollama returned HTTP {status}.', { status }) + suffix;
  }

  // ------------------------------------------------------------------------- //
  // Cliente Ollama
  // ------------------------------------------------------------------------- //
  const Ollama = {
    available: null,    // null = no chequeado; true/false tras detect()
    models: [],         // array de { name, size, ... } como devuelve /api/tags
    activeModel: null,  // preferencia del usuario, persistida

    async init() {
      this.activeModel = this.readActiveModel();
      await this.detect();
    },

    async detect() {
      try {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), DETECT_TIMEOUT_MS);
        const res = await fetch(`${ENDPOINT}/api/tags`, {
          method: 'GET',
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (!res.ok) {
          this.available = false;
          this.models = [];
          this.notify();
          return false;
        }
        const data = await res.json();
        this.available = true;
        this.models = Array.isArray(data.models) ? data.models : [];
        if (!this.activeModel || !this.hasModel(this.activeModel)) {
          this.activeModel = this.pickDefaultModel();
          this.writeActiveModel(this.activeModel);
        }
        this.notify();
        return true;
      } catch (e) {
        this.available = false;
        this.models = [];
        this.lastDetectError = friendlyFetchError(e, 'detect');
        this.notify();
        return false;
      }
    },

    pickDefaultModel() {
      if (!this.models.length) return null;
      // Preferencia: gemma3n:e2b → gemma4:e2b → qwen2.5:7b-instruct → resto recomendados → primero disponible.
      for (const pref of RECOMMENDED_MODELS) {
        const found = this.models.find(m => m.name === pref.id);
        if (found) return found.name;
      }
      return this.models[0].name;
    },

    hasModel(name) {
      return this.models.some(m => m.name === name);
    },

    setActiveModel(name) {
      if (!this.hasModel(name)) return false;
      this.activeModel = name;
      this.writeActiveModel(name);
      this.notify();
      return true;
    },

    readActiveModel() {
      try { return localStorage.getItem('cumplo_model') || null; } catch { return null; }
    },

    writeActiveModel(name) {
      try {
        if (name) localStorage.setItem('cumplo_model', name);
        else localStorage.removeItem('cumplo_model');
      } catch { /* silencioso */ }
    },

    /**
     * Generación a partir de un mensaje system + user. Devuelve la string
     * con el contenido del assistant. La validación/normalización del JSON
     * la hace app.js (parser tolerante).
     */
    async chat({ system, user, model, options, signal } = {}) {
      if (!system) throw new Error('Missing system prompt');
      if (!user)   throw new Error('Missing user prompt');

      const useModel = model || this.activeModel;
      if (!useModel) {
        throw new Error(tt('err.noActiveModel', 'No active model.'));
      }
      if (!isValidModelName(useModel)) {
        throw new Error(tt('err.modelName', 'Invalid model name.'));
      }

      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), GENERATE_TIMEOUT_MS);
      if (signal) {
        if (signal.aborted) ctrl.abort();
        else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
      }

      try {
        const body = {
          model: useModel,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: user   }
          ],
          options: Object.assign({
            temperature: 0.25,
            top_p: 0.9,
            num_ctx: 8192
          }, options || {})
        };
        // No enviamos format: "json" deliberadamente: rompe con modelos
        // pequeños y el parser tolerante de app.js limpia el JSON aunque
        // venga con code fences o ruido alrededor.

        let res;
        try {
          res = await fetch(`${ENDPOINT}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal
          });
        } catch (err) {
          if (err && (err.name === 'AbortError' || ctrl.signal.aborted)) {
            throw new Error(friendlyFetchError({ name: 'AbortError' }, 'generate'));
          }
          throw new Error(friendlyFetchError(err, 'generate'));
        }
        if (!res.ok) {
          let details = '';
          try {
            const err = await res.json();
            details = err && err.error ? err.error : '';
          } catch { /* respuesta no JSON */ }
          throw new Error(friendlyHttpError(res.status, details, 'generate'));
        }
        let data;
        try { data = await res.json(); }
        catch { throw new Error(tt('err.unparseable', 'Ollama returned an unreadable response.')); }
        if (!data || !data.message || typeof data.message.content !== 'string') {
          throw new Error(tt('err.noContent', 'Ollama returned no content.'));
        }
        return data.message.content;
      } finally {
        clearTimeout(timer);
      }
    },

    notify() {
      document.dispatchEvent(new CustomEvent('cumplo:ollama-changed', {
        detail: {
          available: this.available,
          models: this.models,
          activeModel: this.activeModel
        }
      }));
    },

    // Utilidades expuestas para app.js
    isValidModelName,
    RECOMMENDED_MODELS
  };

  window.CumploOllama = Ollama;
})();
