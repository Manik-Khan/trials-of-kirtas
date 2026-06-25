/* soul-shards-spellcasting.js — multiclass spellcasting derive for Soul Shards.
 *
 * Folds the engine's PER-CLASS spellcasting into the ONE `structural.spellcasting`
 * block the sheet reads (sheet-data.js renderSpellcasting). This is the producer half
 * of the contract; it is the piece the single-class engine deliberately left out.
 * Pure / environment-agnostic (window.SoulShardsSpellcasting + module.exports).
 *
 * THE MULTICLASS RULE (2014 / SRD):
 *   - Full / half / third / artificer casters share ONE slot pool sized by a COMBINED
 *     caster level (full = L, ½ = ⌊L/2⌋, ⅓ = ⌊L/3⌋, artificer = ⌈L/2⌉) looked up in the
 *     standard multiclass slot table — recharges on a LONG rest.
 *   - Pact Magic (Warlock) is SEPARATE: its slots come from the Pact Magic table by
 *     Warlock level alone and do NOT combine — recharges on a SHORT rest.
 *   These two pools are exactly the pact/shared split the sheet contract was built around.
 *   (We compute both tables here rather than from the class slot table, because the data
 *   layer's mkSlots reads only rowsSpellProgression — it can't represent Pact Magic.)
 *
 * INPUT — what P7 assembles from engine.build() per class + the spell-picker's choices:
 *   {
 *     totalLevel,                         // Σ class levels → proficiency bonus
 *     abilities: { str..cha },            // final scores (post-racial)
 *     classes: [ {
 *       name, level, subclass,            // identity (subclass = display name, may be null)
 *       progression,                      // 'full'|'1/2'|'1/3'|'pact'|'artificer'|null
 *       ability,                          // 'cha' etc. (null for non-casters); from engine
 *       prepared                          // bool; from engine
 *     } ],
 *     spells: [ {                         // FLAT, provenance-tagged (the picker's output)
 *       name, level('cantrip'|1..9), origin('class'|'subclass'|'race'|'feat'|'expanded'),
 *       source, time, detail?
 *     } ],
 *     spellbook?: [ {name,level,origin,source} ],  // Wizard's owned book — persists distinct from groups
 *     extraPools?: [ {label,badge,tone,current,max,recharge} ],  // class resources (sorcery points, ki…)
 *     detail?: {...}                      // optional expanded card (else first spell carrying a detail)
 *   }
 *
 * OUTPUT: deriveSpellcasting(input) -> structural.spellcasting ; deriveClasses(input) -> structural.classes
 */
