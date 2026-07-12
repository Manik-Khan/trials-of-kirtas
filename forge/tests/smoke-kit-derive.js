/* smoke-kit-derive.js — Known-answer smokes for forge-kit-derive.js
   (§5 of the BG3 HUD spec: derivation on all four PCs' live-shaped
   structural → expected tabs/tiles/costs, multiclass slots for Líadan,
   no-sheet fallback, icon map, and RS merge.)

   Drives the REAL derive() with fixture data shaped after the live party.
   No DOM, no Supabase — pure logic.                                       */
const FKD = require("./forge-kit-derive.js");

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log("  FAIL " + name); } }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// ── FIXTURE DATA ────────────────────────────────────────────────────────
// Shaped after the real party's structural — field names confirmed against
// sheet-mount.js/soul-shards-derive.js. Not the live rows; the shapes.

const STARTER_KITS = {
  vesperian: { name: "Vesperian", hp: 40, ac: 18, speed: 30, init: 4, res: { secondWind: 1, actionSurge: 1, slot1: 2 },
    react: { shield: { cost: { slot1: 1 } } }, actions: [
    { label: "Longsword", kind: "attack", rng: 1, hit: 6, dmg: "1d8+6" },
    { label: "Shortbow", kind: "attack", rng: 16, long: 64, hit: 6, dmg: "1d6+4" } ] },
  caim: { name: "Caim", hp: 24, ac: 16, speed: 40, init: 3, climb: true, res: { ki: 3, rebuke: 1 },
    react: { hellishRebuke: { cost: { rebuke: 1 }, dc: 11, dmg: "2d10", saveAbility: "dex" } }, actions: [
    { label: "Shortsword", kind: "attack", rng: 1, hit: 5, dmg: "1d6+3" } ] }
};

// Vesperian Vale — Fighter 4 (Eldritch Knight)
const VES_CHAR = {
  key: "vesperian", name: "Vesperian Vale",
  structural: {
    name: "Vesperian Vale", level: 4,
    classLabel: "Fighter 4", subclass: "Eldritch Knight",
    race: "Half-Elf",
    abilities: { str: { score: 18, mod: 4 }, dex: { score: 14, mod: 2 }, con: { score: 14, mod: 2 },
                 int: { score: 12, mod: 1 }, wis: { score: 10, mod: 0 }, cha: { score: 10, mod: 0 } },
    proficiencyBonus: 2,
    combat: { ac: 18, speed: 30, initiative: 4, maxHp: 40 },
    features: [
      { name: "Fighting Style: Defense", desc: "+1 AC when wearing armor.", source: "class:Fighter" },
      { name: "Second Wind", desc: "Regain 1d10+4 HP as a bonus action.", source: "class:Fighter" },
      { name: "Action Surge", desc: "Take one additional action.", source: "class:Fighter" },
      { name: "Spellcasting", desc: "Eldritch Knight spellcasting.", source: "subclass:Eldritch Knight" }
    ],
    spellcasting: {
      ability: "Intelligence", saveDC: 11, attackBonus: 3,
      pools: [{ key: "spell_1", level: 1, label: "Eldritch Knight Slots", badge: "Lvl 1", max: 2, current: 2, tone: "class" }],
      groups: [
        { heading: "Cantrips · At Will", level: 0, spells: [
          { name: "Booming Blade", origin: "subclass", time: "1 action" }
        ] },
        { heading: "1st Level", level: 1, spells: [
          { name: "Shield", origin: "subclass", time: "1 reaction" },
          { name: "Find Familiar", origin: "subclass", time: "1 action" }
        ] }
      ]
    },
    resources: [],
    actions: [],
    customActions: [],
    actionOverrides: {}
  },
  vitals: { hp: 40, maxHp: 40, pipState: {} },
  inventory: [
    { name: "Longsword", type: "weapon" },
    { name: "Shortbow", type: "weapon" },
    { name: "Potion of Healing", type: "potion" }
  ]
};

