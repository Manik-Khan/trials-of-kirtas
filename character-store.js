// character-store.js
// Client-side read/write layer for mutable character data.
// Loaded by sheet.html. Works alongside characters.js (static data).
//
// USAGE:
//   CharacterStore.load('caim')          → fetches from Netlify function
//   CharacterStore.get()                 → returns current in-memory data
//   CharacterStore.save(patch)           → merges patch and writes to GitHub
//   CharacterStore.onUpdate(fn)          → register listener for data changes
//
// The store keeps an in-memory copy. UI reads from memory, writes
// debounce to the server so rapid edits don't spam GitHub.

const CharacterStore = (() => {

  const FUNCTION_URL = '/.netlify/functions/character';
  const DEBOUNCE_MS  = 1200; // wait 1.2s after last change before writing

  let _key       = null;
  let _data      = null;
  let _sha       = null;
  let _listeners = [];
  let _debounceTimer = null;
  let _pendingPatch  = {};
  let _status    = 'idle'; // 'idle' | 'loading' | 'saving' | 'saved' | 'error'

  // ── Status helpers ──
  function setStatus(s) {
    _status = s;
    _listeners.forEach(fn => fn({ type: 'status', status: s, data: _data }));
  }

  function notify() {
    _listeners.forEach(fn => fn({ type: 'data', data: _data, status: _status }));
  }

  // ── Load character data from server ──
  async function load(key) {
    _key = key;
    setStatus('loading');
    try {
      const res  = await fetch(`${FUNCTION_URL}?character=${key}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Load failed');
      _data = json.data;
      _sha  = json.sha;
      setStatus('idle');
      notify();
      return _data;
    } catch (e) {
      console.error('[CharacterStore] load error:', e);
      setStatus('error');
      // Fall back to defaults so UI still works offline
      _data = _defaultData(key);
      notify();
      return _data;
    }
  }

  // ── Get current in-memory data ──
  function get() {
    return _data;
  }

  // ── Save — merges patch into memory immediately, debounces network write ──
  function save(patch, authorName) {
    if (!_key) return;

    // Merge patch into in-memory data immediately (optimistic)
    _data = _deepMerge(_data, patch);
    _pendingPatch = _deepMerge(_pendingPatch, patch);
    if (authorName) _pendingPatch._author = authorName;
    notify();

    // Debounce the actual network write
    clearTimeout(_debounceTimer);
    setStatus('saving');
    _debounceTimer = setTimeout(() => _flush(), DEBOUNCE_MS);
  }

  // ── Force immediate write (e.g. on page unload) ──
  function flush() {
    clearTimeout(_debounceTimer);
    return _flush();
  }

  async function _flush() {
    if (!_key || Object.keys(_pendingPatch).length === 0) return;
    const patch = { ..._pendingPatch };
    _pendingPatch = {};
    try {
      const res  = await fetch(`${FUNCTION_URL}?character=${_key}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      _sha  = json.data ? null : _sha; // SHA rotates on write; re-fetch will get new one
      setStatus('saved');
      // Brief "Saved" flash then back to idle
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      console.error('[CharacterStore] save error:', e);
      setStatus('error');
    }
  }

  // ── Register update listener ──
  // fn receives { type: 'data'|'status', data, status }
  function onUpdate(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); }; // returns unsubscribe fn
  }

  // ── Helpers ──
  function _defaultData(key) {
    return {
      key,
      inventory: [],
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      notes: '',
      bio: { personality: '', ideals: '', bonds: '', flaws: '', backstory: '' },
      combat: { hp: null, hpTemp: 0, hpBonus: 0, pipState: {} },
      lastUpdated: null,
    };
  }

  function _deepMerge(target, source) {
    const out = { ...target };
    for (const k of Object.keys(source)) {
      if (source[k] !== null && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = _deepMerge(target[k] || {}, source[k]);
      } else {
        out[k] = source[k];
      }
    }
    return out;
  }

  return { load, get, save, flush, onUpdate };

})();
