/* soul-shards-data.js — P0 data layer for the "Soul Shards" character builder.
 *
 * Fetches + normalizes the 5etools 2014 dataset (the SAME mirror the bestiary,
 * compendium, and items already use) into a clean model the builder and the
 * spellbook consume. There is no REST API — these are static JSON files; the
 * real work is (a) resolving the `Name|class|source|level` feature references
 * into the parallel classFeature[]/subclassFeature[] arrays, and (b) the
 * spell→class reverse index in spells/sources.json.
 *
 * Environment-agnostic: attaches to window.SoulShardsData in the browser and
 * sets module.exports in Node (so it can be smoke-tested headlessly).
 */
(function () {
  'use strict';
  const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data';

  // ── fetch + memoize (one in-flight promise per path) ───────────────────────
  const _cache = new Map();
  function fetchJson(path) {
    if (_cache.has(path)) return _cache.get(path);
    const p = fetch(`${BASE}/${path}`).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
      return r.json();
    });
    _cache.set(path, p);
    return p;
  }

  // ── reference parsing (pure) ───────────────────────────────────────────────
  // class feature ref:    "Name|className|classSource|level|[featureSource]"
  //   or the subclass-grant object { classFeature:"…", gainSubclassFeature:true }
  // subclass feature ref: "Name|className|classSource|subclassShort|subclassSource|level"
  // Empty source segments default to the class file's own source.
  function parseClassFeatureRef(ref, classSourceDefault) {
    const raw = typeof ref === 'string' ? ref : ref.classFeature;
    const gainSubclass = typeof ref === 'object' && !!ref.gainSubclassFeature;
    const [name, className, classSource, level, featureSource] = raw.split('|');
    return {
      name, className,
      classSource: classSource || classSourceDefault,
      level: Number(level),
      source: featureSource || classSource || classSourceDefault,
      gainSubclass,
    };
  }
  function parseSubclassFeatureRef(ref, classSourceDefault) {
    const [name, className, classSource, subclassShort, subclassSource, level] = ref.split('|');
    return {
      name, className,
      classSource: classSource || classSourceDefault,
      subclassShort,
      subclassSource: subclassSource || classSourceDefault,
      level: Number(level),
    };
  }

  function indexBy(arr, keyFn) { const m = new Map(); for (const x of arr) m.set(keyFn(x), x); return m; }

  // ── normalize a class file into the builder model (pure) ───────────────────
  function normalizeClass(file) {
    const c = file.class[0];
    const srcDefault = c.source;

    const cfIndex = indexBy(file.classFeature || [], cf => `${cf.name}|${cf.level}|${cf.source}`);
    const featuresByLevel = {};
    let subclassChoiceLevel = null;
    for (const ref of (c.classFeatures || [])) {
      const p = parseClassFeatureRef(ref, srcDefault);
      if (p.gainSubclass && subclassChoiceLevel == null) subclassChoiceLevel = p.level;
      const obj = cfIndex.get(`${p.name}|${p.level}|${p.source}`)
        || (file.classFeature || []).find(cf => cf.name === p.name && cf.level === p.level);
      (featuresByLevel[p.level] || (featuresByLevel[p.level] = [])).push({
        name: p.name, level: p.level, source: p.source,
        gainSubclass: p.gainSubclass,
        entries: obj ? obj.entries : null,
        unresolved: !obj,
      });
    }

    const scfIndex = indexBy(file.subclassFeature || [],
      f => `${f.name}|${f.subclassShortName}|${f.level}|${f.source}`);
    const subclasses = (file.subclass || []).map(sc => {
      const byLevel = {};
      for (const ref of (sc.subclassFeatures || [])) {
        const p = parseSubclassFeatureRef(ref, srcDefault);
        const obj = scfIndex.get(`${p.name}|${p.subclassShort}|${p.level}|${p.subclassSource}`)
          || (file.subclassFeature || []).find(f =>
               f.name === p.name && f.subclassShortName === p.subclassShort && f.level === p.level);
        (byLevel[p.level] || (byLevel[p.level] = [])).push({
          name: p.name, level: p.level, source: p.subclassSource,
          entries: obj ? obj.entries : null, unresolved: !obj,
        });
      }
      return { name: sc.name, shortName: sc.shortName, source: sc.source, featuresByLevel: byLevel };
    });

    // spell slots come straight from the class table; cantrip/spells-known arrays
    // distinguish known casters (Bard/Sorc) from prepared (Wizard/Cleric/Druid).
    const slotGrp = (c.classTableGroups || []).find(g => Array.isArray(g.rowsSpellProgression));
    const slotsByLevel = {};
    if (slotGrp) slotGrp.rowsSpellProgression.forEach((row, i) => { slotsByLevel[i + 1] = row.slice(); });

    const spellcasting = c.casterProgression ? {
      progression: c.casterProgression,           // full | 1/2 | 1/3 | pact | artificer
      ability: c.spellcastingAbility || null,
      cantripsKnown: c.cantripProgression || null,
      spellsKnown: c.spellsKnownProgression || null,   // null ⇒ a prepared caster
      prepared: !c.spellsKnownProgression,
    } : null;

    return {
      name: c.name, source: c.source,
      hd: c.hd ? c.hd.faces : null,
      savingThrows: c.proficiency || [],
      subclassTitle: c.subclassTitle || 'Subclass',
      subclassChoiceLevel,
      spellcasting, slotsByLevel,
      startingProficiencies: c.startingProficiencies || {},
      startingEquipment: c.startingEquipment || {},
      multiclassing: c.multiclassing || null,
      featuresByLevel, subclasses,
    };
  }

  // ── network API ────────────────────────────────────────────────────────────
  const classFile = name => `class/class-${name.toLowerCase().replace(/\s+/g, '')}.json`;

  async function loadClass(className) {
    return normalizeClass(await fetchJson(classFile(className)));
  }

  // The class spell list, via the reverse index, hydrated with level/school from
  // the per-source spell files. `opts.sources` optionally limits spell sources
  // (e.g. ['PHB','XGE','TCE']) — the same allow-list the builder will expose.
  async function loadClassSpellList(className, opts) {
    const onlySources = opts && opts.sources ? new Set(opts.sources) : null;
    const [sources, idx] = await Promise.all([
      fetchJson('spells/sources.json'),
      fetchJson('spells/index.json'),
    ]);
    const want = [];
    for (const [spellSource, spells] of Object.entries(sources)) {
      if (onlySources && !onlySources.has(spellSource)) continue;
      for (const [spellName, info] of Object.entries(spells)) {
        if ((info.class || []).some(cl => cl.name === className)) want.push({ name: spellName, spellSource });
      }
    }
    const files = [...new Set(want.map(w => w.spellSource))].filter(s => idx[s]);
    const data = {};
    await Promise.all(files.map(async s => { data[s] = await fetchJson(`spells/${idx[s]}`); }));
    const out = [];
    for (const w of want) {
      const f = data[w.spellSource]; if (!f) continue;
      const sp = (f.spell || []).find(x => x.name === w.name && x.source === w.spellSource);
      if (sp) out.push({ name: sp.name, level: sp.level, school: sp.school, source: sp.source });
    }
    out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    return out;
  }

  const API = {
    BASE, fetchJson,
    parseClassFeatureRef, parseSubclassFeatureRef, normalizeClass,
    loadClass, loadClassSpellList,
  };
  if (typeof window !== 'undefined') window.SoulShardsData = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
