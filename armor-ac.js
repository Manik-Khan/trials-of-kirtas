// armor-ac.js
// ---------------------------------------------------------------------------
// Derives Armour Class (and the armour-driven speed / stealth / proficiency
// consequences) LIVE from a character's inventory — the same shape as
// weapon-actions.js: the SRD armour set is small and fixed, so the table below
// is static and the whole computation is synchronous (no fetch), which keeps it
// a pure renderer input and unit-testable under Node.
//
// Loads as a browser global (window.ArmorAC) AND a CommonJS module
// (module.exports) — the dice-engine.js pattern — so the ES-module sheet
// (sheet-mount.js, via window.ArmorAC), the plain-script Forge derive
// (soul-shards-derive.js), and the Node smokes can all share one source.
//
// deriveAC(inventory, structural) -> {
//   ac,                  // final Armour Class
//   source,              // subtitle line: "Scale Mail + Shield" / "Unarmored Defense (Monk)"
//   speedPenalty,        // 0 or 10 — worn Str-requirement armour the wearer's Str can't meet
//   speedReason,         // "Plate requires Str 15"
//   stealthDisadvantage, // worn armour imposes Stealth disadvantage (per-armour flag; Mithral waives)
//   notProficient,       // worn armour/shield the wearer lacks proficiency with
//   profReason,          // "Not proficient with Heavy Armor"
//   body, shield         // the chosen body-armour name / whether a shield is worn (debug + tests)
// }
// ---------------------------------------------------------------------------
(function (global) {
  'use strict';

  // 2014 PHB armour. base = AC the armour sets; cat drives the Dex rule
  // (light = full Dex, medium = Dex capped +2, heavy = no Dex); str = the
  // Strength score below which speed drops 10 ft; stealth = imposes
  // disadvantage on Dex (Stealth) checks; shields contribute `bonus`.
  var ARMOR = {
    // ── light: base + full Dex ──
    'padded':          { base: 11, cat: 'light',  stealth: true },
    'leather':         { base: 11, cat: 'light' },
    'studded leather': { base: 12, cat: 'light' },
    // ── medium: base + Dex (max +2) ──
    'hide':            { base: 12, cat: 'medium' },
    'chain shirt':     { base: 13, cat: 'medium' },
    'scale mail':      { base: 14, cat: 'medium', stealth: true },
    'breastplate':     { base: 14, cat: 'medium' },
    'half plate':      { base: 15, cat: 'medium', stealth: true },
    // ── heavy: flat base, no Dex ──
    'ring mail':       { base: 14, cat: 'heavy',  stealth: true },
    'chain mail':      { base: 16, cat: 'heavy',  stealth: true, str: 13 },
    'splint':          { base: 17, cat: 'heavy',  stealth: true, str: 15 },
    'plate':           { base: 18, cat: 'heavy',  stealth: true, str: 15 },
    // ── shield ──
    'shield':          { bonus: 2, cat: 'shield' }
  };
  // 5etools item `type` codes → our category, for armour that isn't in the table
  // (homebrew / unusual magic items carry `type` + `ac` from the data enrichment).
  var TYPE_CAT = { LA: 'light', MA: 'medium', HA: 'heavy', S: 'shield' };

  function titleCase(s) {
    return String(s).split(' ').map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join(' ');
  }
  // Strip decoration the way weapon-actions does, but capture the magic "+N" first
  // so a "+1 Plate" / "Plate +1" still resolves to the base armour AND adds the bonus.
  function parseName(raw) {
    var s = String(raw == null ? '' : raw).toLowerCase();
    var mithral = /\bmith(?:ral|ril)\b/.test(s);
    var mm = s.match(/\+(\d+)/);
    var magic = mm ? parseInt(mm[1], 10) : 0;
    s = s.replace(/\s*\([^)]*\)/g, ' ').replace(/\s*\+\d+\s*/g, ' ').replace(/\bmith(?:ral|ril)\b/g, ' ').replace(/\s+/g, ' ').trim();
    return { clean: s, magic: magic, mithral: mithral };
  }
  // Match the cleaned name to the table: whole string, else the longest trailing
  // noun ("glamoured studded leather" -> "studded leather"; "plate of etherealness" -> "plate").
  function tableMatch(clean) {
    if (ARMOR[clean]) return clean;
    var words = clean.split(' ');
    for (var i = 0; i < words.length; i++) { var suf = words.slice(i).join(' '); if (ARMOR[suf]) return suf; }
    for (var j = words.length; j > 0; j--) { var pre = words.slice(0, j).join(' '); if (ARMOR[pre]) return pre; }
    return null;
  }

  // Resolve one inventory item to an armour descriptor, or null if it isn't armour.
  // Table entry is authoritative (base/cat/str/stealth) + parsed magic; otherwise
  // fall back to the item's own enriched `ac`/`type`/`strength`/`stealth` fields.
  function classifyArmor(it) {
    if (!it || !it.name) return null;
    var p = parseName(it.name);
    var key = tableMatch(p.clean);
    if (key) {
      var a = ARMOR[key];
      return {
        name: titleCase(key), cat: a.cat,
        base: a.base || 0, bonus: a.bonus || 0,
        str: p.mithral ? 0 : (a.str || 0),
        stealth: p.mithral ? false : !!a.stealth,
        magic: p.magic, mithral: p.mithral,
        equipped: !!it.equipped
      };
    }
    // not in the table — accept an enriched armour item by its type code
    var cat = TYPE_CAT[it.type];
    if (!cat || it.ac == null) return null;
    return {
      name: titleCase(p.clean || it.name), cat: cat,
      base: cat === 'shield' ? 0 : (+it.ac || 0),
      bonus: cat === 'shield' ? (+it.ac || 0) : 0,
      // item.ac on an enriched piece already folds any magic in, so don't double-add.
      str: p.mithral ? 0 : (+it.strength || 0),
      stealth: p.mithral ? false : !!it.stealth,
      magic: 0, mithral: p.mithral,
      equipped: !!it.equipped
    };
  }

  // Of several candidates, take the equipped one if ANY are flagged, else the best
  // (highest base for body armour / highest bonus for shields). This honours an
  // explicit equip choice when present but still works for the migrated PCs whose
  // armour carries no equipped flag — "you're wearing the best you own."
  function pickWorn(list, scoreKey) {
    if (!list.length) return null;
    var flagged = list.filter(function (x) { return x.equipped; });
    var pool = flagged.length ? flagged : list;
    return pool.reduce(function (best, x) { return (best == null || (x[scoreKey] + x.magic) > (best[scoreKey] + best.magic)) ? x : best; }, null);
  }

  function abilMod(structural, k) { var a = (structural.abilities || {})[k]; return (a && a.mod != null) ? a.mod : 0; }
  function strScore(structural) {
    var a = (structural.abilities || {}).str;
    if (a && a.score != null) return a.score;
    if (a && a.mod != null) return 10 + 2 * a.mod;   // lossy fallback; the score is what we want
    return 10;
  }
  // Armour-proficiency set from structural.proficiencies.armor (array OR comma string;
  // "All Armor" => every category). Shields are their own proficiency.
  function armorProf(structural) {
    var raw = (structural.proficiencies && structural.proficiencies.armor) || [];
    var list = (Array.isArray(raw) ? raw : String(raw).split(',')).map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean);
    var prof = { light: false, medium: false, heavy: false, shield: false };
    list.forEach(function (p) {
      if (p === 'all armor' || p === 'all') { prof.light = prof.medium = prof.heavy = true; }
      else if (/^light/.test(p)) prof.light = true;
      else if (/^medium/.test(p)) prof.medium = true;
      else if (/^heavy/.test(p)) prof.heavy = true;
      else if (/^shield/.test(p)) prof.shield = true;
    });
    return prof;
  }
  // Unarmored Defense source (2014 PHB core): Monk = +Wis, Barbarian = +Con.
  // Read the class label so multiclass ("Fighter 3 / Monk 2") still detects it.
  function unarmoredKind(structural) {
    var label = String(structural.classLabel || '');
    if (/\bMonk\b/i.test(label)) return 'Monk';
    if (/\bBarbarian\b/i.test(label)) return 'Barbarian';
    return null;
  }

  function deriveAC(inventory, structural) {
    structural = structural || {};
    inventory = inventory || [];
    var dex = abilMod(structural, 'dex');

    var bodies = [], shields = [];
    inventory.forEach(function (it) {
      var info = classifyArmor(it); if (!info) return;
      (info.cat === 'shield' ? shields : bodies).push(info);
    });
    var body = pickWorn(bodies, 'base');
    var shield = pickWorn(shields, 'bonus');
    var prof = armorProf(structural);

    var out = {
      ac: 0, source: '', speedPenalty: 0, speedReason: null,
      stealthDisadvantage: false, notProficient: false, profReason: null,
      body: body ? body.name : null, shield: !!shield
    };

    var shieldBonus = shield ? (shield.bonus + shield.magic) : 0;

    if (body) {
      var dexPart = body.cat === 'light' ? dex : (body.cat === 'medium' ? Math.min(dex, 2) : 0);
      out.ac = body.base + dexPart + body.magic + shieldBonus;
      out.source = body.name + (shield ? ' + Shield' : '');
      out.stealthDisadvantage = body.stealth;
      // speed drop only for a worn heavy armour that lists a Str score the wearer can't meet
      if (body.cat === 'heavy' && body.str && strScore(structural) < body.str) {
        out.speedPenalty = 10; out.speedReason = body.name + ' requires Str ' + body.str;
      }
    } else {
      // no body armour — Unarmored Defense (if any) or bare 10 + Dex.
      // A Monk loses Unarmored Defense while wielding a shield (it requires no shield);
      // a Barbarian keeps it with a shield.
      var kind = unarmoredKind(structural);
      var udBonus = 0;
      if (kind === 'Monk' && !shield) udBonus = abilMod(structural, 'wis');
      else if (kind === 'Barbarian') udBonus = abilMod(structural, 'con');
      out.ac = 10 + dex + udBonus + shieldBonus;
      out.source = (udBonus ? ('Unarmored Defense (' + kind + ')') : 'Unarmored') + (shield ? ' + Shield' : '');
    }

    // Non-proficiency: wearing body armour you lack proficiency with, OR a shield
    // you lack Shields proficiency with → disadvantage on Str/Dex d20s and can't
    // cast (we surface the warning; we don't auto-lock the spell UI in this pass).
    var bad = [];
    if (body && !prof[body.cat]) bad.push(titleCase(body.cat) + ' Armor');
    if (shield && !prof.shield) bad.push('Shields');
    if (bad.length) { out.notProficient = true; out.profReason = 'Not proficient with ' + bad.join(' + '); }

    return out;
  }

  var API = { ARMOR: ARMOR, deriveAC: deriveAC, classifyArmor: classifyArmor };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ArmorAC = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
