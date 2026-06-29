/* soul-shards-persona.js — data layer for the Soul Shards "Personality" step.
 *
 * Parses each 2014 background's "Suggested Characteristics" tables (the Personality
 * Trait / Ideal / Bond / Flaw d-tables) out of backgrounds.json — the SAME mirror the
 * rest of the Forge uses — into clean per-background lists plus a deduped cross-background
 * pool. The step rolls from a background's own table or the full pool, and surfaces
 * "from other backgrounds" suggestions tagged with their source.
 *
 * Environment-agnostic: attaches to window.SoulShardsPersona in the browser and sets
 * module.exports in Node (so it can be smoke-tested headlessly). When SoulShardsData is
 * present it reuses that module's memoized backgrounds fetch — no second network hit.
 */
(function () {
  'use strict';

  var BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data';

  // a Suggested-Characteristics table is identified by its second column label
  var LABEL_KEY = {
    'Personality Trait': 'personality',
    'Ideal':             'ideals',
    'Bond':              'bonds',
    'Flaw':              'flaws',
  };
  var KEYS = ['personality', 'ideals', 'bonds', 'flaws'];

  // ── strip 5etools {@tag ...} markup down to display text ───────────────────
  // {@tag a|src|display} -> display (when present) else a ; bare {@tag} -> ''.
  // Loops to resolve nested tags. Trait tables are mostly plain prose, but a few
  // (e.g. {@dice}, {@condition}) appear, and the sheet wants clean strings.
  function strip(s) {
    if (s == null) return '';
    s = String(s);
    var prev;
    do {
      prev = s;
      s = s.replace(/\{@\w+ ([^{}]+)\}/g, function (_, inner) {
        var p = inner.split('|');
        return (p.length >= 3 && p[2]) ? p[2] : p[0];
      });
    } while (s !== prev);
    s = s.replace(/\{@\w+\}/g, '');
    return s.replace(/\s+/g, ' ').trim();
  }

  // recursively walk a background's `entries` tree, collecting trait-table rows
  function collectTables(node, out) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(function (n) { collectTables(n, out); }); return; }
    if (typeof node !== 'object') return;
    if (node.type === 'table' && Array.isArray(node.colLabels) && node.colLabels.length >= 2) {
      var key = LABEL_KEY[String(node.colLabels[1]).trim()];
      if (key && Array.isArray(node.rows)) {
        node.rows.forEach(function (r) {
          if (Array.isArray(r) && r.length >= 2) {
            var t = strip(r[1]);
            if (t) out[key].push(t);
          }
        });
      }
    }
    if (node.entries) collectTables(node.entries, out);
  }

  function emptyLists() { return { personality: [], ideals: [], bonds: [], flaws: [] }; }

  var BY_NAME = {};   // exact background name -> lists
  var BY_LOWER = {};  // lowercase name -> lists (same objects)
  var POOL = emptyLists();   // deduped union across every background: [{text, src}]
  var loaded = false;

  function parseAll(arr) {
    BY_NAME = {}; BY_LOWER = {}; POOL = emptyLists();
    var seen = { personality: {}, ideals: {}, bonds: {}, flaws: {} };
    (arr || []).forEach(function (bg) {
      var out = emptyLists();
      collectTables(bg.entries, out);
      if (!(out.personality.length || out.ideals.length || out.bonds.length || out.flaws.length)) return;
      var nm = bg.name || '';
      // merge unique if a name repeats across sources (richest combined entry wins)
      var rec = BY_NAME[nm] || emptyLists();
      KEYS.forEach(function (k) {
        out[k].forEach(function (t) {
          if (rec[k].indexOf(t) === -1) rec[k].push(t);
          var sk = t.toLowerCase();
          if (!seen[k][sk]) { seen[k][sk] = nm; POOL[k].push({ text: t, src: nm }); }
        });
      });
      BY_NAME[nm] = rec;
      BY_LOWER[nm.toLowerCase()] = rec;
    });
    return true;
  }

  // tolerant lookup: exact -> case-insensitive -> base name (drop "Variant " prefix
  // and any "(...)" parenthetical) -> any known bg sharing that base name.
  function baseName(s) {
    return String(s).toLowerCase().replace(/^variant\s+/, '').replace(/\s*\(.*\)\s*$/, '').trim();
  }
  function lookup(name) {
    if (!name) return null;
    if (BY_NAME[name]) return BY_NAME[name];
    var lo = String(name).toLowerCase().trim();
    if (BY_LOWER[lo]) return BY_LOWER[lo];
    var base = baseName(name);
    if (BY_LOWER[base]) return BY_LOWER[base];
    var hit = Object.keys(BY_LOWER).filter(function (k) { return baseName(k) === base; })[0];
    return hit ? BY_LOWER[hit] : null;
  }

  // a background's own four lists (copies), or null if it has no tables / is unknown
  function forBackground(name) {
    var r = lookup(name);
    if (!r) return null;
    return { personality: r.personality.slice(), ideals: r.ideals.slice(), bonds: r.bonds.slice(), flaws: r.flaws.slice() };
  }

  // the deduped cross-background pool MINUS the chosen background's own lines,
  // each tagged with the background it came from: { key: [{text, src}] }
  function othersFor(name) {
    var own = lookup(name) || emptyLists();
    var ownSet = {};
    KEYS.forEach(function (k) { ownSet[k] = {}; own[k].forEach(function (t) { ownSet[k][t.toLowerCase()] = 1; }); });
    var res = emptyLists();
    KEYS.forEach(function (k) {
      POOL[k].forEach(function (item) {
        if (!ownSet[k][item.text.toLowerCase()]) res[k].push({ text: item.text, src: item.src });
      });
    });
    return res;
  }

  // the full deduped pool (text only) across every background — the "any background" roll
  function pool() {
    var res = emptyLists();
    KEYS.forEach(function (k) { res[k] = POOL[k].map(function (x) { return x.text; }); });
    return res;
  }

  function load() {
    if (loaded) return Promise.resolve(api);
    var src;
    if (typeof window !== 'undefined' && window.SoulShardsData && window.SoulShardsData.loadBackgrounds) {
      src = window.SoulShardsData.loadBackgrounds();
    } else {
      src = fetch(BASE + '/backgrounds.json')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' for backgrounds.json'); return r.json(); })
        .then(function (d) { return d.background || []; });
    }
    return src.then(function (arr) { parseAll(arr); loaded = true; return api; });
  }

  var api = {
    BASE: BASE,
    load: load,
    forBackground: forBackground,
    othersFor: othersFor,
    pool: pool,
    isLoaded: function () { return loaded; },
    // exposed for headless tests
    _strip: strip,
    _parseAll: parseAll,
    _backgroundsWithTables: function () { return Object.keys(BY_NAME).length; },
  };

  if (typeof window !== 'undefined') window.SoulShardsPersona = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