// Caim — Monk 4 (Way of Mercy), Tiefling
const CAIM_CHAR = {
  key: "caim", name: "Caim",
  structural: {
    name: "Caim", level: 4,
    classLabel: "Monk 4", subclass: "Way of Mercy",
    race: "Tiefling",
    abilities: { str: { score: 10, mod: 0 }, dex: { score: 16, mod: 3 }, con: { score: 14, mod: 2 },
                 int: { score: 8, mod: -1 }, wis: { score: 14, mod: 2 }, cha: { score: 12, mod: 1 } },
    proficiencyBonus: 2,
    combat: { ac: 16, speed: 40, initiative: 3, maxHp: 24, climb: true },
    features: [
      { name: "Unarmored Defense", desc: "AC = 10 + DEX + WIS.", source: "class:Monk" },
      { name: "Martial Arts", desc: "Use Dex for unarmed strikes; bonus unarmed.", source: "class:Monk" },
      { name: "Ki", desc: "3 ki points.", source: "class:Monk" },
      { name: "Hands of Healing", desc: "Spend 1 ki to heal 1d4+WIS.", source: "subclass:Way of Mercy" }
    ],
    spellcasting: null,
    resources: [
      { id: "ki", label: "Ki Points", tag: "Ki", max: 4, die: null, recharge: "short rest", tone: "class" }
    ],
    actions: [],
    customActions: [],
    actionOverrides: {}
  },
  vitals: { hp: 24, maxHp: 24, pipState: { ki: 1 } },  // 1 ki spent
  inventory: [
    { name: "Shortsword", type: "weapon" }
  ]
};

// Cosmere Runestar — Warlock 2 / Sorcerer 1 (multiclass)
const COSMERE_CHAR = {
  key: "cosmere", name: "Cosmere Runestar",
  structural: {
    name: "Cosmere Runestar", level: 3,
    classLabel: "Warlock 2 / Sorcerer 1", subclass: "The Hexblade",
    race: "Astral Elf",
    abilities: { str: { score: 10, mod: 0 }, dex: { score: 14, mod: 2 }, con: { score: 14, mod: 2 },
                 int: { score: 10, mod: 0 }, wis: { score: 10, mod: 0 }, cha: { score: 16, mod: 3 } },
    proficiencyBonus: 2,
    combat: { ac: 18, speed: 30, initiative: 2, maxHp: 20, spellSaveDC: 13, spellAttackBonus: 5 },
    features: [
      { name: "Hex Warrior", desc: "Use CHA for weapon attacks.", source: "subclass:The Hexblade" },
      { name: "Hexblade's Curse", desc: "Bonus to hit against one target.", source: "subclass:The Hexblade" }
    ],
    spellcasting: {
      ability: "Charisma", saveDC: 13, attackBonus: 5,
      pools: [
        { key: "pactSlots", level: 1, label: "Pact Magic", badge: "Lvl 1", max: 2, current: 2, tone: "class" },
        { key: "spell_1", level: 1, label: "Sorcerer Slots", badge: "Lvl 1", max: 1, current: 1, tone: "subclass" }
      ],
      groups: [
        { heading: "Cantrips · At Will", level: 0, spells: [
          { name: "Eldritch Blast", origin: "class", time: "1 action" },
          { name: "Booming Blade", origin: "class", time: "1 action" }
        ] },
        { heading: "1st Level", level: 1, spells: [
          { name: "Hex", origin: "class", time: "1 bonus action" },
          { name: "Shield", origin: "class", time: "1 reaction" },
          { name: "Armor of Agathys", origin: "class", time: "1 action" }
        ] }
      ]
    },
    resources: [],
    actions: [],
    customActions: [],
    actionOverrides: {}
  },
  vitals: { hp: 20, maxHp: 20, pipState: {} },
  inventory: [
    { name: "Longsword", type: "weapon" }
  ]
};

