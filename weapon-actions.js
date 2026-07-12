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
  s = s.replace(/[,;:.]/g, ' ');              // drop stray punctuation ("Longsword, +1" -> "longsword")
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
function hasFeature(structural, frag) {
  // true if any class/subclass/race feature or eldritch invocation name contains `frag` (lowercased)
  return (structural.features || []).some(function (f) { return String((f && f.name) || f || '').toLowerCase().indexOf(frag) !== -1; });
}
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
  // class features can override a MELEE weapon's attack ability (overridable per-item / per-attack):
  //   Hexblade's Hex Warrior \u2192 Charisma; Artificer Battle Smith (Battle Ready) \u2192 Intelligence.
  var ability;
  if (!w.ranged && hasFeature(structural, 'hex warrior')) ability = 'cha';
  else if (!w.ranged && (hasFeature(structural, 'battle ready') || hasFeature(structural, 'battle smith'))) ability = 'int';
  else ability = w.ranged ? 'dex' : (w.finesse ? (abilModOf(structural, 'dex') >= abilModOf(structural, 'str') ? 'dex' : 'str') : 'str');
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
    var label = (it && it.name) ? String(it.name).trim() : titleCaseName(key);
    var pr = weaponProfile(w, key, structural);
    // item-level combat carries from the equipment editor into the attack: magic to-hit/damage
    // bonuses, an extra-damage rider, and an optional pinned ability. The action editor still
    // overrides per-attack, and the pin beats the feature/property default.
    var atkB = (it && +it.atkBonus) || 0, dmgB = (it && +it.dmgBonus) || 0;
    var pin = (it && it.attackAbil) ? String(it.attackAbil).toLowerCase() : '';
    var hasExtra = !!(it && it.extraDmg && it.extraDmg.dice);
    var abil = pin || pr.ability;
    function deck(id, lbl, dice) {
      var a = action(id, lbl, w, dice, abil, pr.proficient);
      a.atkBonus = atkB; a.dmgBonus = dmgB;
      if (hasExtra) a.extraDamage = [{ dice: it.extraDmg.dice, bonus: 0, type: it.extraDmg.type || '' }];
      return a;
    }
    out.push(deck('wpn-' + key, label, w.dmg1));
    // The versatile two-handed mode is a real derived attack, but it ships HIDDEN so it
    // lives in the swap pile (one clean row per weapon); swap it in when you two-hand.
    if (w.versatile && w.dmg2) { var a2h = deck('wpn-' + key + '-2h', label + ' (Two-Handed)', w.dmg2); a2h.defaultHidden = true; out.push(a2h); }
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

function meleeItems(inventory) {
  // every melee weapon carried, as {key, w, item} — `item` carries any magic bonuses
  var out = [];
  (inventory || []).forEach(function (it) {
    var key = normalizeWeaponName(it && it.name), w = WEAPONS[key];
    if (w && w.dmg1 && !w.ranged) out.push({ key: key, w: w, item: it });
  });
  return out;
}

