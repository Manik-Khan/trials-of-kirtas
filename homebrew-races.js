// homebrew-races.js
// Reusable per-campaign library of custom (homebrew) races for the Forge.
//
// Mirrors character-data.js: uses nav.js's Supabase client (window.__tok.sb) and waits
// for the session via the same __tok gate. RLS (schema_delta_homebrew_races.sql): any
// approved member may read + create; a row's creator (or staff) may edit/delete.
//
// Table public.homebrew_races:
//   { id uuid, name text, model jsonb, created_by uuid, created_by_name text,
//     created_at timestamptz }
// `model` is a normalizeRace-shaped object — the same shape SoulShardsData.loadRace
// returns — produced by the Forge's custom-race builder (SpeciesUI). The builder's
// transient UI fields (asiMode / _bonusRows) ride along harmlessly so a saved race
// re-opens with its increase rows intact; the derive + proficiency resolver ignore them.
//
// Degrades safely: if the table/migration isn't deployed yet, calls reject and the
// Forge falls back to define-a-new-race only (the per-character builder needs no backend).

(function () {
  'use strict';

  // Wait for nav.js to finish assembling window.__tok (same pattern as character-data.js).
  function awaitTok(timeoutMs = 8000) {
    if (window.__tok && window.__tok.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let done = false;
      const ready = () => window.__tok && window.__tok.ready;
      const finish = ok => {
        if (done) return;
        done = true;
        document.removeEventListener('nav:ready', onReady);
        clearInterval(poll); clearTimeout(timer);
        ok ? resolve() : reject(new Error('nav.js (__tok) not loaded'));
      };
      const onReady = () => { if (ready()) finish(true); };
      document.addEventListener('nav:ready', onReady);
      const poll = setInterval(() => { if (ready()) finish(true); }, 50);
      const timer = setTimeout(() => finish(false), timeoutMs);
    });
  }
  async function client() {
    await awaitTok();
    await window.__tok.ready;   // resolves once session + profile are in place (never rejects)
    return window.__tok.sb;
  }
  // What to SHOW for the saver (username || email local-part), denormalized at save time.
  function myName() {
    try { const p = window.__tok && window.__tok.profile; return (p && p.displayName) || null; }
    catch (e) { return null; }
  }

  const COLS = 'id,name,model,created_by,created_by_name,created_at';
  function shape(r) {
    return r ? {
      id: r.id, name: r.name, model: r.model || {},
      createdBy: r.created_by, createdByName: r.created_by_name || null, createdAt: r.created_at
    } : null;
  }

  // every homebrew race in the campaign, newest first
  async function list() {
    const sb = await client();
    const { data, error } = await sb.from('homebrew_races').select(COLS).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(shape);
  }

  // insert a new homebrew race. created_by is pinned server-side (column default auth.uid());
  // the RLS insert policy also requires created_by = auth.uid(), so a member can only file
  // rows under their own identity.
  async function save(name, model) {
    if (!name || !String(name).trim()) throw new Error('save: a race name is required');
    if (!model || typeof model !== 'object') throw new Error('save: model must be the race-model object');
    const sb = await client();
    const { data, error } = await sb.from('homebrew_races')
      .insert({ name: String(name).trim(), model: model, created_by_name: myName() })
      .select(COLS);
    if (error) throw error;
    if (!data || !data.length) throw new Error('Save blocked \u2014 only approved members can save homebrew races.');
    return shape(data[0]);
  }

  // update an existing row (creator or staff only — RLS filters non-owners OUT of the
  // result, so an empty result means the server refused).
  async function update(id, name, model) {
    if (!id) throw new Error('update: missing id');
    const sb = await client();
    const patch = {};
    if (name != null) patch.name = String(name).trim();
    if (model != null) patch.model = model;
    if (!Object.keys(patch).length) return null;
    const { data, error } = await sb.from('homebrew_races').update(patch).eq('id', id).select(COLS);
    if (error) throw error;
    if (!data || !data.length) throw new Error('Update blocked \u2014 you can only edit homebrew races you created.');
    return shape(data[0]);
  }

  // delete a row (creator or staff only — RLS enforces)
  async function remove(id) {
    if (!id) throw new Error('remove: missing id');
    const sb = await client();
    const { error } = await sb.from('homebrew_races').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  window.HomebrewRaces = { list, save, update, remove };
})();