// Líadan Luchóg — Bard 3 / Cleric 1 (multiclass)
const LIADAN_CHAR = {
  key: "liadan", name: "Líadan Luchóg",
  structural: {
    name: "Líadan Luchóg", level: 4,
    classLabel: "Bard 3 / Cleric 1", subclass: "College of Lore",
    race: "Lightfoot Halfling",
    abilities: { str: { score: 8, mod: -1 }, dex: { score: 12, mod: 1 }, con: { score: 14, mod: 2 },
                 int: { score: 10, mod: 0 }, wis: { score: 14, mod: 2 }, cha: { score: 16, mod: 3 } },
    proficiencyBonus: 2,
    combat: { ac: 12, speed: 30, initiative: 1, maxHp: 31, spellSaveDC: 13, spellAttackBonus: 5 },
    features: [
      { name: "Bardic Inspiration", desc: "d6 inspiration die.", source: "class:Bard" },
      { name: "Jack of All Trades", desc: "+1 to all non-proficient checks.", source: "class:Bard" },
      { name: "Cutting Words", desc: "Reduce enemy roll with inspiration die.", source: "subclass:College of Lore" }
    ],
    spellcasting: {
      ability: "Charisma", saveDC: 13, attackBonus: 5,
      pools: [
        { key: "spell_1", level: 1, label: "Spell Slots", badge: "Lvl 1", max: 4, current: 4, tone: "class" },
        { key: "spell_2", level: 2, label: "Spell Slots", badge: "Lvl 2", max: 2, current: 2, tone: "class" }
      ],
      groups: [
        { heading: "Cantrips · At Will", level: 0, spells: [
          { name: "Vicious Mockery", origin: "class", time: "1 action" },
          { name: "Mending", origin: "class", time: "1 action" }
        ] },
        { heading: "1st Level", level: 1, spells: [
          { name: "Healing Word", origin: "class", time: "1 bonus action" },
          { name: "Cure Wounds", origin: "class", time: "1 action" },
          { name: "Silvery Barbs", origin: "class", time: "1 reaction" },
          { name: "Bless", origin: "class", time: "1 action", concentration: true }
        ] },
        { heading: "2nd Level", level: 2, spells: [
          { name: "Heat Metal", origin: "class", time: "1 bonus action", concentration: true },
          { name: "Shatter", origin: "class", time: "1 action" }
        ] }
      ]
    },
    resources: [
      { id: "bardicInspiration", label: "Bardic Inspiration", tag: "Bard", max: 3, die: "d6", recharge: "long rest", tone: "class" }
    ],
    actions: [],
    customActions: [],
    actionOverrides: {}
  },
  vitals: { hp: 31, maxHp: 31, pipState: { spell_1: 1 } },  // 1 lvl-1 slot spent
  inventory: [
    { name: "Sling", type: "weapon" },
    { name: "Potion of Healing", type: "potion" },
    { name: "Potion of Healing", type: "potion" },
    { name: "Scroll of Detect Magic", type: "scroll" }
  ]
};

// ── TEST GROUPS ──────────────────────────────────────────────────────────

// 1. Vesperian: Fighter 4 EK — stats, slots, reactions, feats
(function testVesperian() {
  var kit = FKD.derive(VES_CHAR);
  ok("ves: derived flag set", kit.derived === true);
  ok("ves: ac=18", kit.ac === 18);
  ok("ves: speed=30", kit.speed === 30);
  ok("ves: init=4", kit.init === 4);
  ok("ves: hp=40", kit.hp === 40);
  ok("ves: maxHp=40", kit.maxHp === 40);

  // Slots: EK has 2 level-1 slots
  ok("ves: res.slot1 = 2 (no spent)", kit.res.slot1 === 2);
  ok("ves: pools has slot1", kit.pools.some(function (p) { return p.key === "slot1" && p.max === 2; }));

  // Fighter class resources: Second Wind + Action Surge at level 4
  ok("ves: res.secondWind exists", kit.res.secondWind != null);
  ok("ves: res.actionSurge exists", kit.res.actionSurge != null);

  // Reaction: Shield (reaction spell in EK list)
  ok("ves: react.shield exists", !!kit.react && !!kit.react.shield);
  ok("ves: react.shield costs slot1", kit.react && kit.react.shield && deepEq(kit.react.shield.cost, { slot1: 1 }));

  // Feats tab
  ok("ves: feats tab has features", kit.tabs.feats.length >= 3);
  ok("ves: feat origin = class for Fighting Style", kit.tabs.feats.some(function (f) { return f.label === "Fighting Style: Defense" && f.origin === "class"; }));

  // Spells tab: Booming Blade (cantrip, action) should be there;
  // Shield (reaction) should NOT be on the spells shelf (it's a reaction)
  ok("ves: spells tab has Booming Blade", kit.tabs.spells.some(function (s) { return s.label === "Booming Blade"; }));
  ok("ves: spells tab omits Shield (reaction)", !kit.tabs.spells.some(function (s) { return s.label === "Shield"; }));

  // Items tab: Potion of Healing
  ok("ves: items tab has potion", kit.tabs.items.some(function (i) { return /potion/i.test(i.label); }));

  // Actions tab: universals present
  ok("ves: actions tab has Dash", kit.tabs.actions.some(function (a) { return a.label === "Dash"; }));
  ok("ves: actions tab has Grapple (greyed)", kit.tabs.actions.some(function (a) { return a.label === "Grapple" && a.greyed; }));
})();

