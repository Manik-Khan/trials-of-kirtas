// character-data.js
// READ-PATH — characters now live in Supabase (public.characters). This is the
// single client-side reader: the new party menu (and eventually the old sheet)
// call this instead of loading characters.js / fetching the JSON. The git JSON
// is now only the durable backup written by the export functions.
//
// Requires nav.js — uses its Supabase client (window.__tok.sb) and waits for the
// session via window.__tok.ready. RLS lets any authenticated user read every row,
// so loadParty() returns all four characters.
//
// nav.js assembles window.__tok ASYNCHRONOUSLY (it injects the Supabase CDN and
// awaits getSession before assigning __tok and dispatching 'nav:ready'). A page's
// DOMContentLoaded can fire BEFORE that completes, so callers must not assume
// __tok already exists — awaitTok() below waits for it instead of throwing.
//
// Shape returned to the UI mirrors the table columns 1:1, plus a convenience
// `name` pulled from structural:
//   { key, owner, name, structural, vitals, inventory, equipment,
//     currency, bio, notes, updatedAt }

(function () {
  'use strict';

  const COLS = 'key,owner,structural,vitals,inventory,equipment,currency,bio,notes,updated_at';

  // Wait for nav.js to finish assembling window.__tok. It builds __tok
  // asynchronously (Supabase CDN load + getSession) and signals completion by
  // dispatching 'nav:ready' on `document`. We wait for that signal rather than
  // assume __tok is present — fixes the race where boot() runs at
  // DOMContentLoaded before the session gate resolves.
  function awaitTok(timeoutMs = 8000) {
    if (window.__tok && window.__tok.ready) return Promise.resolve(); // fast path
    return new Promise((resolve, reject) => {
      let done = false;
      const ready  = () => window.__tok && window.__tok.ready;
      const finish = ok => {
        if (done) return;
        done = true;
        document.removeEventListener('nav:ready', onReady);
        clearInterval(poll);
        clearTimeout(timer);
        ok ? resolve() : reject(new Error('nav.js (__tok) not loaded'));
      };
      const onReady = () => { if (ready()) finish(true); };
      // Correct target: nav.js dispatches on document, not window.
      document.addEventListener('nav:ready', onReady);
      // Belt-and-suspenders: covers __tok landing between the fast-path check
      // and the listener attaching, and any path that sets __tok without a
      // (re-)dispatch we can hear.
      const poll = setInterval(() => { if (ready()) finish(true); }, 50);
      // Bounded: nav.js redirects to login (and never signals) when there's no
      // session. The page is navigating away in that case, so the rejection is
      // moot — but we must not hang on the spinner forever.
      const timer = setTimeout(() => finish(false), timeoutMs);
    });
  }

  async function client() {
    await awaitTok();
    // __tok.ready resolves once the session + profile are in place (never rejects)
    await window.__tok.ready;
    return window.__tok.sb;
  }

  // raw row → UI shape (columns pass through; add a convenience name)
  function shape(row) {
    if (!row) return null;
    const s = row.structural || {};
    return {
      key:        row.key,
      owner:      row.owner,
      name:       s.name || row.key,
      structural: s,
      vitals:     row.vitals    || {},
      inventory:  row.inventory || [],
      equipment:  row.equipment || {},
      currency:   row.currency  || {},
      bio:        row.bio       || {},
      notes:      row.notes     || '',
      updatedAt:  row.updated_at,
    };
  }

  // all party characters, ordered by key — for the portrait wall
  async function loadParty() {
    const sb = await client();
    const { data, error } = await sb.from('characters').select(COLS).order('key');
    if (error) throw error;
    return (data || []).map(shape);
  }

  // one character by key
  async function loadCharacter(key) {
    const sb = await client();
    const { data, error } = await sb.from('characters').select(COLS).eq('key', key);
    if (error) throw error;
    return shape((data || [])[0] || null);
  }

  // may the current user EDIT this character? owner of the row, or staff.
  // (the DB guard enforces this server-side too; this just drives the UI.)
  // Waits for __tok like client() so it doesn't false-negative on a slow load;
  // returns false (rather than throwing) if nav never settles.
  async function canEdit(charKey) {
    try {
      await awaitTok();
    } catch (e) {
      return false;
    }
    const me = await window.__tok.ready;
    if (!me) return false;
    if (me.role === 'overseer' || me.role === 'dm') return true;
    return me.characterKey === charKey;
  }


  // Editable columns (identity cols key/owner/created_at are pinned by the DB
  // guard trigger; everything else is owner-editable). Whitelisted client-side
  // so a stray patch fails fast with a clear message instead of a guard reject.
  const EDITABLE = ['structural', 'vitals', 'inventory', 'equipment', 'currency', 'bio', 'notes'];

  // WRITE-PATH. save(key, patch) updates owner-editable columns on one character.
  // RLS + characters_guard_columns enforce who-can-write and which-cols server-side;
  // this is just the UI's write seam. Returns the server-confirmed, shaped row.
  async function save(key, patch) {
    if (!key) throw new Error('save: missing character key');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('save: patch must be an object of column \u2192 value');
    }
    const cols = Object.keys(patch);
    if (!cols.length) return null; // nothing to write
    const bad = cols.filter(c => !EDITABLE.includes(c));
    if (bad.length) throw new Error('save: not an editable column: ' + bad.join(', '));

    const sb = await client();
    const { data, error } = await sb
      .from('characters')
      .update(patch)
      .eq('key', key)
      .select(COLS);
    if (error) throw error;
    // RLS filters unauthorized rows OUT of the result rather than erroring, so an
    // empty result means the server refused the write (not the owner / not staff).
    if (!data || !data.length) {
      throw new Error('Save blocked \u2014 you can only edit your own character.');
    }
    return shape(data[0]);
  }

  window.CharacterData = { loadParty, loadCharacter, canEdit, save };
})();
