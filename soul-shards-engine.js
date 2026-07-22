/* soul-shards-engine.js — the grant / advancement engine for the "Soul Shards" builder.
 *
 * Pure and environment-agnostic. It does NOT fetch anything — soul-shards-data.js
 * owns all IO. This module takes the normalized class model that loadClass() returns
 * and assembles "the character at level N": features granted 1..N (origin-stamped),
 * the hit-point total (level-1 max + CON, then rolled or average per level), the
 * subclass-timing gate, ASI-level detection, spell entitlements (slots / cantrips /
 * spells-known or prepared-count), and the list of decisions still pending.
 *
 * Creating a character is build() at level N; levelling up is the delta to N — the
 * SAME engine driving both. This first slice is single-class only; multiclass,
 * feats, and species grants layer on later behind the same shape.
 *
 * Attaches to window.SoulShardsEngine in the browser and module.exports in Node
 * (so it can be smoke-tested headlessly, like the data layer).
 */
(function () {
  'use strict';

  // ── small pure helpers ─────────────────────────────────────────────────────
  function abilityMod(score) { return Math.floor((score - 10) / 2); }

  // fixed HP gained per level after 1st = ⌊die/2⌋ + 1  (d6→4, d8→5, d10→6, d12→7)
  function avgPerLevel(hd) { return Math.floor(hd / 2) + 1; }

  // the caster level used to size a PREPARED caster's prepared-spell count
  function preparedCasterLevel(progression, level) {
    switch (progression) {
      case 'full':      return level;                  // Cleric, Druid, Wizard
      case '1/2':       return Math.floor(level / 2);  // Paladin (the max(1,…) is applied on the count)
      case 'artificer': return Math.ceil(level / 2);   // Artificer rounds up
      case '1/3':       return Math.floor(level / 3);  // (EK/AT subclass casters — later)
      default:          return level;
    }
  }

  function isASIFeature(name) { return /^ability score improvement/i.test(name || ''); }

  // optional-feature count owed at a level. `progression` is {level:cumulative} or a
  // 20-slot, level-indexed array (value = cumulative). Mirrors SoulShardsData's resolver.
  function ofCountAt(progression, level) {
    if (!progression) return 0;
    var L = Math.max(1, level | 0);
    if (Array.isArray(progression)) return progression[Math.min(L, progression.length) - 1] || 0;
    var best = 0, bestLv = -1;
    Object.keys(progression).forEach(function (k) {
      var lv = parseInt(k, 10);
      if (lv <= L && lv > bestLv) { bestLv = lv; best = progression[k]; }
    });
    return best || 0;
  }

  // ── feature collection (origin-stamped) ─────────────────────────────────────
  function collectLinkedFeatures(entries, out) {
    if (!entries) return;
    if (Array.isArray(entries)) { entries.forEach(function (e) { collectLinkedFeatures(e, out); }); return; }
    if (typeof entries !== 'object') return;
    if (entries._featureRef && entries.name) out.push(entries);
    if (entries.entries) collectLinkedFeatures(entries.entries, out);
    if (entries.items) collectLinkedFeatures(entries.items, out);
  }

  function appendLinkedFeatures(out, parent, model, subclass) {
    var linked = [];
    collectLinkedFeatures(parent.entries, linked);
    linked.forEach(function (f) {
      var originType = f._featureRef === 'subclass' ? 'subclass' : 'class';
      var originName = originType === 'subclass' && subclass ? subclass.name : model.name;
      var featureLevel = f.level || parent.level;
      var duplicate = out.some(function (x) {
        return x.name === f.name && x.level === featureLevel && x.originType === originType;
      });
      if (duplicate) return;
      out.push({
        level: featureLevel, name: f.name, source: f.source || parent.source,
        originType: originType, origin: originType + ':' + originName,
        entries: f.entries || [], unresolved: false,
      });
    });
  }

  // Walks 1..N, taking class features always and subclass features only once the
  // subclass is unlocked AND chosen. Every entry carries where it came from — the
  // seed of the provenance model (race/feat origins join later).
  function collectFeatures(model, subclass, level) {
    var out = [];
    for (var L = 1; L <= level; L++) {
      (model.featuresByLevel[L] || []).forEach(function (f) {
        var granted = {
          level: L, name: f.name, source: f.source,
          originType: 'class', origin: 'class:' + model.name,
          gainSubclass: !!f.gainSubclass, entries: f.entries, unresolved: f.unresolved,
        };
        out.push(granted);
        appendLinkedFeatures(out, granted, model, subclass);
      });
      if (subclass) {
        (subclass.featuresByLevel[L] || []).forEach(function (f) {
          var granted = {
            level: L, name: f.name, source: f.source,
            originType: 'subclass', origin: 'subclass:' + subclass.name,
            entries: f.entries, unresolved: f.unresolved,
          };
          out.push(granted);
          appendLinkedFeatures(out, granted, model, subclass);
        });
      }
    }
    return out;
  }

  // ── hit points ──────────────────────────────────────────────────────────────
  // Only the character's VERY FIRST level (the starting class's 1st level) is maxed:
  // 1st = max die + CON. Every later level — INCLUDING the 1st level of a class taken
  // by multiclassing — is a rolled value (if supplied) or the fixed average, + CON.
  // `firstClass` (default true) says whether THIS build holds that first character
  // level; the derive passes false for every class after the starting one, so a
  // multiclass no longer over-counts the added class's first level. Per-level
  // breakdown is returned so the sheet can show it and a level-up records the gain.
  function hitPoints(hd, conMod, level, hp, firstClass) {
    hp = hp || {};
    if (firstClass === undefined) firstClass = true;
    var method = hp.method === 'roll' ? 'roll' : 'average';
    var rolls = hp.rolls || {};
    var byLevel = [];
    for (var L = 1; L <= level; L++) {
      var base, kind;
      if (L === 1 && firstClass) {
        base = hd; kind = 'max';                            // the single maxed level
      } else {
        base = method === 'roll'
          ? (rolls[L] != null ? rolls[L] : avgPerLevel(hd)) // missing roll falls back to average
          : avgPerLevel(hd);
        kind = method;
      }
      byLevel.push({ level: L, base: base, con: conMod, gained: base + conMod, kind: kind });
    }
    var max = byLevel.reduce(function (s, x) { return s + x.gained; }, 0);
    return { max: max, method: method, byLevel: byLevel };
  }

  // ── spell entitlements ──────────────────────────────────────────────────────
  // The NUMBERS a caster is granted at level N — not the picking. Known casters get
  // a spells-known count; prepared casters get a prepared-count (ability mod + caster
  // level, min 1). Domain/racial/feat extras are provenance-tagged elsewhere and do
  // NOT count against this pool.
  function spellEntitlement(model, abilities, level, subclass) {
    // a casting subclass (Eldritch Knight / Arcane Trickster) overrides the base
    // class, which for Fighter/Rogue grants no casting at all.
    var fromSub = subclass && subclass.spellcasting;
    var sc = fromSub || model.spellcasting;
    if (!sc) return null;
    var slotsByLevel = (fromSub && subclass.slotsByLevel) || model.slotsByLevel || {};
    var ent = {
      ability: sc.ability,
      progression: sc.progression,
      prepared: sc.prepared,
      source: fromSub ? 'subclass' : 'class',
      spellListClass: sc.spellListClass || model.name,
      slots: (slotsByLevel[level] || []).slice(),
      cantripsKnown: sc.cantripsKnown ? (sc.cantripsKnown[level - 1] || 0) : 0,
      spellsKnown: null,
      preparedCount: null,
    };
    if (sc.prepared) {
      var have = sc.ability && abilities && abilities[sc.ability] != null;
      ent.preparedCount = have ? Math.max(1, abilityMod(abilities[sc.ability]) + preparedCasterLevel(sc.progression, level)) : null;
    } else {
      ent.spellsKnown = sc.spellsKnown ? (sc.spellsKnown[level - 1] || 0) : 0;
    }
    return ent;
  }

  // ── the build ────────────────────────────────────────────────────────────────
  function build(opts) {
    var model = opts.classModel;
    if (!model) throw new Error('build: classModel required (from SoulShardsData.loadClass)');
    var level = Math.max(1, Math.min(20, opts.level || 1));
    var abilities = opts.abilities || {};
    var conMod = abilities.con != null ? abilityMod(abilities.con) : 0;

    // subclass timing gate — the rule: level N grants only 1..N
    var subAt = model.subclassChoiceLevel;
    var unlocked = subAt != null && level >= subAt;
    var subclass = null, subclassPending = false;
    if (unlocked) {
      if (opts.subclassShortName) {
        subclass = (model.subclasses || []).find(function (s) { return s.shortName === opts.subclassShortName; }) || null;
      }
      if (!subclass) subclassPending = true;
    }

    var features = collectFeatures(model, subclass, level);

    var asiLevels = [];
    features.forEach(function (f) {
      if (f.originType === 'class' && isASIFeature(f.name) && asiLevels.indexOf(f.level) === -1) asiLevels.push(f.level);
    });

    var hp = hitPoints(model.hd, conMod, level, opts.hp, opts.firstClass !== false);
    var spellcasting = spellEntitlement(model, abilities, level, subclass);

    // everything the player still has to decide for this level set
    var pending = [];
    if (subclassPending) pending.push({ kind: 'subclass', level: subAt, label: 'Choose ' + (model.subclassTitle || 'subclass') });
    asiLevels.forEach(function (L) { pending.push({ kind: 'asi', level: L, label: 'Ability Score Improvement or feat (level ' + L + ')' }); });
    if (spellcasting && spellcasting.cantripsKnown) pending.push({ kind: 'cantrips', count: spellcasting.cantripsKnown, label: 'Choose ' + spellcasting.cantripsKnown + ' cantrips' });
    if (spellcasting && spellcasting.spellsKnown) pending.push({ kind: 'spells-known', count: spellcasting.spellsKnown, label: 'Choose ' + spellcasting.spellsKnown + ' spells known' });
    if (spellcasting && spellcasting.preparedCount) pending.push({ kind: 'prepared', count: spellcasting.preparedCount, label: 'Prepare ' + spellcasting.preparedCount + ' from the ' + model.name + ' list' });

    // optional-feature picks (Fighting Style / Maneuvers / Invocations / Metamagic / …)
    (model.optFeatureProg || []).forEach(function (b) {
      var n = ofCountAt(b.progression, level);
      if (n > 0) pending.push({ kind: 'optfeature', name: b.name, featureType: b.featureType || [], count: n, origin: 'class', originName: model.name, level: level });
    });
    if (subclass) (subclass.optFeatureProg || []).forEach(function (b) {
      var n = ofCountAt(b.progression, level);
      if (n > 0) pending.push({ kind: 'optfeature', name: b.name, featureType: b.featureType || [], count: n, origin: 'subclass', originName: subclass.name, level: level });
    });

    return {
      level: level,
      className: model.name,
      classSource: model.source,
      subclass: subclass ? subclass.name : null,
      subclassShortName: subclass ? subclass.shortName : null,
      subclassTitle: model.subclassTitle,
      subclassUnlockLevel: subAt,
      hd: model.hd,
      savingThrows: model.savingThrows || [],
      hp: hp,
      features: features,
      asiLevels: asiLevels,
      spellcasting: spellcasting,
      pending: pending,
    };
  }

  // ── level-up = the delta between successive builds (same engine, one step) ────
  function spellDelta(a, b) {
    if (!b) return null;
    if (!a) a = { slots: [], cantripsKnown: 0, spellsKnown: 0, preparedCount: 0 };
    var newSlotLevels = [];
    for (var i = 0; i < (b.slots || []).length; i++) {
      var had = !!(a.slots && a.slots[i] > 0);
      if (b.slots[i] > 0 && !had) newSlotLevels.push(i + 1);   // 0→>0 only (arrays are zero-padded to 9 levels)
    }
    return {
      newSlotLevels: newSlotLevels,                                  // spell levels first unlocked here
      cantrips: (b.cantripsKnown || 0) - (a.cantripsKnown || 0),
      spellsKnown: b.spellsKnown != null ? b.spellsKnown - (a.spellsKnown || 0) : null,
      preparedCount: b.preparedCount != null ? b.preparedCount - (a.preparedCount || 0) : null,
    };
  }

  function levelUp(opts) {
    var to = build(opts);
    var from = build(Object.assign({}, opts, { level: Math.max(1, (opts.level || 1) - 1) }));
    var newFeatures = to.features.filter(function (f) { return f.level === to.level; });
    var hpGain = to.hp.byLevel[to.hp.byLevel.length - 1];
    return {
      from: from.level, to: to.level, build: to,
      gained: {
        features: newFeatures,
        hp: hpGain,
        asi: to.asiLevels.indexOf(to.level) !== -1,
        unlocksSubclass: to.subclassUnlockLevel === to.level,
        spells: spellDelta(from.spellcasting, to.spellcasting),
      },
    };
  }

  var API = {
    abilityMod, avgPerLevel, preparedCasterLevel, isASIFeature,
    collectFeatures, hitPoints, spellEntitlement, spellDelta,
    build, levelUp,
  };
  if (typeof window !== 'undefined') window.SoulShardsEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
