/* smoke-feed-render.js — Known-answer smokes for forge-feed-render.js
   (§5 of the BG3 HUD spec: feed-row builder — facts → body HTML:
   verdicts, kept/dropped, mods, the SB row, no "AC" substring anywhere.)

   Pure logic, no DOM.                                                     */
const FFR = require("../forge-feed-render.js");

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log("  FAIL " + name); } }

function nameOf(k) { return ({ vesperian: "Vesperian", goblin_1: "Goblin 1", cosmere: "Cosmere", liadan: "Líadan" })[k] || k; }
var ctx = { unitName: nameOf };

// ── 1. VERDICT BADGES ───────────────────────────────────────────────────
(function testVerdicts() {
  // Crit hit
  var v = FFR.verdictBadge({ roll: 20, crit: true, hit: true });
  ok("verdict: crit", v.label === "✶ CRIT");

  // Normal hit
  v = FFR.verdictBadge({ roll: 15, hit: true });
  ok("verdict: hit", v.label === "HIT");

  // Miss
  v = FFR.verdictBadge({ roll: 5, hit: false });
  ok("verdict: miss", v.label === "MISS");

  // Nat 1 miss
  v = FFR.verdictBadge({ roll: 1, hit: false });
  ok("verdict: nat 1", v.label === "NAT 1");

  // Save (target saves)
  v = FFR.verdictBadge({ kind: "save", saved: true });
  ok("verdict: save", v.label === "SAVE");

  // Fail (target fails save)
  v = FFR.verdictBadge({ kind: "save", saved: false });
  ok("verdict: fail", v.label === "FAIL");
})();

// ── 2. ATTACK ROLL BODY ────────────────────────────────────────────────
(function testAttackBody() {
  var fact = {
    actor: "vesperian", target: "goblin_1", mode: "Longsword",
    roll: 17, hitBonus: 6, hit: true, crit: false,
    dmg: 12, dmgParts: [{ rolls: [6], bonus: 6, type: "Slashing", total: 12 }]
  };
  var html = FFR.rollBody(fact, ctx);

  // Head line
  ok("attack: has actor name", html.indexOf("Vesperian") !== -1);
  ok("attack: has target name", html.indexOf("Goblin 1") !== -1);
  ok("attack: has arrow", html.indexOf("\u2192") !== -1);
  ok("attack: has mode", html.indexOf("Longsword") !== -1);
  ok("attack: has HIT badge", html.indexOf("HIT") !== -1);

  // d20 math
  ok("attack: has d20 roll (17)", html.indexOf("17") !== -1);
  ok("attack: has hit bonus (+6)", html.indexOf("+6") !== -1);
  ok("attack: has total (= 23)", html.indexOf("= 23") !== -1);

  // Damage
  ok("attack: has damage total (12)", html.indexOf("12 dmg") !== -1);

  // NO AC
  ok("attack: no AC in output", FFR.assertNoAC(html));
})();

// ── 3. CRIT ATTACK ──────────────────────────────────────────────────────
(function testCritBody() {
  var fact = {
    actor: "vesperian", target: "goblin_1", mode: "Longsword",
    roll: 20, hitBonus: 6, hit: true, crit: true,
    dmg: 20, dmgParts: [{ rolls: [6, 5], bonus: 6, type: "Slashing", total: 17 },
                         { rolls: [3], bonus: 0, type: "Slashing", total: 3 }]
  };
  var html = FFR.rollBody(fact, ctx);
  ok("crit: has CRIT badge", html.indexOf("CRIT") !== -1);
  ok("crit: has crit star", html.indexOf("\u2736") !== -1);
  ok("crit: no AC", FFR.assertNoAC(html));
})();

// ── 4. MISS ─────────────────────────────────────────────────────────────
(function testMissBody() {
  var fact = {
    actor: "goblin_1", target: "vesperian", mode: "Scimitar",
    roll: 4, hitBonus: 4, hit: false, crit: false
  };
  var html = FFR.rollBody(fact, ctx);
  ok("miss: has MISS badge", html.indexOf("MISS") !== -1);
  ok("miss: no damage in output", html.indexOf("dmg") === -1);
  ok("miss: no AC", FFR.assertNoAC(html));
})();

