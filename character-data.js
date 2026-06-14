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
// Shape returned to the UI mirrors the table columns 1:1, plus a convenience
// `name` pulled from structural:
//   { key, owner, name, structural, vitals, inventory, equipment,
//     currency, bio, notes, updatedAt }

(function () {
  'use strict';

  const COLS = 'key,owner,structural,vitals,inventory,equipment,currency,bio,notes,updated_at';

  async function client() {
    // __tok.ready resolves once the session + client are in place (never rejects)
    if (!window.__tok || !window.__tok.ready) throw new Error('nav.js (__tok) not loaded');
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
  async function canEdit(charKey) {
    const me = (window.__tok && window.__tok.ready) ? await window.__tok.ready : null;
    if (!me) return false;
    if (me.role === 'overseer' || me.role === 'dm') return true;
    return me.characterKey === charKey;
  }

  window.CharacterData = { loadParty, loadCharacter, canEdit };
})();
