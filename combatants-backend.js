// combatants-backend.js — ONE backend, installed by BOTH combat.html and
// party.html via window.__battle.useBackend(makeCombatantsBackend(deps)). The
// combat write semantics (hp / conditions / initiative, event text, vitals) live
// here once; each page injects its own glue (combatant cache, realtime source,
// feed logger). Same anti-drift principle as export-core.js — one implementation,
// so the map and the sheet can't diverge in behaviour.
//
// deps:
//   sb                : Supabase client (required)
//   resolve(key)      : -> combatant row (combat.html: hudComb/COMBS; party.html: cache)
//   saveVitals(key,c) : optional async — write full vitals to characters (piece #2)
//   loadVitals(key)   : optional async -> vitals obj (party.html: CharacterData)
//   logEvent(kind,data,text,hidden) : optional replay feed event
//   logRoll(o)        : optional
//   isStaff()         : -> bool
//   afterInitiative() : optional re-render hook (combat.html: renderInitStrip)
//   advanceTurn(key)  : optional — delegated. combat.html injects its turn engine;
//                       party.html omits, so End Turn isn't driven from the sheet.
//   esc(s)            : optional escape fn for event text (default identity)
//   evHidden(row)     : optional -> bool (default false)
//   onSubscribe(fn)   : optional — also hand battle.js's onChange to the page, so a
//                       page that owns its realtime channel (combat.html) can keep
//                       feeding it from there. Pages that own a channel directly
//                       (party.html) call backend._emit() instead.

window.makeCombatantsBackend = function (deps) {
  const sb = deps.sb;
  const esc = deps.esc || (s => s);
  const hidden = row => (deps.evHidden ? !!deps.evHidden(row) : false);
  const event = (kind, data, text, row) => { if (deps.logEvent) deps.logEvent(kind, data, text, hidden(row)); };
  let _onChange = null;

  return {
    async load(key) {
      const c = deps.resolve(key);
      let v = {};
      if (deps.loadVitals) { try { v = (await deps.loadVitals(key)) || {}; } catch (_) {} }
      if (!c) return null;
      return {
        hp:            (v.hp != null) ? v.hp : c.hp,
        hpTemp:        v.hpTemp || 0,
        hpBonus:       v.hpBonus || 0,
        pipState:      v.pipState || {},
        concentration: v.concentration || null,
        conditions:    Array.isArray(c.conditions) ? c.conditions : [],
        initiative:    c.initiative,
        in_combat:     !!c.in_combat,
      };
    },

    async save(key, combat) {
      const c = deps.resolve(key);
      // HP -> combatant (live map + replay event). c.hp refreshes on the realtime echo.
      if (c && combat.hp != null) {
        const prev = c.hp;
        const { error } = await sb.from('combatants').update({ hp: combat.hp }).eq('id', c.id);
        if (error) console.warn('[combatants] hp save:', error.message);
        else if (c.in_combat && prev !== combat.hp)
          event('hp', { id: c.id, from: prev, to: combat.hp }, `${esc(c.name)}: ${prev} → ${combat.hp} HP`, c);
      }
      // Full vitals (temp HP, max bonus, slots, concentration, hp) -> characters.
      if (deps.saveVitals) { try { await deps.saveVitals(key, combat); } catch (e) { console.warn('[combatants] vitals save:', e); } }
    },

    async saveConditions(key, arr) {
      const c = deps.resolve(key); if (!c) return;
      const { error } = await sb.from('combatants').update({ conditions: arr }).eq('id', c.id);
      if (error) { console.warn('[combatants] conditions save:', error.message); return; }
      if (c.in_combat) event('condition', { id: c.id, conditions: arr },
        `${esc(c.name)}: ${arr.length ? arr.join(', ') : 'conditions cleared'}`, c);
    },

    async setInitiative(key, val) {
      const c = deps.resolve(key); if (!c) return;
      c.initiative = val;
      if (deps.afterInitiative) deps.afterInitiative();
      const { error } = await sb.from('combatants').update({ initiative: val }).eq('id', c.id);
      if (error) { console.warn('[combatants] initiative save:', error.message); return; }
      if (c.in_combat) event('initiative', { id: c.id, value: val }, `${esc(c.name)} initiative set to ${val}`, c);
    },

    logRoll(o) { if (deps.logRoll) deps.logRoll(o); },
    isStaff() { return !!(deps.isStaff && deps.isStaff()); },
    advanceTurn(key) { if (deps.advanceTurn) deps.advanceTurn(key); },

    subscribe(onChange) { _onChange = onChange; if (deps.onSubscribe) deps.onSubscribe(onChange); },
    _emit(payload) { if (_onChange) _onChange(payload); },
  };
};
