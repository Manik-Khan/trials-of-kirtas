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
  // Build a spellcasting block from a class OR subclass object (same field names
  // on both). spellsKnown present ⇒ a "known" caster; absent ⇒ prepared.
  function mkSpellcasting(obj, listClass) {
    if (!obj || !obj.casterProgression) return null;
    return {
      progression: obj.casterProgression,           // full | 1/2 | 1/3 | pact | artificer
      ability: obj.spellcastingAbility || null,
      cantripsKnown: obj.cantripProgression || null,
      spellsKnown: obj.spellsKnownProgression || null,   // null ⇒ a prepared caster
      prepared: !obj.spellsKnownProgression,
      spellListClass: listClass || null,            // which class's list to pick from
    };
  }
  // Slot table from a class's classTableGroups or a subclass's subclassTableGroups.
  function mkSlots(tableGroups) {
    const out = {};
    const grp = (tableGroups || []).find(g => Array.isArray(g.rowsSpellProgression));
    if (grp) grp.rowsSpellProgression.forEach((row, i) => { out[i + 1] = row.slice(); });
    return out;
  }
  // The 2014 ⅓-casters (Eldritch Knight, Arcane Trickster) pick from the wizard
  // list. Any other casting subclass falls back to its own class's list.
  function subclassSpellList(sc) {
    if (!sc.casterProgression) return null;
    if (sc.casterProgression === '1/3') return 'Wizard';
    return sc.className || null;
  }

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
      // ⅓-caster subclasses (Eldritch Knight, Arcane Trickster) carry their own
      // casterProgression + cantrip/spells-known arrays and a slot table on
      // subclassTableGroups; the base class (Fighter/Rogue) grants no casting.
      return {
        name: sc.name, shortName: sc.shortName, source: sc.source,
        featuresByLevel: byLevel,
        spellcasting: mkSpellcasting(sc, subclassSpellList(sc)),
        slotsByLevel: mkSlots(sc.subclassTableGroups),
      };
    });

    // spell slots come straight from the class table; cantrip/spells-known arrays
    // distinguish known casters (Bard/Sorc) from prepared (Wizard/Cleric/Druid).
    const spellcasting = mkSpellcasting(c, c.name);   // base list = the class's own
    const slotsByLevel = mkSlots(c.classTableGroups);

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


  // ── races.json loader (P3) ──────────────────────────────────────────────────
  // Resolves race[]+subrace[], _copy inheritance (cosmetic _mod only), ability /
  // speed / size, and trait text. Same memoized fetchJson as the class loader.
  const ABILS = ['str','dex','con','int','wis','cha'];

  // ---- _copy resolution (entries-mod is cosmetic; mechanical fields inherit) ----
  function applyMod(entries, mod) {
    entries = (entries || []).slice();
    const ops = Array.isArray(mod) ? mod : [mod];
    for (const op of ops) {
      if (!op || typeof op !== 'object') continue;
      if (op.mode === 'appendArr') {
        const items = Array.isArray(op.items) ? op.items : [op.items];
        entries.push(...items);
      } else if (op.mode === 'replaceArr') {
        const i = entries.findIndex(e => e && e.name === op.replace);
        const items = Array.isArray(op.items) ? op.items : [op.items];
        if (i !== -1) entries.splice(i, 1, ...items); else entries.push(...items);
      } else if (op.mode === 'replaceTxt') {
        const re = new RegExp(op.replace, op.flags || 'g');
        const walk = v => typeof v === 'string' ? v.replace(re, op.with)
          : (v && Array.isArray(v.entries) ? (v.entries = v.entries.map(walk), v) : v);
        entries = entries.map(walk);
      }
    }
    return entries;
  }
  function resolveCopy(entry, byKey) {
    if (!entry._copy) return entry;
    const baseKey = (entry._copy.name + '|' + entry._copy.source).toLowerCase();
    const base = byKey.get(baseKey);
    if (!base) return entry; // base missing — return child as-is
    const merged = Object.assign({}, resolveCopy(base, byKey)); // base may itself _copy
    for (const k of Object.keys(entry)) {
      if (k === '_copy' || k === '_mod' || k === '_preserve') continue;
      merged[k] = entry[k];
    }
    if (entry._copy._mod) merged.entries = applyMod(merged.entries, entry._copy._mod.entries || entry._copy._mod);
    merged.name = entry.name; merged.source = entry.source;
    return merged;
  }

  // ---- field normalizers (pure) ----
  function parseAbility(abilityArr) {
    const fixed = {}; const choices = [];
    for (const block of (abilityArr || [])) {
      for (const k of Object.keys(block)) {
        if (k === 'choose') {
          const ch = block.choose;
          if (ch.weighted) choices.push({ kind:'weighted', from: ch.weighted.from, weights: ch.weighted.weights });
          else if (ch.amount != null) choices.push({ kind:'amount', from: ch.from || ABILS, amount: ch.amount, count: ch.count || 1 });
          else choices.push({ kind:'count', from: ch.from || ABILS, count: ch.count || 1, amount: 1 });
        } else if (ABILS.indexOf(k) !== -1) {
          fixed[k] = (fixed[k] || 0) + block[k];
        }
      }
    }
    return { fixed, choices };
  }
  function parseSpeed(speed) {
    if (speed == null) return { walk: null, label: '\u2014' };
    if (typeof speed === 'number') return { walk: speed, label: speed + ' ft.' };
    const walk = speed.walk != null ? speed.walk : null;
    const out = { walk };
    const parts = [walk != null ? walk + ' ft.' : null];
    ['fly','swim','climb','burrow'].forEach(m => {
      if (speed[m] != null) { const v = speed[m] === true ? walk : speed[m]; out[m] = v; parts.push(m + ' ' + v + ' ft.'); }
    });
    return Object.assign(out, { label: parts.filter(Boolean).join(', ') });
  }
  function parseSize(sizeArr) {
    const map = { T:'Tiny', S:'Small', M:'Medium', L:'Large', H:'Huge', G:'Gargantuan' };
    const arr = (sizeArr || []).map(s => map[s] || s);
    if (arr.length <= 1) return { size: arr[0] || null, options: null };
    return { size: null, options: arr };
  }
  function parseLanguages(arr) {
    const fixed = []; let anyStandard = 0, any = 0;
    for (const b of (arr || [])) for (const k of Object.keys(b)) {
      if (k === 'anyStandard') anyStandard += b[k];
      else if (k === 'any') any += b[k];
      else if (b[k] === true) fixed.push(k.charAt(0).toUpperCase() + k.slice(1));
    }
    return { fixed, anyStandard, any };
  }
  function parseProfChoose(arr) {
    // returns { fixed:[...names], anyCount:n, choose:[ [opts] ] }
    const fixed = []; let anyCount = 0; const choose = [];
    for (const b of (arr || [])) for (const k of Object.keys(b)) {
      if (k === 'any') anyCount += b[k];
      else if (k === 'choose') choose.push(b[k].from || []);
      else if (b[k] === true) fixed.push(k);
    }
    return { fixed, anyCount, choose };
  }
  function collectTraits(entries, srcDefault) {
    return (entries || [])
      .filter(e => e && typeof e === 'object' && e.name && (e.type === 'entries' || e.entries))
      .map(e => ({ name: e.name, entries: e.entries || [], source: srcDefault }));
  }

  function normalizeRace(resolved, subraceEntries) {
    const ab = parseAbility(resolved.ability);
    const sp = parseSpeed(resolved.speed);
    const sz = parseSize(resolved.size);
    const subraces = (subraceEntries || []).map(sr => {
      const sab = parseAbility(sr.ability);
      return {
        name: sr.name || null, label: sr.name || 'Standard', source: sr.source,
        abilityBonuses: sab.fixed, abilityChoices: sab.choices,
        speed: sr.speed ? parseSpeed(sr.speed) : null,
        darkvision: sr.darkvision != null ? sr.darkvision : null,
        resist: sr.resist || [], traits: collectTraits(sr.entries, sr.source),
        skillProficiencies: parseProfChoose(sr.skillProficiencies),
        additionalSpells: sr.additionalSpells || null,
      };
    });
    return {
      name: resolved.name, source: resolved.source,
      lineage: !!resolved.lineage,
      size: sz.size, sizeOptions: sz.options,
      speed: sp, darkvision: resolved.darkvision != null ? resolved.darkvision : null,
      abilityBonuses: ab.fixed, abilityChoices: ab.choices,
      resist: resolved.resist || [], immune: resolved.immune || [],
      conditionImmune: resolved.conditionImmune || [], vulnerable: resolved.vulnerable || [],
      languages: parseLanguages(resolved.languageProficiencies),
      skillProficiencies: parseProfChoose(resolved.skillProficiencies),
      toolProficiencies: parseProfChoose(resolved.toolProficiencies),
      weaponProficiencies: parseProfChoose(resolved.weaponProficiencies),
      armorProficiencies: parseProfChoose(resolved.armorProficiencies),
      feats: resolved.feats || null,
      additionalSpells: resolved.additionalSpells || null,
      creatureTypes: resolved.creatureTypes || null,
      traits: collectTraits(resolved.entries, resolved.source),
      subraces,
    };
  }

  // ---- network API (mirrors loadClass: one file, memoized) ----
  let _racesFile = null;
  async function _loadRacesFile(fetchJson) {
    if (!_racesFile) _racesFile = await fetchJson('races.json');
    return _racesFile;
  }
  function makeLoadRace(fetchJson) {
    return async function loadRace(name, source) {
      const file = await _loadRacesFile(fetchJson);
      const byKey = new Map();
      for (const r of (file.race || [])) byKey.set((r.name + '|' + r.source).toLowerCase(), r);
      let entry = source ? byKey.get((name + '|' + source).toLowerCase())
                         : (file.race || []).find(r => r.name === name);
      if (!entry) throw new Error('race not found: ' + name + (source ? ' [' + source + ']' : ''));
      const resolved = resolveCopy(entry, byKey);
      const subs = (file.subrace || []).filter(sr =>
        sr.raceName === resolved.name && sr.raceSource === resolved.source);
      return normalizeRace(resolved, subs);
    };
  }
  const loadRace = makeLoadRace(fetchJson);

  const API = {
    BASE, fetchJson,
    parseClassFeatureRef, parseSubclassFeatureRef, normalizeClass,
    loadClass, loadClassSpellList,
    loadRace,
    parseAbility, parseSpeed, parseSize, parseLanguages, parseProfChoose,
    collectTraits, applyMod, resolveCopy, normalizeRace, makeLoadRace,
  };
  if (typeof window !== 'undefined') window.SoulShardsData = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