(function () {
  'use strict';

  // ── D&D tables (SRD) ────────────────────────────────────────────────────────
  // Multiclass spell slots by COMBINED caster level (index 0 unused). 9 spell levels.
  var MULTICLASS_SLOTS = [
    [0,0,0,0,0,0,0,0,0],
    [2,0,0,0,0,0,0,0,0], [3,0,0,0,0,0,0,0,0], [4,2,0,0,0,0,0,0,0], [4,3,0,0,0,0,0,0,0],
    [4,3,2,0,0,0,0,0,0], [4,3,3,0,0,0,0,0,0], [4,3,3,1,0,0,0,0,0], [4,3,3,2,0,0,0,0,0],
    [4,3,3,3,1,0,0,0,0], [4,3,3,3,2,0,0,0,0], [4,3,3,3,2,1,0,0,0], [4,3,3,3,2,1,0,0,0],
    [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,1,0], [4,3,3,3,2,1,1,1,0],
    [4,3,3,3,2,1,1,1,1], [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1]
  ];

  // Pact Magic by WARLOCK class level -> { count, slotLevel } (short rest).
  function pactMagic(warlockLevel) {
    var L = warlockLevel;
    if (!L) return null;
    var count = L === 1 ? 1 : L <= 10 ? 2 : L <= 16 ? 3 : 4;
    var slotLevel = Math.min(5, Math.ceil(L / 2));
    return { count: count, slotLevel: slotLevel };
  }

  function abilityMod(score) { return Math.floor(((score || 10) - 10) / 2); }
  function profBonus(totalLevel) { return 2 + Math.floor((Math.max(1, totalLevel || 1) - 1) / 4); }

  var ABILITY_NAME = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' };
  function ordinal(n) { var s=['th','st','nd','rd'], v=n%100; return n + (s[(v-20)%10] || s[v] || s[0]); }

  // contribution of one class to the COMBINED (non-pact) caster level
  function casterContribution(progression, level) {
    switch (progression) {
      case 'full':      return level;
      case '1/2':       return Math.floor(level / 2);
      case '1/3':       return Math.floor(level / 3);
      case 'artificer': return Math.ceil(level / 2);
      default:          return 0;   // 'pact' and non-casters add nothing here
    }
  }

  // ── slot pools (the keystone) ───────────────────────────────────────────────
  function mergeSlotPools(classes) {
    var pools = [];

    // Pact pool — Warlock levels summed (normally one Warlock, but be safe)
    var warlockLevel = classes.reduce(function (n, c) {
      return n + (c.progression === 'pact' ? (c.level || 0) : 0);
    }, 0);
    var pact = pactMagic(warlockLevel);
    if (pact) {
      pools.push({
        label: 'Pact Magic', badge: 'Lvl ' + pact.slotLevel, tone: 'class',
        current: pact.count, max: pact.count, recharge: pact.count + ' slots \u00B7 short rest'
      });
    }

    // Shared pool(s) — combined caster level -> multiclass table -> one pool per slot level
    var nonPact = classes.filter(function (c) { return casterContribution(c.progression, c.level) > 0; });
    var combined = nonPact.reduce(function (n, c) { return n + casterContribution(c.progression, c.level); }, 0);
    if (combined > 0) {
      var row = MULTICLASS_SLOTS[Math.min(20, combined)] || [];
      // single full/half/third caster → name the pool after it; multiple → generic "Spell Slots"
      var label = nonPact.length === 1 ? (nonPact[0].name + ' Slots') : 'Spell Slots';
      for (var i = 0; i < row.length; i++) {
        if (row[i] > 0) {
          pools.push({
            label: label, badge: 'Lvl ' + (i + 1), tone: 'subclass',
            current: row[i], max: row[i], recharge: row[i] + ' slots \u00B7 long rest'
          });
        }
      }
    }
    return pools;
  }

  // ── cast-meta (ability / DC / attack / Known-Prepared) ──────────────────────
  function castMeta(classes, totalLevel, abilities, racialAbil) {
    var pb = profBonus(totalLevel);
    var casters = classes.filter(function (c) { return c.ability; });
    if (!casters.length) {
      // No spellcasting CLASS — but a race can grant innate spellcasting (Yuan-Ti,
      // Tiefling, Drow, …) with its OWN ability, independent of class. Use it so the
      // save DC / attack still compute for a non-caster who casts only racial spells.
      if (racialAbil) {
        var rmod = abilityMod(abilities[racialAbil]);
        return { ability: ABILITY_NAME[racialAbil] || racialAbil, saveDC: 8 + pb + rmod, attackBonus: pb + rmod, prepared: false };
      }
      return { ability: null, saveDC: null, attackBonus: null, prepared: false };
    }

    var rows = casters.map(function (c) {
      var mod = abilityMod(abilities[c.ability]);
      return { ability: c.ability, dc: 8 + pb + mod, atk: pb + mod, prepared: !!c.prepared };
    });
    var first = rows[0];
    var sameStats = rows.every(function (r) { return r.ability === first.ability && r.dc === first.dc && r.atk === first.atk; });
    var allPrepared = rows.every(function (r) { return r.prepared; });
    var allKnown = rows.every(function (r) { return !r.prepared; });

    var meta = {
      ability: ABILITY_NAME[first.ability] || first.ability,
      saveDC: first.dc,
      attackBonus: first.atk
    };
    if (allPrepared) meta.prepared = true;
    else if (allKnown) meta.prepared = false;
    else meta.castType = 'Mixed';                 // renderer falls back to castType when prepared is unset
    if (!sameStats) meta._note = 'casters differ in ability/DC/attack; showing ' + meta.ability;
    return meta;
  }

  // ── spell groups (provenance bucketing of the picker's flat list) ───────────
  var LEVEL_ORDER = ['cantrip', 1, 2, 3, 4, 5, 6, 7, 8, 9];
  function bucketSpells(spells) {
    var byLevel = {};
    (spells || []).forEach(function (sp) {
      var k = sp.level == null ? 'cantrip' : sp.level;
      (byLevel[k] || (byLevel[k] = [])).push({
        name: sp.name, origin: sp.origin || 'class', source: sp.source, time: sp.time, ability: sp.ability || null,
        level: (k === 'cantrip' ? 0 : k)   // the cast handler reads this; without it leveled spells logged as cantrip
      });
    });
    var groups = [];
    LEVEL_ORDER.forEach(function (k) {
      if (!byLevel[k]) return;
      groups.push({ heading: k === 'cantrip' ? 'Cantrips \u00B7 At Will' : ordinal(k) + ' Level', level: (k === 'cantrip' ? 0 : k), spells: byLevel[k] });
    });
    return groups;
  }

  function featNote(groups) {
    var hasFeat = groups.some(function (g) { return g.spells.some(function (s) { return s.origin === 'feat'; }); });
    return hasFeat ? '' : '\u2014 no feat spells at this level';
  }

  // ── assemble ────────────────────────────────────────────────────────────────
  function deriveSpellcasting(input) {
    input = input || {};
    var classes = input.classes || [];
    // racial innate spellcasting carries its ability on the spell entries (origin:'race');
    // pull the first so castMeta can compute a DC even with no spellcasting class.
    var racialAbil = null;
    (input.spells || []).some(function (sp) { if (sp.origin === 'race' && sp.ability) { racialAbil = sp.ability; return true; } return false; });
    var meta = castMeta(classes, input.totalLevel, input.abilities || {}, racialAbil);
    var groups = bucketSpells(input.spells);
    var detail = input.detail || null;
    if (!detail) {
      (input.spells || []).some(function (sp) { if (sp.detail) { detail = sp.detail; return true; } return false; });
    }

    var sc = {
      ability: meta.ability,
      saveDC: meta.saveDC,
      attackBonus: meta.attackBonus,
      pools: mergeSlotPools(classes).concat(input.extraPools || []),
      featNote: featNote(groups),
      groups: groups,
      detail: detail
    };
    if ('prepared' in meta) sc.prepared = meta.prepared; else sc.castType = meta.castType;
    // Wizard's owned book — persists DISTINCT from the prepared/castable `groups`: the level-up
    // flow grows it (+2/level) and the transcribe-into-book flow appends to it. Purely additive —
    // absent for non-book casters, so the sheet reader is unaffected until it chooses to show it.
    if (input.spellbook && input.spellbook.length) {
      sc.spellbook = input.spellbook.map(function (s) {
        return { name: s.name, level: s.level, origin: s.origin || 'class', source: s.source };
      });
    }
    return sc;
  }

  function deriveClasses(input) {
    return (input.classes || []).map(function (c) {
      return { name: c.name, level: c.level, subclass: c.subclass || null };
    });
  }

  var API = {
    deriveSpellcasting, deriveClasses,
    // exposed for tests / P7:
    mergeSlotPools, castMeta, bucketSpells, pactMagic, casterContribution, profBonus, MULTICLASS_SLOTS
  };
  if (typeof window !== 'undefined') window.SoulShardsSpellcasting = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
