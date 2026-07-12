/* ── forge-kit-derive.js ─────────────────────────────────────────────────
   Bite 2 · §6.1: the derivation module.

   Projects a `characters` row (structural + vitals + inventory) into a
   ForgeKit — the shape the bar, the tabs, and the pipeline consume.
   STARTER_KITS demotes to fallback; GENERIC_PC_KIT is the last resort.

   Pure & headless: no DOM, no three.js, no Supabase. Dual-export: browser
   (window.ForgeKitDerive) + node (module.exports).

   Usage:
     var kit = ForgeKitDerive.derive(charData, opts);
     //  charData = { key, name, structural, vitals, inventory, currency }
     //  opts     = { assembledActions: [...], starterKits: {...} }    [optional]

   The returned kit is backward-compatible with STARTER_KITS' shape, so the
   existing beginTurn/canUse/resolveStrike/reactReady pipeline works unchanged.
   It extends it with `tabs` (the six category groups) and `pools` (display
   resources for the bar UI).                                                  */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeKitDerive = api;
})(typeof self !== "undefined" ? self : this, function () {

  // ── helpers ──────────────────────────────────────────────────────────────
  function abilMod(structural, ab) {
    var a = ((structural.abilities || {})[ab]) || {};
    return a.mod != null ? a.mod : 0;
  }
  function profBonus(structural) {
    if (structural.proficiencyBonus != null) return structural.proficiencyBonus;
    return 2 + Math.floor((Math.max(1, structural.level || 1) - 1) / 4);
  }
  function has(s, frag) { return (s || "").toLowerCase().indexOf(frag) !== -1; }
  function titleCase(s) { return String(s || "").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  /* Pool-key normaliser: map live data keys (spell_1, pactSlots) to the forge's
     flat resource keys (slot1, pact) that STARTER_KITS already established. */
  function forgeResKey(key) {
    if (!key) return key;
    var m = /^spell_(\d+)$/.exec(key);
    if (m) return "slot" + m[1];
    if (key === "pactSlots") return "pact";
    if (key === "sorcery") return "sorcery";
    return key; // ki, bardicInspiration, etc. pass through
  }

  // ── combat stats ────────────────────────────────────────────────────────
  function combatStats(s) {
    var cmb = s.combat || {};
    return {
      ac:    cmb.ac   != null ? cmb.ac   : 10,
      speed: cmb.speed != null ? cmb.speed : 30,
      init:  cmb.initiative != null ? cmb.initiative : 0,
      fly:   !!cmb.fly,
      climb: !!cmb.climb
    };
  }

  // ── resource map & display pools ────────────────────────────────────────
  /* Builds both the flat `res` map (for canUse cost checks) and the display
     `pools` array (for the bar's slot/resource pips). Sources: spellcasting
     pools + ResourceDerive-style class resources. Vitals.pipState carries the
     spent count; current = max - spent. */
  function buildResPools(s, v) {
    var pip = (v && v.pipState) || {};
    var res = {}, pools = [];

    // Spell-slot pools from structural.spellcasting
    var sc = s.spellcasting || {};
    (sc.pools || []).forEach(function (p) {
      var key = p.key || ("spell_" + (p.level || 0));
      var fk  = forgeResKey(key);
      var max = p.max || 0;
      var cur = Math.max(0, max - (pip[key] || 0));
      res[fk] = cur;
      pools.push({
        key: fk, rawKey: key, level: p.level || 0, label: p.label || ("Lvl " + (p.level || "?")),
        badge: p.badge || ("Lvl " + (p.level || "?")), max: max, current: cur,
        tone: p.tone || "class", kind: "slot"
      });
    });

    // Class resources: if ResourceDerive produced structural.resources, use it;
    // otherwise fall through (bare structural may not carry .resources at all).
    // Full passthrough (§1 of the icons/resources spec): recharge, die, tag,
    // origin, source, custom all ride through — the Resources tab consumes them.
    var resources = s.resources || [];
    resources.forEach(function (r) {
      if (!r || !r.id) return;
      var fk  = forgeResKey(r.id);
      var max = r.max || 0;
      var cur = Math.max(0, max - (pip[r.id] || 0));
      if (res[fk] == null) res[fk] = cur; // slots may have already been set above
      pools.push({
        key: fk, rawKey: r.id, level: 0, label: r.label || r.id,
        badge: r.die || String(max), max: max, current: cur,
        tone: r.tone || "class", kind: "resource",
        // ── passthrough fields (resource-derive emits all of these) ──
        recharge: r.recharge || null,
        die:      r.die      || null,
        tag:      r.tag      || null,
        origin:   r.origin   || null,
        source:   r.source   || null,
        custom:   !!r.custom
      });
    });

    // Fighter extras: Second Wind + Action Surge (keyed in STARTER_KITS as
    // secondWind / actionSurge; carried in structural.classFeatures or custom
    // resources). Detect from the class label if not already in resources.
    var seen = {};
    resources.forEach(function (r) { if (r && r.id) seen[r.id] = 1; });
    if (!seen.secondWind && has(s.classLabel, "fighter")) {
      res.secondWind = Math.max(0, 1 - (pip.secondWind || 0));
      pools.push({ key: "secondWind", rawKey: "secondWind", level: 0,
        label: "Second Wind", badge: "1", max: 1, current: res.secondWind,
        tone: "class", kind: "resource",
        recharge: "short rest", die: null, tag: null, origin: "class", source: "class", custom: false });
    }
    if (!seen.actionSurge && has(s.classLabel, "fighter") && (s.level || 0) >= 2) {
      var asCnt = (s.level || 0) >= 17 ? 2 : 1;
      res.actionSurge = Math.max(0, asCnt - (pip.actionSurge || 0));
      pools.push({ key: "actionSurge", rawKey: "actionSurge", level: 0,
        label: "Action Surge", badge: String(asCnt), max: asCnt, current: res.actionSurge,
        tone: "class", kind: "resource",
        recharge: "short rest", die: null, tag: null, origin: "class", source: "class", custom: false });
    }
    // Hellish Rebuke (Tiefling racial, once per long rest)
    if (!seen.rebuke && has(s.race, "tiefling")) {
      res.rebuke = Math.max(0, 1 - (pip.rebuke || 0));
      pools.push({ key: "rebuke", rawKey: "rebuke", level: 0,
        label: "Infernal Legacy", badge: "1", max: 1, current: res.rebuke,
        tone: "race", kind: "resource",
        recharge: "long rest", die: null, tag: null, origin: "race", source: "race", custom: false });
    }

    return { res: res, pools: pools };
  }

  // ── ATTACKS tab ─────────────────────────────────────────────────────────
  /* When the caller passes opts.assembledActions (the browser calling
     weapon-actions.js's assembleActions), those become the Attacks tab — the
     full derived weapon + cantrip + custom attack list.
     Without it, we read structural.actions / customActions directly (test
     fixtures / generic fallback). */
  function attackTiles(s, assembled) {
    var tiles = [];
    var pb = profBonus(s);
    var sc = s.spellcasting || {};

    (assembled || []).forEach(function (a) {
      if (!a || a._removed || a._hidden) return;
      var group = actionGroup(a.type);
      if (group !== "attack") return; // only attack-type rows into this tab

      // ── Spell attack rows from buildSpellAttacks (weapon-actions.js) ──
      // attack-cantrip: hitMod is the complete spell attack bonus (ability+prof)
      //   — must NOT be recomputed from the weapon ability path.
      // damage-only (round-3 Fact 2): NOT a save bucket — it's the action
      //   editor's "roll dice, no attack roll" type, and live sheets file
      //   Healing Word / Cure Wounds / Hand of Healing / Hex (damage) /
      //   Absorb Elements under it. The SPELL_COMBAT label lookup decides
      //   the kind; the row type only decides which numeric fields to trust
      //   (hitMod direct on attack-cantrip, dmgMod/dmgDice on both).
      //   No projection and no saveAbility → greyed, never a wrong-kind
      //   live wire. Projection to buff/buffAlly on a damage bucket means
      //   the row is a RIDER of its parent effect → greyed v1.
      if (a.type === "attack-cantrip" || a.type === "damage-only") {
        var spDmgMod = a.dmgMod || 0;
        var spDmgExpr = (a.dmgDice || "1d4");
        if (spDmgMod > 0) spDmgExpr += "+" + spDmgMod;
        else if (spDmgMod < 0) spDmgExpr += String(spDmgMod);

        var spDc   = sc.saveDC || ((s.combat || {}).spellSaveDC) || null;

        // Label → SPELL_COMBAT projection ("Hex (damage)" keeps its
        // parenthetical for the rider check; the base lookup strips it)
        var rawName = (a.label || "").toLowerCase().replace(/\u2019/g, "'").trim();
        var spName  = rawName.replace(/\s*\(.*\)$/, "");
        var proj    = SPELL_COMBAT[rawName] || SPELL_COMBAT[spName];
        var projKind = proj ? proj.kind : undefined;

        var spKind, spGreyed = false, spGreyReason = null;
        if (a.type === "attack-cantrip") {
          spKind = "attack";               // the sheet's real attack roll — always trusted
        } else if (rawName !== spName && rawName.indexOf("(damage)") !== -1) {
          spKind = "spell"; spGreyed = true;
          spGreyReason = "Rolls from its parent effect \u2014 the drawer explains";
        } else if (projKind === "heal" || projKind === "save" || projKind === "selfheal") {
          spKind = projKind;               // the projection decides
        } else if (projKind === "buff" || projKind === "buffAlly") {
          spKind = "spell"; spGreyed = true;   // damage rider of a buff spell
          spGreyReason = "Rolls from its parent effect \u2014 the drawer explains";
        } else if (a.saveAbility) {
          spKind = "save";                 // buildSpellAttacks-derived save row
        } else {
          spKind = "spell"; spGreyed = true;
          spGreyReason = (proj && proj.greyReason)
            || "Not yet wired for Forge combat \u2014 rules text in the drawer";
        }

        var spRng  = (proj && proj.rng) ? proj.rng : (a.type === "attack-cantrip" ? 24 : 12);
        var spRider = (proj && proj.rider) || null;

        tiles.push({
          id:          a.id || ("atk_" + tiles.length),
          label:       a.label || "Spell",
          kind:        spKind,
          tab:         "attacks",
          rng:         spRng,
          long:        null,
          hit:         a.type === "attack-cantrip" ? (a.hitMod || 0) : 0,
          dc:          spKind === "save" ? spDc : null,
          saveAbility: spKind === "save" ? (a.saveAbility || (proj && proj.save) || null) : null,
          dmg:         spDmgExpr,
          dmgStack:    [{ dice: a.dmgDice || "1d4", bonus: spDmgMod, type: a.dmgType || "" }],
          bonus:       !!a.bonus,
          free:        !!a.free,
          spell:       true,
          conc:        !!a.conc,
          cost:        a.cost || null,
          rider:       spRider,
          critDice:    a.critDice || null,
          strikes:     null,
          needsAttack: false,
          greyed:      spGreyed,
          greyReason:  spGreyReason,
          _src:        a
        });
        return;
      }

      // ── Normal weapon attack rows ──
      var abil = a.ability || "str";
      var mod = abilMod(s, abil);
      var hitTotal = mod + (a.proficient !== false ? pb : 0) + (a.atkBonus || 0);

      // Damage expression: dmgDice + ability mod + bonus
      var dmgMod  = (a.dmgAbility !== false ? mod : 0) + (a.dmgBonus || 0);
      var dmgExpr = (a.dmgDice || "1d4") + (dmgMod >= 0 ? "+" + dmgMod : String(dmgMod));

      // Multi-component damage stack (the attack editor's typed components)
      var stack = [{ dice: a.dmgDice || "1d4", bonus: dmgMod, type: a.dmgType || "" }];
      if (Array.isArray(a.extraDamage)) {
        a.extraDamage.forEach(function (x) {
          stack.push({ dice: x.dice || "0", bonus: x.bonus || 0, type: x.type || "" });
        });
      }

      // Range: ranged weapons carry range as "80/320" string; parse it.
      // The forge pipeline uses range in SQUARES (÷5). Melee = 1 (or reach = 2).
      var rng = 1, long = null;
      if (a.range) {
        var rm = String(a.range).match(/(\d+)(?:\/(\d+))?/);
        if (rm) { rng = Math.ceil(+rm[1] / 5); if (rm[2]) long = Math.ceil(+rm[2] / 5); }
      } else if (a.rng != null) {
        rng = a.rng; long = a.long || null;
      }

      tiles.push({
        id:       a.id || ("atk_" + tiles.length),
        label:    a.label || "Attack",
        kind:     a.kind || "attack",
        tab:      "attacks",
        rng:      rng,
        long:     long,
        hit:      hitTotal,
        dmg:      dmgExpr,
        dmgStack: stack,
        bonus:    !!a.bonus,
        free:     !!a.free,
        spell:    !!a.spell,
        conc:     !!a.conc,
        cost:     a.cost || null,
        rider:    a.rider || null,
        strikes:  a.strikes || null,
        needsAttack: !!a.needsAttack,
        _src:     a
      });
    });

    return tiles;
  }

  function actionGroup(type) {
    if (!type) return "attack";
    if (type === "damage" || type === "utility") return type;
    return "attack";
  }

  // ── SPELL_COMBAT — pipeline-kind projection for the Spells tab ─────────
  // Maps lowercase spell name → { kind, rng (squares), save, baseDmg, scale,
  //   healMod, addMod, rider }. Coverage: the four PCs' current lists first,
  //   then the common 5e set. DC/atkBonus derive from structural.spellcasting.
  //
  //   kind:  "attack"|"save"|"heal"|"buff"|"buffAlly"|"selfheal"  → resolvable
  //          null  → utility, greyed with explanation
  //
  //   Unmapped spells also grey ("Not yet wired for Forge combat").
  //   attackTiles also references this table for range/save on spell-attack rows.
  var SPELL_COMBAT = {
    // ── attack cantrips (scale by character level) ──
    "eldritch blast":     { kind: "attack", rng: 24, baseDmg: "1d10", scale: "cantrip" },
    "fire bolt":          { kind: "attack", rng: 24, baseDmg: "1d10", scale: "cantrip" },
    "ray of frost":       { kind: "attack", rng: 12, baseDmg: "1d8",  scale: "cantrip" },
    "shocking grasp":     { kind: "attack", rng: 1,  baseDmg: "1d8",  scale: "cantrip" },
    "chill touch":        { kind: "attack", rng: 24, baseDmg: "1d8",  scale: "cantrip" },
    "thorn whip":         { kind: "attack", rng: 6,  baseDmg: "1d6",  scale: "cantrip" },
    "produce flame":      { kind: "attack", rng: 6,  baseDmg: "1d8",  scale: "cantrip" },
    "magic stone":        { kind: "attack", rng: 12, baseDmg: "1d6",  scale: "cantrip", addMod: true },

    // ── save cantrips ──
    "vicious mockery":    { kind: "save", save: "wis", rng: 12, baseDmg: "1d4", scale: "cantrip", rider: "vm" },
    "sacred flame":       { kind: "save", save: "dex", rng: 12, baseDmg: "1d8", scale: "cantrip" },
    "toll the dead":      { kind: "save", save: "wis", rng: 12, baseDmg: "1d8", scale: "cantrip" },
    "acid splash":        { kind: "save", save: "dex", rng: 12, baseDmg: "1d6", scale: "cantrip" },
    "poison spray":       { kind: "save", save: "con", rng: 2,  baseDmg: "1d12", scale: "cantrip" },
    "word of radiance":   { kind: "save", save: "con", rng: 1,  baseDmg: "1d6",  scale: "cantrip" },
    "frostbite":          { kind: "save", save: "con", rng: 12, baseDmg: "1d6",  scale: "cantrip" },
    "mind sliver":        { kind: "save", save: "int", rng: 12, baseDmg: "1d6",  scale: "cantrip" },
    "thunderclap":        { kind: "save", save: "con", rng: 1,  baseDmg: "1d6",  scale: "cantrip" },
    "sword burst":        { kind: "save", save: "dex", rng: 1,  baseDmg: "1d6",  scale: "cantrip" },

    // ── heal ──
    "healing word":       { kind: "heal", rng: 12, baseDmg: "1d4", healMod: true },
    "cure wounds":        { kind: "heal", rng: 1,  baseDmg: "1d8", healMod: true },
    "spare the dying":    { kind: "heal", rng: 1 },
    "mass healing word":  { kind: "heal", rng: 12, baseDmg: "1d4", healMod: true },
    "mass cure wounds":   { kind: "heal", rng: 12, baseDmg: "3d8", healMod: true },
    "heal":               { kind: "heal", rng: 12, baseDmg: "70" },
    "prayer of healing":  { kind: "heal", rng: 6,  baseDmg: "2d8", healMod: true },
    // Way of Mercy — sheet-row aliases (not spells; the label lookup in
    // attackTiles resolves them so the ki heal is a real heal tile)
    "hand of healing":    { kind: "heal", rng: 1 },
    "hands of healing":   { kind: "heal", rng: 1 },

    // ── buff (single-target enemy debuff) ──
    "hex":                { kind: "buff", rng: 18 },
    "hunter's mark":      { kind: "buff", rng: 18 },

    // ── ally buff ──
    "bless":              { kind: "buffAlly", rng: 6 },
    "guidance":           { kind: "buffAlly", rng: 1 },
    "sanctuary":          { kind: "buffAlly", rng: 6 },
    "aid":                { kind: "buffAlly", rng: 6 },
    "shield of faith":    { kind: "buffAlly", rng: 12 },
    "heroism":            { kind: "buffAlly", rng: 1 },
    "protection from evil and good": { kind: "buffAlly", rng: 1 },
    "haste":              { kind: "buffAlly", rng: 6 },
    "warding bond":       { kind: "buffAlly", rng: 1 },

    // ── self buff / temp HP ──
    "armor of agathys":   { kind: "selfheal", baseDmg: "5" },
    "false life":         { kind: "selfheal", baseDmg: "1d4+4" },
    "mirror image":       { kind: "selfheal" },
    "mage armor":         { kind: "selfheal" },
    "shield":             { kind: "selfheal" },  // reaction — but if it reaches the tab, self-cast

    // ── save (leveled damage) ──
    "shatter":            { kind: "save", save: "con", rng: 12, baseDmg: "3d8" },
    "heat metal":         { kind: "save", save: "con", rng: 12, baseDmg: "2d8" },
    "thunderwave":        { kind: "save", save: "con", rng: 3,  baseDmg: "2d8" },
    "burning hands":      { kind: "save", save: "dex", rng: 3,  baseDmg: "3d6" },
    "hellish rebuke":     { kind: "save", save: "dex", rng: 12, baseDmg: "2d10" },
    "fireball":           { kind: "save", save: "dex", rng: 30, baseDmg: "8d6" },
    "lightning bolt":     { kind: "save", save: "dex", rng: 20, baseDmg: "8d6" },
    "spirit guardians":   { kind: "save", save: "wis", rng: 3,  baseDmg: "3d8" },
    "moonbeam":           { kind: "save", save: "con", rng: 24, baseDmg: "2d10" },
    "call lightning":     { kind: "save", save: "dex", rng: 24, baseDmg: "3d10" },

    // ── attack (leveled) ──
    "guiding bolt":       { kind: "attack", rng: 24, baseDmg: "4d6" },
    "inflict wounds":     { kind: "attack", rng: 1,  baseDmg: "3d10" },
    "chromatic orb":      { kind: "attack", rng: 18, baseDmg: "3d8" },
    "scorching ray":      { kind: "attack", rng: 24, baseDmg: "2d6" },
    "spiritual weapon":   { kind: "attack", rng: 12, baseDmg: "1d8", addMod: true },
    "magic missile":      { kind: "attack", rng: 24, baseDmg: "3d4+3" },

    // ── weapon cantrips → grey (use from Attacks tab) ──
    "booming blade":      { kind: null, greyReason: "Weapon cantrip \u2014 use from the Attacks tab" },
    "green-flame blade":  { kind: null, greyReason: "Weapon cantrip \u2014 use from the Attacks tab" },

    // ── utility / non-combat → grey ──
    "find familiar":      { kind: null },
    "mending":            { kind: null },
    "minor illusion":     { kind: null },
    "mage hand":          { kind: null },
    "prestidigitation":   { kind: null },
    "thaumaturgy":        { kind: null },
    "detect magic":       { kind: null },
    "charm person":       { kind: null },
    "feather fall":       { kind: null },
    "disguise self":      { kind: null },
    "comprehend languages": { kind: null },
    "identify":           { kind: null },
    "unseen servant":     { kind: null },
    "silent image":       { kind: null },
    "speak with animals": { kind: null },
    "misty step":         { kind: null },
    "invisibility":       { kind: null },
    "darkness":           { kind: null },
    "darkvision":         { kind: null },
    "knock":              { kind: null },
    "suggestion":         { kind: null },
    "counterspell":       { kind: null },
    "dispel magic":       { kind: null },
    "fly":                { kind: null },
    "absorb elements":    { kind: null },
    "silvery barbs":      { kind: null }
  };

  // Cantrip scaling helpers (mirrors weapon-actions.js — derive is a separate IIFE)
  function _cantripMult(level) { return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1; }
  function _scaleDice(s, mult) { var m = String(s).match(/(\d+)d(\d+)/); return m ? (parseInt(m[1],10)*mult)+'d'+m[2] : s; }

  // ── the live-shape normalizer (round-3 Fact 1) ──────────────────────────
  /* structural.spellcasting is None on every live character — spells live
     under structural.spells, level-keyed with INCONSISTENT keys per sheet:
     '1'/'2'/'cantrip' (Líadan, Cosmere, Vesperian) vs 'level2'/'cantrips'
     (Caim). spellGroupsFrom prefers spellcasting.groups when present (the
     forged/new shape) and otherwise builds groups from structural.spells:
       key normalization  'cantrip'|'cantrips' → 0, 'N'|'levelN' → N
       per-row            castingTime → time, concentration|conc → conc,
                          range/duration/desc carried on the row (→ _src). */
  function normSpellLevelKey(k) {
    if (/^cantrips?$/i.test(k)) return 0;
    var m = String(k).match(/^(?:level)?(\d)$/i);
    return m ? +m[1] : null;
  }
  function spellGroupsFrom(s) {
    var sc = (s && s.spellcasting) || {};
    if (sc.groups && sc.groups.length) return sc.groups;
    var legacy = s && s.spells;
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return [];
    var groups = [];
    Object.keys(legacy).forEach(function (k) {
      if (!Array.isArray(legacy[k])) return;
      var lvl = normSpellLevelKey(k);
      if (lvl == null) return;
      groups.push({ level: lvl, spells: legacy[k].map(function (sp) {
        if (!sp) return { name: "" };
        if (typeof sp === "string") return { name: sp };
        return {
          name: sp.name || "",
          time: sp.castingTime || sp.time || null,
          conc: !!(sp.concentration || sp.conc),
          range: sp.range || null,
          duration: sp.duration || null,
          desc: sp.desc || null,
          source: sp.source || null,
          origin: sp.origin || null
        };
      }) });
    });
    groups.sort(function (a, b) { return a.level - b.level; });
    return groups;
  }

  // ── SPELLS tab ──────────────────────────────────────────────────────────
  /* Reads spellGroupsFrom(structural) → pipeline-ready tiles via SPELL_COMBAT.
     Cantrips first, grouped by level. Excludes spellbook-only entries.
     Unmapped or utility spells render greyed with an explanation in the drawer.
     DC / attack bonus chain (round-3): spellcasting.saveDC → the sheet's
     combat.spellSaveDC (live shape) → the guessCastAbil computation. Same
     for the attack bonus; the cast mod backs out of the stored attack bonus
     when present (attackBonus − PB), matching buildSpellAttacks' spellMod. */
  function spellTiles(s) {
    var sc = s.spellcasting || {};
    var cmb = s.combat || {};
    var tiles = [];
    var dc = sc.saveDC || cmb.spellSaveDC || (8 + profBonus(s) + abilMod(s, guessCastAbil(s)));
    var atkBonus = sc.attackBonus || cmb.spellAttackBonus || (profBonus(s) + abilMod(s, guessCastAbil(s)));
    var castMod = (sc.attackBonus || cmb.spellAttackBonus) != null && (sc.attackBonus || cmb.spellAttackBonus) !== 0
      ? (sc.attackBonus || cmb.spellAttackBonus) - profBonus(s)
      : abilMod(s, guessCastAbil(s));
    var clvl = s.level || 0;

    spellGroupsFrom(s).forEach(function (g) {
      var lvl = g.level != null ? (typeof g.level === "number" ? g.level : parseInt(g.level, 10) || 0) : 0;
      (g.spells || []).forEach(function (sp) {
        var isCantrip = lvl === 0;
        var isBonus   = isTimeCostBonus(sp.time);
        var isReaction = isTimeCostReaction(sp.time)
          || (!sp.time && !!REACTION_SPELLS[String(sp.name || "").toLowerCase()]);
        // Reaction spells don't go on the shelf (they're in the react pipeline)
        if (isReaction) return;

        // Slot cost: cantrips are free; leveled spells cost a slot at their level
        var cost = null;
        if (!isCantrip) {
          var slotKey = "slot" + lvl;
          cost = {};
          cost[slotKey] = 1;
        }

        // ── SPELL_COMBAT projection ──
        var spKey = (sp.name || "").toLowerCase().replace(/\u2019/g, "'");
        var proj  = SPELL_COMBAT[spKey];

        var kind, rng, dmg, saveAbility, rider, greyed, greyReason;

        if (!proj || proj.kind === null || proj.kind === undefined) {
          // Unknown or utility spell → greyed
          kind        = "spell";
          greyed      = true;
          greyReason  = (proj && proj.greyReason) || "Not yet wired for Forge combat \u2014 rules text in the drawer";
          rng         = null;
          dmg         = null;
          saveAbility = null;
          rider       = null;
        } else {
          // Resolvable combat spell
          kind        = proj.kind;
          rng         = proj.rng || 1;
          saveAbility = proj.save || null;
          rider       = proj.rider || null;
          greyed      = false;
          greyReason  = null;

          // Compute damage / healing expression
          if (proj.baseDmg) {
            var rawDmg = proj.baseDmg;
            if (proj.scale === "cantrip") rawDmg = _scaleDice(rawDmg, _cantripMult(clvl));
            var bonus = 0;
            if (proj.healMod || proj.addMod) bonus += castMod;
            if (bonus > 0) dmg = rawDmg + "+" + bonus;
            else if (bonus < 0) dmg = rawDmg + String(bonus);
            else dmg = rawDmg;
          } else {
            dmg = null;
          }
        }

        tiles.push({
          id:          "spell_" + slugify(sp.name),
          label:       sp.name || "Spell",
          kind:        kind,
          tab:         "spells",
          level:       lvl,
          rng:         rng,
          hit:         kind === "attack" ? atkBonus : 0,
          dc:          dc,
          dmg:         dmg,
          saveAbility: saveAbility,
          bonus:       isBonus,
          free:        false,
          spell:       true,
          conc:        !!(sp.conc || sp.concentration),
          cost:        cost,
          origin:      sp.origin || "class",
          rider:       rider,
          greyed:      greyed || false,
          greyReason:  greyReason || null,
          _src:        sp
        });
      });
    });

    return tiles;
  }

  function guessCastAbil(s) {
    var sc = s.spellcasting || {};
    if (sc.ability) {
      var aMap = { Charisma: "cha", Wisdom: "wis", Intelligence: "int",
                   cha: "cha", wis: "wis", int: "int" };
      return aMap[sc.ability] || "cha";
    }
    // Heuristic from class label
    if (has(s.classLabel, "warlock") || has(s.classLabel, "sorcerer") ||
        has(s.classLabel, "bard") || has(s.classLabel, "paladin")) return "cha";
    if (has(s.classLabel, "wizard") || has(s.classLabel, "artificer")) return "int";
    if (has(s.classLabel, "cleric") || has(s.classLabel, "druid") ||
        has(s.classLabel, "ranger")) return "wis";
    return "cha";
  }

  function isTimeCostBonus(time) {
    if (!time) return false;
    var t = typeof time === "string" ? time : (Array.isArray(time) && time[0] && time[0].unit) ? time[0].unit : "";
    return (/bonus/i).test(t);
  }
  function isTimeCostReaction(time) {
    if (!time) return false;
    var t = typeof time === "string" ? time : (Array.isArray(time) && time[0] && time[0].unit) ? time[0].unit : "";
    return (/reaction/i).test(t);
  }

  function slugify(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40); }

  // ── ITEMS tab ───────────────────────────────────────────────────────────
  /* Usable subset of the gear-manager inventory. Type whitelist from spec:
     potion, scroll, oil. Count badges for stacked items.
     Round-3 §G: live inventories carry 5etools type CODES (M/R/G/LA/P/SC…),
     not words — map the usable codes so the first looted potion (type "P")
     actually surfaces. Today's empty tab is correct: nobody carries one. */
  var USABLE_TYPES = { potion: 1, scroll: 1, oil: 1, wand: 1, rod: 1 };
  var USABLE_TYPE_CODES = { p: "potion", sc: "scroll", wd: "wand", rd: "rod" };
  function itemTiles(inventory) {
    var tiles = [], seen = {};
    (inventory || []).forEach(function (it) {
      if (!it || !it.name) return;
      var type = String(it.type || it.itemType || "").toLowerCase().replace(/\|.*$/, "");
      if (USABLE_TYPE_CODES[type]) type = USABLE_TYPE_CODES[type];
      // Use the type field, or detect from the name
      if (!USABLE_TYPES[type]) {
        if (/^potion\b/i.test(it.name)) type = "potion";
        else if (/^scroll\b/i.test(it.name)) type = "scroll";
        else if (/^oil\b/i.test(it.name)) type = "oil";
        else return;
      }
      var skey = slugify(it.name);
      if (seen[skey]) { seen[skey].count++; return; }
      var tile = {
        id:    "item_" + skey,
        label: it.name,
        kind:  type === "potion" ? "potion" : "item",
        tab:   "items",
        rng:   1,
        count: 1,
        bonus: false,
        free:  false,
        spell: false,
        conc:  false,
        cost:  null,
        _src:  it
      };
      seen[skey] = tile;
      tiles.push(tile);
    });
    return tiles;
  }

  // ── FEATS tab ───────────────────────────────────────────────────────────
  /* Read-only tiles from structural.features + customFeatures. */
  function featTiles(s) {
    var tiles = [];
    (s.features || []).forEach(function (f) {
      if (!f || !f.name) return;
      tiles.push({
        id:     "feat_" + slugify(f.name),
        label:  f.name,
        desc:   f.desc || "",
        tab:    "feats",
        origin: parseOrigin(f.source),
        kind:   "feature",
        passive: true,  // read-only; detail drawer
        _src:   f       // drawer can reach f.entries (5etools array) when present
      });
    });
    (s.customFeatures || []).forEach(function (f) {
      if (!f || !f.name) return;
      tiles.push({
        id:     "feat_custom_" + slugify(f.name),
        label:  f.name,
        desc:   f.desc || "",
        tab:    "feats",
        origin: "custom",
        kind:   "feature",
        passive: true,
        _src:   f
      });
    });
    return tiles;
  }

  function parseOrigin(source) {
    if (!source) return "class";
    var s = String(source).toLowerCase();
    if (s.indexOf("race") !== -1) return "race";
    if (s.indexOf("feat") !== -1) return "feat";
    if (s.indexOf("subclass") !== -1) return "subclass";
    return "class";
  }

  // ── ACTIONS tab ─────────────────────────────────────────────────────────
  /* Five universal actions + class feature actions + custom action-editor rows.
     Grapple/Shove greyed per spec §2.
     Class feature actions: features that ARE usable actions (Second Wind,
     Action Surge, Flurry of Blows, etc.) — detected from structural.features
     and/or structural.resources and projected as tiles. */
  var UNIVERSALS = [
    { id: "act_dash",       label: "Dash",       kind: "dash",       desc: "Double your movement for this turn." },
    { id: "act_disengage",  label: "Disengage",  kind: "disengage",  desc: "Your movement doesn't provoke opportunity attacks this turn." },
    { id: "act_dodge",      label: "Dodge",      kind: "dodge",      desc: "Attacks against you have disadvantage; you have advantage on Dex saves." },
    { id: "act_help",       label: "Help",       kind: "help",       desc: "Grant an ally advantage on their next attack roll or ability check." },
    { id: "act_ready",      label: "Ready",      kind: "ready",      desc: "Hold your action for a trigger you specify." }
  ];
  var GREYED = [
    { id: "act_grapple", label: "Grapple", kind: "grapple", desc: "Contested Athletics check — not yet available.", greyed: true, greyReason: "Contested checks are a later bite." },
    { id: "act_shove",   label: "Shove",   kind: "shove",   desc: "Contested Athletics check — not yet available.", greyed: true, greyReason: "Contested checks are a later bite." }
  ];

  /* Known class features that are usable actions.
     key: lowercase name match, tab: where the tile lives,
     bonus/free: action economy, cost: resource key + count,
     kind: pipeline kind for the event. */
  var CLASS_FEATURE_ACTIONS = [
    { match: "second wind",       id: "cf_second_wind",    label: "Second Wind",       kind: "selfheal",   tab: "actions", bonus: true,  free: false, cost: { secondWind: 1 },    desc: "Regain 1d10+level HP as a bonus action." },
    { match: "action surge",      id: "cf_action_surge",   label: "Action Surge",      kind: "surge",      tab: "actions", bonus: false, free: true,  cost: { actionSurge: 1 },   desc: "Take one additional action this turn." },
    { match: "flurry of blows",   id: "cf_flurry",         label: "Flurry of Blows",   kind: "attack",     tab: "actions", bonus: true,  free: false, cost: { ki: 1 },            desc: "After Attack action: 2 unarmed strikes as a bonus action." },
    { match: "patient defense",   id: "cf_patient_defense",label: "Patient Defense",   kind: "dodge",      tab: "actions", bonus: true,  free: false, cost: { ki: 1 },            desc: "Dodge as a bonus action." },
    { match: "step of the wind",  id: "cf_step_wind",      label: "Step of the Wind",  kind: "dash",       tab: "actions", bonus: true,  free: false, cost: { ki: 1 },            desc: "Dash or Disengage as a bonus action." },
    { match: "hands of healing",  id: "cf_hands_heal",     label: "Hands of Healing",  kind: "heal",       tab: "actions", bonus: false, free: false, cost: { ki: 1 },            desc: "Heal 1d4+WIS as an action (1 ki)." },
    { match: "hexblade",          id: "cf_hex_curse",      label: "Hexblade\u2019s Curse", kind: "buff",   tab: "actions", bonus: true,  free: false, cost: null,                 desc: "Bonus action: bonus to hit, crit on 19–20 vs one target." }
  ];

  function classFeatureTiles(s) {
    var tiles = [];
    var feats = (s.features || []).concat(s.customFeatures || []);
    var featNames = feats.map(function (f) { return (f && f.name) ? f.name.toLowerCase() : ""; });

    CLASS_FEATURE_ACTIONS.forEach(function (cfa) {
      // Check if the character has this feature
      var found = featNames.some(function (n) { return n.indexOf(cfa.match) !== -1; });
      if (!found) return;
      tiles.push({
        id: cfa.id, label: cfa.label, kind: cfa.kind, tab: cfa.tab,
        desc: cfa.desc, rng: null,
        bonus: !!cfa.bonus, free: !!cfa.free, spell: false, conc: false,
        cost: cfa.cost, classFeature: true
      });
    });
    return tiles;
  }

  function actionTiles(s, assembled) {
    var tiles = [];

    // Class feature actions (Second Wind, Action Surge, Flurry, etc.)
    var cfTiles = classFeatureTiles(s);
    cfTiles.forEach(function (t) { tiles.push(t); });

    // Universal actions
    UNIVERSALS.forEach(function (u) {
      tiles.push({
        id: u.id, label: u.label, kind: u.kind, tab: "actions",
        desc: u.desc, universal: true, rng: null,
        bonus: false, free: false, spell: false, conc: false, cost: null
      });
    });

    // Greyed-out actions
    GREYED.forEach(function (g) {
      tiles.push({
        id: g.id, label: g.label, kind: g.kind, tab: "actions",
        desc: g.desc, universal: true, greyed: true, greyReason: g.greyReason,
        rng: null, bonus: false, free: false, spell: false, conc: false, cost: null
      });
    });

    // Non-weapon custom actions from the sheet's action editor
    // (assembled actions that are type 'utility' or 'damage' go here).
    // Round-3 Fact 2: 'utility'/'damage' are not pipeline-resolvable kinds —
    // these rows are drawer notes, greyed so they never flow into
    // flatActions as wrong-kind live wires. A derived twin (spell tile /
    // classFeature tile) wins the dedupe and folds the note into itself.
    (assembled || []).forEach(function (a) {
      if (!a || a._removed || a._hidden) return;
      var group = actionGroup(a.type);
      if (group === "utility" || group === "damage") {
        tiles.push({
          id: a.id || ("custom_" + tiles.length), label: a.label || "Custom",
          kind: group, tab: "actions", rng: a.rng || null,
          bonus: !!a.bonus, free: !!a.free, spell: !!a.spell, conc: !!a.conc,
          cost: a.cost || null,
          greyed: true,
          greyReason: "Rules text in the drawer \u2014 not yet a Forge-resolvable action",
          _src: a
        });
      }
    });

    return tiles;
  }

  // ── BONUS tab ───────────────────────────────────────────────────────────
  /* Filter, not source: gathers every tile that doesn't eat your action.
     M's ruling (2026-07-12): bonus + free — "everything that doesn't eat
     your action." Action Surge (RAW free) joins Second Wind (bonus) etc. */
  function bonusTiles(tabs) {
    var out = [];
    ["attacks", "spells", "items", "actions"].forEach(function (tabKey) {
      (tabs[tabKey] || []).forEach(function (t) {
        if (t.bonus || t.free) out.push(t);
      });
    });
    return out;
  }

  // ── REACTIONS ───────────────────────────────────────────────────────────
  /* Detect reaction spells from structural.spellcasting.groups and build the
     react map the pipeline's reactReady/payReact already consume. */
  var REACTION_SPELLS = {
    "shield":           { key: "shield",        slotLevel: 1 },
    "silvery barbs":    { key: "silveryBarbs",   slotLevel: 1, range: 12 },
    "absorb elements":  { key: "absorbElements", slotLevel: 1 },
    "hellish rebuke":   { key: "hellishRebuke",  slotLevel: 1 },
    "counterspell":     { key: "counterspell",   slotLevel: 3 }
  };

  function buildReactions(s) {
    var react = {};

    spellGroupsFrom(s).forEach(function (g) {
      (g.spells || []).forEach(function (sp) {
        var key = String(sp.name || "").toLowerCase();
        var def = REACTION_SPELLS[key];
        if (!def) return; // unknown reaction spell — skip for now
        // Reaction by time; a time-less live row (Caim's shape) counts by name
        if (sp.time && !isTimeCostReaction(sp.time)) return;
        var slotKey = "slot" + def.slotLevel;
        var entry = { cost: {} };
        entry.cost[slotKey] = 1;
        if (def.range) entry.range = def.range;
        react[def.key] = entry;
      });
    });

    // Hellish Rebuke via racial (Tiefling): not a spell slot cost — uses the
    // once/long-rest racial resource. Check structural.features or race.
    if (has(s.race, "tiefling")) {
      // Derive DC from Constitution (Infernal Legacy variant) or Charisma
      var hrDc = 8 + profBonus(s) + abilMod(s, has(s.race, "feral") ? "con" : "cha");
      react.hellishRebuke = { cost: { rebuke: 1 }, dc: hrDc, dmg: "2d10", saveAbility: "dex" };
    }

    return Object.keys(react).length ? react : null;
  }

  // ── ICON MAP ────────────────────────────────────────────────────────────
  /* Keyword → registry glyph name (SpellIcons or ItemIcons). Demoted to a
     seeding layer by resolveIcon — fires when no inline icon or override
     exists. Weapon keywords reference ItemIcons names; spell/feature/
     universal keywords reference SpellIcons names.
     CC-BY 3.0 Delapouite / Lorc / Skoll — attribution in the repo README. */
  var ICON_KEYWORDS = {
    // weapons (→ ItemIcons glyph names)
    longsword: "plain-dagger", shortsword: "plain-dagger", shortbow: "bow-arrow",
    longbow: "high-shot", rapier: "piercing-sword",
    dagger: "bowie-knife", greataxe: "sharp-axe", greatsword: "pointy-sword",
    handaxe: "thrown-knife", javelin: "thrown-spear", mace: "flanged-mace",
    quarterstaff: "wizard-staff", warhammer: "thor-hammer", crossbow: "crossbow",
    // spells (→ SpellIcons glyph names)
    "eldritch blast": "eldritch-beam", "fire bolt": "fire-bolt",
    "booming blade": "thunder-blade", "green-flame blade": "fire-blade",
    "vicious mockery": "vicious-mockery", "healing word": "healing",
    "cure wounds": "cure-wounds", hex: "hex-spell", shield: "shield-ward",
    "silvery barbs": "silvery-barbs", "hellish rebuke": "infernal-fire",
    "guiding bolt": "guiding-bolt", "sacred flame": "sacred-flame",
    "bardic inspiration": "musical-notes", thunderwave: "wave-strike",
    "magic missile": "missile-swarm", "armor of agathys": "armor-frost",
    "heat metal": "heat-metal", shatter: "shatter-spell",
    "find familiar": "find-familiar", mending: "mending-spell",
    bless: "bless-cross",
    // class features (→ SpellIcons glyph names)
    "flurry of blows": "flurry-fists", "hand of healing": "hands-of-mercy",
    "hands of healing": "hands-of-mercy",
    "second wind": "health-increase", "action surge": "action-surge",
    "patient defense": "patient-shield", "step of the wind": "step-wind",
    "hexblade": "hex-curse",
    // universals (→ SpellIcons glyph names)
    dash: "sprint", disengage: "evasion", dodge: "dodging",
    help: "hand", ready: "hourglass"
  };

  /* Returns an icon name for a tile: keyword match → kind-generic → null.
     Legacy API — resolveIcon is the full-chain resolver. */
  function iconFor(tile) {
    if (!tile) return null;
    var name = String(tile.label || "").toLowerCase();
    // exact match first
    if (ICON_KEYWORDS[name]) return ICON_KEYWORDS[name];
    // partial match
    for (var kw in ICON_KEYWORDS) {
      if (ICON_KEYWORDS.hasOwnProperty(kw) && name.indexOf(kw) !== -1)
        return ICON_KEYWORDS[kw];
    }
    // kind-generic fallback
    if (tile.kind === "attack" || tile.tab === "attacks") return "crossed-swords";
    if (tile.spell || tile.tab === "spells") return "sparkles";
    if (tile.tab === "items") return "potion-ball";
    if (tile.kind === "feature" || tile.tab === "feats") return "scroll-unfurled";
    if (tile.tab === "actions") return "hand";
    return null; // caller falls through to initial-letter tile
  }

  // ── RESOLVER (design doc §3) ─────────────────────────────────────────
  /* Full icon resolution chain. Returns a glyph name from SpellIcons or
     ItemIcons — or null when no registry has a match (→ letter tile).
     Exported so forge-hud.js and any future surface share one path.
       1. tile._src.icon           (inline — items & custom actions)
       2. structural.iconOverrides[tile.id]
       3. ICON_KEYWORDS seed       (name match → registry glyph name)
       4. category default         (SpellIcons.iconFor / ItemIcons.iconFor)
       5. null → letter tile       (never blank — Chonkalius rule)          */
  function resolveIcon(tile, structural) {
    if (!tile) return null;

    // 1. Inline icon from the source row (gear-manager custom icons)
    if (tile._src && tile._src.icon) {
      if (_inRegistry(tile._src.icon)) return tile._src.icon;
    }

    // 2. Player override (structural.iconOverrides keyed by tile id)
    var overrides = structural && structural.iconOverrides;
    if (overrides && tile.id && overrides[tile.id]) {
      if (_inRegistry(overrides[tile.id])) return overrides[tile.id];
    }

    // 3. ICON_KEYWORDS seed (name match → registry glyph name)
    var kwResult = iconFor(tile);
    if (kwResult && _inRegistry(kwResult)) return kwResult;

    // 4. Category default via registry iconFor (browser only)
    var _SI = typeof SpellIcons !== "undefined" ? SpellIcons : null;
    var _II = typeof ItemIcons  !== "undefined" ? ItemIcons  : null;
    if (tile.spell || tile.tab === "spells" || tile.tab === "actions" || tile.classFeature || tile.universal) {
      if (_SI) { var si = _SI.iconFor(tile); if (si && _SI.BODIES[si]) return si; }
    }
    if (tile.tab === "attacks" || tile.tab === "items") {
      if (_II) { var ii = _II.iconFor(tile._src || tile); if (ii && _II.BODIES[ii]) return ii; }
    }
    // Cross-check the other registry
    if (_SI && kwResult && _SI.BODIES[kwResult]) return kwResult;
    if (_II && kwResult && _II.BODIES[kwResult]) return kwResult;

    // 5. null → letter tile
    return kwResult || null;
  }

  /* Check if a glyph name exists in either registry (browser only). */
  function _inRegistry(name) {
    if (!name) return false;
    var _SI = typeof SpellIcons !== "undefined" ? SpellIcons : null;
    var _II = typeof ItemIcons  !== "undefined" ? ItemIcons  : null;
    if (_SI && _SI.BODIES && _SI.BODIES[name]) return true;
    if (_II && _II.BODIES && _II.BODIES[name]) return true;
    // In headless (no registries loaded), accept any name — the keyword map
    // is the only source and its values are known-good at build time.
    if (!_SI && !_II) return true;
    return false;
  }

  // ── the fallback kits (inlined from the mock) ──────────────────────────
  var GENERIC_PC_KIT = {
    ac: 10, speed: 30, init: 0,
    react: null, res: {},
    actions: [{ label: "Improvised Strike", kind: "attack", rng: 1, hit: 2, dmg: "1d4+1" }]
  };

  // ── DERIVE ──────────────────────────────────────────────────────────────
  function derive(charData, opts) {
    opts = opts || {};

    // ── no-sheet fallback ──
    if (!charData || !charData.structural) {
      var sk = opts.starterKits || {};
      var key = charData && charData.key;
      if (key && sk[key]) {
        return wrapStarterKit(key, sk[key]);
      }
      return wrapGenericKit(charData);
    }

    var s = charData.structural || {};
    var v = charData.vitals     || {};
    var inv = charData.inventory || [];

    // 1. Combat stats
    var stats = combatStats(s);

    // 2. Resource pools + flat res map
    var rp = buildResPools(s, v);

    // 3. Reactions
    var react = buildReactions(s);

    // 4. Assembled actions (attacks + cantrips + custom), caller provides or empty
    var assembled = opts.assembledActions || (s.actions || []).concat(s.customActions || []);

    // 5. Tabs
    var tabs = {};
    tabs.attacks = attackTiles(s, assembled);
    tabs.spells  = spellTiles(s);
    tabs.items   = itemTiles(inv);
    tabs.feats   = featTiles(s);
    tabs.actions = actionTiles(s, assembled);

    // 5b. Dedupe (round-3 §C): the same action arrives twice — inventory-
    // assembled + sheet action row (Sling, Dagger, Longsword), classFeature +
    // sheet row (Second Wind). Normalized-label dedupe; the derived tile wins
    // (it has the derived math); the sheet row folds into the winner's
    // _folded so nothing the sheet wrote is lost. A greyed tile never beats a
    // resolvable one. If the winner has no damage expression and the folded
    // sheet row carries dice, the winner adopts them (Second Wind's 1d10+3).
    dedupeTabs(tabs);
    tabs.bonus = bonusTiles(tabs);

    // 6. Flat actions list (backward compat: beginTurn/selectAction read u.actions)
    //    Attacks + spells + class-feature/custom actions — greyed tiles never
    //    flow (round-3 invariant: every flat action's kind is resolvable OR
    //    the tile is greyed; a greyed tile is drawer-only, not a live wire).
    var flatActions = [];
    tabs.attacks.forEach(function (t) { if (!t.greyed) flatActions.push(flatTile(t)); });
    tabs.spells.forEach(function (t) { if (!t.greyed) flatActions.push(flatTile(t)); });
    tabs.actions.forEach(function (t) {
      if (!t.greyed && !t.universal) flatActions.push(flatTile(t));
    });

    // 7. Spellcasting stats for the bar
    var scInfo = {
      saveDC:       (s.spellcasting || {}).saveDC || null,
      attackBonus:  (s.spellcasting || {}).attackBonus || null,
      ability:      (s.spellcasting || {}).ability || null
    };

    // 8. HP from vitals (the live value) or structural
    var hp    = v.hp    != null ? v.hp    : ((s.combat || {}).maxHp || (s.combat || {}).hpMax || 10);
    var maxHp = v.maxHp != null ? v.maxHp : ((s.combat || {}).maxHp || (s.combat || {}).hpMax || 10);

    return {
      key:          charData.key || null,
      name:         charData.name || s.name || charData.key || "Unknown",
      hp:           hp,
      maxHp:        maxHp,
      ac:           stats.ac,
      speed:        stats.speed,
      init:         stats.init,
      fly:          stats.fly,
      climb:        stats.climb,
      res:          rp.res,
      react:        react,
      actions:      flatActions,
      tabs:         tabs,
      pools:        rp.pools,
      spellcasting: scInfo,
      derived:      true   // flag: this kit came from the derivation layer, not STARTER_KITS
    };
  }

  /* ── round-3 §C: normalized-label dedupe across attacks/spells/actions ──
     Provenance rank: classFeature 4 · derived spell tile 3 · assembled
     weapon/cantrip/spell row (wpn-/cant-/sp- ids) 2 · sheet action row 1.
     Resolvable (non-greyed) always outranks greyed. Universals and greyed
     placeholder actions (Grapple/Shove) never join the contest. */
  function _dedupeKey(label) {
    return String(label || "").toLowerCase().replace(/\u2019/g, "'").replace(/\s+/g, " ").trim();
  }
  function _provRank(t) {
    if (t.classFeature) return 4;
    if (t.tab === "spells") return 3;
    if (/^(wpn-|cant-|sp-)/.test(String(t.id || ""))) return 2;
    return 1;
  }
  function _dedupeScore(t) { return (t.greyed ? 0 : 10) + _provRank(t); }
  function dedupeTabs(tabs) {
    var best = {};
    ["attacks", "spells", "actions"].forEach(function (tabKey) {
      (tabs[tabKey] || []).forEach(function (t) {
        if (t.universal) return;
        var k = _dedupeKey(t.label);
        if (!k) return;
        if (!best[k] || _dedupeScore(t) > _dedupeScore(best[k])) best[k] = t;
      });
    });
    ["attacks", "spells", "actions"].forEach(function (tabKey) {
      tabs[tabKey] = (tabs[tabKey] || []).filter(function (t) {
        if (t.universal) return true;
        var k = _dedupeKey(t.label);
        var w = k && best[k];
        if (!w || w === t) return true;
        // fold the loser into the winner
        w._folded = w._folded || [];
        w._folded.push(t._src || t);
        // adopt missing damage dice from a folded sheet row (Second Wind)
        if (!w.dmg && t._src && t._src.dmgDice) {
          var fm = t._src.dmgMod || 0;
          w.dmg = t._src.dmgDice + (fm > 0 ? "+" + fm : (fm < 0 ? String(fm) : ""));
        }
        return false;
      });
    });
  }

  /* Flatten a tab tile to the minimal shape the pipeline's canUse/selectAction
     already consume. The full tile stays in tabs; this is the shim. */
  function flatTile(t) {
    return {
      label:  t.label,
      kind:   t.kind,
      rng:    t.rng != null ? t.rng : 1,
      long:   t.long || null,
      hit:    t.hit || 0,
      dmg:    t.dmg || null,
      dmgStack: t.dmgStack || null,
      bonus:  !!t.bonus,
      free:   !!t.free,
      spell:  !!t.spell,
      conc:   !!t.conc,
      cost:   t.cost || null,
      rider:  t.rider || null,
      strikes: t.strikes || null,
      needsAttack: !!t.needsAttack,
      dc:     t.dc || null,
      saveAbility: t.saveAbility || null,
      _tileId: t.id
    };
  }

  /* Wrap a STARTER_KITS entry into the full ForgeKit shape. The kit keeps its
     hand-tuned actions array; tabs mirror it under attacks. */
  function wrapStarterKit(key, sk) {
    var tabs = { attacks: [], spells: [], items: [], feats: [], actions: [], bonus: [] };
    (sk.actions || []).forEach(function (a, i) {
      var tab = a.bonus ? "bonus" : "attacks";
      var tile = {
        id: "sk_" + i, label: a.label, kind: a.kind || "attack", tab: tab,
        rng: a.rng || 1, long: a.long || null, hit: a.hit || 0,
        dmg: a.dmg || null, bonus: !!a.bonus, free: !!a.free,
        spell: !!a.spell, conc: !!a.conc, cost: a.cost || null,
        rider: a.rider || null, strikes: a.strikes || null,
        needsAttack: !!a.needsAttack
      };
      tabs[tab].push(tile);
      if (tab === "bonus") tabs.attacks.push(tile); // bonus tiles also in attacks
    });
    // Add universals
    tabs.actions = actionTiles({}, []);
    tabs.bonus = bonusTiles(tabs);
    return {
      key: key, name: sk.name || key,
      hp: sk.hp || 10, maxHp: sk.hp || 10,
      ac: sk.ac || 10, speed: sk.speed || 30, init: sk.init || 0,
      fly: !!sk.fly, climb: !!sk.climb,
      res: sk.res || {}, react: sk.react || null,
      actions: sk.actions || [],
      tabs: tabs, pools: [],
      spellcasting: null,
      derived: false, fallback: "starter"
    };
  }

  function wrapGenericKit(charData) {
    var name = (charData && charData.name) || (charData && charData.key) || "Unknown";
    var tabs = {
      attacks: [{ id: "gen_0", label: "Improvised Strike", kind: "attack", tab: "attacks",
                  rng: 1, hit: 2, dmg: "1d4+1", bonus: false, free: false, spell: false,
                  conc: false, cost: null }],
      spells: [], items: [], feats: [],
      actions: actionTiles({}, []),
      bonus: []
    };
    return {
      key: (charData && charData.key) || null, name: name,
      hp: 10, maxHp: 10, ac: 10, speed: 30, init: 0,
      fly: false, climb: false,
      res: {}, react: null,
      actions: GENERIC_PC_KIT.actions.slice(),
      tabs: tabs, pools: [],
      spellcasting: null,
      derived: false, fallback: "generic"
    };
  }

  // ── public API ──────────────────────────────────────────────────────────
  return {
    derive:        derive,
    iconFor:       iconFor,
    resolveIcon:   resolveIcon,
    combatStats:   combatStats,
    buildResPools: buildResPools,
    buildReactions: buildReactions,
    attackTiles:   attackTiles,
    spellTiles:    spellTiles,
    spellGroupsFrom: spellGroupsFrom,
    itemTiles:     itemTiles,
    featTiles:     featTiles,
    actionTiles:   actionTiles,
    classFeatureTiles: classFeatureTiles,
    bonusTiles:    bonusTiles,
    wrapStarterKit: wrapStarterKit,
    forgeResKey:   forgeResKey,
    UNIVERSALS:    UNIVERSALS,
    GREYED:        GREYED,
    SPELL_COMBAT:  SPELL_COMBAT,
    GENERIC_PC_KIT: GENERIC_PC_KIT,
    ICON_KEYWORDS: ICON_KEYWORDS
  };
});
