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
      { name: "Flurry of Blows", desc: "After Attack: 2 unarmed strikes as a bonus action (1 ki).", source: "class:Monk" },
      { name: "Patient Defense", desc: "Dodge as a bonus action (1 ki).", source: "class:Monk" },
      { name: "Step of the Wind", desc: "Dash or Disengage as a bonus action (1 ki).", source: "class:Monk" },
      { name: "Hands of Healing", desc: "Spend 1 ki to heal 1d4+WIS.", source: "subclass:Way of Mercy" }
    ],
    spellcasting: null,
    resources: [
      { id: "ki", label: "Ki Points", tag: "Ki", max: 4, die: null, recharge: "short rest", tone: "class", source: "class", origin: "class" }
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
      { id: "bardicInspiration", label: "Bardic Inspiration", tag: "Bard", max: 3, die: "d6", recharge: "long rest", tone: "class", source: "class", origin: "class" }
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

  // Class feature actions: Second Wind (bonus), Action Surge (free)
  ok("ves: actions tab has Second Wind", kit.tabs.actions.some(function (a) { return a.label === "Second Wind"; }));
  ok("ves: Second Wind is bonus action", kit.tabs.actions.some(function (a) { return a.label === "Second Wind" && a.bonus; }));
  ok("ves: Second Wind costs secondWind:1", kit.tabs.actions.some(function (a) { return a.label === "Second Wind" && a.cost && a.cost.secondWind === 1; }));
  ok("ves: actions tab has Action Surge", kit.tabs.actions.some(function (a) { return a.label === "Action Surge"; }));
  ok("ves: Action Surge is free action", kit.tabs.actions.some(function (a) { return a.label === "Action Surge" && a.free; }));
  ok("ves: Action Surge costs actionSurge:1", kit.tabs.actions.some(function (a) { return a.label === "Action Surge" && a.cost && a.cost.actionSurge === 1; }));
  // Second Wind should also appear in bonus tab (filter)
  ok("ves: bonus tab has Second Wind", kit.tabs.bonus.some(function (t) { return t.label === "Second Wind"; }));
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

  // Class feature actions: Flurry, Patient Defense, Step of the Wind, Hands of Healing
  ok("caim: actions has Flurry of Blows", kit.tabs.actions.some(function (a) { return a.label === "Flurry of Blows"; }));
  ok("caim: Flurry costs ki:1", kit.tabs.actions.some(function (a) { return a.label === "Flurry of Blows" && a.cost && a.cost.ki === 1; }));
  ok("caim: actions has Patient Defense", kit.tabs.actions.some(function (a) { return a.label === "Patient Defense"; }));
  ok("caim: actions has Hands of Healing", kit.tabs.actions.some(function (a) { return a.label === "Hands of Healing"; }));
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

// 13. Bonus-tab widening: bonus + free (M's ruling 2026-07-12)
(function testBonusTabWidening() {
  var kit = FKD.derive(VES_CHAR);
  // Action Surge is free:true, bonus:false — must appear in bonus tab
  ok("bonus-widen: Action Surge in bonus tab", kit.tabs.bonus.some(function (t) { return t.label === "Action Surge"; }));
  // Second Wind is bonus:true — still in bonus tab
  ok("bonus-widen: Second Wind still in bonus tab", kit.tabs.bonus.some(function (t) { return t.label === "Second Wind"; }));
  // No action-costed tiles should leak in
  var leaked = kit.tabs.bonus.filter(function (t) { return !t.bonus && !t.free; });
  ok("bonus-widen: no action-only tiles leak in", leaked.length === 0);
  // Universals (Dash/Dodge/Help/Disengage/Ready) are not bonus and not free → excluded
  ok("bonus-widen: Dash not in bonus tab", !kit.tabs.bonus.some(function (t) { return t.label === "Dash"; }));

  // Caim: Flurry/Patient Defense/Step of the Wind are bonus → in bonus tab
  var cKit = FKD.derive(CAIM_CHAR);
  ok("bonus-widen: Caim Flurry in bonus tab", cKit.tabs.bonus.some(function (t) { return t.label === "Flurry of Blows"; }));
  ok("bonus-widen: Caim Patient Defense in bonus tab", cKit.tabs.bonus.some(function (t) { return t.label === "Patient Defense"; }));
  ok("bonus-widen: Caim Step of the Wind in bonus tab", cKit.tabs.bonus.some(function (t) { return t.label === "Step of the Wind"; }));
  // Hands of Healing is action (bonus:false, free:false) → NOT in bonus tab
  ok("bonus-widen: Hands of Healing not in bonus tab", !cKit.tabs.bonus.some(function (t) { return t.label === "Hands of Healing"; }));

  // Cosmere: Hex (bonus spell) in bonus tab, Hexblade's Curse (bonus) in bonus tab
  var cosKit = FKD.derive(COSMERE_CHAR);
  ok("bonus-widen: Cosmere Hex in bonus tab", cosKit.tabs.bonus.some(function (t) { return t.label === "Hex"; }));
  ok("bonus-widen: Cosmere Hexblade's Curse in bonus tab", cosKit.tabs.bonus.some(function (t) { return /hexblade/i.test(t.label); }));

  // Líadan: Healing Word (bonus spell) in bonus tab; Heat Metal (bonus spell) in bonus tab
  var liaKit = FKD.derive(LIADAN_CHAR);
  ok("bonus-widen: Líadan Healing Word in bonus tab", liaKit.tabs.bonus.some(function (t) { return t.label === "Healing Word"; }));
  ok("bonus-widen: Líadan Heat Metal in bonus tab", liaKit.tabs.bonus.some(function (t) { return t.label === "Heat Metal"; }));
})();

// 14. Order passthrough: assembledActions order === tabs.attacks order
(function testOrderPassthrough() {
  // Simulate assembleActions output order: weapon1, weapon2, cantrip-attack, spell-attack
  var assembled = [
    { id: "wpn-longsword",  type: "attack", label: "Longsword",  ability: "str", proficient: true, atkBonus: 0, dmgAbility: true, dmgBonus: 0, dmgDice: "1d8",  dmgType: "Slashing" },
    { id: "wpn-shortbow",   type: "attack", label: "Shortbow",   ability: "dex", proficient: true, atkBonus: 0, dmgAbility: true, dmgBonus: 0, dmgDice: "1d6",  dmgType: "Piercing", range: "80/320" },
    { id: "cant-boomingblade", type: "attack", label: "Booming Blade · Longsword", ability: "str", proficient: true, atkBonus: 0, dmgAbility: true, dmgBonus: 0, dmgDice: "1d8", dmgType: "Slashing + thunder" },
    { id: "sp-firebolt",    type: "attack", label: "Fire Bolt",  ability: "int", proficient: true, atkBonus: 0, dmgAbility: false, dmgBonus: 0, dmgDice: "1d10", dmgType: "fire" },
    { id: "custom-taunt",   type: "utility", label: "Taunt" }
  ];
  var kit = FKD.derive(VES_CHAR, { assembledActions: assembled });
  // attacks tab should have exactly the 4 attack-type rows, in order
  var atkLabels = kit.tabs.attacks.map(function (t) { return t.label; });
  ok("order: attacks tab has 4 tiles", atkLabels.length === 4);
  ok("order: index 0 = Longsword", atkLabels[0] === "Longsword");
  ok("order: index 1 = Shortbow", atkLabels[1] === "Shortbow");
  ok("order: index 2 = Booming Blade · Longsword", atkLabels[2] === "Booming Blade · Longsword");
  ok("order: index 3 = Fire Bolt", atkLabels[3] === "Fire Bolt");
  // utility goes to actions tab, not attacks
  ok("order: Taunt in actions, not attacks", !atkLabels.some(function (l) { return l === "Taunt"; }));
  ok("order: Taunt in actions tab", kit.tabs.actions.some(function (t) { return t.label === "Taunt"; }));
  // tile ids also preserved
  var atkIds = kit.tabs.attacks.map(function (t) { return t.id; });
  ok("order: tile ids match source ids", atkIds[0] === "wpn-longsword" && atkIds[1] === "wpn-shortbow");
})();

// 14b. Resolver chain (headless — registries not loaded, _inRegistry accepts all)
(function testResolverChain() {
  ok("resolver: exported", typeof FKD.resolveIcon === "function");

  // Step 1: inline icon from _src beats everything
  var tile1 = { id: "atk_0", label: "Longsword", tab: "attacks", _src: { icon: "custom-blade" } };
  ok("resolver: inline _src.icon wins", FKD.resolveIcon(tile1, {}) === "custom-blade");

  // Step 2: iconOverrides beats keyword seed
  var tile2 = { id: "spell_healing_word", label: "Healing Word", tab: "spells", spell: true };
  var struct2 = { iconOverrides: { "spell_healing_word": "holy-light" } };
  ok("resolver: iconOverrides wins over keyword", FKD.resolveIcon(tile2, struct2) === "holy-light");

  // Step 3: ICON_KEYWORDS seed fires when no inline or override
  var tile3 = { id: "spell_hw", label: "Healing Word", tab: "spells", spell: true };
  ok("resolver: keyword seed fires", FKD.resolveIcon(tile3, {}) === "healing");

  // Step 1 > Step 2: inline beats override
  var tile4 = { id: "atk_0", label: "Longsword", tab: "attacks", _src: { icon: "my-icon" } };
  var struct4 = { iconOverrides: { "atk_0": "other-icon" } };
  ok("resolver: inline beats override", FKD.resolveIcon(tile4, struct4) === "my-icon");

  // Step 5: unknown → falls to kind-generic (in headless, ICON_KEYWORDS kind-generic returns)
  var tile5 = { id: "x", label: "Zzzyxxx Mystery", tab: "attacks", kind: "attack" };
  var r5 = FKD.resolveIcon(tile5, {});
  ok("resolver: unknown attack → crossed-swords (kind-generic)", r5 === "crossed-swords");

  // Null tile → null
  ok("resolver: null tile → null", FKD.resolveIcon(null, {}) === null);

  // Weapon tile inherits gear-manager custom icon via _src
  var wpnTile = { id: "atk_0", label: "Longsword", tab: "attacks",
                  _src: { name: "Longsword", icon: "flame-sword" } };
  ok("resolver: weapon inherits gear-manager icon", FKD.resolveIcon(wpnTile, {}) === "flame-sword");

  // Override survives re-derivation (override applies to a fresh tile with same id)
  var tile6a = { id: "spell_hex", label: "Hex", tab: "spells", spell: true };
  var struct6 = { iconOverrides: { "spell_hex": "cursed-star" } };
  ok("resolver: override on spell tile", FKD.resolveIcon(tile6a, struct6) === "cursed-star");
  // Second call, same id, same override — still works
  var tile6b = { id: "spell_hex", label: "Hex", tab: "spells", spell: true };
  ok("resolver: override survives re-derive", FKD.resolveIcon(tile6b, struct6) === "cursed-star");
})();

// 15. Resource passthrough: recharge, die, tag, origin, source, custom survive derive
(function testResourcePassthrough() {
  // Caim has ki with recharge/die/tag/origin/source from resource-derive
  var kit = FKD.derive(CAIM_CHAR);
  var kiPool = kit.pools.filter(function (p) { return p.key === "ki"; })[0];
  ok("res-pass: ki pool exists", !!kiPool);
  ok("res-pass: ki recharge = 'short rest'", kiPool && kiPool.recharge === "short rest");
  ok("res-pass: ki die = null", kiPool && kiPool.die === null);
  ok("res-pass: ki tone = 'class'", kiPool && kiPool.tone === "class");
  ok("res-pass: ki origin = 'class'", kiPool && kiPool.origin === "class");
  ok("res-pass: ki source = 'class'", kiPool && kiPool.source === "class");
  ok("res-pass: ki custom = false", kiPool && kiPool.custom === false);

  // Líadan has bardic inspiration with die = 'd6', recharge = 'long rest'
  var liaKit = FKD.derive(LIADAN_CHAR);
  var bardPool = liaKit.pools.filter(function (p) { return /bard/i.test(p.label); })[0];
  ok("res-pass: bardic pool exists", !!bardPool);
  ok("res-pass: bardic die = 'd6'", bardPool && bardPool.die === "d6");
  ok("res-pass: bardic recharge = 'long rest'", bardPool && bardPool.recharge === "long rest");
  ok("res-pass: bardic origin = 'class'", bardPool && bardPool.origin === "class");
  ok("res-pass: bardic custom = false", bardPool && bardPool.custom === false);

  // Vesperian: hardcoded secondWind pool has recharge/origin
  var vesKit = FKD.derive(VES_CHAR);
  var swPool = vesKit.pools.filter(function (p) { return p.key === "secondWind"; })[0];
  ok("res-pass: secondWind pool exists", !!swPool);
  ok("res-pass: secondWind recharge = 'short rest'", swPool && swPool.recharge === "short rest");
  ok("res-pass: secondWind origin = 'class'", swPool && swPool.origin === "class");
  var asPool = vesKit.pools.filter(function (p) { return p.key === "actionSurge"; })[0];
  ok("res-pass: actionSurge pool exists", !!asPool);
  ok("res-pass: actionSurge recharge = 'short rest'", asPool && asPool.recharge === "short rest");

  // Caim Tiefling: hardcoded rebuke pool has recharge/origin
  var rebukePool = kit.pools.filter(function (p) { return p.key === "rebuke"; })[0];
  ok("res-pass: rebuke pool exists", !!rebukePool);
  ok("res-pass: rebuke recharge = 'long rest'", rebukePool && rebukePool.recharge === "long rest");
  ok("res-pass: rebuke origin = 'race'", rebukePool && rebukePool.origin === "race");

  // Custom resource passthrough: add one to a fixture and verify custom:true survives
  var customChar = JSON.parse(JSON.stringify(CAIM_CHAR));
  customChar.structural.resources.push({
    id: "myRes", label: "My Thing", tag: "MT", max: 3, die: "d4",
    recharge: "short or long rest", tone: "class", source: "custom", origin: "custom", custom: true
  });
  var cKit = FKD.derive(customChar);
  var myPool = cKit.pools.filter(function (p) { return p.key === "myRes"; })[0];
  ok("res-pass: custom resource pool exists", !!myPool);
  ok("res-pass: custom resource custom = true", myPool && myPool.custom === true);
  ok("res-pass: custom resource die = 'd4'", myPool && myPool.die === "d4");
  ok("res-pass: custom resource tag = 'MT'", myPool && myPool.tag === "MT");
  ok("res-pass: custom resource recharge = 'short or long rest'", myPool && myPool.recharge === "short or long rest");
  ok("res-pass: custom resource source = 'custom'", myPool && myPool.source === "custom");
  ok("res-pass: custom resource origin = 'custom'", myPool && myPool.origin === "custom");
})();

// 16. Feat tiles carry _src (drawer can reach entries/desc from the original feature)
(function testFeatSrcPassthrough() {
  // Vesperian has structural features with desc strings
  var kit = FKD.derive(VES_CHAR);
  var featTab = kit.tabs.feats || [];
  ok("feat-src: Vesperian has feat tiles", featTab.length > 0);

  var sw = featTab.filter(function (t) { return t.label === "Second Wind"; })[0];
  ok("feat-src: Second Wind tile exists", !!sw);
  ok("feat-src: Second Wind has _src", sw && !!sw._src);
  ok("feat-src: _src.name === feature name", sw && sw._src && sw._src.name === "Second Wind");
  ok("feat-src: _src.desc matches tile.desc", sw && sw._src && sw.desc === sw._src.desc);

  // Custom features also carry _src
  var customChar = JSON.parse(JSON.stringify(VES_CHAR));
  customChar.structural.customFeatures = [
    { name: "Homebrew Trick", desc: "Does something cool.", source: "custom" }
  ];
  var cKit = FKD.derive(customChar);
  var cFeat = (cKit.tabs.feats || []).filter(function (t) { return t.label === "Homebrew Trick"; })[0];
  ok("feat-src: custom feature tile exists", !!cFeat);
  ok("feat-src: custom feature has _src", cFeat && !!cFeat._src);
  ok("feat-src: custom _src.name matches", cFeat && cFeat._src && cFeat._src.name === "Homebrew Trick");

  // Forward-proof: a feature with entries array is reachable via _src
  var entriesChar = JSON.parse(JSON.stringify(VES_CHAR));
  entriesChar.structural.features = [
    { name: "Rich Feature", source: "class:Fighter", desc: "Short desc.",
      entries: ["Full description.", "Second paragraph."] }
  ];
  var eKit = FKD.derive(entriesChar);
  var rich = (eKit.tabs.feats || []).filter(function (t) { return t.label === "Rich Feature"; })[0];
  ok("feat-src: entries-bearing feature has _src", rich && !!rich._src);
  ok("feat-src: _src.entries is reachable", rich && rich._src && Array.isArray(rich._src.entries));
  ok("feat-src: _src.entries[0] is correct", rich && rich._src && rich._src.entries[0] === "Full description.");
})();

// 17. SPELL_COMBAT: per-PC known-answer spell projections
(function testSpellCombatProjection() {
  // ── Líadan: Healing Word → heal/1d4+3/12 sq ──
  var liaKit = FKD.derive(LIADAN_CHAR);
  var liaSpells = liaKit.tabs.spells || [];

  var hw = liaSpells.filter(function (t) { return t.label === "Healing Word"; })[0];
  ok("spell-proj: Healing Word exists", !!hw);
  ok("spell-proj: Healing Word kind=heal", hw && hw.kind === "heal");
  ok("spell-proj: Healing Word dmg=1d4+3", hw && hw.dmg === "1d4+3");
  ok("spell-proj: Healing Word rng=12", hw && hw.rng === 12);
  ok("spell-proj: Healing Word bonus=true", hw && hw.bonus === true);
  ok("spell-proj: Healing Word not greyed", hw && !hw.greyed);

  // Cure Wounds → heal/1d8+3/rng=1 (touch)
  var cw = liaSpells.filter(function (t) { return t.label === "Cure Wounds"; })[0];
  ok("spell-proj: Cure Wounds kind=heal", cw && cw.kind === "heal");
  ok("spell-proj: Cure Wounds dmg=1d8+3", cw && cw.dmg === "1d8+3");
  ok("spell-proj: Cure Wounds rng=1", cw && cw.rng === 1);

  // Vicious Mockery → save/wis (cantrip, level 4 = 1d4)
  var vm = liaSpells.filter(function (t) { return t.label === "Vicious Mockery"; })[0];
  ok("spell-proj: VM kind=save", vm && vm.kind === "save");
  ok("spell-proj: VM saveAbility=wis", vm && vm.saveAbility === "wis");
  ok("spell-proj: VM dmg=1d4 (level 4)", vm && vm.dmg === "1d4");
  ok("spell-proj: VM rng=12", vm && vm.rng === 12);
  ok("spell-proj: VM rider=vm", vm && vm.rider === "vm");
  ok("spell-proj: VM dc=13", vm && vm.dc === 13);

  // Bless → buffAlly, conc
  var bl = liaSpells.filter(function (t) { return t.label === "Bless"; })[0];
  ok("spell-proj: Bless kind=buffAlly", bl && bl.kind === "buffAlly");
  ok("spell-proj: Bless conc=true", bl && bl.conc === true);
  ok("spell-proj: Bless rng=6", bl && bl.rng === 6);
  ok("spell-proj: Bless not greyed", bl && !bl.greyed);
  ok("spell-proj: Bless cost slot1", bl && bl.cost && bl.cost.slot1 === 1);

  // Mending → greyed (utility)
  var mend = liaSpells.filter(function (t) { return t.label === "Mending"; })[0];
  ok("spell-proj: Mending greyed", mend && mend.greyed === true);
  ok("spell-proj: Mending has greyReason", mend && typeof mend.greyReason === "string" && mend.greyReason.length > 5);

  // Shatter → save/con, 3d8, rng 12
  var sh = liaSpells.filter(function (t) { return t.label === "Shatter"; })[0];
  ok("spell-proj: Shatter kind=save", sh && sh.kind === "save");
  ok("spell-proj: Shatter saveAbility=con", sh && sh.saveAbility === "con");
  ok("spell-proj: Shatter dmg=3d8", sh && sh.dmg === "3d8");

  // Heat Metal → save/con, bonus action
  var hm = liaSpells.filter(function (t) { return t.label === "Heat Metal"; })[0];
  ok("spell-proj: Heat Metal kind=save", hm && hm.kind === "save");
  ok("spell-proj: Heat Metal bonus=true", hm && hm.bonus === true);
  ok("spell-proj: Heat Metal conc=true", hm && hm.conc === true);

  // Silvery Barbs → reaction, should be filtered out (not in spells tab)
  var sb = liaSpells.filter(function (t) { return t.label === "Silvery Barbs"; })[0];
  ok("spell-proj: Silvery Barbs filtered (reaction)", !sb);

  // ── Cosmere: Hex → buff, Armor of Agathys → selfheal, EB → attack ──
  var cosKit = FKD.derive(COSMERE_CHAR);
  var cosSpells = cosKit.tabs.spells || [];

  var hex = cosSpells.filter(function (t) { return t.label === "Hex"; })[0];
  ok("spell-proj: Hex kind=buff", hex && hex.kind === "buff");
  ok("spell-proj: Hex rng=18", hex && hex.rng === 18);
  ok("spell-proj: Hex bonus=true", hex && hex.bonus === true);

  var aoa = cosSpells.filter(function (t) { return t.label === "Armor of Agathys"; })[0];
  ok("spell-proj: AoA kind=selfheal", aoa && aoa.kind === "selfheal");
  ok("spell-proj: AoA dmg=5", aoa && aoa.dmg === "5");

  var eb = cosSpells.filter(function (t) { return t.label === "Eldritch Blast"; })[0];
  ok("spell-proj: EB kind=attack", eb && eb.kind === "attack");
  ok("spell-proj: EB rng=24", eb && eb.rng === 24);
  ok("spell-proj: EB hit=atkBonus (5)", eb && eb.hit === 5);
  ok("spell-proj: EB dmg=1d10 (level 3)", eb && eb.dmg === "1d10");

  // Booming Blade → greyed (weapon cantrip)
  var bb = cosSpells.filter(function (t) { return t.label === "Booming Blade"; })[0];
  ok("spell-proj: BB greyed (weapon cantrip)", bb && bb.greyed === true);
  ok("spell-proj: BB greyReason mentions Attacks tab", bb && /Attacks tab/i.test(bb.greyReason || ""));

  // Shield → reaction, should be filtered out
  var sh2 = cosSpells.filter(function (t) { return t.label === "Shield"; })[0];
  ok("spell-proj: Shield filtered (reaction)", !sh2);

  // ── Vesperian: Find Familiar → greyed, Booming Blade → greyed ──
  var vesKit = FKD.derive(VES_CHAR);
  var vesSpells = vesKit.tabs.spells || [];

  var ff = vesSpells.filter(function (t) { return t.label === "Find Familiar"; })[0];
  ok("spell-proj: Find Familiar greyed", ff && ff.greyed === true);

  var vbb = vesSpells.filter(function (t) { return t.label === "Booming Blade"; })[0];
  ok("spell-proj: Ves BB greyed", vbb && vbb.greyed === true);
})();

// 18. SPELL_COMBAT: greyed-fallback invariant — every spells-tab tile has a resolvable kind OR greyed:true
(function testGreyedInvariant() {
  var RESOLVE_KINDS = { attack: 1, save: 1, heal: 1, buff: 1, buffAlly: 1, selfheal: 1, surge: 1, rage: 1 };
  [VES_CHAR, CAIM_CHAR, COSMERE_CHAR, LIADAN_CHAR].forEach(function (c) {
    var kit = FKD.derive(c);
    (kit.tabs.spells || []).forEach(function (t) {
      var resolvable = !!RESOLVE_KINDS[t.kind];
      var safe = resolvable || t.greyed === true;
      ok("grey-inv: " + c.key + "/" + t.label + " resolvable OR greyed", safe);
    });
  });
})();

// 19. SPELL_COMBAT: attack-cantrip hit math (from assembled actions)
(function testAttackCantripHit() {
  // Build a character with assembled actions that include attack-cantrip rows
  var assembled = [
    { id: "sp-eldritchblast", type: "attack-cantrip", label: "Eldritch Blast", hitMod: 5, dmgMod: 0, dmgDice: "1d10", critDice: "2d10", dmgType: "force" },
    { id: "sp-viciousmockery", type: "damage-only", label: "Vicious Mockery", dmgMod: 0, dmgDice: "1d4", dmgType: "psychic (WIS save DC 13)", saveAbility: "wis" }
  ];
  var tiles = FKD.attackTiles(LIADAN_CHAR.structural, assembled);

  var ebTile = tiles.filter(function (t) { return t.label === "Eldritch Blast"; })[0];
  ok("atk-cantrip: EB tile exists", !!ebTile);
  ok("atk-cantrip: EB kind=attack", ebTile && ebTile.kind === "attack");
  ok("atk-cantrip: EB hit=5 (hitMod, not recomputed)", ebTile && ebTile.hit === 5);
  ok("atk-cantrip: EB dmg=1d10", ebTile && ebTile.dmg === "1d10");
  ok("atk-cantrip: EB rng=24 (from SPELL_COMBAT)", ebTile && ebTile.rng === 24);
  ok("atk-cantrip: EB spell=true", ebTile && ebTile.spell === true);
  ok("atk-cantrip: EB critDice=2d10", ebTile && ebTile.critDice === "2d10");

  var vmTile = tiles.filter(function (t) { return t.label === "Vicious Mockery"; })[0];
  ok("dmg-only: VM tile exists", !!vmTile);
  ok("dmg-only: VM kind=save (re-kinded)", vmTile && vmTile.kind === "save");
  ok("dmg-only: VM dc=13", vmTile && vmTile.dc === 13);
  ok("dmg-only: VM saveAbility=wis", vmTile && vmTile.saveAbility === "wis");
  ok("dmg-only: VM dmg=1d4", vmTile && vmTile.dmg === "1d4");
  ok("dmg-only: VM rider=vm (from SPELL_COMBAT)", vmTile && vmTile.rider === "vm");

  // Verify weapon rows still compute normally alongside spell rows
  var mixedAssembled = [
    { id: "w-longsword", label: "Longsword", ability: "str", dmgDice: "1d8", dmgType: "slashing", proficient: true },
    { id: "sp-eldritchblast", type: "attack-cantrip", label: "Eldritch Blast", hitMod: 5, dmgMod: 0, dmgDice: "1d10", critDice: "2d10", dmgType: "force" }
  ];
  var mixTiles = FKD.attackTiles(VES_CHAR.structural, mixedAssembled);
  var sword = mixTiles.filter(function (t) { return t.label === "Longsword"; })[0];
  ok("mixed: Longsword still computes hit from str+prof", sword && sword.hit === (4 + 2)); // str=4, prof=2
  var ebMix = mixTiles.filter(function (t) { return t.label === "Eldritch Blast"; })[0];
  ok("mixed: EB uses hitMod directly", ebMix && ebMix.hit === 5);
})();

// 20. Cantrip scaling in spellTiles (level-dependent)
(function testCantripScaling() {
  // Level 3 (Cosmere) → mult=1
  var cosKit = FKD.derive(COSMERE_CHAR);
  var eb3 = (cosKit.tabs.spells || []).filter(function (t) { return t.label === "Eldritch Blast"; })[0];
  ok("cantrip-scale: EB at level 3 = 1d10", eb3 && eb3.dmg === "1d10");

  // Level 5 → mult=2 (2d10)
  var lvl5 = JSON.parse(JSON.stringify(COSMERE_CHAR));
  lvl5.structural.level = 5;
  var kit5 = FKD.derive(lvl5);
  var eb5 = (kit5.tabs.spells || []).filter(function (t) { return t.label === "Eldritch Blast"; })[0];
  ok("cantrip-scale: EB at level 5 = 2d10", eb5 && eb5.dmg === "2d10");

  // Level 11 → mult=3 (3d10)
  var lvl11 = JSON.parse(JSON.stringify(COSMERE_CHAR));
  lvl11.structural.level = 11;
  var kit11 = FKD.derive(lvl11);
  var eb11 = (kit11.tabs.spells || []).filter(function (t) { return t.label === "Eldritch Blast"; })[0];
  ok("cantrip-scale: EB at level 11 = 3d10", eb11 && eb11.dmg === "3d10");

  // VM at level 4 → 1d4 (mult=1)
  var liaKit = FKD.derive(LIADAN_CHAR);
  var vm4 = (liaKit.tabs.spells || []).filter(function (t) { return t.label === "Vicious Mockery"; })[0];
  ok("cantrip-scale: VM at level 4 = 1d4", vm4 && vm4.dmg === "1d4");

  // VM at level 5 → 2d4
  var lvl5L = JSON.parse(JSON.stringify(LIADAN_CHAR));
  lvl5L.structural.level = 5;
  var kit5L = FKD.derive(lvl5L);
  var vm5 = (kit5L.tabs.spells || []).filter(function (t) { return t.label === "Vicious Mockery"; })[0];
  ok("cantrip-scale: VM at level 5 = 2d4", vm5 && vm5.dmg === "2d4");
})();

// ── summary ──────────────────────────────────────────────────────────────
console.log("smoke-kit-derive: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
