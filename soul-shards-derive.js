/* soul-shards-derive.js — assemble `structural` from the engine + the multiclass merge.
 *
 * P7's DERIVE (preview half): runs SoulShardsEngine.build() once per class, folds
 * spellcasting through SoulShardsSpellcasting (the multiclass merge), folds race traits
 * from a SoulShardsData.loadRace() model, and assembles the `structural` block the sheet
 * reads — with an honest `_incomplete[]` for everything still un-derivable. NOTHING is
 * written; CharacterData.save(key,{structural}) is the last, separate P7 step.
 *
 * Pure-ish: engine + spellcasting deps injected (2nd arg) or read off window. Attaches to
 * window.SoulShardsDerive / module.exports.
 *
 * INPUT (what the builder hands over):
 *   {
 *     name, alignment, portrait, xp?,
 *     abilities: { str..cha },                              // FINAL scores (post-racial)
 *     classes: [ { model, level, subclassShortName } ],     // model = SoulShardsData.loadClass()
 *     race?: <loadRace() model>, subraceName?,              // full model -> speed/senses/traits fold in
 *     background?: { name },                                 // grants are P5
 *     spells?: [ {name,level,origin,source,time,detail?} ],  // P6a picker output; empty -> flagged
 *     spellbook?: [ {name,level,origin,source} ],            // Wizard's owned book (persists distinct from groups)
 *     choices?: [ {name, origin:'class'|'subclass', originName, entries?} ], // Choices-step picks (Fighting Style / Maneuvers / Invocations / …)
 *     feats?: [ {name, entries?} ],                          // Feats-step picks (racial grant + ASI-level) — folded under a feat: stamp
 *     proficiencies?: { skills:[…], expertise?:[…], languages:[…], tools:[…], weapons:[…], armor:[…] }, // resolved NAME lists from the Proficiencies step
 *     extraPools?: [...], detail?: {...}, hp?: { method, rolls }
 *   }
 * RETURNS: { structural, _incomplete:[strings] }
 */
