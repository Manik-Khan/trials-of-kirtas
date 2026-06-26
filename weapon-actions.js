// weapon-actions.js
// ---------------------------------------------------------------------------
// Turns the weapons in a character's inventory into sheet attack actions, live.
// The SRD weapon set is small and fixed, so the table below is static and the
// whole computation is synchronous — no fetch — which keeps the sheet a pure
// renderer (and keeps this unit testable under Node).
//
// Each entry: dmg1 (one-handed dice), dmg2 (versatile two-handed dice, if any),
// dmgType, cat (simple|martial → proficiency), ranged, and the property flags
// that change the to-hit ability (finesse) or the attack shape (thrown/2H/reach).
//
// buildWeaponActions(inventory, structural) -> [ action ] in the sheet's shape:
//   { id, type:'attack', label, ability, proficient, atkBonus, dmgAbility,
//     dmgBonus, dmgDice, dmgType }.  Versatile weapons emit TWO actions (a
//   one-handed entry and a "(Two-Handed)" entry with the larger die).
// ---------------------------------------------------------------------------

export const WEAPONS = {
  // ── simple melee ──
  'club':            { cat: 'simple',  ranged: false, dmg1: '1d4',  dmgType: 'Bludgeoning', light: true },
  'dagger':          { cat: 'simple',  ranged: false, dmg1: '1d4',  dmgType: 'Piercing', finesse: true, light: true, thrown: true, range: '20/60' },
  'greatclub':       { cat: 'simple',  ranged: false, dmg1: '1d8',  dmgType: 'Bludgeoning', twoHanded: true },
  'handaxe':         { cat: 'simple',  ranged: false, dmg1: '1d6',  dmgType: 'Slashing', light: true, thrown: true, range: '20/60' },
  'javelin':         { cat: 'simple',  ranged: false, dmg1: '1d6',  dmgType: 'Piercing', thrown: true, range: '30/120' },
  'light hammer':    { cat: 'simple',  ranged: false, dmg1: '1d4',  dmgType: 'Bludgeoning', light: true, thrown: true, range: '20/60' },
  'mace':            { cat: 'simple',  ranged: false, dmg1: '1d6',  dmgType: 'Bludgeoning' },
  'quarterstaff':    { cat: 'simple',  ranged: false, dmg1: '1d6',  dmg2: '1d8',  dmgType: 'Bludgeoning', versatile: true },
  'sickle':          { cat: 'simple',  ranged: false, dmg1: '1d4',  dmgType: 'Slashing', light: true },
  'spear':           { cat: 'simple',  ranged: false, dmg1: '1d6',  dmg2: '1d8',  dmgType: 'Piercing', thrown: true, versatile: true, range: '20/60' },
  // ── simple ranged ──
  'light crossbow':  { cat: 'simple',  ranged: true,  dmg1: '1d8',  dmgType: 'Piercing', twoHanded: true, range: '80/320' },
  'dart':            { cat: 'simple',  ranged: true,  dmg1: '1d4',  dmgType: 'Piercing', finesse: true, thrown: true, range: '20/60' },
  'shortbow':        { cat: 'simple',  ranged: true,  dmg1: '1d6',  dmgType: 'Piercing', twoHanded: true, range: '80/320' },
  'sling':           { cat: 'simple',  ranged: true,  dmg1: '1d4',  dmgType: 'Bludgeoning', range: '30/120' },
  // ── martial melee ──
  'battleaxe':       { cat: 'martial', ranged: false, dmg1: '1d8',  dmg2: '1d10', dmgType: 'Slashing', versatile: true },
  'flail':           { cat: 'martial', ranged: false, dmg1: '1d8',  dmgType: 'Bludgeoning' },
  'glaive':          { cat: 'martial', ranged: false, dmg1: '1d10', dmgType: 'Slashing', twoHanded: true, reach: true },
  'greataxe':        { cat: 'martial', ranged: false, dmg1: '1d12', dmgType: 'Slashing', twoHanded: true },
  'greatsword':      { cat: 'martial', ranged: false, dmg1: '2d6',  dmgType: 'Slashing', twoHanded: true },
  'halberd':         { cat: 'martial', ranged: false, dmg1: '1d10', dmgType: 'Slashing', twoHanded: true, reach: true },
  'lance':           { cat: 'martial', ranged: false, dmg1: '1d12', dmgType: 'Piercing', reach: true },
  'longsword':       { cat: 'martial', ranged: false, dmg1: '1d8',  dmg2: '1d10', dmgType: 'Slashing', versatile: true },
  'maul':            { cat: 'martial', ranged: false, dmg1: '2d6',  dmgType: 'Bludgeoning', twoHanded: true },
  'morningstar':     { cat: 'martial', ranged: false, dmg1: '1d8',  dmgType: 'Piercing' },
  'pike':            { cat: 'martial', ranged: false, dmg1: '1d10', dmgType: 'Piercing', twoHanded: true, reach: true },
  'rapier':          { cat: 'martial', ranged: false, dmg1: '1d8',  dmgType: 'Piercing', finesse: true },
  'scimitar':        { cat: 'martial', ranged: false, dmg1: '1d6',  dmgType: 'Slashing', finesse: true, light: true },
  'shortsword':      { cat: 'martial', ranged: false, dmg1: '1d6',  dmgType: 'Piercing', finesse: true, light: true },
  'trident':         { cat: 'martial', ranged: false, dmg1: '1d6',  dmg2: '1d8',  dmgType: 'Piercing', thrown: true, versatile: true, range: '20/60' },
  'war pick':        { cat: 'martial', ranged: false, dmg1: '1d8',  dmgType: 'Piercing' },
  'warhammer':       { cat: 'martial', ranged: false, dmg1: '1d8',  dmg2: '1d10', dmgType: 'Bludgeoning', versatile: true },
  'whip':            { cat: 'martial', ranged: false, dmg1: '1d4',  dmgType: 'Slashing', finesse: true, reach: true },
  // ── martial ranged ──
  'blowgun':         { cat: 'martial', ranged: true,  dmg1: '1',    dmgType: 'Piercing', range: '25/100' },
  'hand crossbow':   { cat: 'martial', ranged: true,  dmg1: '1d6',  dmgType: 'Piercing', light: true, range: '30/120' },
  'heavy crossbow':  { cat: 'martial', ranged: true,  dmg1: '1d10', dmgType: 'Piercing', twoHanded: true, range: '100/400' },
  'longbow':         { cat: 'martial', ranged: true,  dmg1: '1d8',  dmgType: 'Piercing', twoHanded: true, range: '150/600' }
  // (Net deals no damage; it produces no attack action.)
};
function titleCaseName(key) {
  return String(key).split(' ').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
}

