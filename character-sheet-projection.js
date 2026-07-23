// character-sheet-projection.js
// ---------------------------------------------------------------------------
// Canonical read projection for every character-sheet consumer.
//
// Supabase stores generated rules data plus durable player corrections. Older
// rows can also retain structural.spells after a reforge. Once the forged
// structural.spellcasting field exists it is authoritative; the legacy field
// is only a fallback for genuinely old rows. Corrections are then applied to a
// clone, so Party, the mounted sheet, and Forge all see the same effective
// spells/features without rewriting the generated source.
//
// Dual export: classic browser scripts read window.CharacterSheetProjection;
// ESM may import it for its side effect; Node smokes use require().
// ---------------------------------------------------------------------------
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CharacterSheetProjection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function clone(x) { return JSON.parse(JSON.stringify(x == null ? {} : x)); }
  function norm(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
  function actionOf(c) { return (c && c.action) || 'add'; }
  function ledgerOf(s) {
    var raw = s && s.corrections;
    return {
      version: 2,
      active: Array.isArray(raw && raw.active) ? raw.active.slice() : [],
      history: Array.isArray(raw && raw.history) ? raw.history.slice() : []
    };
  }
  function summaryOf(s) {
    var ledger = ledgerOf(s), active = ledger.active.filter(Boolean);
    return {
      active: active.length,
      unreviewed: active.filter(function (c) { return c.status === 'unreviewed'; }).length,
      confirmed: active.filter(function (c) { return c.status === 'confirmed'; }).length,
      history: ledger.history.length
    };
  }
  function sameTarget(c, kind, action, name, source) {
    if (!c || c.kind !== kind || actionOf(c) !== action || norm(c.name) !== norm(name)) return false;
    return !source || !c.source || norm(c.source) === norm(source);
  }
  function legacyLevel(key) {
    if (/^cantrips?$/i.test(key)) return 0;
    var m = String(key).match(/^(?:level)?\s*(\d)$/i);
    return m ? Number(m[1]) : null;
  }
  function legacySpellcasting(structural) {
    var legacy = structural && structural.spells, groups = [];
    if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return { groups: groups };
    Object.keys(legacy).forEach(function (key) {
      if (!Array.isArray(legacy[key])) return;
      var level = legacyLevel(key); if (level == null) return;
      groups.push({
        heading: level === 0 ? 'Cantrips · At Will' : ('Level ' + level),
        level: level,
        spells: legacy[key].map(function (raw) {
          if (typeof raw === 'string') return { name: raw, level: level };
          raw = raw || {};
          return {
            name: raw.name || '', level: level,
            time: raw.time || raw.castingTime || '', range: raw.range || '',
            duration: raw.duration || '', conc: !!(raw.conc || raw.concentration),
            ritual: !!raw.ritual, source: raw.source || '', origin: raw.origin || 'class',
            desc: raw.desc || ''
          };
        })
      });
    });
    groups.sort(function (a, b) { return a.level - b.level; });
    return { groups: groups };
  }
  function spellExists(spellcasting, name) {
    var want = norm(name), found = false;
    ((spellcasting && spellcasting.groups) || []).forEach(function (group) {
      (group.spells || []).forEach(function (spell) { if (norm(spell && spell.name) === want) found = true; });
    });
    return found;
  }
  function applySpellCorrections(spellcasting, structural) {
    var out = clone(spellcasting || {}), ledger = ledgerOf(structural), added = [], suppressed = [];
    out.groups = Array.isArray(out.groups) ? out.groups : [];
    var hides = ledger.active.filter(function (c) { return c && c.kind === 'spell' && actionOf(c) === 'suppress'; });
    out.groups.forEach(function (group) {
      group.spells = (group.spells || []).filter(function (spell) {
        var hit = hides.filter(function (c) { return sameTarget(c, 'spell', 'suppress', spell && spell.name, spell && spell.source); })[0];
        if (hit) suppressed.push(hit.id);
        return !hit;
      });
    });
    out.groups = out.groups.filter(function (group) { return (group.spells || []).length; });
    ledger.active.forEach(function (c) {
      if (!c || c.kind !== 'spell' || actionOf(c) !== 'add' || !c.name || spellExists(out, c.name)) return;
      var level = Math.max(0, Math.min(9, parseInt(c.level, 10) || 0));
      var group = out.groups.filter(function (g) { return parseInt(g.level, 10) === level; })[0];
      if (!group) {
        var ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
        group = { heading: level === 0 ? 'Cantrips · At Will' : ((ord[level] || (level + 'th')) + ' Level'), level: level, spells: [] };
        out.groups.push(group);
      }
      var meta = c.spell || {};
      group.spells.push({
        name: c.name, origin: 'manual', source: c.source || 'Manual',
        time: meta.time || meta.castingTime || '', level: level,
        conc: !!meta.concentration, ritual: !!meta.ritual,
        correctionId: c.id, correctionStatus: c.status || 'unreviewed'
      });
      added.push(c.id);
    });
    out.groups.sort(function (a, b) { return (parseInt(a.level, 10) || 0) - (parseInt(b.level, 10) || 0); });
    out.correctionSummary = summaryOf(structural);
    out.correctionIdsRendered = added;
    out.correctionIdsSuppressed = suppressed;
    return out;
  }
  function applyFeatureCorrections(features, structural) {
    var out = clone(Array.isArray(features) ? features : []), ledger = ledgerOf(structural), suppressed = [];
    var hides = ledger.active.filter(function (c) { return c && c.kind === 'feature' && actionOf(c) === 'suppress'; });
    out = out.filter(function (feature) {
      var hit = hides.filter(function (c) { return sameTarget(c, 'feature', 'suppress', feature && feature.name, feature && feature.source); })[0];
      if (hit) suppressed.push(hit.id);
      return !hit;
    });
    ledger.active.forEach(function (c) {
      if (!c || c.kind !== 'feature' || actionOf(c) !== 'add' || !c.name) return;
      if (out.some(function (feature) { return norm(feature && feature.name) === norm(c.name); })) return;
      out.push({
        name: c.name, desc: c.desc || c.note || '', source: 'custom:' + (c.source || 'Manual'),
        correctionId: c.id, correctionStatus: c.status || 'unreviewed'
      });
    });
    return { features: out, correctionIdsSuppressed: suppressed };
  }
  function projectStructural(structural) {
    var out = clone(structural || {});
    // A spellcasting object — even with zero groups — means a modern forge
    // intentionally authored the list. Older rows sometimes carry null.
    var base = out.spellcasting ? out.spellcasting : legacySpellcasting(out);
    out.spellcasting = applySpellCorrections(base, out);
    out.features = applyFeatureCorrections(out.features || [], out).features;
    return out;
  }

  return {
    ledgerOf: ledgerOf,
    summaryOf: summaryOf,
    spellExists: spellExists,
    legacySpellcasting: legacySpellcasting,
    applySpellCorrections: applySpellCorrections,
    applyFeatureCorrections: applyFeatureCorrections,
    projectStructural: projectStructural
  };
});
