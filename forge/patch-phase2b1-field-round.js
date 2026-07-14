#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

function once(text, re, replacement, label) {
  if (!re.test(text)) throw new Error("Phase 2b.1 patch guard failed: " + label);
  re.lastIndex = 0;
  return text.replace(re, replacement);
}

function patchWeaponActions(text) {
  if (text.includes("function duelingBonus(structural")) return text;
  text = once(text, /function weaponProfList\(structural\)\s*\{/,
`function fightingStyle(structural, name) {
  var cf = (structural && structural.classFeatures) || {};
  var raw = cf.fightingStyle == null ? [] : (Array.isArray(cf.fightingStyle) ? cf.fightingStyle : [cf.fightingStyle]);
  var needle = String(name || '').toLowerCase();
  if (raw.some(function (v) { return String(v || '').toLowerCase().indexOf(needle) !== -1; })) return true;
  return hasFeature(structural || {}, needle);
}
function duelingBonus(structural, w, twoHandedMode) {
  return fightingStyle(structural, 'dueling') && w && !w.ranged && !w.twoHanded && !twoHandedMode ? 2 : 0;
}
function weaponProfList(structural) {`, "weapon-actions fighting-style insertion");

  text = once(text, /function deck\(id,\s*lbl,\s*dice\)\s*\{/,
    "function deck(id, lbl, dice, twoHandedMode) {", "weapon-actions deck signature");
  text = once(text, /a\.dmgBonus\s*=\s*dmgB\s*;/,
    "a.dmgBonus = dmgB + duelingBonus(structural, w, !!twoHandedMode);", "weapon-actions one-hand damage bonus");
  text = once(text,
    /deck\(\s*'wpn-'\s*\+\s*key\s*\+\s*'-2h'\s*,\s*label\s*\+\s*' \(Two-Handed\)'\s*,\s*w\.dmg2\s*\)/,
    "deck('wpn-' + key + '-2h', label + ' (Two-Handed)', w.dmg2, true)",
    "weapon-actions two-handed carve-out");
  text = once(text,
    /var atkB\s*=\s*\(\+item\.atkBonus\)\s*\|\|\s*0,\s*dmgB\s*=\s*\(\+item\.dmgBonus\)\s*\|\|\s*0;\s*var act/,
    "var atkB = (+item.atkBonus) || 0, dmgB = (+item.dmgBonus) || 0; dmgB += duelingBonus(structural, w, false); var act",
    "weapon-cantrip Dueling bonus");
  return text;
}

function patchKitDerive(text) {
  if (!text.includes("weaponCantripKey")) {
    text = once(text,
      /function _dedupeKey\(label\)\s*\{\s*return String\(label \|\| ""\)\.toLowerCase\(\)\.replace\(\/\\u2019\/g, "'"\)\.replace\(\/\\s\+\/g, " "\)\.trim\(\);\s*\}/,
`function weaponCantripKey(label) {
  var k = String(label || "").toLowerCase().replace(/\\u2019/g, "'").replace(/\\s+/g, " ").trim();
  if (/^booming blade(?:\\s*[·-].*)?$/.test(k)) return "booming blade";
  if (/^green[- ]flame blade(?:\\s*[·-].*)?$/.test(k)) return "green-flame blade";
  return k;
}
function _dedupeKey(label) { return weaponCantripKey(label); }`,
      "forge-kit semantic weapon-cantrip dedupe");
  }
  if (!text.includes("w._derivedId=w.id")) {
    text = once(text,
      /w\._folded\s*=\s*w\._folded\s*\|\|\s*\[\];\s*w\._folded\.push\(t\._src\s*\|\|\s*t\);/,
`w._folded = w._folded || [];
      w._folded.push(t._src || t);
      // Preserve saved default-slot ids while the live derived cantrip owns the math.
      if ((k === "booming blade" || k === "green-flame blade") && /^(cant-)/.test(String(w.id || "")) && t.id) {
        if (!w._derivedId) w._derivedId=w.id;
        w.id=t.id;
      }`,
      "forge-kit legacy cantrip id compatibility");
  }
  return text;
}

function patchTableCorrectness(text) {
  if (!text.includes("dmgParts:p.dmgParts")) {
    text = once(text, /heal:p\.heal,dmg:p\.dmg,narration:/,
      "heal:p.heal,dmg:p.dmg,dmgParts:p.dmgParts||null,narration:",
      "table correctness ability damage parts");
    text = once(text, /dmg:p\.dmg,adv:/,
      "dmg:p.dmg,dmgParts:p.dmgParts||null,adv:",
      "table correctness attack damage parts");
  }
  if (!text.includes("state.coverContestAvailable")) {
    text = once(text,
      /state\.pending&&state\.pending\.kind==="attack"&&!state\.suppressEnemyHud/,
      'state.pending&&state.pending.kind==="attack"&&state.coverContestAvailable&&!state.suppressEnemyHud',
      "cover contest visibility gate");
  }
  return text;
}

function patchFeedRender(text) {
  if (text.includes(".ffr-dmg-detail { display:block;")) return text;
  return once(text,
    /\.ffr-dmg-detail \{ display:none;/,
    ".ffr-dmg-detail { display:block;",
    "damage evidence visible by default");
}

function buildPlan(file, transform) {
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  return { file, before, after, changed: after !== before };
}

function main() {
  const root = path.resolve(__dirname, "..");
  const targets = [
    [path.join(root, "weapon-actions.js"), patchWeaponActions],
    [path.join(__dirname, "forge-kit-derive.js"), patchKitDerive],
    [path.join(__dirname, "forge-table-correctness.js"), patchTableCorrectness],
    [path.join(__dirname, "forge-feed-render.js"), patchFeedRender]
  ];

  // Validate every guard and build every replacement before writing anything.
  // A stale source shape therefore cannot leave the repository half-patched.
  const plans = targets.map(function (entry) { return buildPlan(entry[0], entry[1]); });
  plans.forEach(function (plan) {
    if (plan.changed) fs.writeFileSync(plan.file, plan.after);
    console.log(plan.changed ? "patched" : "unchanged", path.relative(process.cwd(), plan.file));
  });
  console.log("Phase 2b.1 field-round external-module patch complete.");
}

module.exports = { patchWeaponActions, patchKitDerive, patchTableCorrectness, patchFeedRender };
if (require.main === module) main();