// Inventory names can carry decoration: "Longsword (your choice)", a "+1" prefix,
// or a magic name ("Longsword of Warning"). Strip the decoration, then match the
// table — first by the whole cleaned string, else by the longest weapon noun in it.
export function normalizeWeaponName(raw) {
  var s = String(raw == null ? '' : raw).toLowerCase();
  s = s.replace(/\s*\([^)]*\)/g, ' ');        // drop "(your choice)" / "(two-handed)" etc.
  s = s.replace(/\s*\+\d+\s*/g, ' ');         // drop "+1"
  s = s.replace(/\s+/g, ' ').trim();
  if (WEAPONS[s]) return s;
  var words = s.split(' ');
  for (var i = 0; i < words.length; i++) { var suf = words.slice(i).join(' '); if (WEAPONS[suf]) return suf; }   // "longsword of warning" -> ... -> "longsword"? no
  for (var j = words.length; j > 0; j--) { var pre = words.slice(0, j).join(' '); if (WEAPONS[pre]) return pre; } // "longsword of warning" -> "longsword"
  return s;
}

function action(id, label, w, dice, ability, proficient) {
  return {
    id: id, type: 'attack', label: label,
    ability: ability, proficient: !!proficient, atkBonus: 0,
    dmgAbility: true, dmgBonus: 0, dmgDice: dice, dmgType: w.dmgType
  };
}

function abilModOf(structural, k) { var a = (structural.abilities || {})[k]; return a && a.mod != null ? a.mod : 0; }
function weaponProfList(structural) {
  // proficiencies.weapons is an array on forged characters but a comma-separated string
  // on legacy/migrated ones — normalize both to a lowercased list.
  var rawW = (structural.proficiencies && structural.proficiencies.weapons) || [];
  return (Array.isArray(rawW) ? rawW : String(rawW).split(',')).map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean);
}
// to-hit ability + proficiency for one weapon, shared by weapon attacks and weapon-cantrips.
function weaponProfile(w, key, structural) {
  var profList = weaponProfList(structural);
  var hasSimple = profList.some(function (p) { return p === 'simple weapons' || p === 'simple'; });
  var hasMartial = profList.some(function (p) { return p === 'martial weapons' || p === 'martial'; });
  // class profs are plural ("daggers"), the table keys singular ("dagger"); race profs are
  // singular. Match either way by also keying the de-pluralized form.
  var profSet = {}; profList.forEach(function (p) { profSet[p] = 1; profSet[p.replace(/s$/, '')] = 1; });
  // ranged→Dex; finesse→better of Str/Dex; else Str
  var ability = w.ranged ? 'dex' : (w.finesse ? (abilModOf(structural, 'dex') >= abilModOf(structural, 'str') ? 'dex' : 'str') : 'str');
  var proficient = (w.cat === 'simple' && hasSimple) || (w.cat === 'martial' && hasMartial) || !!profSet[key];
  return { ability: ability, proficient: proficient };
}

