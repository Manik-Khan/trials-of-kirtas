// character-store.js
// Supabase-backed adapter — Phase 0 of the main-sheet migration.
//
// Keeps the EXACT public surface the old GitHub-JSON store exposed
// (load / get / save / flush / onUpdate, the in-memory cache, the debounce, and the
// idle|loading|saving|saved|error status events sheet.html's sync UI is wired to) — but
// reads and writes now go to Supabase via window.CharacterData, the same live truth
// party.html and the nightly export already use, instead of data/characters/<key>.json.
//
// Why: the old path wrote only to the git JSON, which the nightly Supabase->git export
// then overwrote — so every edit on this sheet had a <24h half-life. Routing through
// CharacterData puts edits in the source of truth, so they persist (and party.html sees
// them live).
//
// Field mapping (sheet shape  <->  Supabase column):
//   combat            <->  vitals      — SAME {hp,hpTemp,hpBonus,pipState} shape party.html
//                                         writes; party's `concentration` is preserved by the
//                                         merge below (we never blind-overwrite the column).
//   inventory / currency / notes / bio / equipment / structural   pass through 1:1
//
// Partial patches (bio, combat) are deep-merged into the loaded row BEFORE the write,
// because CharacterData.save replaces a whole column with whatever value it's handed.
//
// Requires nav.js (CharacterData waits on window.__tok) and character-data.js — both are
// loaded by sheet.html ahead of this file. The actual CharacterData calls only run inside
// load()/save(), which fire after the page (and the session) are up.

const CharacterStore = (() => {

  const DEBOUNCE_MS = 1200; // wait 1.2s after the last change before writing

  let _key       = null;
  let _data      = null;   // in-memory copy in SHEET shape (combat === vitals)
  let _listeners = [];
  let _debounceTimer = null;
  let _pendingKeys   = {}; // set of sheet-shape top-level keys awaiting flush
  let _status    = 'idle'; // 'idle' | 'loading' | 'saving' | 'saved' | 'error'

  // sheet-shape key -> Supabase editable column. Anything not here is not written.
  const COL = {
    combat: 'vitals',
    inventory: 'inventory',
    currency: 'currency',
    notes: 'notes',
    bio: 'bio',
    equipment: 'equipment',
    structural: 'structural',
  };

  // ── Status / notify ──
  function setStatus(s) {
    _status = s;
    _listeners.forEach(fn => fn({ type: 'status', status: s, data: _data }));
  }
  function notify() {
    _listeners.forEach(fn => fn({ type: 'data', data: _data, status: _status }));
  }

  function _deepMerge(target, source) {
    const out = { ...(target || {}) };
    for (const k of Object.keys(source || {})) {
      if (source[k] !== null && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = _deepMerge(out[k] || {}, source[k]);
      } else {
        out[k] = source[k];
      }
    }
    return out;
  }

  // CharacterData row (has `vitals`) -> sheet shape (has `combat`).
  function toSheet(row) {
    if (!row) return _defaultData(_key);
    return {
      key:         row.key,
      structural:  row.structural || {},
      combat:      row.vitals     || {},   // the sheet reads d.combat
      inventory:   row.inventory  || [],
      equipment:   row.equipment  || {},
      currency:    row.currency   || {},
      bio:         row.bio        || {},
      notes:       (row.notes == null ? '' : row.notes),
      lastUpdated: row.updatedAt  || null,
    };
  }

  // ── Load this character's live data from Supabase ──
  async function load(key) {
    _key = key;
    setStatus('loading');
    try {
      if (typeof CharacterData === 'undefined') throw new Error('CharacterData not loaded');
      const row = await CharacterData.loadCharacter(key);
      _data = toSheet(row);
      setStatus('idle');
      notify();
      return _data;
    } catch (e) {
      console.error('[CharacterStore] load error:', e);
      setStatus('error');
      _data = _defaultData(key); // keep the UI alive on a transient failure
      notify();
      return _data;
    }
  }

  function get() {
    return _data;
  }

  // ── Save — optimistic merge into memory, debounce a Supabase write ──
  // Second arg (author) is accepted for call-site compatibility but ignored:
  // Supabase attributes the write via the session/RLS, not a label.
  function save(patch /*, author */) {
    if (!_key || !patch) return;
    _data = _deepMerge(_data || _defaultData(_key), patch);
    Object.keys(patch).forEach(k => { if (k !== '_author') _pendingKeys[k] = true; });
    notify();

    clearTimeout(_debounceTimer);
    setStatus('saving');
    _debounceTimer = setTimeout(() => _flush(), DEBOUNCE_MS);
  }

  function flush() {
    clearTimeout(_debounceTimer);
    return _flush();
  }

  async function _flush() {
    const keys = Object.keys(_pendingKeys);
    if (!_key || !keys.length) return;
    _pendingKeys = {};

    // One Supabase patch: the FULL merged value for each touched key, mapped to its
    // column (so a partial bio/combat edit never drops sibling fields).
    const colPatch = {};
    for (const k of keys) {
      const col = COL[k];
      if (!col) continue;              // not an editable column -> skip
      colPatch[col] = _data[k];
    }
    if (!Object.keys(colPatch).length) return;

    try {
      if (typeof CharacterData === 'undefined') throw new Error('CharacterData not loaded');
      await CharacterData.save(_key, colPatch);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      console.error('[CharacterStore] save error:', e);
      setStatus('error');
    }
  }

  // ── Register update listener — fn receives { type:'data'|'status', data, status } ──
  function onUpdate(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }

  function _defaultData(key) {
    return {
      key,
      structural: {},
      inventory: [],
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      notes: '',
      bio: { personality: '', ideals: '', bonds: '', flaws: '', backstory: '' },
      combat: { hp: null, hpTemp: 0, hpBonus: 0, pipState: {} },
      lastUpdated: null,
    };
  }

  return { load, get, save, flush, onUpdate };

})();