(function () {
  'use strict';

  function abilityMod(score) { return Math.floor(((score || 10) - 10) / 2); }
  function joinEntries(e) {
    if (typeof e === 'string') return e;
    if (Array.isArray(e)) return e.filter(function (x) { return typeof x === 'string'; }).join(' ');
    return '';
  }

  // 18 skills → governing ability (2014). Canonical names; the Proficiencies step
  // normalizes 5etools' lowercase keys to these before handing names over.
  var SKILL_ABIL = {
    'Acrobatics': 'dex', 'Animal Handling': 'wis', 'Arcana': 'int', 'Athletics': 'str',
    'Deception': 'cha', 'History': 'int', 'Insight': 'wis', 'Intimidation': 'cha',
    'Investigation': 'int', 'Medicine': 'wis', 'Nature': 'int', 'Perception': 'wis',
    'Performance': 'cha', 'Persuasion': 'cha', 'Religion': 'int', 'Sleight of Hand': 'dex',
    'Stealth': 'dex', 'Survival': 'wis'
  };
  var SKILL_LIST = Object.keys(SKILL_ABIL);

  function deriveStructural(input, deps) {
    input = input || {}; deps = deps || {};
    var engine = deps.engine || (typeof window !== 'undefined' && window.SoulShardsEngine);
    var SC = deps.spellcasting || (typeof window !== 'undefined' && window.SoulShardsSpellcasting);
    if (!engine || !SC) throw new Error('deriveStructural: { engine, spellcasting } deps required');

    var abilities = input.abilities || {};
    var classes = input.classes || [];
    var incomplete = [];
    var mod = function (k) { return abilityMod(abilities[k]); };
    var ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    // ── per-class engine builds ──
    var builds = classes.map(function (c) {
      return engine.build({ classModel: c.model, level: c.level, abilities: abilities, subclassShortName: c.subclassShortName, hp: input.hp });
    });
    var totalLevel = classes.reduce(function (n, c) { return n + (c.level || 0); }, 0);
    var pb = 2 + Math.floor((Math.max(1, totalLevel) - 1) / 4);

    var classLabel = builds.map(function (b) { return b.className + ' ' + b.level; }).join(' / ');
    var subclassLabel = builds.map(function (b) { return b.subclass; }).filter(Boolean).join(' / ');

    // ── spellcasting via the multiclass merge ──
    // A spellcasting CLASS makes this a caster; so does a race that grants innate spells
    // (Yuan-Ti, Tiefling, …) on an otherwise non-casting character — those still need a
    // spellcasting block with their racial ability / DC.
    var anyCaster = builds.some(function (b) { return b.spellcasting; }) ||
      (input.spells || []).some(function (s) { return s.origin === 'race'; });
    var mergeInput = {
      totalLevel: totalLevel, abilities: abilities,
      classes: builds.map(function (b) {
        var sc = b.spellcasting || {};
        return { name: b.className, level: b.level, subclass: b.subclass, progression: sc.progression || null, ability: sc.ability || null, prepared: !!sc.prepared };
      }),
      spells: input.spells || [], spellbook: input.spellbook || [], extraPools: input.extraPools || [], detail: input.detail || null
    };
    var spellcasting = anyCaster ? SC.deriveSpellcasting(mergeInput) : null;
    var classesArr = SC.deriveClasses(mergeInput);
    if (anyCaster && !(input.spells && input.spells.length))
      incomplete.push('spells (cantrip / known / prepared selections) \u2014 pending the P6a spell picker');

    // ── abilities {score, mod} ──
    var abilOut = {};
    ABIL.forEach(function (k) { abilOut[k] = { score: abilities[k] != null ? abilities[k] : null, mod: mod(k) }; });

    // ── saves — 2014 multiclass: saving-throw proficiencies come from the FIRST class only ──
    var firstSaves = (builds[0] && builds[0].savingThrows) || [];
    var saveOut = {};
    ABIL.forEach(function (k) { var prof = firstSaves.indexOf(k) !== -1; saveOut[k] = { bonus: mod(k) + (prof ? pb : 0), proficient: prof }; });

    // ── hit dice — grouped by die size: "2d8 + 1d6" ──
    var byDie = {};
    builds.forEach(function (b) { if (b.hd) byDie[b.hd] = (byDie[b.hd] || 0) + b.level; });
    var hitDice = Object.keys(byDie).sort(function (a, b) { return b - a; }).map(function (d) { return byDie[d] + 'd' + d; }).join(' + ');

    // ── features — class + subclass carry the engine's origin stamp ('class:Name'/'subclass:Name') ──
    var features = [];
    builds.forEach(function (b) {
      (b.features || []).forEach(function (f) {
        features.push({ name: f.name, source: f.origin, desc: joinEntries(f.entries) });
      });
    });

    // ── chosen optional features (Fighting Style / Maneuvers / Invocations / …) ──
    // The Choices step hands these over already resolved with their origin; stamp
    // them so the sheet's four-colour provenance lights them (class=gold, sub=teal).
    (input.choices || []).forEach(function (ch) {
      var stamp = (ch.origin === 'subclass' ? 'subclass:' : 'class:') + (ch.originName || '');
      features.push({ name: ch.name, source: stamp, desc: joinEntries(ch.entries) });
    });

    // ── chosen feats (racial level-1 grant + ASI-level picks) — purple provenance.
    // Half-feat ability bumps are applied to scores upstream (effectiveAbilities), so
    // here a feat is just another feature to fold under a feat: stamp. ──
    (input.feats || []).forEach(function (ft) {
      features.push({ name: ft.name, source: 'feat:Feat', desc: joinEntries(ft.entries) });
    });

    // ── combat scalars + race/subrace traits (P3 — resolved from races.json by loadRace) ──
    var combat = { initiative: mod('dex'), hitDice: hitDice };
    // HP — sum the engine's per-class max (level-1 max HD + CON, then average/rolled
    // per level). Single-class is exact; multiclass over-counts secondary classes'
    // first level, since the level-1 max only truly applies to the FIRST character level.
    var hpMax = builds.reduce(function (n, b) { return n + ((b.hp && b.hp.max) || 0); }, 0);
    if (hpMax > 0) { combat.hp = hpMax; combat.hpMax = hpMax; }
    var race = input.race || null;
    var raceName = race ? race.name : null;
    if (race && (race.speed || race.darkvision != null || race.traits)) {
      var sub = (race.subraces || []).filter(function (s) {
        return input.subraceName && (s.name === input.subraceName || s.label === input.subraceName);
      })[0] || null;
      var walk = (sub && sub.speed && sub.speed.walk != null) ? sub.speed.walk
               : (race.speed && race.speed.walk != null ? race.speed.walk : null);
      if (walk != null) combat.speed = walk;
      var dv = (sub && sub.darkvision != null) ? sub.darkvision : (race.darkvision != null ? race.darkvision : null);
      if (dv != null) combat.senses = { darkvision: dv };
      (race.traits || []).forEach(function (t) { features.push({ name: t.name, source: 'race:' + raceName, desc: joinEntries(t.entries) }); });
      if (sub) (sub.traits || []).forEach(function (t) { features.push({ name: t.name, source: 'race:' + raceName, desc: joinEntries(t.entries) }); });
    } else if (race) {
      incomplete.push('race traits (speed / senses / traits) \u2014 pass the loadRace model, not just { name }');
    }

    if (spellcasting && spellcasting.saveDC != null) combat.spellSaveDC = spellcasting.saveDC;
    if (spellcasting && spellcasting.attackBonus != null) combat.spellAttackBonus = spellcasting.attackBonus;

    // ── skills + proficiencies + passives (from the Proficiencies step) ──
    // input.proficiencies carries resolved NAME lists (granted ∪ chosen) per type.
    // Skills resolve to the 18-row sheet shape; passive Perception / Insight derive
    // off those rows. With no proficiency input every skill is at its bare ability
    // mod (a degenerate but valid build) — the real forge always passes this in.
    var prof = input.proficiencies || {};
    var profSkills = prof.skills || [];
    var profExpert = prof.expertise || [];
    var inList = function (list, name) { return (list || []).indexOf(name) !== -1; };
    var skills = SKILL_LIST.map(function (name) {
      var attr = SKILL_ABIL[name];
      var p = inList(profSkills, name);
      var ex = inList(profExpert, name);
      return { name: name, attr: attr, prof: p, expertise: ex, bonus: mod(attr) + (p ? pb : 0) + (ex ? pb : 0) };
    });
    var skillBonus = function (name) {
      var r = skills.filter(function (s) { return s.name === name; })[0];
      return r ? r.bonus : mod(SKILL_ABIL[name] || 'wis');
    };
    var passivePerception = 10 + skillBonus('Perception');
    var passiveInsight = 10 + skillBonus('Insight');
    var proficiencies = {
      skills: profSkills.slice(),
      expertise: profExpert.slice(),
      languages: (prof.languages || []).slice(),
      tools: (prof.tools || []).slice(),
      weapons: (prof.weapons || []).slice(),
      armor: (prof.armor || []).slice()
    };

    // ── honest gaps ──
    incomplete.push('feature descriptions (P4 \u2014 {@tag} entries markup not yet rendered)');
    incomplete.push('combat.ac (needs equipped armor \u2014 equipment not modeled in this derive)');
    if (classes.length > 1) incomplete.push('multiclass HP slightly over-counts secondary classes\u2019 first level (level-1 max applies only to the first character level)');
    incomplete.push('senses don\u2019t include feature/subclass upgrades (e.g. Shadow Magic darkvision)');
    incomplete.push('actions[] (weapon / cantrip attacks \u2014 need equipment)');
    // Racial spells now arrive via the picker's emit (origin:'race') and fold into groups[].
    // Only flag when the race actually grants spells the picker hasn't captured yet.
    var raceGrantsSpells = !!(race && race.additionalSpells &&
      (Array.isArray(race.additionalSpells) ? race.additionalSpells.length : true));
    var raceSpellsCaptured = (input.spells || []).some(function (s) { return s.origin === 'race'; });
    if (raceGrantsSpells && !raceSpellsCaptured)
      incomplete.push('racial spells (race.additionalSpells) \u2014 complete the Spells step to fold them in');
    incomplete.push('appearance + bio (physical description, backstory) not captured here');
    incomplete.push('legacy structural.spells / classFeatures (party.html shape) \u2014 reconcile vs structural.spellcasting');

    var structural = {
      name: input.name || null,
      classLabel: classLabel,
      subclass: subclassLabel || null,
      classes: classesArr,
      level: totalLevel,
      race: raceName,
      background: input.background ? input.background.name : null,
      alignment: input.alignment || null,
      xp: input.xp != null ? input.xp : 0,
      portrait: input.portrait || null,
      proficiencyBonus: pb,
      abilities: abilOut,
      combat: combat,
      saves: saveOut,
      skills: skills,
      proficiencies: proficiencies,
      passivePerception: passivePerception,
      passiveInsight: passiveInsight,
      features: features,
      spellcasting: spellcasting
    };

    return { structural: structural, _incomplete: incomplete };
  }

  var API = { deriveStructural };
  if (typeof window !== 'undefined') window.SoulShardsDerive = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