// 2. Caim: Monk 4 Tiefling — ki, Hellish Rebuke, climb, no spellcasting
(function testCaim() {
  var kit = FKD.derive(CAIM_CHAR);
  ok("caim: ac=16", kit.ac === 16);
  ok("caim: speed=40", kit.speed === 40);
  ok("caim: climb=true", kit.climb === true);

  // Ki: 4 max, 1 spent → 3 current
  ok("caim: res.ki = 3 (1 spent of 4)", kit.res.ki === 3);
  ok("caim: pools has ki", kit.pools.some(function (p) { return p.key === "ki" && p.max === 4 && p.current === 3; }));

  // Hellish Rebuke (Tiefling racial reaction)
  ok("caim: react.hellishRebuke exists", !!kit.react && !!kit.react.hellishRebuke);
  ok("caim: react.hellishRebuke costs rebuke:1", kit.react && kit.react.hellishRebuke && deepEq(kit.react.hellishRebuke.cost, { rebuke: 1 }));
  ok("caim: react.hellishRebuke has dc", kit.react && kit.react.hellishRebuke && kit.react.hellishRebuke.dc > 0);
  ok("caim: res.rebuke exists", kit.res.rebuke != null);

  // No spellcasting → spells tab empty
  ok("caim: spells tab empty", kit.tabs.spells.length === 0);

  // Feats
  ok("caim: feats tab has features", kit.tabs.feats.length >= 3);
})();

// 3. Cosmere: Warlock 2 / Sorcerer 1 — multiclass pools, Shield reaction, Hex as bonus
(function testCosmere() {
  var kit = FKD.derive(COSMERE_CHAR);
  ok("cos: ac=18", kit.ac === 18);
  ok("cos: speed=30", kit.speed === 30);
  ok("cos: init=2", kit.init === 2);

  // Multiclass pools: pact (2) + sorcerer slot1 (1)
  ok("cos: res.pact = 2", kit.res.pact === 2);
  ok("cos: res.slot1 = 1 (sorcerer)", kit.res.slot1 === 1);
  ok("cos: pools has pact", kit.pools.some(function (p) { return p.key === "pact" && p.max === 2; }));
  ok("cos: pools has slot1", kit.pools.some(function (p) { return p.key === "slot1" && p.max === 1; }));

  // Shield reaction
  ok("cos: react.shield exists", !!kit.react && !!kit.react.shield);

  // Spells: Hex should be bonus-costed
  ok("cos: spells tab has Hex", kit.tabs.spells.some(function (s) { return s.label === "Hex"; }));
  var hex = kit.tabs.spells.filter(function (s) { return s.label === "Hex"; })[0];
  ok("cos: Hex is bonus action", !!hex && hex.bonus === true);
  ok("cos: Hex costs a slot", !!hex && hex.cost != null);

  // Hex should also appear in the bonus tab (filter)
  ok("cos: bonus tab has Hex", kit.tabs.bonus.some(function (t) { return t.label === "Hex"; }));

  // Shield is a reaction → not in spells tab
  ok("cos: spells tab omits Shield", !kit.tabs.spells.some(function (s) { return s.label === "Shield"; }));

  // Cantrips (free, no cost)
  var eb = kit.tabs.spells.filter(function (s) { return s.label === "Eldritch Blast"; })[0];
  ok("cos: Eldritch Blast is free (cantrip)", !!eb && eb.cost === null);

  // Spellcasting stats
  ok("cos: spellcasting.saveDC=13", kit.spellcasting && kit.spellcasting.saveDC === 13);
  ok("cos: spellcasting.attackBonus=5", kit.spellcasting && kit.spellcasting.attackBonus === 5);
})();

