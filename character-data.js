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
// 06/30/26 redeploy
// Shape returned to the UI mirrors the table columns 1:1, plus a convenience
// `name` pulled from structural:
//   { key, owner, name, structural, vitals, inventory, equipment,
//     currency, bio, notes, updatedAt }

(function () {
  'use strict';

  const COLS = 'key,owner,structural,vitals,inventory,equipment,currency,bio,notes,updated_at,delete_marked';

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
      deleteMarked: !!row.delete_marked,
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

  // may the current user EDIT this character? ANY party member may edit ANY party
  // character (shared sheet — covers absent players); staff included. The DB
  // (characters_party_update policy + characters_guard_columns) enforces this
  // server-side and pins identity cols; this just drives the UI affordances.
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
    return !!me.role;   // any settled member session (player / dm / overseer)
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

  // ── CREATE. Forge a brand-new character via the create_character RPC (anyone
  // signed in may). The caller supplies a unique key from newKey(); owner is
  // pinned server-side. Returns the new key. Astronomically-rare key collisions
  // surface as a unique-violation — callers can regenerate + retry.
  async function create(key, fields) {
    if (!key) throw new Error('create: missing character key');
    fields = fields || {};
    const sb = await client();
    const { data, error } = await sb.rpc('create_character', {
      p_key: key,
      p_structural: fields.structural || {},
      p_vitals: fields.vitals || {},
    });
    if (error) throw error;
    return data; // the key
  }

  // ── SOFT-DELETE (the two-stage trash). markDeletion flags/unflags (any member);
  // remove is the staff-only hard delete. Both go through SECURITY DEFINER RPCs.
  async function markDeletion(key, marked) {
    if (!key) throw new Error('markDeletion: missing character key');
    const sb = await client();
    const { error } = await sb.rpc('mark_character_deletion', { p_key: key, p_marked: marked !== false });
    if (error) throw error;
  }
  async function remove(key) {
    if (!key) throw new Error('remove: missing character key');
    const sb = await client();
    const { error } = await sb.rpc('delete_character', { p_key: key });
    if (error) throw error;
  }

  // A unique, readable key: name slug + short random suffix, so two same-named
  // characters never clash and creating one never touches another.
  function newKey(name) {
    const slug = String(name || 'character').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'character';
    return slug + '-' + Math.random().toString(16).slice(2, 6);
  }

  // ── ROSTER LAYOUT (the Characters tab's folders). One shared JSONB doc:
  // { folders:[{id,name}], order:[id...], members:{charKey:folderId} }. The row
  // is the seeded singleton id=1 (schema_delta_roster_layout.sql); party-wide.
  async function loadLayout() {
    const sb = await client();
    const { data, error } = await sb.from('roster_layout').select('layout').eq('id', 1);
    if (error) throw error;
    return (data && data[0] && data[0].layout) || {};
  }
  async function saveLayout(layout) {
    const sb = await client();
    const { error } = await sb.from('roster_layout')
      .update({ layout: layout || {}, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw error;
  }

  window.CharacterData = { loadParty, loadCharacter, canEdit, save, create, markDeletion, remove, newKey, loadLayout, saveLayout };
})();