// ── 5. ADVANTAGE WITH REASON ────────────────────────────────────────────
(function testAdvBody() {
  var fact = {
    actor: "vesperian", target: "goblin_1", mode: "Longsword",
    roll: 18, dropped: 7, hitBonus: 6, hit: true, crit: false,
    adv: true, advReason: "flanking",
    dmg: 10
  };
  var html = FFR.rollBody(fact, ctx);
  ok("adv: has adv tag", html.indexOf("\u21d1 adv") !== -1);
  ok("adv: has reason", html.indexOf("flanking") !== -1);
  ok("adv: kept die (18)", html.indexOf("18") !== -1);
  ok("adv: dropped die (7) struck through", html.indexOf("ffr-drop") !== -1 && html.indexOf("7") !== -1);
  ok("adv: no AC", FFR.assertNoAC(html));
})();

// ── 6. DISADVANTAGE ─────────────────────────────────────────────────────
(function testDisBody() {
  var fact = {
    actor: "cosmere", target: "goblin_1", mode: "Eldritch Blast",
    roll: 5, dropped: 16, hitBonus: 5, hit: false, crit: false,
    dis: true, dmg: null
  };
  var html = FFR.rollBody(fact, ctx);
  ok("dis: has dis tag", html.indexOf("\u21d3 dis") !== -1);
  ok("dis: dropped die visible", html.indexOf("16") !== -1);
  ok("dis: no AC", FFR.assertNoAC(html));
})();

// ── 7. COVER TAG ────────────────────────────────────────────────────────
(function testCoverBody() {
  var fact = {
    actor: "vesperian", target: "goblin_1", mode: "Shortbow",
    roll: 14, hitBonus: 6, hit: true, crit: false,
    coverName: "half", dmg: 8
  };
  var html = FFR.rollBody(fact, ctx);
  ok("cover: has cover word", html.indexOf("half") !== -1);
  ok("cover: cover is a mod tag", html.indexOf("ffr-mod-cover") !== -1);
  // The cover word is there, but NOT +2 or +5 — that's the target's AC
  ok("cover: no +2 in cover tag", !/cover.*\+2/.test(html));
  ok("cover: no AC", FFR.assertNoAC(html));
})();

// ── 8. BLESS MOD ────────────────────────────────────────────────────────
(function testBlessBody() {
  var fact = {
    actor: "vesperian", target: "goblin_1", mode: "Longsword",
    roll: 12, hitBonus: 6, hit: true, crit: false,
    mods: [{ k: "bless", v: 3 }], dmg: 10
  };
  var html = FFR.rollBody(fact, ctx);
  ok("bless: has bless icon", html.indexOf("\ud83d\ude4f") !== -1);
  ok("bless: has bless value", html.indexOf("+3") !== -1);
  ok("bless: no AC", FFR.assertNoAC(html));
})();

// ── 9. SILVERY BARBS ROW ────────────────────────────────────────────────
(function testSBBody() {
  var fact = {
    actor: "goblin_1", target: "cosmere", mode: "Scimitar",
    roll: 12, dropped: 18, hitBonus: 4, hit: false, crit: false,
    adv: false, dis: false,
    mods: [{ k: "silvery_barbs" }], dmg: null
  };
  var html = FFR.rollBody(fact, ctx);
  ok("sb: has silvery barbs tag", html.indexOf("silvery barbs") !== -1);
  ok("sb: has ffr-mod-sb class", html.indexOf("ffr-mod-sb") !== -1);
  ok("sb: no AC", FFR.assertNoAC(html));
})();

// ── 10. SAVE (spell save) ───────────────────────────────────────────────
(function testSaveBody() {
  var fact = {
    actor: "liadan", target: "goblin_1", mode: "Vicious Mockery",
    kind: "save", saveAbility: "wis", dc: 13, saveRoll: 8,
    saved: false, dmg: 3,
    dmgParts: [{ rolls: [3], bonus: 0, type: "Psychic", total: 3 }]
  };
  var html = FFR.rollBody(fact, ctx);
  ok("save: has FAIL badge", html.indexOf("FAIL") !== -1);
  ok("save: has save ability", html.indexOf("WIS") !== -1);
  ok("save: has DC", html.indexOf("DC 13") !== -1);
  ok("save: has damage", html.indexOf("3 dmg") !== -1);
  ok("save: no AC", FFR.assertNoAC(html));
})();

