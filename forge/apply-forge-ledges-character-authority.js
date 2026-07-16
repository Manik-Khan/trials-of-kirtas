#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundleRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(process.argv[2] || process.cwd());
const staged = new Map();

function fail(message) {
  throw new Error('PATCH ABORTED: ' + message);
}
function abs(rel) { return path.join(repoRoot, rel); }
function readDisk(rel) {
  const file = abs(rel);
  if (!fs.existsSync(file)) fail(`${rel} not found`);
  return fs.readFileSync(file, 'utf8');
}
function get(rel) { return staged.has(rel) ? staged.get(rel) : readDisk(rel); }
function stage(rel, text) { staged.set(rel, text); }
function stageBundle(rel) {
  const src = path.join(bundleRoot, rel);
  if (!fs.existsSync(src)) fail(`bundle file missing: ${rel}`);
  stage(rel, fs.readFileSync(src, 'utf8'));
}
function globalRegex(re) {
  return new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
}
function matchCount(text, re) {
  return Array.from(text.matchAll(globalRegex(re))).length;
}
function replaceExact(text, re, replacement, expected, label) {
  const count = matchCount(text, re);
  if (count !== expected) fail(`${label}: expected ${expected} match(es), found ${count}; main may have moved — do not force the patch`);
  return text.replace(re, replacement);
}
function htmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function patchGeometry() {
  const rel = 'forge/tactics-geometry.js';
  let src = get(rel);

  src = replaceExact(src,
    /function segAttrib\([\s\S]*?(?=\/\* v1 name kept)/,
`function traceTop(map, c, r, ignoreCell) {
  // A legal parapet lean forgives only the ADDED occluder. The terrain
  // beneath it still exists and can block a steep downward shot.
  if (ignoreCell && c === ignoreCell.c && r === ignoreCell.r) return heightAt(map, c, r);
  return occTop(map, c, r);
}
function segAttrib(map, x0, y0, z0, x1, y1, z1, a, b, ignoreCell) {
  var steps = 240, blocked = false, graded = false;
  for (var s = 1; s < steps; s++) {
    var t = s / steps;
    var x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
    var c = Math.floor(x), r = Math.floor(y);
    if ((c === a.c && r === a.r) || (c === b.c && r === b.r)) continue;
    if (traceTop(map, c, r, ignoreCell) > z + 1e-9) {
      blocked = true;
      var cell = { c: c, r: r };
      if (chebyshev(cell, b) <= chebyshev(cell, a)) { graded = true; break; }
    }
  }
  return { blocked: blocked, graded: graded };
}
`, 1, 'segAttrib block');

  src = replaceExact(src,
    /function lipCorners\([\s\S]*?(?=function verdictFromEye\()/,
`function lipCorners(map, c, r) {
  var floor = heightAt(map, c, r), out = [];
  for (var k = 0; k < CORNERS.length; k++) {
    var dx = CORNERS[k][0] ? 1 : -1, dy = CORNERS[k][1] ? 1 : -1;
    if (occTop(map, c + dx, r) < floor - 1e-9 ||
        occTop(map, c, r + dy) < floor - 1e-9 ||
        occTop(map, c + dx, r + dy) < floor - 1e-9) {
      out.push([c + CORNERS[k][0], r + CORNERS[k][1]]);
    }
  }
  return out;
}

/* Target-facing shared edges. A ledge lean requires a CARDINAL edge the
   attacker actually shares with the parapet cell. At an exact 45-degree shot
   both cardinal edges are candidates; the diagonal cell is never ignored. */
function targetFacingEdges(a, b) {
  var dx = (b.c + 0.5) - (a.c + 0.5), dy = (b.r + 0.5) - (a.r + 0.5);
  var ax = Math.abs(dx), ay = Math.abs(dy), out = [];
  if (ax < 1e-12 && ay < 1e-12) return out;
  if (ax >= ay - 1e-12 && ax > 1e-12) {
    var sx = dx > 0 ? 1 : -1;
    out.push({ c: a.c + sx, r: a.r, x: a.c + (sx > 0 ? 1 : 0), y: a.r + 0.5, edge: 'x' });
  }
  if (ay >= ax - 1e-12 && ay > 1e-12) {
    var sy = dy > 0 ? 1 : -1;
    out.push({ c: a.c, r: a.r + sy, x: a.c + 0.5, y: a.r + (sy > 0 ? 1 : 0), edge: 'y' });
  }
  return out;
}

function lowWallPeeks(map, a, b) {
  var edges = targetFacingEdges(a, b), z = heightAt(map, a.c, a.r) + EYE_FT;
  var out = [], hasFacingWall = false;
  for (var i = 0; i < edges.length; i++) {
    var e = edges[i];
    if (!inBounds(map, e.c, e.r) || (e.c === b.c && e.r === b.r) || !isWall(map, e.c, e.r)) continue;
    hasFacingWall = true;
    if (occTop(map, e.c, e.r) < z - 1e-9) {
      out.push({ x: e.x, y: e.y, z: z, peek: true, stepOut: true, ignore: { c: e.c, r: e.r }, edge: e.edge });
    }
  }
  return { eyes: out, hasFacingWall: hasFacingWall };
}

function targetFacingLipCorners(map, a, b) {
  var lips = lipCorners(map, a.c, a.r);
  if (!lips.length) return lips;
  var dx = (b.c + 0.5) - (a.c + 0.5), dy = (b.r + 0.5) - (a.r + 0.5);
  var best = -Infinity, scores = [];
  for (var i = 0; i < lips.length; i++) {
    var sx = lips[i][0] - (a.c + 0.5), sy = lips[i][1] - (a.r + 0.5);
    var score = sx * dx + sy * dy;
    scores.push(score);
    if (score > best) best = score;
  }
  return lips.filter(function (_, i) { return scores[i] >= best - 1e-9; });
}

function firingPoints(map, a, b) {
  var z = heightAt(map, a.c, a.r) + EYE_FT;
  var wall = lowWallPeeks(map, a, b);
  // A target-facing shared-edge wall owns the ruling. Low walls yield only
  // their legal edge step-outs; tall walls yield none. Do not fall through to
  // a numerical corner graze around the same obstruction.
  if (wall.hasFacingWall) return wall.eyes;

  var out = [], lips = targetFacingLipCorners(map, a, b);
  for (var i = 0; i < lips.length; i++) {
    out.push({ x: lips[i][0], y: lips[i][1], z: z, peek: true, stepOut: false, ignore: null, edge: 'lip' });
  }
  return out;
}

`, 1, 'ledge helper block');

  src = replaceExact(src,
    /function verdictFromEye\([\s\S]*?(?=function losVerdict\()/,
`function verdictFromEye(map, ax, ay, az, a, b, ignoreCell) {
  // Cover is what the TARGET hides behind (M's ruling, 2026-07-11, round 3):
  // a blocking cell GRADES cover (the half/three-quarters counts, and the
  // centre-line check) only when it sits at least as close to the target as
  // to the attacker — a midfield tie grades, defender's benefit. An
  // obstruction on the shooter's side is the shooter's VANTAGE problem
  // (step up / lean — the ledge-peek eye), not the target's AC, so it adds
  // nothing to the grade. Wall height and size enter through the line count
  // itself; there is no other constant. TOTAL is unchanged: all 8 corner
  // lines blocked by anything anywhere is dead ground — cannot target.
  var bh = heightAt(map, b.c, b.r);
  var zHead = bh + EYE_FT, zFeet = bh + FOOT_FT;
  var blocked = 0, graded = 0;
  for (var tc = 0; tc < CORNERS.length; tc++) {
    var bx = b.c + CORNERS[tc][0], by = b.r + CORNERS[tc][1];
    var hl = segAttrib(map, ax, ay, az, bx, by, zHead, a, b, ignoreCell);
    if (hl.blocked) { blocked++; if (hl.graded) graded++; }
    var fl = segAttrib(map, ax, ay, az, bx, by, zFeet, a, b, ignoreCell);
    if (fl.blocked) { blocked++; if (fl.graded) graded++; }
  }
  var cl = segAttrib(map, ax, ay, az, b.c + 0.5, b.r + 0.5,
    bh + (EYE_FT + FOOT_FT) / 2, a, b, ignoreCell);
  var centerGraded = cl.graded;
  var cover, acBonus;
  if (blocked >= 8) { cover = "total"; acBonus = Infinity; }
  else if (graded === 0) { cover = "none"; acBonus = 0; }
  else if (graded <= 4 && !centerGraded) { cover = "half"; acBonus = 2; }
  else { cover = "three-quarters"; acBonus = 5; }
  return { cover: cover, acBonus: acBonus, blocked: blocked, canTarget: cover !== "total" };
}
`, 1, 'verdictFromEye block');

  src = replaceExact(src,
    /function losVerdict\([\s\S]*?(?=\/\* center-to-center ray)/,
`function losVerdict(map, a, b) {
  // Centre eye first. Legal alternate firing points are evaluated and the
  // winning eye/ignore metadata rides back so the visible line uses the same
  // geometry that authorised the shot.
  var az = heightAt(map, a.c, a.r) + EYE_FT;
  var v = verdictFromEye(map, a.c + 0.5, a.r + 0.5, az, a, b, null);
  v.eye = { x: a.c + 0.5, y: a.r + 0.5, z: az, peek: false, stepOut: false, ignore: null, edge: null };
  if (v.acBonus === 0) return v;

  var eyes = firingPoints(map, a, b);
  for (var e = 0; e < eyes.length; e++) {
    var eye = eyes[e];
    // The parapet's cap may be forgiven; its terrain may not. Reject this
    // alternate eye when the centre sight ray hits the ignored cell's berm.
    var probe = eye.ignore ? losRay(map, a, b, eye) : null;
    if (probe && probe.blocked && probe.at && probe.at.c === eye.ignore.c && probe.at.r === eye.ignore.r) continue;
    var w = verdictFromEye(map, eye.x, eye.y, eye.z, a, b, eye.ignore || null);
    if (w.acBonus < v.acBonus || (w.acBonus === v.acBonus && w.blocked < v.blocked)) {
      w.eye = eye;
      v = w;
    }
    if (v.acBonus === 0) break;
  }
  return v;
}
`, 1, 'losVerdict block');

  src = replaceExact(src,
    /function losRay\([\s\S]*?(?=var API\s*=)/,
`function losRay(map, a, b, eye) {
  var x0 = (eye && eye.x != null) ? eye.x : a.c + 0.5;
  var y0 = (eye && eye.y != null) ? eye.y : a.r + 0.5;
  var z0 = (eye && eye.z != null) ? eye.z : heightAt(map, a.c, a.r) + EYE_FT;
  var x1 = b.c + 0.5, y1 = b.r + 0.5, z1 = heightAt(map, b.c, b.r) + EYE_FT;
  var ignoreCell = eye && eye.ignore;
  var steps = 240;
  for (var s = 1; s < steps; s++) {
    var t = s / steps;
    var c = Math.floor(x0 + (x1 - x0) * t), r = Math.floor(y0 + (y1 - y0) * t);
    if ((c === a.c && r === a.r) || (c === b.c && r === b.r)) continue;
    if (traceTop(map, c, r, ignoreCell) > z0 + (z1 - z0) * t + 1e-9) {
      return { blocked: true, at: { c: c, r: r } };
    }
  }
  return { blocked: false, at: null };
}
`, 1, 'losRay block');

  src = replaceExact(src,
    /lipCorners:\s*lipCorners(?:,\s*[^}]*)?\s*}/,
    'lipCorners: lipCorners, targetFacingEdges: targetFacingEdges, lowWallPeeks: lowWallPeeks, firingPoints: firingPoints }',
    1, 'TacticsGeo API tail');

  stage(rel, src);
  return src;
}

function geometryIife(src) {
  const re = /;\(function\s*\(global\)\s*\{[\s\S]*?global\.TacticsGeo\s*=\s*API;\s*}\)\(typeof window !== ["']undefined["'] \? window : globalThis\);/;
  const m = src.match(re);
  if (!m) fail('could not extract canonical TacticsGeo IIFE');
  return { text: m[0], re };
}

function syncGeometryIntoMocks(canonical) {
  const extracted = geometryIife(canonical);
  ['forge/battle-tactics-geo-mock.html', 'forge/index.html'].forEach(rel => {
    let html = get(rel);
    html = replaceExact(html, extracted.re, extracted.text, 1, `${rel} TacticsGeo inline`);
    stage(rel, html);
  });
}

function patchForgeKit() {
  const rel = 'forge/forge-kit-derive.js';
  let src = get(rel);

  src = replaceExact(src,
    /\/\/ ── combat stats ─+[\s\S]*?(?=\/\/ ── resource map & display pools)/,
`// ── combat stats ────────────────────────────────────────────────────────
function characterCombatApi() {
  if (typeof CharacterCombat !== "undefined" && CharacterCombat && typeof CharacterCombat.derive === "function") return CharacterCombat;
  if (typeof globalThis !== "undefined" && globalThis.CharacterCombat && typeof globalThis.CharacterCombat.derive === "function") return globalThis.CharacterCombat;
  if (typeof require === "function") {
    try { return require('../character-combat.js'); }
    catch (err) { if (typeof console !== "undefined" && console.warn) console.warn('CharacterCombat require failed', err); }
  }
  return null;
}
function combatStats(s, inventory, vitals, charData) {
  var cc = characterCombatApi();
  if (!cc) {
    var missing = new Error('CharacterCombat unavailable; refusing cached combat fields');
    missing.code = 'FORGE_CHARACTER_COMBAT_MISSING';
    throw missing;
  }
  return cc.derive(charData || { structural: s, inventory: inventory || [], vitals: vitals || {} });
}
function escapeCombatError(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function surfaceCombatError(charData, err) {
  var name = (charData && (charData.name || (charData.structural || {}).name || charData.key)) || 'Unknown character';
  var message = 'Character data unavailable — ' + name + ': ' + ((err && err.message) || err || 'unknown projection error');
  if (typeof console !== 'undefined' && console.error) console.error(message, err);
  if (typeof globalThis !== 'undefined') {
    try {
      if (typeof globalThis.addForgeRow === 'function') {
        globalThis.addForgeRow('<div class="ffr-body"><b>' + escapeCombatError(name) + '</b><br>' + escapeCombatError(message) + '</div>');
      }
    } catch (_) { /* feed may not be mounted yet */ }
    try {
      if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
        globalThis.dispatchEvent(new globalThis.CustomEvent('forge:characterDataError', { detail: { key: charData && charData.key || null, name: name, message: message, error: err } }));
      }
    } catch (_) { /* non-browser */ }
  }
  return message;
}
function combatErrorKit(charData, err) {
  var name = (charData && (charData.name || (charData.structural || {}).name || charData.key)) || 'Unknown character';
  var message = surfaceCombatError(charData, err);
  var errorTile = { id: 'character-data-error', label: 'Character data unavailable', kind: 'utility', tab: 'actions', greyed: true, reason: message, description: message };
  return {
    key: charData && charData.key || null,
    name: '⚠ ' + name,
    hp: 0, maxHp: 0, ac: 0, speed: 0, init: 0, fly: false, climb: false,
    res: {}, react: null, actions: [],
    tabs: { attacks: [], spells: [], items: [], feats: [], actions: [errorTile], bonus: [] },
    pools: [], spellcasting: null, derived: false, fallback: 'error', unavailable: true,
    loadError: message
  };
}
`, 1, 'combat-stats section');

  src = replaceExact(src,
    /var stats = combatStats\(s\);/,
`var stats;
  try { stats = combatStats(s, inv, v, charData); }
  catch (combatErr) {
    if (opts && typeof opts.onCharacterError === 'function') {
      try { opts.onCharacterError(combatErr, charData); } catch (_) { /* caller hook is non-fatal */ }
    }
    return combatErrorKit(charData, combatErr);
  }`,
    1, 'derive combatStats call');

  src = replaceExact(src,
    /var hp\s+=\s+v\.hp\s+!= null \? v\.hp\s+: \(\(s\.combat \|\| \{\}\)\.maxHp \|\| \(s\.combat \|\| \{\}\)\.hpMax \|\| 10\);\s*\n\s*var maxHp = v\.maxHp != null \? v\.maxHp : \(\(s\.combat \|\| \{\}\)\.maxHp \|\| \(s\.combat \|\| \{\}\)\.hpMax \|\| 10\);/,
    `var hp    = stats.hp;\n    var maxHp = stats.maxHp;`,
    1, 'HP projection block');

  src = replaceExact(src,
    /ac:\s+stats\.ac,\s*\n\s*speed:\s+stats\.speed,/,
    `ac:           stats.ac,
      acSource:     stats.acSource || null,
      sourceUpdatedAt: stats.sourceUpdatedAt || charData.updatedAt || charData.updated_at || null,
      speed:        stats.speed,`,
    1, 'ForgeKit AC return fields');

  stage(rel, src);
}

function patchKitFixtures() {
  // The old fixtures pinned cached structural.combat.ac with armorless
  // inventories. Under database character authority AC derives from
  // inventory, so the fixtures now carry the party's REAL gear (per the
  // nightly data/characters export, 2026-07-12). All four AC pins keep their
  // existing values — 18/16/18/12 — but become derived instead of cached.
  const rel = 'forge/tests/smoke-kit-derive.js';
  let src = get(rel);
  if (src.includes('"Scale Mail"')) { stage(rel, src); return; }

  src = replaceExact(src,
    /inventory: \[\n    \{ name: "Longsword", type: "weapon" \},\n    \{ name: "Shortbow", type: "weapon" \},/,
`inventory: [
    { name: "Scale Mail", type: "MA" },   // real gear: 14 + Dex(cap 2) + shield = AC 18, derived
    { name: "Shield", type: "S" },
    { name: "Longsword", type: "weapon" },
    { name: "Shortbow", type: "weapon" },`,
    1, 'Vesperian fixture inventory');

  src = replaceExact(src,
    /wis: \{ score: 14, mod: 2 \}, cha: \{ score: 12, mod: 1 \} \},/,
    'wis: { score: 16, mod: 3 }, cha: { score: 12, mod: 1 } }, // real Caim wis +3: Unarmored Defense 10+3+3 = 16',
    1, 'Caim fixture wisdom');

  src = replaceExact(src,
    /inventory: \[\n    \{ name: "Longsword", type: "weapon" \}\n  \]/,
`inventory: [
    { name: "Scale Mail", type: "MA" },   // real gear (Hexblade medium armor): 14 + 2 + 2 = AC 18, derived
    { name: "Shield", type: "S" },
    { name: "Longsword", type: "weapon" }
  ]`,
    1, 'Cosmere fixture inventory');

  src = replaceExact(src,
    /\{ name: "Sling", type: "weapon" \},/,
`{ name: "Leather Armor", type: "LA" },  // real gear: 11 + Dex 1 = AC 12, derived
    { name: "Sling", type: "weapon" },`,
    1, 'Líadan fixture inventory');

  stage(rel, src);
}

function walkHtml(dir, out) {
  out = out || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(ent => {
    if (ent.name === '.git' || ent.name === 'node_modules') return;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(p, out);
    else if (ent.isFile() && /\.html$/i.test(ent.name)) out.push(path.relative(repoRoot, p));
  });
  return out;
}
function relScript(htmlRel, rootFile) {
  let rel = path.relative(path.dirname(abs(htmlRel)), abs(rootFile)).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}
function scriptTags(html) {
  const out = [];
  const re = /<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/ig;
  let m;
  while ((m = re.exec(html))) out.push({ src: m[1], index: m.index, end: re.lastIndex, tag: m[0] });
  return out;
}
function baseScript(src) { return String(src || '').split(/[?#]/)[0].split('/').pop().toLowerCase(); }

function patchScriptOrder() {
  walkHtml(repoRoot).forEach(rel => {
    let html = get(rel);
    let tags = scriptTags(html);
    const forgeTags = tags.filter(t => baseScript(t.src) === 'forge-kit-derive.js');
    if (!forgeTags.length) return; // comments/docs that merely mention the filename are irrelevant

    const firstForge = forgeTags[0];
    const needed = [
      ['armor-ac.js', 'armor-ac.js'],
      ['equip-slots.js', 'equip-slots.js'],
      ['character-combat.js', 'character-combat.js']
    ];
    const before = tags.filter(t => t.index < firstForge.index).map(t => baseScript(t.src));
    const missing = needed.filter(([name]) => !before.includes(name));
    if (missing.length) {
      const deps = missing.map(([, rootFile]) => `<script src="${relScript(rel, rootFile)}?v=cc2"></script>`).join('\n');
      html = html.slice(0, firstForge.index) + deps + '\n' + html.slice(firstForge.index);
      stage(rel, html);
    }
  });
}

function verifyScriptOrder() {
  const htmlRels = walkHtml(repoRoot);
  htmlRels.forEach(rel => {
    const html = get(rel);
    const tags = scriptTags(html);
    tags.forEach((tag, i) => {
      if (baseScript(tag.src) !== 'forge-kit-derive.js') return;
      const before = tags.slice(0, i).map(t => baseScript(t.src));
      ['armor-ac.js', 'equip-slots.js', 'character-combat.js'].forEach(dep => {
        if (!before.includes(dep)) fail(`${rel}: ${dep} must load before forge-kit-derive.js`);
      });
    });
  });
}

function validateStaged() {
  verifyScriptOrder();
  const geo = get('forge/tactics-geometry.js');
  const canon = geometryIife(geo).text.replace(/\s+/g, ' ').trim();
  ['forge/battle-tactics-geo-mock.html', 'forge/index.html'].forEach(rel => {
    const inline = geometryIife(get(rel)).text.replace(/\s+/g, ' ').trim();
    if (inline !== canon) fail(`${rel}: inline TacticsGeo differs from canonical after staging`);
  });
  ['character-combat.js', 'forge/forge-kit-derive.js', 'forge/tactics-geometry.js'].forEach(rel => {
    if (!get(rel).trim()) fail(`${rel}: staged output is empty`);
  });
}

function commitStaged() {
  // Validation is complete before the first repository write. Every staged
  // file is written to a sibling temp path first; only then are temps renamed.
  const temps = [];
  try {
    for (const [rel, text] of staged.entries()) {
      const dest = abs(rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const temp = dest + `.forge-cc2-${process.pid}.tmp`;
      fs.writeFileSync(temp, text, 'utf8');
      temps.push({ rel, dest, temp });
    }
    for (const item of temps) {
      fs.renameSync(item.temp, item.dest);
      console.log('wrote', item.rel);
    }
  } catch (err) {
    temps.forEach(item => { try { if (fs.existsSync(item.temp)) fs.unlinkSync(item.temp); } catch (_) {} });
    throw err;
  }
}

function main() {
  if (!fs.existsSync(path.join(repoRoot, 'forge'))) fail(`not a trials-of-kirtas repo: ${repoRoot}`);
  console.log('Planning ledge + character-authority rev 2026-07-12f for', repoRoot);

  stageBundle('character-combat.js');
  stageBundle('forge/tests/smoke-character-combat.js');
  stageBundle('forge/tests/smoke-ledge-fire.js');
  stageBundle('CONTEXT_Forge-update-2026-07-12f.md');

  const canonical = patchGeometry();
  syncGeometryIntoMocks(canonical);
  patchForgeKit();
  patchKitFixtures();
  patchScriptOrder();
  validateStaged();
  commitStaged();

  console.log('\nPatch applied without committing or pushing. Run README_APPLY.md, inspect git diff, then M commits/pushes.');
}

try { main(); }
catch (err) {
  console.error('\n' + (err && err.message ? err.message : err));
  process.exit(1);
}