export function buildWeaponActions(inventory, structural) {
  structural = structural || {};
  var out = [], seen = {};
  (inventory || []).forEach(function (it) {
    var key = normalizeWeaponName(it && it.name);
    var w = WEAPONS[key];
    if (!w || !w.dmg1 || seen[key]) return;     // unknown / damage-less / already added
    seen[key] = 1;
    var label = titleCaseName(key);
    var pr = weaponProfile(w, key, structural);
    out.push(action('wpn-' + key, label, w, w.dmg1, pr.ability, pr.proficient));
    if (w.versatile && w.dmg2) out.push(action('wpn-' + key + '-2h', label + ' (Two-Handed)', w, w.dmg2, pr.ability, pr.proficient));
  });
  return out;
}

// ── Weapon cantrips (Booming Blade / Green-Flame Blade) ─────────────────────
// These SCAG cantrips are a melee WEAPON attack with a rider. We surface them as an
// attack action that rolls the chosen melee weapon (its real to-hit + die + ability
// damage) — exactly like a hand-built weapon-cantrip action — and carry the rider as a
// reminder in the damage-type label (the rider is usually conditional, so it's noted,
// not auto-rolled). Derived LIVE from the carried weapon + known cantrips, same as
// weapon attacks, so a looted weapon updates them on the next render.
var WEAPON_CANTRIPS = {
  'booming blade':     { rider: 'thunder', cond: 'on move' },
  'green-flame blade': { rider: 'fire',    cond: 'leaps to a 2nd creature' },
  'green flame blade': { rider: 'fire',    cond: 'leaps to a 2nd creature' }
};
// Known cantrip names, lowercased. Forged chars carry them in spellcasting.groups (the
// level-0 group); legacy chars in spells.cantrip. Read both.
function knownCantripSet(structural) {
  var out = {}, sc = structural.spellcasting || {};
  (sc.groups || []).forEach(function (g) {
    if ((g.level || 0) === 0 || /cantrip/i.test(g.heading || '')) {
      (g.spells || []).forEach(function (sp) { if (sp && sp.name) out[String(sp.name).trim().toLowerCase()] = 1; });
    }
  });
  var legacy = (structural.spells && structural.spells.cantrip) || [];
  legacy.forEach(function (sp) { var nm = (sp && sp.name) || sp; if (nm) out[String(nm).trim().toLowerCase()] = 1; });
  return out;
}
function firstMeleeWeapon(inventory) {
  var found = null;
  (inventory || []).some(function (it) {
    var key = normalizeWeaponName(it && it.name), w = WEAPONS[key];
    if (w && w.dmg1 && !w.ranged) { found = { key: key, w: w }; return true; }
    return false;
  });
  return found;
}
function titleCantrip(cn) { return cn.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

export function buildCantripAttacks(inventory, structural) {
  structural = structural || {};
  var known = knownCantripSet(structural);
  var melee = firstMeleeWeapon(inventory);
  if (!melee) return [];                       // weapon cantrips need a melee weapon in hand
  var level = structural.level || 0;
  var pb = structural.proficiencyBonus || 0;
  var spellMod = ((structural.combat || {}).spellAttackBonus != null) ? (structural.combat.spellAttackBonus - pb) : 0;
  var pr = weaponProfile(melee.w, melee.key, structural);
  var wLabel = titleCaseName(melee.key), wType = melee.w.dmgType;
  var out = [];
  Object.keys(WEAPON_CANTRIPS).forEach(function (cn) {
    if (!known[cn]) return;
    var spec = WEAPON_CANTRIPS[cn], nice = titleCantrip(cn), note;
    if (spec.rider === 'thunder') {
      var d8 = level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0;   // 2014 scaling 5/11/17
      note = wType + (d8 ? (' + ' + d8 + 'd8 thunder (' + spec.cond + ')') : ' (booming)');
    } else {
      var extra = level >= 5 ? ' + 1d8' : '';
      note = wType + ' + ' + (spellMod >= 0 ? '+' : '') + spellMod + ' fire' + extra + ' (' + spec.cond + ')';
    }
    out.push({
      id: 'cant-' + cn.replace(/[^a-z]+/g, '') + '-' + melee.key.replace(/\s+/g, ''),
      type: 'attack', label: nice + ' \u00B7 ' + wLabel,
      ability: pr.ability, proficient: pr.proficient, atkBonus: 0,
      dmgAbility: true, dmgBonus: 0, dmgDice: melee.w.dmg1, dmgType: note
    });
  });
  return out;
}

// ── The ONE action list ─────────────────────────────────────────────────────
// The renderer (renderActions) and the click handler (sheet-actions.js's allActions)
// MUST build their list the same way, or a painted row whose id the clicker can't
// resolve silently no-ops. This is the single source of truth both call. Order:
// weapon attacks, then weapon-cantrip attacks, then structural.actions (feature /
// cantrip / manual). When the action editor lands, its overrides apply HERE.
export function assembleActions(inventory, structural) {
  structural = structural || {};
  return buildWeaponActions(inventory, structural)
    .concat(buildCantripAttacks(inventory, structural))
    .concat(structural.actions || []);
}