export function buildCantripAttacks(inventory, structural) {
  structural = structural || {};
  var known = knownCantripSet(structural);
  var melees = meleeItems(inventory);
  if (!melees.length) return [];               // weapon cantrips need a melee weapon in hand
  var binds = structural.cantripBinds || {};   // { '<cantrip>': '<weapon key>' } from the bind picker
  var level = structural.level || 0;
  var pb = structural.proficiencyBonus || 0;
  var spellMod = ((structural.combat || {}).spellAttackBonus != null) ? (structural.combat.spellAttackBonus - pb) : 0;
  var out = [];
  Object.keys(WEAPON_CANTRIPS).forEach(function (cn) {
    if (!known[cn]) return;
    // ride the pinned weapon if one is set and still carried, else the first melee weapon
    var bind = binds[cn] ? String(binds[cn]).toLowerCase() : '';
    var chosen = (bind && melees.filter(function (m) { return m.key === bind; })[0]) || melees[0];
    var w = chosen.w, key = chosen.key, item = chosen.item || {};
    var pr = weaponProfile(w, key, structural);
    var wLabel = (item.name ? String(item.name).trim() : titleCaseName(key)).replace(/ \(.*/, '');
    var wType = w.dmgType;
    var spec = WEAPON_CANTRIPS[cn], nice = titleCantrip(cn), note;
    if (spec.rider === 'thunder') {
      var d8 = level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0;   // 2014 scaling 5/11/17
      note = wType + (d8 ? (' + ' + d8 + 'd8 thunder (' + spec.cond + ')') : ' (booming)');
    } else {
      var extra = level >= 5 ? ' + 1d8' : '';
      note = wType + ' + ' + (spellMod >= 0 ? '+' : '') + spellMod + ' fire' + extra + ' (' + spec.cond + ')';
    }
    // the cantrip inherits the bound weapon's item-level magic (Booming Blade on a +1 sword gets the +1)
    var atkB = (+item.atkBonus) || 0, dmgB = (+item.dmgBonus) || 0;
    var act = {
      id: 'cant-' + cn.replace(/[^a-z]+/g, ''),
      type: 'attack', label: nice + ' \u00B7 ' + wLabel,
      ability: pr.ability, proficient: pr.proficient, atkBonus: atkB,
      dmgAbility: true, dmgBonus: dmgB, dmgDice: w.dmg1, dmgType: note
    };
    if (item.extraDmg && item.extraDmg.dice) act.extraDamage = [{ dice: item.extraDmg.dice, bonus: 0, type: item.extraDmg.type || '' }];
    out.push(act);
  });
  return out;
}

// Melee weapons carried, de-duped, as { key, name } — for the cantrip weapon-bind picker.
export function meleeWeaponOptions(inventory) {
  var seen = {}, out = [];
  meleeItems(inventory).forEach(function (m) {
    if (seen[m.key]) return; seen[m.key] = 1;
    out.push({ key: m.key, name: (m.item && m.item.name ? String(m.item.name).trim() : titleCaseName(m.key)) });
  });
  return out;
}

// ── Spell damage → live rollable actions ─────────────────────────────────────
// D&D-5e (2014) damaging spells, surfaced as attack/save actions the same way weapon
// attacks and weapon-cantrips already are — derived LIVE from the character's known
// spells (spellcasting.groups, or the legacy spells map), so nothing has to be hand-
// authored, nothing is stored, and they can never be wiped by a reforge. Cantrips scale
// with character level (1/2/3/4 dice at L1/5/11/17); leveled spells surface at their base
// slot level with the per-slot upcast shown as a reminder. Booming Blade / Green-Flame
// Blade are NOT here — those are weapon cantrips handled by buildCantripAttacks.
//   kind: 'atk'  → spell attack roll (uses the character's spell attack bonus, crit doubles)
//         'save' → target saves (rolls damage only; the save + DC ride in the type label)
//         'auto' → auto-hit (Magic Missile / persistent-area effects)
var SPELL_DAMAGE = {
  // ── cantrips (scale by character level) ──
  "fire bolt":        { dmg:"1d10", type:"fire",       kind:"atk",  scale:"cantrip" },
  "ray of frost":     { dmg:"1d8",  type:"cold",       kind:"atk",  scale:"cantrip", note:"-10 ft speed" },
  "shocking grasp":   { dmg:"1d8",  type:"lightning",  kind:"atk",  scale:"cantrip", note:"adv vs metal armor; target can't take reactions" },
  "chill touch":      { dmg:"1d8",  type:"necrotic",   kind:"atk",  scale:"cantrip", note:"target can't regain HP" },
  "eldritch blast":   { dmg:"1d10", type:"force",      kind:"atk",  scale:"cantrip", beams:true },
  "thorn whip":       { dmg:"1d6",  type:"piercing",   kind:"atk",  scale:"cantrip", note:"pull 10 ft" },
  "produce flame":    { dmg:"1d8",  type:"fire",       kind:"atk",  scale:"cantrip", note:"thrown 30 ft" },
  "magic stone":      { dmg:"1d6",  type:"bludgeoning",kind:"atk",  scale:"cantrip", addMod:true, note:"thrown; +spell mod to hit & damage" },
  "sacred flame":     { dmg:"1d8",  type:"radiant",    kind:"save", save:"dex", scale:"cantrip", note:"ignores cover" },
  "toll the dead":    { dmg:"1d8",  type:"necrotic",   kind:"save", save:"wis", scale:"cantrip", note:"use d12 instead if the target is missing HP" },
  "word of radiance": { dmg:"1d6",  type:"radiant",    kind:"save", save:"con", scale:"cantrip" },
  "poison spray":     { dmg:"1d12", type:"poison",     kind:"save", save:"con", scale:"cantrip" },
  "acid splash":      { dmg:"1d6",  type:"acid",       kind:"save", save:"dex", scale:"cantrip", note:"up to 2 creatures within 5 ft" },
  "frostbite":        { dmg:"1d6",  type:"cold",       kind:"save", save:"con", scale:"cantrip", note:"disadv on next weapon attack" },
  "mind sliver":      { dmg:"1d6",  type:"psychic",    kind:"save", save:"int", scale:"cantrip", note:"-1d4 to target's next save" },
  "thunderclap":      { dmg:"1d6",  type:"thunder",    kind:"save", save:"con", scale:"cantrip" },
  "sword burst":      { dmg:"1d6",  type:"force",      kind:"save", save:"dex", scale:"cantrip" },
  "create bonfire":   { dmg:"1d8",  type:"fire",       kind:"save", save:"dex", scale:"cantrip", note:"concentration" },
  "vicious mockery":  { dmg:"1d4",  type:"psychic",    kind:"save", save:"wis", scale:"cantrip", note:"disadv on next attack" },
  "sapping sting":    { dmg:"1d4",  type:"necrotic",   kind:"save", save:"con", scale:"cantrip", note:"knocked prone" },
  "lightning lure":   { dmg:"1d8",  type:"lightning",  kind:"save", save:"str", scale:"cantrip", note:"pull 10 ft (within 15 ft)" },
  "infestation":      { dmg:"1d6",  type:"poison",     kind:"save", save:"con", scale:"cantrip", note:"target moves 5 ft randomly" },

  // ── 1st ──
  "magic missile":    { dmg:"3d4",  type:"force",      kind:"auto", bonus:3, min:1, perDarts:true },
  "burning hands":    { dmg:"3d6",  type:"fire",       kind:"save", save:"dex", min:1, per:"1d6" },
  "thunderwave":      { dmg:"2d8",  type:"thunder",    kind:"save", save:"con", min:1, per:"1d8", note:"push 10 ft" },
  "chromatic orb":    { dmg:"3d8",  type:"chosen",     kind:"atk",  min:1, per:"1d8", note:"choose the damage type" },
  "witch bolt":       { dmg:"1d12", type:"lightning",  kind:"atk",  min:1, per:"1d12", note:"sustain 1d12/turn" },
  "guiding bolt":     { dmg:"4d6",  type:"radiant",    kind:"atk",  min:1, per:"1d6", note:"next attack vs target has adv" },
  "inflict wounds":   { dmg:"3d10", type:"necrotic",   kind:"atk",  min:1, per:"1d10" },
  "ray of sickness":  { dmg:"2d8",  type:"poison",     kind:"atk",  min:1, per:"1d8", note:"CON save or poisoned" },
  "hellish rebuke":   { dmg:"2d10", type:"fire",       kind:"save", save:"dex", min:1, per:"1d10", note:"reaction" },
  "ice knife":        { dmg:"2d6",  type:"cold",       kind:"save", save:"dex", min:1, per:"1d6", note:"+1d10 piercing on the initial hit" },

  // ── 2nd ──
  "scorching ray":    { dmg:"2d6",  type:"fire",       kind:"atk",  min:2, rays:3, perRay:true },
  "shatter":          { dmg:"3d8",  type:"thunder",    kind:"save", save:"con", min:2, per:"1d8" },
  "flaming sphere":   { dmg:"2d6",  type:"fire",       kind:"save", save:"dex", min:2, per:"1d6", note:"concentration" },
  "melf's acid arrow":{ dmg:"4d4",  type:"acid",       kind:"atk",  min:2, per:"1d4", note:"+2d4 acid next turn" },
  "acid arrow":       { dmg:"4d4",  type:"acid",       kind:"atk",  min:2, per:"1d4", note:"+2d4 acid next turn" },
  "aganazzar's scorcher": { dmg:"3d8", type:"fire",    kind:"save", save:"dex", min:2, per:"1d8" },
  "moonbeam":         { dmg:"2d10", type:"radiant",    kind:"save", save:"con", min:2, per:"1d10", note:"concentration" },
  "spiritual weapon": { dmg:"1d8",  type:"force",      kind:"atk",  min:2, addMod:true, note:"bonus action; +1d8 per 2 slot levels" },
  "cloud of daggers": { dmg:"4d4",  type:"slashing",   kind:"auto", min:2, per:"2d4", note:"on enter / start of turn in area" },
  "dragon's breath":  { dmg:"3d6",  type:"chosen",     kind:"save", save:"dex", min:2, per:"1d6", note:"choose the damage type" },

  // ── 3rd ──
  "fireball":         { dmg:"8d6",  type:"fire",       kind:"save", save:"dex", min:3, per:"1d6" },
  "lightning bolt":   { dmg:"8d6",  type:"lightning",  kind:"save", save:"dex", min:3, per:"1d6" },
  "spirit guardians": { dmg:"3d8",  type:"radiant or necrotic", kind:"save", save:"wis", min:3, per:"1d8", note:"concentration" },
  "vampiric touch":   { dmg:"3d6",  type:"necrotic",   kind:"atk",  min:3, per:"1d6", note:"concentration; heal half" },
  "call lightning":   { dmg:"3d10", type:"lightning",  kind:"save", save:"dex", min:3, per:"1d10", note:"concentration" },
  "erupting earth":   { dmg:"3d12", type:"bludgeoning",kind:"save", save:"dex", min:3, per:"1d12" },

  // ── 4th ──
  "ice storm":        { dmg:"2d8",  type:"bludgeoning",kind:"save", save:"dex", min:4, per:"1d8", note:"+4d6 cold" },
  "blight":           { dmg:"8d8",  type:"necrotic",   kind:"save", save:"con", min:4, per:"1d8" },
  "vitriolic sphere": { dmg:"10d4", type:"acid",       kind:"save", save:"dex", min:4, per:"2d4" },
  "wall of fire":     { dmg:"5d8",  type:"fire",       kind:"save", save:"dex", min:4, per:"1d8", note:"concentration" },
  "sickening radiance": { dmg:"4d10", type:"radiant",  kind:"save", save:"con", min:4, note:"1 level of exhaustion" },

  // ── 5th ──
  "cone of cold":     { dmg:"8d8",  type:"cold",       kind:"save", save:"con", min:5, per:"1d8" },
  "flame strike":     { dmg:"8d6",  type:"fire & radiant", kind:"save", save:"dex", min:5, per:"1d6" },
  "cloudkill":        { dmg:"5d8",  type:"poison",     kind:"save", save:"con", min:5, per:"1d8", note:"concentration" },
  "immolation":       { dmg:"8d6",  type:"fire",       kind:"save", save:"dex", min:5, note:"concentration" },
  "synaptic static":  { dmg:"8d6",  type:"psychic",    kind:"save", save:"int", min:5, note:"-1d6 to attacks/checks after" },
  "destructive wave": { dmg:"10d6", type:"thunder + radiant/necrotic", kind:"save", save:"con", min:5 },

  // ── 6th ──
  "disintegrate":     { dmg:"10d6", type:"force",      kind:"save", save:"dex", bonus:40, min:6, per:"3d6" },
  "chain lightning":  { dmg:"10d8", type:"lightning",  kind:"save", save:"dex", min:6, note:"+1 target per slot above 6th" },
  "circle of death":  { dmg:"8d6",  type:"necrotic",   kind:"save", save:"con", min:6, per:"2d6" },
  "sunbeam":          { dmg:"6d8",  type:"radiant",    kind:"save", save:"con", min:6, note:"concentration" },
  "blade barrier":    { dmg:"6d10", type:"slashing",   kind:"save", save:"dex", min:6, note:"concentration" },

  // ── 7th ──
  "delayed blast fireball": { dmg:"12d6", type:"fire", kind:"save", save:"dex", min:7, per:"1d6", note:"+1d6 per round delayed" },
  "finger of death":  { dmg:"7d8",  type:"necrotic",   kind:"save", save:"con", bonus:30, min:7 },
  "fire storm":       { dmg:"7d10", type:"fire",       kind:"save", save:"dex", min:7 },
  "crown of stars":   { dmg:"4d12", type:"radiant",    kind:"atk",  min:7, note:"one star per attack" },
  "prismatic spray":  { dmg:"10d6", type:"varies",     kind:"save", save:"dex", min:7, note:"roll the ray color" },

  // ── 8th ──
  "incendiary cloud": { dmg:"10d8", type:"fire",       kind:"save", save:"dex", min:8, note:"concentration" },
  "sunburst":         { dmg:"12d6", type:"radiant",    kind:"save", save:"con", min:8 },
  "abi-dalzim's horrid wilting": { dmg:"12d8", type:"necrotic", kind:"save", save:"con", min:8 },

  // ── 9th ──
  "meteor swarm":     { dmg:"20d6", type:"fire + bludgeoning", kind:"save", save:"dex", min:9 },
  "psychic scream":   { dmg:"14d6", type:"psychic",    kind:"save", save:"int", min:9 }
};

function scaleDice(s, mult) { var m = String(s).match(/(\d+)d(\d+)/); return m ? (parseInt(m[1], 10) * mult) + 'd' + m[2] : s; }
function doubleDice(s) { var m = String(s).match(/(\d+)d(\d+)/); return m ? (2 * parseInt(m[1], 10)) + 'd' + m[2] : s; }
function spellOrdinal(n) { var v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'); }
function cantripMult(level) { return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1; }

// Every known spell with its level, from spellcasting.groups (forged) or the legacy
// structural.spells map (older sheets). Lowercased, apostrophes normalised, so the
// table lookup matches whichever quote style the source data used.
function knownSpellList(structural) {
  var out = [], seen = {}, sc = structural.spellcasting || {};
  function add(name, lvl) {
    if (!name) return;
    var key = String(name).trim().toLowerCase().replace(/\u2019/g, "'");
    if (seen[key]) return; seen[key] = 1;
    out.push({ name: String(name).trim(), key: key, level: (lvl == null ? 0 : lvl) });
  }
  (sc.groups || []).forEach(function (g) {
    var glvl = (g.level != null) ? g.level : (/cantrip/i.test(g.heading || '') ? 0 : null);
    (g.spells || []).forEach(function (sp) {
      var spl = sp && sp.level;
      var lvl = (spl != null) ? (spl === 'cantrip' ? 0 : spl) : glvl;
      add(sp && sp.name, lvl);
    });
  });
  var legacy = structural.spells;
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    Object.keys(legacy).forEach(function (k) {
      var lm = k.match(/^level(\d)$/i);
      var lvl = /^cantrips?$/i.test(k) ? 0 : (lm ? +lm[1] : null);
      if (lvl == null || !Array.isArray(legacy[k])) return;
      legacy[k].forEach(function (sp) { add((sp && sp.name) || sp, lvl); });
    });
  }
  return out;
}

// Turn the character's damaging spells into rollable actions. Attack spells become
// 'attack-cantrip' rows (real spell-attack to-hit, crit doubles the dice); save / auto
// spells become 'damage-only' rows with the save (DC + ability) shown in the type label.
export function buildSpellAttacks(structural) {
  structural = structural || {};
  var spells = knownSpellList(structural);
  if (!spells.length) return [];
  var clvl = structural.level || 0;
  var combat = structural.combat || {};
  var atk = combat.spellAttackBonus != null ? combat.spellAttackBonus : 0;
  var dc = combat.spellSaveDC != null ? combat.spellSaveDC : null;
  var spellMod = combat.spellAttackBonus != null ? (combat.spellAttackBonus - (structural.proficiencyBonus || 0)) : 0;
  var agonizing = hasFeature(structural, 'agonizing blast');   // warlock invocation: +spell mod to each Eldritch Blast beam
  var authored = {};
  (structural.actions || []).forEach(function (a) { if (a && a.label) authored[String(a.label).trim().toLowerCase().replace(/\u2019/g, "'")] = 1; });

  var out = [];
  spells.forEach(function (sp) {
    var spec = SPELL_DAMAGE[sp.key];
    if (!spec || authored[sp.key]) return;          // unknown spell, or the player hand-built it → leave it
    var dice, label = sp.name, extras = [];

    if (spec.scale === 'cantrip') {
      var mult = cantripMult(clvl);
      if (spec.beams) {
        dice = spec.dmg;                 // Eldritch Blast: each beam is the base die — you make `mult` separate attacks
        if (mult > 1) { label = sp.name + ' (\u00d7' + mult + ' beams)'; extras.push(mult + ' beams \u2014 roll each separately'); }
      } else {
        dice = scaleDice(spec.dmg, mult);
      }
    } else {
      dice = spec.dmg;
      if (spec.rays) { label = sp.name + ' (' + spec.rays + ' rays)'; extras.push(spec.rays + ' rays \u2014 roll each' + (spec.perRay ? '; +1 ray per slot above ' + spellOrdinal(spec.min) : '')); }
      else if (spec.min) label = sp.name + ' (' + spellOrdinal(spec.min) + ')';
      if (!spec.rays && spec.per) extras.push('+' + spec.per + ' per slot above ' + spellOrdinal(spec.min));
      if (spec.perDarts) extras.push('+1 dart per slot above ' + spellOrdinal(spec.min));
    }

    if (spec.note) extras.push(spec.note);
    var typeLabel = spec.type;
    if (spec.kind === 'save') typeLabel += ' (' + String(spec.save).toUpperCase() + ' save' + (dc != null ? ' DC ' + dc : '') + ')';
    else if (spec.kind === 'auto') typeLabel += ' (auto-hit)';
    if (extras.length) typeLabel += ' \u00b7 ' + extras.join('; ');

    var id = 'sp-' + sp.key.replace(/[^a-z0-9]+/g, '');
    var dmgBonus = (spec.bonus || 0) + (spec.addMod ? spellMod : 0);
    if (sp.key === 'eldritch blast' && agonizing) dmgBonus += spellMod;   // Agonizing Blast

    if (spec.kind === 'atk') {
      out.push({ id: id, type: 'attack-cantrip', label: label, hitMod: atk, dmgMod: dmgBonus, dmgDice: dice, critDice: doubleDice(dice), dmgType: typeLabel });
    } else {
      out.push({ id: id, type: 'damage-only', label: label, dmgMod: dmgBonus, dmgDice: dice, dmgType: typeLabel, saveAbility: spec.save || null });
    }
  });
  return out;
}

// ── The ONE action list ─────────────────────────────────────────────────────
// The renderer (renderActions) and the click handler (sheet-actions.js's allActions)
// MUST build their list the same way, or a painted row whose id the clicker can't
// resolve silently no-ops. This is the single source of truth both call. Order:
// weapon attacks, then weapon-cantrip attacks, then structural.actions (feature /
// cantrip / manual), then structural.customActions (hand-added on the sheet, reforge-safe).
// Then the action editor's overrides apply HERE.
//   opts.includeHidden  — keep hidden actions (tagged _hidden:true) instead of dropping them
//                         (also surfaces a versatile weapon's hidden two-handed mode).
//   opts.includeRemoved — return ONLY deleted actions (tagged _removed:true), for the
//                         Removed drawer's restore list.
export function assembleActions(inventory, structural, opts) {
  structural = structural || {};
  var list = buildWeaponActions(inventory, structural)
    .concat(buildCantripAttacks(inventory, structural))
    .concat(buildSpellAttacks(structural))
    .concat(structural.actions || [])
    .concat(structural.customActions || []);
  return applyActionOverrides(list, structural, opts);
}

// Fields the editor can override on an action. `extraDamage` (an array of flat
// {dice,bonus,type} components) is handled separately so it replaces wholesale.
var OVERRIDE_FIELDS = ['label', 'ability', 'proficient', 'atkBonus', 'dmgDice', 'dmgBonus', 'dmgType'];
function applyActionOverrides(list, structural, opts) {
  var ov = (structural && structural.actionOverrides) || null;
  var includeHidden = !!(opts && opts.includeHidden);
  var includeRemoved = !!(opts && opts.includeRemoved);
  var out = [];
  list.forEach(function (a) {
    var o = ov && ov[a.id];
    // REMOVED (deleted): suppressed everywhere except the Removed drawer. For a derived
    // action this is the only way to truly drop it — it'd otherwise re-derive each render.
    if (o && o.removed) {
      if (includeRemoved) { var mr = Object.assign({}, a); mr._removed = true; out.push(mr); }
      return;
    }
    if (includeRemoved) return;                                // the Removed drawer wants ONLY removed rows
    // HIDDEN: an explicit override wins; otherwise the action's own default (a versatile
    // weapon's two-handed mode ships hidden, so it sits in the swap pile until swapped in).
    var hidden = (o && 'hidden' in o) ? !!o.hidden : !!a.defaultHidden;
    if (hidden && !includeHidden) return;
    var merged = Object.assign({}, a);
    if (o) {
      OVERRIDE_FIELDS.forEach(function (k) { if (k in o) merged[k] = o[k]; });
      if (Array.isArray(o.extraDamage)) merged.extraDamage = o.extraDamage.slice();
      var editedKeys = Object.keys(o).filter(function (k) { return k !== 'hidden' && k !== 'removed'; });
      if (editedKeys.length) merged._edited = true;            // for the "edited" badge
    }
    if (hidden) merged._hidden = true;                         // for the editor's greyed row
    out.push(merged);
  });
  return out;
}
