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
        tone: r.tone || "class", kind: "resource"
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
        tone: "class", kind: "resource" });
    }
    if (!seen.actionSurge && has(s.classLabel, "fighter") && (s.level || 0) >= 2) {
      var asCnt = (s.level || 0) >= 17 ? 2 : 1;
      res.actionSurge = Math.max(0, asCnt - (pip.actionSurge || 0));
      pools.push({ key: "actionSurge", rawKey: "actionSurge", level: 0,
        label: "Action Surge", badge: String(asCnt), max: asCnt, current: res.actionSurge,
        tone: "class", kind: "resource" });
    }
    // Hellish Rebuke (Tiefling racial, once per long rest)
    if (!seen.rebuke && has(s.race, "tiefling")) {
      res.rebuke = Math.max(0, 1 - (pip.rebuke || 0));
      pools.push({ key: "rebuke", rawKey: "rebuke", level: 0,
        label: "Infernal Legacy", badge: "1", max: 1, current: res.rebuke,
        tone: "race", kind: "resource" });
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

    (assembled || []).forEach(function (a) {
      if (!a || a._removed || a._hidden) return;
      var group = actionGroup(a.type);
      if (group !== "attack") return; // only attack-type rows into this tab

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

  // ── SPELLS tab ──────────────────────────────────────────────────────────
  /* Reads structural.spellcasting.groups. Cantrips first, grouped by level.
     Excludes spellbook-only entries (Wizard's book ≠ prepared). */
  function spellTiles(s) {
    var sc = s.spellcasting || {};
    var tiles = [];
    var dc = sc.saveDC || (8 + profBonus(s) + abilMod(s, guessCastAbil(s)));
    var atkBonus = sc.attackBonus || (profBonus(s) + abilMod(s, guessCastAbil(s)));

    (sc.groups || []).forEach(function (g) {
      var lvl = g.level != null ? (typeof g.level === "number" ? g.level : parseInt(g.level, 10) || 0) : 0;
      (g.spells || []).forEach(function (sp) {
        var isCantrip = lvl === 0;
        var isBonus   = isTimeCostBonus(sp.time);
        var isReaction = isTimeCostReaction(sp.time);
        // Reaction spells don't go on the shelf (they're in the react pipeline)
        if (isReaction) return;

        // Slot cost: cantrips are free; leveled spells cost a slot at their level
        var cost = null;
        if (!isCantrip) {
          var slotKey = "slot" + lvl;
          cost = {};
          cost[slotKey] = 1;
        }

        tiles.push({
          id:       "spell_" + slugify(sp.name),
          label:    sp.name || "Spell",
          kind:     "spell",
          tab:      "spells",
          level:    lvl,
          rng:      null,  // spells have variable range; pipeline reads the statblock
          hit:      atkBonus,
          dc:       dc,
          dmg:      null,  // too variable to derive generically; pipeline handles it
          bonus:    isBonus,
          free:     false,
          spell:    true,
          conc:     !!(sp.conc || sp.concentration),
          cost:     cost,
          origin:   sp.origin || "class",
          _src:     sp
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
     potion, scroll, oil. Count badges for stacked items. */
  var USABLE_TYPES = { potion: 1, scroll: 1, oil: 1, wand: 1, rod: 1 };
  function itemTiles(inventory) {
    var tiles = [], seen = {};
    (inventory || []).forEach(function (it) {
      if (!it || !it.name) return;
      var type = String(it.type || it.itemType || "").toLowerCase();
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
        passive: true  // read-only; detail drawer
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
        passive: true
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
  /* Five universal actions + any custom action-editor rows from structural.
     Grapple/Shove greyed per spec §2. */
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

  function actionTiles(s, assembled) {
    var tiles = [];

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
    // (assembled actions that are type 'utility' or 'damage' go here)
    (assembled || []).forEach(function (a) {
      if (!a || a._removed || a._hidden) return;
      var group = actionGroup(a.type);
      if (group === "utility" || group === "damage") {
        tiles.push({
          id: a.id || ("custom_" + tiles.length), label: a.label || "Custom",
          kind: group, tab: "actions", rng: a.rng || null,
          bonus: !!a.bonus, free: !!a.free, spell: !!a.spell, conc: !!a.conc,
          cost: a.cost || null, _src: a
        });
      }
    });

    return tiles;
  }

  // ── BONUS tab ───────────────────────────────────────────────────────────
  /* Filter, not source: gathers every bonus-costed tile from the other tabs. */
  function bonusTiles(tabs) {
    var out = [];
    ["attacks", "spells", "items", "actions"].forEach(function (tabKey) {
      (tabs[tabKey] || []).forEach(function (t) {
        if (t.bonus) out.push(t);
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
    "counterspell":     { key: "counterspell",   slotLevel: 3 }
  };

  function buildReactions(s) {
    var react = {};
    var sc = s.spellcasting || {};

    (sc.groups || []).forEach(function (g) {
      (g.spells || []).forEach(function (sp) {
        if (!isTimeCostReaction(sp.time)) return;
        var key = String(sp.name || "").toLowerCase();
        var def = REACTION_SPELLS[key];
        if (!def) return; // unknown reaction spell — skip for now
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
  /* Keyword → game-icons.net glyph name. The bar assigns icons from this map;
     the actual <img> URL is built by the renderer, not this module.
     CC-BY 3.0 Delapouite / Lorc / Skoll — attribution in the repo README. */
  var ICON_KEYWORDS = {
    // weapons
    longsword: "plain-dagger", shortsword: "stiletto", shortbow: "pocket-bow",
    longbow: "high-shot", scimitar: "scimitar", rapier: "piercing-sword",
    dagger: "bowie-knife", greataxe: "sharp-axe", greatsword: "pointy-sword",
    handaxe: "thrown-knife", javelin: "thrown-spear", mace: "flanged-mace",
    quarterstaff: "bo", warhammer: "thor-hammer", flail: "flail",
    crossbow: "crossbow", sling: "sling",
    // spells
    "eldritch blast": "beam-wake", "fire bolt": "fire-ray",
    "booming blade": "thunder-blade", "green-flame blade": "fire-blade",
    "vicious mockery": "angry-eyes", "healing word": "healing",
    "cure wounds": "medical-pack", hex: "cursed-star", shield: "shield",
    "silvery barbs": "psy-waves", "hellish rebuke": "fire-ring",
    "guiding bolt": "focusing-beam", "sacred flame": "fire-zone",
    "bardic inspiration": "musical-notes", thunderwave: "wave-strike",
    "magic missile": "missile-swarm",
    // class features
    "flurry of blows": "punch-blast", "hand of healing": "healing",
    "second wind": "health-increase", "action surge": "sprint",
    // universals
    dash: "sprint", disengage: "evasion", dodge: "dodging",
    help: "hand", ready: "hourglass"
  };

  /* Returns an icon name for a tile: keyword match → kind-generic → letter. */
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
    tabs.bonus   = bonusTiles(tabs);

    // 6. Flat actions list (backward compat: beginTurn/selectAction read u.actions)
    //    Attacks + non-feat tabs, minus greyed
    var flatActions = [];
    tabs.attacks.forEach(function (t) { flatActions.push(flatTile(t)); });
    tabs.spells.forEach(function (t) { flatActions.push(flatTile(t)); });
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
    var hp    = v.hp    != null ? v.hp    : ((s.combat || {}).maxHp || 10);
    var maxHp = v.maxHp != null ? v.maxHp : ((s.combat || {}).maxHp || 10);

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
    combatStats:   combatStats,
    buildResPools: buildResPools,
    buildReactions: buildReactions,
    attackTiles:   attackTiles,
    spellTiles:    spellTiles,
    itemTiles:     itemTiles,
    featTiles:     featTiles,
    actionTiles:   actionTiles,
    bonusTiles:    bonusTiles,
    forgeResKey:   forgeResKey,
    UNIVERSALS:    UNIVERSALS,
    GREYED:        GREYED,
    GENERIC_PC_KIT: GENERIC_PC_KIT,
    ICON_KEYWORDS: ICON_KEYWORDS
  };
});
