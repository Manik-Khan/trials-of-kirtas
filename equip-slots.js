// equip-slots.js
// ---------------------------------------------------------------------------
// The equipment-slot spine: a fixed slot taxonomy + a classifier that maps any
// inventory item to its slot CATEGORY, so the sheet can place gear in a
// paper-doll and the AC derive can read worn armour/shield from slots.
//
// Worn state lives ON the inventory item as `item.slot` (a slot key, or null =
// carried) — a widening of the `equipped` boolean the AC feature already wrote.
// This module never stores state; it only classifies and (optionally) computes
// a first-time slot backfill from an un-slotted bag.
//
// Loads as a browser global (window.EquipSlots) AND a CommonJS module
// (module.exports) — the dice-engine.js / armor-ac.js pattern — so the
// ES-module sheet, plain-script consumers, and the Node smokes share one source.
//
//   SLOTS                     -> [{ key, label, accepts:[cat], ac? }]  (8 slots)
//   classifyItem(item)        -> 'armor'|'shield'|'weapon'|'staff'|'ring'
//                                |'cloak'|'amulet'|'head'| null (carried)
//   slotsFor(cat)             -> [slotKey]  (which slots accept that category)
//   canEquip(item)            -> bool       (maps to at least one slot)
//   wornInSlot(inventory, k)  -> item|null
//   backfillSlots(inv, opts)  -> inv' (copies) with .slot assigned best-fit,
//                                ONLY for items that have no slot yet
// ---------------------------------------------------------------------------
(function (global) {
  'use strict';

  // The eight slots from the June equipment design. `accepts` lists the slot
  // categories a slot will hold; `ac:true` marks the two the AC derive reads.
  // (Feet / Hands / Waist are deliberate future additions — boots, gauntlets and
  // belts classify to null today and stay carried until those slots are added.)
  var SLOTS = [
    { key: 'HEAD',     label: 'Head',      accepts: ['head'] },
    { key: 'AMULET',   label: 'Amulet',    accepts: ['amulet'] },
    { key: 'CLOAK',    label: 'Cloak',     accepts: ['cloak'] },
    { key: 'ARMOUR',   label: 'Armour',    accepts: ['armor'],            ac: true },
    { key: 'MAINHAND', label: 'Main Hand', accepts: ['weapon', 'staff'] },
    { key: 'OFFHAND',  label: 'Off Hand',  accepts: ['weapon', 'shield'], ac: true },
    { key: 'RING1',    label: 'Ring',      accepts: ['ring'] },
    { key: 'RING2',    label: 'Ring',      accepts: ['ring'] }
  ];

  // 5etools `type` can carry a source suffix ("M|XPHB"); take the code only.
  function baseType(it) {
    return String((it && it.type) || '').split('|')[0].trim().toUpperCase();
  }

  // The PHB armour + shield names, for classifying gear that arrives WITHOUT a 5etools
  // `type` code — the Forge's starting-equipment grant emits bare {name, qty}, so a
  // granted "Scale Mail" / "Chain Mail" / "Plate" had no type and fell through to null
  // (no Equip button). ArmorAC owns the authoritative table (magic/mithral/longest-suffix
  // matching); prefer it when present and fall back to this set for the standalone smoke.
  var BODY_ARMOR_NAMES = [
    'padded', 'leather', 'studded leather', 'hide', 'chain shirt', 'scale mail',
    'breastplate', 'half plate', 'ring mail', 'chain mail', 'splint', 'plate'
  ];
  function cleanArmorName(raw) {
    return String(raw == null ? '' : raw).toLowerCase()
      .replace(/\s*\([^)]*\)/g, ' ').replace(/\s*\+\d+\s*/g, ' ')
      .replace(/\bmith(?:ral|ril)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // 'armor' | 'shield' | null — name only, no type code required.
  function armorByName(it) {
    if (!it || !it.name) return null;
    var g = (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    if (g && g.ArmorAC && typeof g.ArmorAC.classifyArmor === 'function') {
      var info = g.ArmorAC.classifyArmor(it);
      if (info) return info.cat === 'shield' ? 'shield' : 'armor';
    }
    var clean = cleanArmorName(it.name);
    var words = clean.split(' ');
    for (var j = words.length; j > 0; j--) { if (BODY_ARMOR_NAMES.indexOf(words.slice(0, j).join(' ')) !== -1) return 'armor'; }
    for (var i = 0; i < words.length; i++) { if (BODY_ARMOR_NAMES.indexOf(words.slice(i).join(' ')) !== -1) return 'armor'; }
    return null;
  }

  // Map an item to the slot category it belongs in (or null = unslottable/carried).
  // Armour, shields, rings, staves and weapons are unambiguous from `type`; the
  // wondrous catch-all ("W") and untyped homebrew fall to a name heuristic — the
  // only way to tell a Cloak from an Amulet from a Helm, since 5etools types them
  // all identically.
  function classifyItem(it) {
    if (!it) return null;
    var t = baseType(it);
    if (t === 'LA' || t === 'MA' || t === 'HA') return 'armor';
    if (t === 'S') return 'shield';
    if (t === 'RG') return 'ring';
    if (t === 'ST') return 'staff';
    if (t === 'M' || t === 'R' || it.dmg1) return 'weapon';
    var n = String((it.name) || '').toLowerCase();
    if (t === 'W' || t === '') {
      if (/\b(cloak|cape|mantle)\b/.test(n)) return 'cloak';
      if (/\b(amulet|necklace|periapt|medallion|pendant|brooch|talisman|scarab)\b/.test(n)) return 'amulet';
      if (/\bring\b/.test(n)) return 'ring';
      if (/\b(helm|helmet|hat|circlet|crown|cap|hood|mask|diadem|goggles|lenses)\b/.test(n)) return 'head';
    }
    // A shield that arrived WITHOUT the 'S' type code (pack-exploded, homebrew, or a
    // starting-equipment grant that dropped the type) — catch it by name so it can be
    // equipped. Guard against shield-y non-shields (the Shield spell, Ring of Shielding).
    if (/\bshields?\b/.test(n) && !/\b(ring|amulet|cloak|wand|staff|scroll|potion|spell|guardian)\b/.test(n)) return 'shield';
    // Body armour / shield granted without a type code (Forge starting equipment emits
    // bare names) — classify by name so it registers as armour and can be equipped.
    var byName = armorByName(it);
    if (byName) return byName;
    return null; // wands, rods, potions, scrolls, ammo, tools, gear, boots/gloves/belts
  }

  function slotsFor(cat) {
    var out = [];
    SLOTS.forEach(function (s) { if (s.accepts.indexOf(cat) >= 0) out.push(s.key); });
    return out;
  }
  function canEquip(it) { return slotsFor(classifyItem(it)).length > 0; }

  function wornInSlot(inventory, slotKey) {
    var inv = inventory || [];
    for (var i = 0; i < inv.length; i++) if (inv[i] && inv[i].slot === slotKey) return inv[i];
    return null;
  }

  // First-time backfill: given a bag where (typically) nothing is slotted, assign
  // each item to a free slot best-first, WITHOUT disturbing any item that already
  // carries a slot. Returns a shallow-copied inventory so callers can diff/persist.
  // `opts.score(item)` ranks armour for the single ARMOUR slot (default: enriched
  // `ac`); the real caller passes an ArmorAC-aware scorer so base-AC wins.
  function backfillSlots(inventory, opts) {
    opts = opts || {};
    var score = opts.score || function (it) { return +(it && it.ac) || 0; };
    var inv = (inventory || []).map(function (it) { return Object.assign({}, it); });

    var used = {};
    inv.forEach(function (it) { if (it.slot) used[it.slot] = true; });
    function place(it, keys) {
      for (var i = 0; i < keys.length; i++) {
        if (!used[keys[i]]) { it.slot = keys[i]; used[keys[i]] = true; return true; }
      }
      return false;
    }
    function free(cat) {
      return inv.filter(function (it) { return !it.slot && classifyItem(it) === cat; });
    }

    var armours = free('armor').sort(function (a, b) { return score(b) - score(a); });
    if (armours[0]) place(armours[0], ['ARMOUR']);
    var shields = free('shield');
    if (shields[0]) place(shields[0], ['OFFHAND']);
    free('weapon').forEach(function (it) { place(it, ['MAINHAND', 'OFFHAND']); });
    free('staff').forEach(function (it) { place(it, ['MAINHAND', 'OFFHAND']); });
    free('ring').forEach(function (it) { place(it, ['RING1', 'RING2']); });
    free('cloak').forEach(function (it) { place(it, ['CLOAK']); });
    free('amulet').forEach(function (it) { place(it, ['AMULET']); });
    free('head').forEach(function (it) { place(it, ['HEAD']); });
    return inv;
  }

  var API = {
    SLOTS: SLOTS,
    classifyItem: classifyItem,
    slotsFor: slotsFor,
    canEquip: canEquip,
    wornInSlot: wornInSlot,
    backfillSlots: backfillSlots
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.EquipSlots = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
