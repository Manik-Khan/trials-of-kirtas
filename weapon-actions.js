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

export function buildWeaponActions(inventory, structural) {
  structural = structural || {};
  var ab = structural.abilities || {};
  var modOf = function (k) { var a = ab[k]; return a && a.mod != null ? a.mod : 0; };
  // proficiencies.weapons is an array on forged characters but a comma-separated string
  // on legacy/migrated ones — normalize both to a lowercased list.
  var rawW = (structural.proficiencies && structural.proficiencies.weapons) || [];
  var profList = (Array.isArray(rawW) ? rawW : String(rawW).split(',')).map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean);
  var hasSimple = profList.some(function (p) { return p === 'simple weapons' || p === 'simple'; });
  var hasMartial = profList.some(function (p) { return p === 'martial weapons' || p === 'martial'; });
  // class weapon profs are plural ("daggers"), the table keys singular ("dagger"); race
  // profs are singular. Match either way by also keying the de-pluralized form.
  var profSet = {}; profList.forEach(function (p) { profSet[p] = 1; profSet[p.replace(/s$/, '')] = 1; });

  var out = [], seen = {};
  (inventory || []).forEach(function (it) {
    var key = normalizeWeaponName(it && it.name);
    var w = WEAPONS[key];
    if (!w || !w.dmg1 || seen[key]) return;     // unknown / damage-less / already added
    seen[key] = 1;
    var label = titleCaseName(key);
    // to-hit ability: ranged uses Dex; finesse uses the better of Str/Dex; else Str
    var ability = w.ranged ? 'dex' : (w.finesse ? (modOf('dex') >= modOf('str') ? 'dex' : 'str') : 'str');
    var proficient = (w.cat === 'simple' && hasSimple) || (w.cat === 'martial' && hasMartial) || !!profSet[key];
    out.push(action('wpn-' + key, label, w, w.dmg1, ability, proficient));
    if (w.versatile && w.dmg2) out.push(action('wpn-' + key + '-2h', label + ' (Two-Handed)', w, w.dmg2, ability, proficient));
  });
  return out;
}