// 4. Líadan: Bard 3 / Cleric 1 — multiclass slots (4 lvl-1, 2 lvl-2), bardic, SB reaction
(function testLiadan() {
  var kit = FKD.derive(LIADAN_CHAR);
  ok("lia: ac=12", kit.ac === 12);
  ok("lia: init=1", kit.init === 1);

  // Multiclass slots: 4 lvl-1 (1 spent → 3 current), 2 lvl-2
  ok("lia: res.slot1 = 3 (1 spent)", kit.res.slot1 === 3);
  ok("lia: res.slot2 = 2", kit.res.slot2 === 2);

  // Bardic Inspiration
  ok("lia: res.bardicInspiration exists", kit.res.bardicInspiration != null);
  ok("lia: pools has bardic", kit.pools.some(function (p) { return /bard/i.test(p.label); }));

  // Silvery Barbs reaction
  ok("lia: react.silveryBarbs exists", !!kit.react && !!kit.react.silveryBarbs);
  ok("lia: react.silveryBarbs has range:12", kit.react && kit.react.silveryBarbs && kit.react.silveryBarbs.range === 12);

  // Healing Word → bonus action
  var hw = kit.tabs.spells.filter(function (s) { return s.label === "Healing Word"; })[0];
  ok("lia: Healing Word is bonus", !!hw && hw.bonus === true);
  ok("lia: Healing Word in bonus tab", kit.tabs.bonus.some(function (t) { return t.label === "Healing Word"; }));

  // Concentration badge on Bless
  var bless = kit.tabs.spells.filter(function (s) { return s.label === "Bless"; })[0];
  ok("lia: Bless has conc=true", !!bless && bless.conc === true);

  // Heat Metal at level 2 → costs slot2
  var hm = kit.tabs.spells.filter(function (s) { return s.label === "Heat Metal"; })[0];
  ok("lia: Heat Metal costs slot2", !!hm && hm.cost && hm.cost.slot2 === 1);

  // Items: 2 potions (stacked), 1 scroll
  ok("lia: items tab has potion", kit.tabs.items.some(function (i) { return /potion/i.test(i.label); }));
  var pot = kit.tabs.items.filter(function (i) { return /potion/i.test(i.label); })[0];
  ok("lia: potion count=2 (stacked)", !!pot && pot.count === 2);
  ok("lia: items tab has scroll", kit.tabs.items.some(function (i) { return /scroll/i.test(i.label); }));

  // SB not in spells tab (reaction)
  ok("lia: spells tab omits Silvery Barbs", !kit.tabs.spells.some(function (s) { return s.label === "Silvery Barbs"; }));
})();

// 5. No-sheet fallback → STARTER_KITS
(function testStarterFallback() {
  var kit = FKD.derive({ key: "vesperian" }, { starterKits: STARTER_KITS });
  ok("fallback: name from starter kit", kit.name === "Vesperian");
  ok("fallback: ac from starter kit", kit.ac === 18);
  ok("fallback: actions from starter kit", kit.actions.length >= 2);
  ok("fallback: fallback flag = 'starter'", kit.fallback === "starter");
  ok("fallback: derived = false", kit.derived === false);
  ok("fallback: actions tab has universals", kit.tabs.actions.some(function (a) { return a.label === "Dash"; }));
})();

// 6. No sheet, no starter kit → generic kit
(function testGenericFallback() {
  var kit = FKD.derive({ key: "nobody" }, { starterKits: STARTER_KITS });
  ok("generic: ac=10", kit.ac === 10);
  ok("generic: speed=30", kit.speed === 30);
  ok("generic: has improvised strike", kit.actions.length >= 1);
  ok("generic: fallback='generic'", kit.fallback === "generic");
})();

// 7. Null input → generic
(function testNullInput() {
  var kit = FKD.derive(null);
  ok("null: returns a kit", !!kit);
  ok("null: fallback='generic'", kit.fallback === "generic");
  ok("null: has actions", kit.actions.length >= 1);
})();

// 8. Icon map
(function testIconMap() {
  ok("icon: longsword → glyph", FKD.iconFor({ label: "Longsword", tab: "attacks" }) != null);
  ok("icon: Eldritch Blast → glyph", FKD.iconFor({ label: "Eldritch Blast", tab: "spells" }) != null);
  ok("icon: Dash → glyph", FKD.iconFor({ label: "Dash", tab: "actions" }) === "sprint");
  // kind-generic fallback
  ok("icon: unknown attack → crossed-swords", FKD.iconFor({ label: "Zzzyxxx", tab: "attacks", kind: "attack" }) === "crossed-swords");
  ok("icon: unknown spell → sparkles", FKD.iconFor({ label: "Zzzyxxx", tab: "spells", spell: true }) === "sparkles");
  // letter fallback
  ok("icon: totally unknown → null (letter fallback)", FKD.iconFor({ label: "Zzzyxxx" }) === null);
})();

