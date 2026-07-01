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

  // lowercase skill key -> canonical name (features cite skills as {@skill Insight})
  var SKILL_CANON = (function () { var m = {}; SKILL_LIST.forEach(function (s) { m[s.toLowerCase()] = s; }); return m; })();
  function titleCaseTool(s) {
    s = String(s == null ? '' : s).trim();
    return s.split(/\s+/).map(function (w) { return w.replace(/^./, function (c) { return c.toUpperCase(); }); }).join(' ');
  }
  // {@skill Insight} -> Insight ; {@item herbalism kit|PHB} -> herbalism kit
  function stripEntryTag(s) { return String(s).replace(/\{@\w+\s+([^}]*)\}/g, function (_, body) { return body.split('|')[0]; }).trim(); }

  // Proficiencies GRANTED BY FEATURES. 5etools' class-builder data leaves most of
  // these in prose (Way of Mercy's Implements of Mercy: "You gain proficiency in the
  // {@skill Insight} and {@skill Medicine} skills, and … {@item herbalism kit|PHB}"),
  // with no structured field — so a resolver that reads only startingProficiencies /
  // multiclassing silently drops them. Scan each granted feature sentence-by-sentence:
  // harvest the typed tokens ONLY from sentences that actually grant a proficiency, and
  // skip any that defer to player choice ("one skill of your choice") so a feature's
  // grant is never over-applied. Structured fields (if the data ever carries them) win
  // first; prose fills the rest.
  function featureGrantedProficiencies(builds) {
    var out = { skills: [], tools: [], languages: [], weapons: [], armor: [], expertise: [] };
    function addUniq(arr, v) { v = String(v == null ? '' : v).trim(); if (v && arr.indexOf(v) === -1) arr.push(v); }
    function addSkill(name) { var c = SKILL_CANON[String(name).trim().toLowerCase()]; if (c) addUniq(out.skills, c); }
    function scanString(s) {
      s.split('.').forEach(function (sent) {
        if (!/proficien/i.test(sent)) return;                                              // not a proficiency sentence
        if (!/\b(?:gain|gains|have|has|are|is|become|becomes|proficient)\b/i.test(sent)) return;
        if (/of your choice|choose|any (?:one|two|three|\d)\b/i.test(sent)) return;         // a choice — leave it to the Proficiencies step
        (sent.match(/\{@skill\s+[^}]*\}/gi) || []).forEach(function (m) { addSkill(stripEntryTag(m)); });
        (sent.match(/\{@item\s+[^}]*\}/gi) || []).forEach(function (m) { addUniq(out.tools, titleCaseTool(stripEntryTag(m))); });
        (sent.match(/\{@language\s+[^}]*\}/gi) || []).forEach(function (m) { addUniq(out.languages, stripEntryTag(m)); });
      });
    }
    function scan(entries) {
      if (!entries) return;
      if (typeof entries === 'string') { scanString(entries); return; }
      if (Array.isArray(entries)) { entries.forEach(scan); return; }
      if (typeof entries === 'object') {
        if (entries.type === 'table') return;                                              // table rows are data, not grants
        if (entries.entries) scan(entries.entries);
        if (entries.items) scan(entries.items);
      }
    }
    (builds || []).forEach(function (b) {
      (b.features || []).forEach(function (f) {
        (f.skillProficiencies || []).forEach(function (e) { if (e && typeof e === 'object') Object.keys(e).forEach(function (k) { if (e[k] === true) addSkill(k); }); });
        (f.toolProficiencies || []).forEach(function (e) { if (e && typeof e === 'object') Object.keys(e).forEach(function (k) { if (e[k] === true) addUniq(out.tools, titleCaseTool(stripEntryTag(k))); }); });
        (f.languageProficiencies || []).forEach(function (e) { if (e && typeof e === 'object') Object.keys(e).forEach(function (k) { if (e[k] === true) addUniq(out.languages, stripEntryTag(k)); }); });
        scan(f.entries);
      });
    });
    return out;
  }
  // union feature grants into the Proficiencies-step lists (deduped)
  function mergeFeatureGrants(prof, grants) {
    var merged = {};
    ['skills', 'expertise', 'languages', 'tools', 'weapons', 'armor'].forEach(function (t) {
      var base = (prof && prof[t]) ? prof[t].slice() : [];
      (grants[t] || []).forEach(function (n) { if (base.indexOf(n) === -1) base.push(n); });
      merged[t] = base;
    });
    return merged;
  }

  function deriveStructural(input, deps) {
    input = input || {}; deps = deps || {};
    var engine = deps.engine || (typeof window !== 'undefined' && window.SoulShardsEngine);
    var SC = deps.spellcasting || (typeof window !== 'undefined' && window.SoulShardsSpellcasting);
    if (!engine || !SC) throw new Error('deriveStructural: { engine, spellcasting } deps required');
    var AAC = deps.armorAC || (typeof window !== 'undefined' && window.ArmorAC) || null;   // optional — AC derives from input.inventory when both are present

    var abilities = input.abilities || {};
    var classes = input.classes || [];
    var incomplete = [];
    var mod = function (k) { return abilityMod(abilities[k]); };
    var ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    // ── per-class engine builds ──
    // firstClass: only the FIRST entry (the starting class — classes[] arrives
    // starting-first, the same convention the saves fold below relies on) holds the
    // character's 1st level, so only it gets the maxed-die level-1 HP. Every added
    // class computes its 1st level as average/rolled (correct 2014 multiclass HP).
    var builds = classes.map(function (c, i) {
      return engine.build({ classModel: c.model, level: c.level, abilities: abilities, subclassShortName: c.subclassShortName, hp: input.hp, firstClass: i === 0 });
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
    // HP — sum the engine's per-class max. The starting class's build maxes the 1st
    // level; every added class's build (firstClass:false) averages its 1st level, so
    // this sum is the correct 2014 multiclass total (only the very first character
    // level is maxed).
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
    // input.proficiencies is the Proficiencies-step set (class/race/background); fold in
    // anything the character's FEATURES grant (e.g. a Way of Mercy monk's Insight +
    // Medicine + herbalism kit) so a subclass/feature prof never goes missing on the sheet.
    var prof = mergeFeatureGrants(input.proficiencies || {}, featureGrantedProficiencies(builds));
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

    // ── AC from worn armour — same source the live sheet uses (ArmorAC.deriveAC).
    // When the Forge passes its assembled inventory, stamp combat.ac / acSource and
    // apply the heavy-armour speed penalty; otherwise it derives live on the sheet. ──
    var acFromArmor = (AAC && input.inventory && input.inventory.length)
      ? AAC.deriveAC(input.inventory, { abilities: abilOut, proficiencies: proficiencies, classLabel: classLabel, combat: combat })
      : null;
    if (acFromArmor) {
      combat.ac = acFromArmor.ac;
      combat.acSource = acFromArmor.source;
      if (combat.speed != null && acFromArmor.speedPenalty) combat.speed = combat.speed - acFromArmor.speedPenalty;
    }

    // ── honest gaps ──
    incomplete.push('feature descriptions (P4 \u2014 {@tag} entries markup not yet rendered)');
    if (!acFromArmor) incomplete.push('combat.ac derives live on the sheet from worn armour (no items passed to this derive)');
    incomplete.push('senses don\u2019t include feature/subclass upgrades (e.g. Shadow Magic darkvision)');
    incomplete.push('actions[] holds feature / cantrip attacks only \u2014 weapon attacks derive live on the sheet from carried weapons');
    // Racial spells now arrive via the picker's emit (origin:'race') and fold into groups[].
    // Only flag when the race actually grants spells the picker hasn't captured yet.
    var raceGrantsSpells = !!(race && race.additionalSpells &&
      (Array.isArray(race.additionalSpells) ? race.additionalSpells.length : true));
    var raceSpellsCaptured = (input.spells || []).some(function (s) { return s.origin === 'race'; });
    if (raceGrantsSpells && !raceSpellsCaptured)
      incomplete.push('racial spells (race.additionalSpells) \u2014 complete the Spells step to fold them in');
    incomplete.push('appearance + bio (physical description, backstory) not captured here');
    // The SLOT half of the legacy/party.html shape is now reconciled below (classFeatures
    // mirrors structural.spellcasting's pools into the pipState ledger). The legacy flat
    // structural.spells[] list stays intentionally absent — the display reads the richer,
    // provenance-stamped structural.spellcasting.groups instead.

    // ── classFeatures: the legacy spell-slot ledger the rest of the app keys off
    // (sheet cast/spend via buildSpellcasting, the combat orbs, and rests — all read
    // structural.classFeatures.{spellSlots,pactSlots} and the vitals.pipState
    // 'spell_<L>' / 'pactSlots' counters). The Forge writes the rich `spellcasting`
    // block for DISPLAY; this mirrors just its SLOT pools into the shape those
    // consumers already expect, so a forged caster can actually spend slots. ──
    var classFeatures = null;
    if (spellcasting && Array.isArray(spellcasting.pools)) {
      var cfSlots = {}, cfPact = null;
      spellcasting.pools.forEach(function (p) {
        if (!p || p.points) return;
        if (p.key === 'pactSlots') cfPact = { max: p.max || 0, level: p.level || 1 };
        else if (p.key && /^spell_\d+$/.test(p.key) && (p.max || 0) > 0) cfSlots[String(p.level)] = { max: p.max };
      });
      var cf = {};
      if (Object.keys(cfSlots).length) cf.spellSlots = cfSlots;
      if (cfPact) cf.pactSlots = cfPact;
      if (Object.keys(cf).length) classFeatures = cf;
    }

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
      spellcasting: spellcasting,
      classFeatures: classFeatures
    };

    return { structural: structural, _incomplete: incomplete };
  }

  var API = { deriveStructural };
  if (typeof window !== 'undefined') window.SoulShardsDerive = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
