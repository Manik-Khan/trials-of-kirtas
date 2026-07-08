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

  // Some class/subclass features keep their real text behind nested refs inside their
  // entries — {type:'refSubclassFeature'|'refClassFeature'} — e.g. Way of Mercy points
  // to Implements of Mercy / Hand of Healing / Hand of Harm. Resolve those inline so a
  // feature's entries carry the full prose (proficiency grants, mechanics) instead of an
  // opaque pointer; downstream (the sheet's feature text, the proficiency harvest) reads
  // real content. Cross-file refOptionalfeature (invocations, fighting styles) is left
  // as-is. Depth-guarded against pathological self-reference.
  function resolveNestedRefs(entries, scfList, cfList, srcDefault, depth) {
    depth = depth || 0;
    if (!entries || depth > 4) return entries;
    if (Array.isArray(entries)) return entries.map(function (e) { return resolveNestedRefs(e, scfList, cfList, srcDefault, depth); });
    if (typeof entries === 'object') {
      if (entries.type === 'refSubclassFeature' && entries.subclassFeature) {
        var p = parseSubclassFeatureRef(entries.subclassFeature, srcDefault);
        var obj = scfList.find(function (f) { return f.name === p.name && f.subclassShortName === p.subclassShort && f.level === p.level && (!p.subclassSource || f.source === p.subclassSource); })
               || scfList.find(function (f) { return f.name === p.name && f.subclassShortName === p.subclassShort && f.level === p.level; });
        return obj ? { type: 'entries', name: obj.name, entries: resolveNestedRefs(obj.entries || [], scfList, cfList, srcDefault, depth + 1) } : entries;
      }
      if (entries.type === 'refClassFeature' && entries.classFeature) {
        var q2 = parseClassFeatureRef(entries.classFeature, srcDefault);
        var cobj = cfList.find(function (f) { return f.name === q2.name && f.level === q2.level && (!q2.source || f.source === q2.source); })
                || cfList.find(function (f) { return f.name === q2.name && f.level === q2.level; });
        return cobj ? { type: 'entries', name: cobj.name, entries: resolveNestedRefs(cobj.entries || [], scfList, cfList, srcDefault, depth + 1) } : entries;
      }
      if (Array.isArray(entries.entries)) {
        var clone = Object.assign({}, entries);
        clone.entries = resolveNestedRefs(entries.entries, scfList, cfList, srcDefault, depth);
        return clone;
      }
    }
    return entries;
  }

  // Some (sub)class features hold a "choose 1 of the following" block INLINE in their
  // entries — {type:'options', count:N, entries:[refSubclassFeature|refClassFeature, …]}
  // (e.g. the Totem Warrior's Totem Spirit / Aspect of the Beast / Totemic Attunement,
  // where you pick Bear / Eagle / Wolf / …). Unlike Fighting Style or Maneuvers these
  // are NOT an optionalfeatureProgression, so the builder never saw them. The block may
  // sit one ref deep: the LISTED feature "Path of the Totem Warrior" points (via
  // refSubclassFeature) at "Totem Spirit", and the options live inside THAT. So we
  // follow refSubclassFeature / refClassFeature into their targets and carry the target
  // feature's name down as the choice `label`. Returns, per options block:
  //   [{ count, label, options:[{ name, source, level, entries }] }]
  function _findScf(scfList, p) {
    return scfList.find(function (f) { return f.name === p.name && f.subclassShortName === p.subclassShort && f.level === p.level && (!p.subclassSource || f.source === p.subclassSource); })
        || scfList.find(function (f) { return f.name === p.name && f.subclassShortName === p.subclassShort && f.level === p.level; });
  }
  function _findCf(cfList, q) {
    return cfList.find(function (f) { return f.name === q.name && f.level === q.level && (!q.source || f.source === q.source); })
        || cfList.find(function (f) { return f.name === q.name && f.level === q.level; });
  }
  function extractFeatureOptions(entries, scfList, cfList, srcDefault, depth, label) {
    depth = depth || 0;
    var out = [];
    if (!entries || depth > 6) return out;
    var arr = Array.isArray(entries) ? entries : [entries];
    arr.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      if (e.type === 'options' && Array.isArray(e.entries)) {
        var options = [];
        e.entries.forEach(function (ref) {
          if (!ref || typeof ref !== 'object') return;
          if (ref.type === 'refSubclassFeature' && ref.subclassFeature) {
            var obj = _findScf(scfList, parseSubclassFeatureRef(ref.subclassFeature, srcDefault));
            if (obj) options.push({ name: obj.name, source: obj.source, level: obj.level,
              entries: resolveNestedRefs(obj.entries || [], scfList, cfList, srcDefault, depth + 1) });
          } else if (ref.type === 'refClassFeature' && ref.classFeature) {
            var cobj = _findCf(cfList, parseClassFeatureRef(ref.classFeature, srcDefault));
            if (cobj) options.push({ name: cobj.name, source: cobj.source, level: cobj.level,
              entries: resolveNestedRefs(cobj.entries || [], scfList, cfList, srcDefault, depth + 1) });
          }
        });
        if (options.length) out.push({ count: (+e.count || 1), label: label || null, options: options });
      } else if (e.type === 'refSubclassFeature' && e.subclassFeature) {
        var t = _findScf(scfList, parseSubclassFeatureRef(e.subclassFeature, srcDefault));
        if (t) out = out.concat(extractFeatureOptions(t.entries, scfList, cfList, srcDefault, depth + 1, t.name));
      } else if (e.type === 'refClassFeature' && e.classFeature) {
        var tc = _findCf(cfList, parseClassFeatureRef(e.classFeature, srcDefault));
        if (tc) out = out.concat(extractFeatureOptions(tc.entries, scfList, cfList, srcDefault, depth + 1, tc.name));
      } else if (Array.isArray(e.entries)) {
        out = out.concat(extractFeatureOptions(e.entries, scfList, cfList, srcDefault, depth + 1, label));
      }
    });
    return out;
  }

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
  // Warlock pact magic encodes slots differently: a classTableGroups row carries a
  // "Spell Slots" count column and a "Slot Level" column (all slots at one level).
  // Returns the same {level: [l1..l9]} shape as mkSlots, so the engine is agnostic.
  function stripTag(s) { return String(s).replace(/\{@\w+ ([^|}]+)(?:\|[^}]*)?\}/g, '$1').replace(/\{@\w+\}/g, ''); }
  function slotLevelOf(cell) {
    const s = String(cell);
    const byFilter = s.match(/level=(\d+)/);            // {@filter 3rd|spells|level=3|...}
    if (byFilter) return +byFilter[1];
    const byOrd = stripTag(s).match(/(\d+)\s*(?:st|nd|rd|th)/i);
    return byOrd ? +byOrd[1] : 0;
  }
  function mkPactSlots(tableGroups) {
    const out = {};
    const labelOf = l => stripTag(l).trim();
    const grp = (tableGroups || []).find(g => Array.isArray(g.colLabels) && Array.isArray(g.rows)
      && g.colLabels.some(l => /spell slots/i.test(labelOf(l)))
      && g.colLabels.some(l => /slot level/i.test(labelOf(l))));
    if (!grp) return out;
    const countIdx = grp.colLabels.findIndex(l => /spell slots/i.test(labelOf(l)));
    const lvlIdx = grp.colLabels.findIndex(l => /slot level/i.test(labelOf(l)));
    grp.rows.forEach((row, i) => {
      const count = parseInt(row[countIdx], 10) || 0;
      const lvl = slotLevelOf(row[lvlIdx]);
      if (count > 0 && lvl >= 1) {
        const arr = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        arr[lvl - 1] = count;
        out[i + 1] = arr;
      }
    });
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
        entries: obj ? resolveNestedRefs(obj.entries, file.subclassFeature || [], file.classFeature || [], srcDefault) : null,
        choices: obj ? extractFeatureOptions(obj.entries, file.subclassFeature || [], file.classFeature || [], srcDefault) : [],
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
          entries: obj ? resolveNestedRefs(obj.entries, file.subclassFeature || [], file.classFeature || [], srcDefault) : null,
          choices: obj ? extractFeatureOptions(obj.entries, file.subclassFeature || [], file.classFeature || [], srcDefault) : [],
          unresolved: !obj,
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
        optFeatureProg: sc.optionalfeatureProgression || [],
      };
    });

    // spell slots come straight from the class table; cantrip/spells-known arrays
    // distinguish known casters (Bard/Sorc) from prepared (Wizard/Cleric/Druid).
    const spellcasting = mkSpellcasting(c, c.name);   // base list = the class's own
    const slotsByLevel = c.casterProgression === 'pact' ? mkPactSlots(c.classTableGroups) : mkSlots(c.classTableGroups);

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
      optFeatureProg: c.optionalfeatureProgression || [],
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
        // A spell's class-list membership is split across two fields: `class` (the
        // association defined in the spell's own book) and `classVariant` (added to the
        // list by a LATER book — e.g. XGE adds Absorb Elements to the wizard/sorcerer/
        // druid/ranger lists, TCE expands several lists). Both are real membership;
        // checking only `class` silently dropped ~100 wizard spells, and the equivalent
        // for every other class. Source gating (onlySources, above) still applies.
        const onList = (info.class || []).some(cl => cl.name === className)
                    || (info.classVariant || []).some(cl => cl.name === className);
        if (onList) want.push({ name: spellName, spellSource });
      }
    }
    const files = [...new Set(want.map(w => w.spellSource))].filter(s => idx[s]);
    const data = {};
    await Promise.all(files.map(async s => { data[s] = await fetchJson(`spells/${idx[s]}`); }));
    const out = [];
    const withDetail = !!(opts && opts.detail);
    for (const w of want) {
      const f = data[w.spellSource]; if (!f) continue;
      const sp = (f.spell || []).find(x => x.name === w.name && x.source === w.spellSource);
      if (!sp) continue;
      const item = { name: sp.name, level: sp.level, school: sp.school, source: sp.source };
      if (withDetail) {
        item.time = sp.time || null;
        item.range = sp.range || null;
        item.components = sp.components || null;
        item.duration = sp.duration || null;
        item.ritual = !!(sp.meta && sp.meta.ritual);
        item.concentration = (sp.duration || []).some(d => d && d.concentration);
        item.entries = sp.entries || [];
        item.entriesHigherLevel = sp.entriesHigherLevel || null;
        item.spellAttack = sp.spellAttack || null;
        item.savingThrow = sp.savingThrow || null;
        item.damageInflict = sp.damageInflict || null;
      }
      out.push(item);
    }
    out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    return out;
  }

  // Resolve arbitrary spells BY NAME (case-insensitive) -> { name, level, school, source[, time…] }.
  // Same sources.json / index.json path as loadClassSpellList, but filtered by a name set instead
  // of a class. Lets the spell picker resolve racial / feat spells that aren't on the character's
  // own class list (e.g. a Tiefling Wizard's Hellish Rebuke) so they bucket by their real level.
  function spellToItem(sp, withDetail) {
    const item = { name: sp.name, level: sp.level, school: sp.school, source: sp.source };
    if (withDetail) {
      item.time = sp.time || null;
      item.range = sp.range || null;
      item.components = sp.components || null;
      item.duration = sp.duration || null;
      item.ritual = !!(sp.meta && sp.meta.ritual);
      item.concentration = (sp.duration || []).some(d => d && d.concentration);
      item.entries = sp.entries || [];
      item.entriesHigherLevel = sp.entriesHigherLevel || null;
      item.spellAttack = sp.spellAttack || null;
      item.savingThrow = sp.savingThrow || null;
      item.damageInflict = sp.damageInflict || null;
    }
    return item;
  }
  async function loadSpellMeta(names, opts) {
    const wantNames = new Map();                 // lowercased -> kept (first wins)
    (names || []).forEach(n => { const k = String(n).toLowerCase(); if (!wantNames.has(k)) wantNames.set(k, n); });
    if (!wantNames.size) return [];
    const withDetail = !!(opts && opts.detail);
    const [sources, idx] = await Promise.all([
      fetchJson('spells/sources.json'),
      fetchJson('spells/index.json'),
    ]);
    const want = [];
    for (const [spellSource, spells] of Object.entries(sources)) {
      for (const spellName of Object.keys(spells)) {
        if (wantNames.has(spellName.toLowerCase())) want.push({ name: spellName, spellSource });
      }
    }
    const loaded = {};
    const files = [...new Set(want.map(w => w.spellSource))].filter(s => idx[s]);
    await Promise.all(files.map(async s => { loaded[s] = await fetchJson(`spells/${idx[s]}`); }));
    const out = [];
    const seen = new Set();
    for (const w of want) {
      const key = w.name.toLowerCase();
      if (seen.has(key)) continue;               // first source carrying the name wins
      const f = loaded[w.spellSource]; if (!f) continue;
      const sp = (f.spell || []).find(x => x.name === w.name && x.source === w.spellSource);
      if (!sp) continue;
      seen.add(key);
      out.push(spellToItem(sp, withDetail));
    }
    // Fallback: names not in the aggregate sources.json (e.g. GGR / SCC setting-book spells
    // a guild background expands to) — scan the remaining indexed source files by name.
    const missing = [...wantNames.keys()].filter(k => !seen.has(k));
    if (missing.length) {
      const rest = Object.keys(idx).filter(s => !(s in loaded));
      await Promise.all(rest.map(async s => { try { loaded[s] = await fetchJson(`spells/${idx[s]}`); } catch (e) { loaded[s] = { spell: [] }; } }));
      for (const s of rest) {
        for (const sp of (loaded[s].spell || [])) {
          const k = sp.name.toLowerCase();
          if (wantNames.has(k) && !seen.has(k)) { seen.add(k); out.push(spellToItem(sp, withDetail)); }
        }
      }
    }
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
      // Variant Human is not a standalone entry in the 2014 data — synthesize it
      // from the real Human (PHB) so every field shape comes from the normal
      // pipeline, then patch the three things that differ: +1 to two abilities of
      // choice, one skill, and one feat.
      if (name === 'Variant Human') {
        const baseH = byKey.get('human|phb');
        if (baseH) {
          const vh = normalizeRace(resolveCopy(baseH, byKey), []);
          vh.name = 'Variant Human';
          vh.abilityBonuses = {};
          vh.abilityChoices = [{ kind: 'count', from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], count: 2, amount: 1 }];
          vh.skillProficiencies = { fixed: [], anyCount: 1, choose: [] };
          vh.feats = [{ any: 1 }];
          vh.traits = (vh.traits || []).concat([
            { name: 'Skills', entries: ['You gain proficiency in one skill of your choice.'] },
            { name: 'Feat', entries: ['You gain one feat of your choice.'] },
          ]);
          return vh;
        }
      }
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

  // ── optional-feature choices (Fighting Style / Maneuvers / Invocations / …) ───
  // 5etools encodes "choose N from a pool" via `optionalfeatureProgression` on the
  // class or subclass (what + how many, per level) cross-referenced against the
  // flat optionalfeatures.json catalog (the pool, tagged by `featureType`). Read
  // generically — no per-class code. `progression` is either {level:count} (the
  // value = cumulative total unlocked AT that tier) or a 20-slot, level-indexed
  // array (value = cumulative total known at that level).
  function isUASource(s) { return /^UA/i.test(s || ''); }

  function progressionCountAt(progression, level) {
    if (!progression) return 0;
    const L = Math.max(1, level | 0);
    if (Array.isArray(progression)) return progression[Math.min(L, progression.length) - 1] || 0;
    let best = 0, bestLv = -1;
    Object.keys(progression).forEach(k => {
      const lv = parseInt(k, 10);
      if (lv <= L && lv > bestLv) { bestLv = lv; best = progression[k]; }   // highest unlocked tier
    });
    return best || 0;
  }

  function _cleanSpellRef(s) { return String(s).split('#')[0].replace(/\b\w/g, c => c.toUpperCase()); }
  function _prereqLevel(prereq) {
    let max = 0;
    (prereq || []).forEach(p => {
      if (p && p.level != null) {
        const lv = typeof p.level === 'object' ? (p.level.level || 0) : p.level;
        if (lv > max) max = lv;
      }
    });
    return max;
  }
  function prereqText(prereq) {
    const parts = [];
    (prereq || []).forEach(p => {
      if (!p) return;
      if (p.level != null) { const lv = typeof p.level === 'object' ? (p.level.level || p.level) : p.level; parts.push('Level ' + lv + '+'); }
      if (p.spell)   [].concat(p.spell).forEach(s => parts.push('knows ' + _cleanSpellRef(s)));
      if (p.pact)    parts.push('Pact of the ' + p.pact);
      if (p.patron)  parts.push(p.patron + ' patron');
      if (p.ability) [].concat(p.ability).forEach(a => Object.keys(a).forEach(k => parts.push(k.toUpperCase() + ' ' + a[k] + '+')));
      if (p.otherFeature || p.optionalfeature) parts.push('requires another option');
    });
    return parts.join(' · ');
  }

  function loadOptionalFeatures() {
    return fetchJson('optionalfeatures.json').then(d => d.optionalfeature || []);
  }

  // `model` = a loadClass() result (now carrying optFeatureProg on the model and on
  // each subclass). Returns the choice-groups this build owes at `level`, each with
  // candidate options pre-filtered by featureType + source + level prerequisite.
  // opts: { sources?: string[] (allow-list), includeUA?: bool }.
  async function owedFeatureChoices(model, subclassShortName, level, opts) {
    opts = opts || {};
    const catalog = await loadOptionalFeatures();
    const L = Math.max(1, level | 0);
    const blocks = [];
    (model.optFeatureProg || []).forEach(b => blocks.push({ block: b, origin: 'class', originName: model.name }));
    const sc = (model.subclasses || []).find(s => s.shortName === subclassShortName);
    if (sc) (sc.optFeatureProg || []).forEach(b => blocks.push({ block: b, origin: 'subclass', originName: sc.name }));

    return blocks.map(entry => {
      const b = entry.block;
      const count = progressionCountAt(b.progression, L);
      if (count <= 0) return null;
      const types = b.featureType || [];
      const options = catalog
        .filter(f => (f.featureType || []).some(t => types.indexOf(t) !== -1))
        .filter(f => opts.includeUA || !isUASource(f.source))
        .filter(f => !opts.sources || opts.sources.indexOf(f.source) !== -1)
        .filter(f => _prereqLevel(f.prerequisite) <= L)
        .map(f => ({
          name: f.name, source: f.source,
          featureType: f.featureType || [],
          prerequisite: f.prerequisite || null,
          prereqText: prereqText(f.prerequisite),
          entries: f.entries || null,
        }))
        .sort((a, b2) => a.name.localeCompare(b2.name));
      return { name: b.name, featureType: types, count, origin: entry.origin, originName: entry.originName, options };
    }).filter(Boolean);
  }

  // In-feature option picks (the Totem Warrior's Totem Spirit / Aspect of the Beast /
  // Totemic Attunement — "choose Bear / Eagle / Wolf / …"). These live INLINE in a
  // feature's entries (see extractFeatureOptions), not in optionalfeatureProgression, so
  // owedFeatureChoices never saw them. Walk the class + chosen-subclass features granted
  // at `level` and return their option blocks in the SAME group shape owedFeatureChoices
  // uses, so ChoicesUI renders / reconciles / emits them with no extra plumbing. Pure +
  // synchronous (operates on an already-loaded loadClass() model).
  function featureChoiceGroups(model, subclassShortName, level) {
    if (!model) return [];
    var L = Math.max(1, level | 0);
    var groups = [];
    function collect(featuresByLevel, origin, originName) {
      for (var lv = 1; lv <= L; lv++) {
        (featuresByLevel[lv] || []).forEach(function (f) {
          (f.choices || []).forEach(function (choice, ci) {
            var base = choice.label || f.name;
            var name = base + ((!choice.label && f.choices.length > 1) ? (' (' + (ci + 1) + ')') : '');
            groups.push({
              name: name, featureType: [], count: (choice.count || 1),
              origin: origin, originName: originName, featureOption: true,
              options: (choice.options || []).map(function (o) {
                return { name: o.name, source: o.source, prerequisite: null, prereqText: '', entries: o.entries || null };
              })
            });
          });
        });
      }
    }
    collect(model.featuresByLevel || {}, 'class', model.name);
    var sc = (model.subclasses || []).find(function (s) { return s.shortName === subclassShortName; });
    if (sc) collect(sc.featuresByLevel || {}, 'subclass', sc.name);
    return groups;
  }

  // ── Feats (feats.json) ──────────────────────────────────────────────────────
  function loadFeats() {
    return fetchJson('feats.json').then(d => d.feat || []);
  }

  function _sameRace(a, b) { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1; }

  // human-readable prerequisite summary. prereq is an array; elements are OR'd, the
  // conditions inside an element are AND'd. Returns '' when there is no prerequisite.
  function featPrereqText(prereq) {
    const groups = (prereq || []).map(p => {
      if (!p) return null;
      const c = [];
      if (p.level != null) { const lv = typeof p.level === 'object' ? (p.level.level || p.level) : p.level; c.push('level ' + lv); }
      if (p.ability) c.push([].concat(p.ability).map(a => Object.keys(a).map(k => k.toUpperCase() + ' ' + a[k]).join(' & ')).join(' or '));
      if (p.spellcasting || p.spellcasting2020 || p.spellcastingFeature || p.spellcastingPrepared) c.push('the ability to cast at least one spell');
      if (p.race) c.push([].concat(p.race).map(r => r.name || r).join(' or '));
      if (p.proficiency) c.push('proficiency with ' + [].concat(p.proficiency).map(x => Object.keys(x).map(k => x[k] === true ? k : x[k]).join('/')).join(', '));
      if (p.background) c.push([].concat(p.background).map(b => (b.name || b)).join(' or ') + ' background');
      if (p.other) c.push(p.other);
      if (p.otherSummary) c.push(p.otherSummary.entry || p.otherSummary);
      return c.length ? c.join(', ') : null;
    }).filter(Boolean);
    return groups.join(' or ');
  }

  // does a character meet a feat's prerequisite? ctx: { abilities:{str..cha},
  // level, caster:bool, raceName }. OR across prereq elements, AND within; conditions
  // we can't verify here (proficiency / background / other) never block.
  function featMeetsPrereq(feat, ctx) {
    const pre = feat && feat.prerequisite;
    if (!pre || !pre.length) return true;
    ctx = ctx || {}; const ab = ctx.abilities || {};
    return pre.some(p => {
      if (!p) return true;
      if (p.level != null) { const lv = typeof p.level === 'object' ? (p.level.level || p.level) : p.level; if ((ctx.level || 1) < lv) return false; }
      if (p.ability && !([].concat(p.ability).some(a => Object.keys(a).every(k => (ab[k] || 0) >= a[k])))) return false;
      if ((p.spellcasting || p.spellcasting2020 || p.spellcastingFeature || p.spellcastingPrepared) && !ctx.caster) return false;
      if (p.race) { const names = [].concat(p.race).map(r => (r.name || r)); if (ctx.raceName && !names.some(n => _sameRace(n, ctx.raceName))) return false; }
      return true;
    });
  }

  // normalize a feat's half-feat ability bump: null | { fixed:{cha:1} } | { choose:{from:[…],amount:1} }.
  function featAbilityChoice(feat) {
    const a = feat && feat.ability;
    if (!a || !a.length) return null;
    const first = a[0];
    if (first.choose) return { choose: { from: first.choose.from || [], amount: first.choose.amount || 1 } };
    const fixed = {}; Object.keys(first).forEach(k => { if (typeof first[k] === 'number') fixed[k] = first[k]; });
    return Object.keys(fixed).length ? { fixed } : null;
  }

  // the full feat list shaped for the picker: source/UA filtered, each carrying its
  // prereq summary, half-feat ability shape, and an `eligible` flag for this build.
  function featsForChar(feats, ctx, opts) {
    opts = opts || {};
    return (feats || [])
      .filter(f => opts.includeUA || !isUASource(f.source))
      .filter(f => !opts.sources || opts.sources.indexOf(f.source) !== -1)
      .map(f => ({
        name: f.name, source: f.source,
        prerequisite: f.prerequisite || null,
        prereqText: featPrereqText(f.prerequisite),
        ability: featAbilityChoice(f),
        eligible: featMeetsPrereq(f, ctx),
        entries: f.entries || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ── Starting equipment (class.startingEquipment.defaultData + background) ────
  // Both class and background express gear as an array of groups: { _:[…] } is
  // always-granted, { a:[…], b:[…], … } is a mutually-exclusive pick. Each entry is
  // a plain "name|source" ref, a { item, quantity, displayName, containsValue }, a
  // { equipmentType } category placeholder, or a { special } freeform line.
  function loadBackgrounds() { return fetchJson('backgrounds.json').then(d => d.background || []); }
  function backgroundEquipment(list, name, source) {
    const b = (list || []).find(x => x.name === name && (!source || x.source === source)) || (list || []).find(x => x.name === name);
    return (b && b.startingEquipment) || [];
  }
  // skill / language / tool grants a background confers (same parsed shapes as a
  // race: skills/tools -> {fixed,anyCount,choose}, languages -> {fixed,anyStandard,any}).
  // The Proficiencies step reads this; the 2014 "Customizing a Background" swap is a
  // UI-side override, so this returns the background's DEFAULT grants.
  function backgroundProficiencies(list, name, source) {
    const b = (list || []).find(x => x.name === name && (!source || x.source === source)) || (list || []).find(x => x.name === name);
    if (!b) return { skills: { fixed: [], anyCount: 0, choose: [] }, languages: { fixed: [], anyStandard: 0, any: 0 }, tools: { fixed: [], anyCount: 0, choose: [] } };
    return {
      skills: parseProfChoose(b.skillProficiencies),
      languages: parseLanguages(b.languageProficiencies),
      tools: parseProfChoose(b.toolProficiencies),
    };
  }

  function _cleanItemName(s) { return String(s).split('|')[0].trim(); }
  function _equipTypeLabel(t) {
    const M = {
      weapon: 'any weapon', weaponMartial: 'any martial weapon', weaponMartialMelee: 'any martial melee weapon',
      weaponMartialRanged: 'any martial ranged weapon', weaponSimple: 'any simple weapon', weaponSimpleMelee: 'any simple melee weapon',
      weaponSimpleRanged: 'any simple ranged weapon', armor: 'any armor', instrumentMusical: 'any musical instrument',
      focusSpellcasting: 'any spellcasting focus', setGaming: 'any gaming set', toolArtisan: "any artisan's tools",
    };
    return M[t] || ('any ' + String(t).replace(/([A-Z])/g, ' $1').toLowerCase());
  }
  function _resolveItem(spec) {
    if (typeof spec === 'string') return { name: _cleanItemName(spec), qty: 1 };
    if (spec.equipmentType) return { name: _equipTypeLabel(spec.equipmentType), qty: spec.quantity || 1, category: spec.equipmentType };
    if (spec.special) return { name: spec.special, qty: spec.quantity || 1, special: true };
    if (spec.item) { const r = { name: spec.displayName || _cleanItemName(spec.item), qty: spec.quantity || 1 }; if (spec.containsValue != null) r.value = spec.containsValue; return r; }
    if (spec.value != null) return { name: 'coins', qty: 1, value: spec.value };
    return { name: JSON.stringify(spec), qty: 1 };
  }
  function _parseEquipGroup(g, source) {
    if (g._) return { kind: 'fixed', source: source, items: g._.map(_resolveItem) };
    const keys = Object.keys(g).filter(k => /^[a-z]$/.test(k)).sort();
    if (keys.length) return { kind: 'choice', source: source, options: keys.map(k => ({ label: k.toUpperCase(), items: [].concat(g[k]).map(_resolveItem) })) };
    return { kind: 'fixed', source: source, items: [].concat(g).map(_resolveItem) };
  }
  // classModel: a loadClass() result; bgEquip: backgroundEquipment(...) (or []).
  function parseStartingEquipment(classModel, bgEquip) {
    const se = (classModel && classModel.startingEquipment) || {};
    const groups = [];
    (se.defaultData || []).forEach(g => groups.push(_parseEquipGroup(g, 'class')));
    (bgEquip || []).forEach(g => groups.push(_parseEquipGroup(g, 'background')));
    const goldM = se.goldAlternative ? String(se.goldAlternative).match(/\{@dice ([^|}]+)/) : null;
    return {
      fromBackground: !!se.additionalFromBackground,
      goldAlternative: goldM ? goldM[1].trim() : (se.goldAlternative ? _cleanItemName(se.goldAlternative) : null),
      groups: groups,
    };
  }

  const API = {
    BASE, fetchJson,
    parseClassFeatureRef, parseSubclassFeatureRef, normalizeClass,
    loadClass, loadClassSpellList, loadSpellMeta,
    loadOptionalFeatures, owedFeatureChoices, featureChoiceGroups, progressionCountAt, prereqText,
    loadFeats, featPrereqText, featMeetsPrereq, featAbilityChoice, featsForChar,
    loadBackgrounds, backgroundEquipment, backgroundProficiencies, parseStartingEquipment,
    loadRace,
    parseAbility, parseSpeed, parseSize, parseLanguages, parseProfChoose,
    collectTraits, applyMod, resolveCopy, normalizeRace, makeLoadRace,
  };
  if (typeof window !== 'undefined') window.SoulShardsData = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