// 9. forgeResKey mapping
(function testResKeyMapping() {
  ok("resKey: spell_1 → slot1", FKD.forgeResKey("spell_1") === "slot1");
  ok("resKey: spell_3 → slot3", FKD.forgeResKey("spell_3") === "slot3");
  ok("resKey: pactSlots → pact", FKD.forgeResKey("pactSlots") === "pact");
  ok("resKey: ki → ki (passthrough)", FKD.forgeResKey("ki") === "ki");
  ok("resKey: sorcery → sorcery", FKD.forgeResKey("sorcery") === "sorcery");
})();

// 10. Tab structure invariants
(function testTabStructure() {
  var kit = FKD.derive(VES_CHAR);
  ok("tabs: all six keys present", !!kit.tabs.attacks && !!kit.tabs.spells && !!kit.tabs.items && !!kit.tabs.feats && !!kit.tabs.actions && !!kit.tabs.bonus);
  // Every tile in a tab has the matching tab field
  ["attacks", "spells", "items", "feats", "actions"].forEach(function (tabKey) {
    (kit.tabs[tabKey] || []).forEach(function (t) {
      if (t.tab !== tabKey && t.tab !== "bonus") ok("tabs: tile '" + t.label + "' in wrong tab", false);
    });
  });
  ok("tabs: tile-tab consistency (ves)", true); // if we got here with no fails from the inner loop

  // Universals always present (5 + 2 greyed)
  ok("tabs: universals count >= 5", kit.tabs.actions.filter(function (a) { return a.universal && !a.greyed; }).length === 5);
  ok("tabs: greyed count = 2", kit.tabs.actions.filter(function (a) { return a.greyed; }).length === 2);
})();

// 11. Assembled actions integration (simulates what the browser does)
(function testAssembledActions() {
  var assembled = [
    { id: "wpn-longsword", type: "attack", label: "Longsword", ability: "str", proficient: true,
      atkBonus: 0, dmgAbility: true, dmgBonus: 0, dmgDice: "1d8", dmgType: "Slashing" },
    { id: "wpn-shortbow", type: "attack", label: "Shortbow", ability: "dex", proficient: true,
      atkBonus: 0, dmgAbility: true, dmgBonus: 0, dmgDice: "1d6", dmgType: "Piercing", range: "80/320" },
    { id: "custom-1", type: "utility", label: "Taunt", bonus: false }
  ];
  var kit = FKD.derive(VES_CHAR, { assembledActions: assembled });
  // Attacks tab should have the two weapons
  ok("assembled: attacks tab has Longsword", kit.tabs.attacks.some(function (t) { return t.label === "Longsword"; }));
  ok("assembled: attacks tab has Shortbow", kit.tabs.attacks.some(function (t) { return t.label === "Shortbow"; }));
  // Longsword to-hit: STR(4) + prof(2) + atkBonus(0) = 6
  var ls = kit.tabs.attacks.filter(function (t) { return t.label === "Longsword"; })[0];
  ok("assembled: Longsword hit=6", !!ls && ls.hit === 6);
  ok("assembled: Longsword dmg includes mod", !!ls && /\+4/.test(ls.dmg));
  // Shortbow range parsed from "80/320"
  var sb = kit.tabs.attacks.filter(function (t) { return t.label === "Shortbow"; })[0];
  ok("assembled: Shortbow rng=16 (80/5)", !!sb && sb.rng === 16);
  ok("assembled: Shortbow long=64 (320/5)", !!sb && sb.long === 64);
  // dmgStack has the typed damage
  ok("assembled: Longsword dmgStack[0].type=Slashing", !!ls && ls.dmgStack && ls.dmgStack[0].type === "Slashing");

  // Utility action goes to actions tab
  ok("assembled: Taunt in actions tab", kit.tabs.actions.some(function (t) { return t.label === "Taunt"; }));
})();

// 12. Derivation never mutates input
(function testNoMutation() {
  var before = JSON.stringify(VES_CHAR);
  FKD.derive(VES_CHAR);
  var after = JSON.stringify(VES_CHAR);
  ok("no-mutation: charData unchanged after derive", before === after);
})();

// ── summary ──────────────────────────────────────────────────────────────
console.log("smoke-kit-derive: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
