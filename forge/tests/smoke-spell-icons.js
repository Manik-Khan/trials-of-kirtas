/* smoke-spell-icons.js — Validates spell-icons.js contract:
   no-collision with item-icons.js, category coverage, iconFor resolution.
   Pure headless — no DOM, no Supabase.                                    */

// ── load both registries (they self-attach to `window` / global) ────────
const g = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : {});
g.window = g;
require('../../item-icons.js');
require('../../spell-icons.js');
const ItemIcons  = g.ItemIcons;
const SpellIcons = g.SpellIcons;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log("  FAIL " + name); } }

// ── 1. Both registries loaded ────────────────────────────────────────────
ok("load: ItemIcons loaded",  !!ItemIcons  && !!ItemIcons.BODIES);
ok("load: SpellIcons loaded", !!SpellIcons && !!SpellIcons.BODIES);

// ── 2. NO COLLISION: SpellIcons ∩ ItemIcons names = ∅ ────────────────────
(function testNoCollision() {
  var itemNames = new Set(Object.keys(ItemIcons.BODIES));
  var spellNames = Object.keys(SpellIcons.BODIES);
  var collisions = spellNames.filter(function (n) { return itemNames.has(n); });
  ok("no-collision: SpellIcons ∩ ItemIcons = ∅ (found " + collisions.length + ")",
     collisions.length === 0);
  if (collisions.length) console.log("    collisions: " + collisions.join(", "));
})();

// ── 3. Contract parity: same API shape as ItemIcons ──────────────────────
ok("contract: SpellIcons.CATEGORIES is an object", typeof SpellIcons.CATEGORIES === 'object');
ok("contract: SpellIcons.CATEGORY_DEFAULT is an object", typeof SpellIcons.CATEGORY_DEFAULT === 'object');
ok("contract: SpellIcons.iconFor is a function", typeof SpellIcons.iconFor === 'function');
ok("contract: SpellIcons.iconSvg is a function", typeof SpellIcons.iconSvg === 'function');

// ── 4. Every glyph in a category exists in BODIES ────────────────────────
(function testCategoryCoverage() {
  var missing = [];
  Object.keys(SpellIcons.CATEGORIES).forEach(function (cat) {
    SpellIcons.CATEGORIES[cat].forEach(function (name) {
      if (!SpellIcons.BODIES[name]) missing.push(cat + ":" + name);
    });
  });
  ok("categories: every glyph in CATEGORIES exists in BODIES (" + missing.length + " missing)",
     missing.length === 0);
  if (missing.length) console.log("    missing: " + missing.join(", "));
})();

// ── 5. Every CATEGORY_DEFAULT exists in BODIES ───────────────────────────
(function testDefaults() {
  var missing = [];
  Object.keys(SpellIcons.CATEGORY_DEFAULT).forEach(function (cat) {
    var name = SpellIcons.CATEGORY_DEFAULT[cat];
    if (!SpellIcons.BODIES[name]) missing.push(cat + ":" + name);
  });
  ok("defaults: every CATEGORY_DEFAULT exists in BODIES", missing.length === 0);
})();

// ── 6. iconFor: party spell coverage ─────────────────────────────────────
(function testPartySpells() {
  // Every spell on the four PCs' current lists must get a genuinely fitting glyph
  var partySpells = [
    // Vesperian (EK)
    "Booming Blade", "Shield", "Find Familiar",
    // Cosmere (Hexblade/Sorc)
    "Eldritch Blast", "Hex", "Armor of Agathys",
    // Líadan (Bard/Cleric)
    "Vicious Mockery", "Mending", "Healing Word", "Cure Wounds",
    "Silvery Barbs", "Bless", "Heat Metal", "Shatter",
    // Class features (universal / party-specific)
    "Second Wind", "Action Surge", "Flurry of Blows",
    "Patient Defense", "Step of the Wind", "Hands of Healing",
    "Dash", "Disengage", "Dodge", "Help", "Ready"
  ];
  partySpells.forEach(function (name) {
    var glyph = SpellIcons.iconFor({ name: name });
    // Should NOT fall through to the arcane default for named spells
    var isDefault = glyph === SpellIcons.CATEGORY_DEFAULT.arcane;
    ok("party: " + name + " → '" + glyph + "' (not generic default)",
       !!glyph && SpellIcons.BODIES[glyph] && !isDefault);
  });
})();

// ── 7. iconFor: fallback for unknown spells ──────────────────────────────
(function testFallback() {
  var glyph = SpellIcons.iconFor({ name: "Zzzyxxx Unknown Spell" });
  ok("fallback: unknown spell → arcane default", glyph === SpellIcons.CATEGORY_DEFAULT.arcane);

  // School-based fallback
  var necro = SpellIcons.iconFor({ name: "Some Necro Spell", school: "necromancy" });
  ok("fallback: necromancy school → necrotic default",
     necro === SpellIcons.CATEGORY_DEFAULT.necrotic);
})();

// ── 8. iconSvg: produces valid SVG string ────────────────────────────────
(function testIconSvg() {
  var svg = SpellIcons.iconSvg("fire-bolt", 30);
  ok("iconSvg: starts with <svg", svg.indexOf("<svg") === 0);
  ok("iconSvg: contains viewBox", svg.indexOf("viewBox") !== -1);
  ok("iconSvg: contains width=30", svg.indexOf('width="30"') !== -1);
  ok("iconSvg: contains fill=currentColor", svg.indexOf('fill="currentColor"') !== -1);
  // Unknown glyph falls back to default
  var fallback = SpellIcons.iconSvg("zzz-nonexistent", 24);
  ok("iconSvg: unknown glyph → fallback SVG", fallback.indexOf("<svg") === 0);
})();

// ── 9. SPELL_KEYWORDS: every value exists in BODIES ──────────────────────
(function testKeywordBodies() {
  var missing = [];
  Object.keys(SpellIcons.SPELL_KEYWORDS).forEach(function (kw) {
    var name = SpellIcons.SPELL_KEYWORDS[kw];
    if (!SpellIcons.BODIES[name]) missing.push(kw + " → " + name);
  });
  ok("keywords: every SPELL_KEYWORDS target exists in BODIES (" + missing.length + " missing)",
     missing.length === 0);
  if (missing.length) console.log("    missing: " + missing.join(", "));
})();

// ── 10. Glyph count sanity ──────────────────────────────────────────────
(function testGlyphCount() {
  var count = Object.keys(SpellIcons.BODIES).length;
  ok("count: >= 80 glyphs (has " + count + ")", count >= 80);
})();

// ── summary ──────────────────────────────────────────────────────────────
console.log("smoke-spell-icons: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