// ── 11. HEAL ────────────────────────────────────────────────────────────
(function testHealBody() {
  var fact = {
    actor: "liadan", target: "vesperian", mode: "Healing Word",
    heal: 7
  };
  var html = FFR.rollBody(fact, ctx);
  ok("heal: has heal amount", html.indexOf("+7 hp") !== -1);
  ok("heal: has target", html.indexOf("Vesperian") !== -1);
  ok("heal: no AC", FFR.assertNoAC(html));
})();

// ── 12. ABILITY BODY (non-roll) ─────────────────────────────────────────
(function testAbilityBody() {
  var fact = {
    actor: "vesperian", ability: "Second Wind",
    effects: [{ unit: "vesperian", heal: 8 }]
  };
  var html = FFR.abilityBody(fact, ctx);
  ok("ability: has actor", html.indexOf("Vesperian") !== -1);
  ok("ability: has ability name", html.indexOf("Second Wind") !== -1);
  ok("ability: has heal effect", html.indexOf("+8 hp") !== -1);
  ok("ability: no AC", FFR.assertNoAC(html));
})();

// ── 13. MULTI-STRIKE DAMAGE STACK ───────────────────────────────────────
(function testMultiStrikeDmg() {
  // Simulates a 4d8 hit (e.g. crit or multi-die spell)
  var fact = {
    actor: "vesperian", target: "goblin_1", mode: "Greatsword",
    roll: 15, hitBonus: 6, hit: true, crit: true,
    dmg: 28,
    dmgParts: [{ rolls: [5, 3, 6, 2], bonus: 4, type: "Slashing", total: 20 },
               { rolls: [4, 4], bonus: 0, type: "Slashing", total: 8 }]
  };
  var html = FFR.rollBody(fact, ctx);
  ok("multi-dmg: has total", html.indexOf("28 dmg") !== -1);
  ok("multi-dmg: has detail block", html.indexOf("ffr-dmg-detail") !== -1);
  ok("multi-dmg: detail has individual rolls", html.indexOf("[5]") !== -1 && html.indexOf("[3]") !== -1);
  ok("multi-dmg: no AC", FFR.assertNoAC(html));
})();

// ── 14. NULL / EMPTY FACT ───────────────────────────────────────────────
(function testNullFact() {
  ok("null: rollBody(null) → ''", FFR.rollBody(null) === "");
  ok("null: rollBody({}) → non-empty", FFR.rollBody({}).length > 0);
  ok("null: abilityBody(null) → ''", FFR.abilityBody(null) === "");
})();

// ── 15. NO-AC INVARIANT (batch) ─────────────────────────────────────────
(function testNoACBatch() {
  var facts = [
    { actor: "a", target: "b", mode: "X", roll: 15, hitBonus: 6, hit: true, dmg: 10 },
    { actor: "a", target: "b", mode: "X", roll: 5, hitBonus: 4, hit: false, coverName: "three-quarters" },
    { actor: "a", target: "b", mode: "X", kind: "save", dc: 15, saveAbility: "dex", saved: true },
    { actor: "a", ability: "Heal", effects: [{ unit: "a", heal: 5 }] }
  ];
  facts.forEach(function (f, i) {
    var html = FFR.rollBody(f, ctx) + FFR.abilityBody(f, ctx);
    ok("noAC batch[" + i + "]: no standalone AC", FFR.assertNoAC(html));
  });
})();

// ── 16. CSS OWNED ───────────────────────────────────────────────────────
(function testCSS() {
  ok("css: non-empty", FFR.CSS.length > 100);
  ok("css: has ffr-row", FFR.CSS.indexOf(".ffr-row") !== -1);
  ok("css: has verdict styles", FFR.CSS.indexOf(".ffr-v-hit") !== -1);
})();

// ── summary ──────────────────────────────────────────────────────────────
console.log("smoke-feed-render: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
