// character-combat.js
// ---------------------------------------------------------------------------
// Shared projection of a database character row into the combat values that
// both the character sheet and Battle Forge display. The database row remains
// authoritative; derived values such as AC are recomputed from its inventory
// rather than trusting a cached structural.combat.ac field.
//
// Browser: window.CharacterCombat
// Node:    module.exports
// ---------------------------------------------------------------------------
(function (global, factory) {
  'use strict';
  var api = factory(global);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.CharacterCombat = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (global) {
  'use strict';

  function resolveDep(name, nodePath, supplied) {
    if (supplied) return supplied;
    if (global && global[name]) return global[name];
    if (typeof require === 'function') {
      try { return require(nodePath); } catch (_) { /* browser / unresolved dependency */ }
    }
    return null;
  }

  function dependencyError(name, detail) {
    var err = new Error('CharacterCombat requires ' + name + (detail ? ': ' + detail : ''));
    err.code = 'CHARACTER_COMBAT_DEPENDENCY';
    err.dependency = name;
    return err;
  }

  function finiteOr(value, fallback) {
    if (value == null || value === '') return fallback;
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function requireApis(armorAC, equipSlots) {
    if (!armorAC || typeof armorAC.deriveAC !== 'function' || typeof armorAC.deriveSpeed !== 'function' || typeof armorAC.classifyArmor !== 'function') {
      throw dependencyError('ArmorAC', 'deriveAC/deriveSpeed/classifyArmor unavailable');
    }
    if (!equipSlots || typeof equipSlots.canEquip !== 'function' || typeof equipSlots.backfillSlots !== 'function') {
      throw dependencyError('EquipSlots', 'canEquip/backfillSlots unavailable');
    }
  }

  function hasEquippableSlot(inventory, equipSlots) {
    return (inventory || []).some(function (item) { return equipSlots.canEquip(item); });
  }

  function backfillInventory(inventory, armorAC, equipSlots) {
    requireApis(armorAC, equipSlots);
    var inv = Array.isArray(inventory) ? inventory : [];
    if (!inv.length || inv.some(function (item) { return item && item.slot; })) return inv;
    if (!hasEquippableSlot(inv, equipSlots)) return inv;

    return equipSlots.backfillSlots(inv, {
      score: function (item) {
        var info = armorAC.classifyArmor(item);
        return info ? finiteOr(info.base, 0) + finiteOr(info.magic, 0) : 0;
      }
    });
  }

  function derive(characterRow, opts) {
    opts = opts || {};
    characterRow = characterRow || {};

    var structural = characterRow.structural || {};
    var vitals = characterRow.vitals || {};
    var combat = structural.combat || {};
    var inventory = Array.isArray(characterRow.inventory) ? characterRow.inventory : [];
    var armorAC = resolveDep('ArmorAC', './armor-ac.js', opts.ArmorAC);
    var equipSlots = resolveDep('EquipSlots', './equip-slots.js', opts.EquipSlots);

    // Fail closed. Returning the cached structural.combat.ac when these shared
    // sheet dependencies are absent recreates the exact 12-vs-17 bug this
    // module exists to remove.
    requireApis(armorAC, equipSlots);

    var projectedInventory = backfillInventory(inventory, armorAC, equipSlots);
    var armor = armorAC.deriveAC(projectedInventory, structural, vitals);
    var derivedAc = armor && Number(armor.ac);
    if (!Number.isFinite(derivedAc)) {
      var err = new Error('ArmorAC.deriveAC returned no finite AC');
      err.code = 'CHARACTER_COMBAT_AC';
      throw err;
    }

    var movement = armorAC.deriveSpeed(finiteOr(combat.speed, 30), structural, armor);
    var maxHpFallback = finiteOr(combat.maxHp, finiteOr(combat.hpMax, 10));
    var maxHp = finiteOr(vitals.maxHp, maxHpFallback);
    var hp = finiteOr(vitals.hp, maxHp);

    return {
      hp: hp,
      maxHp: maxHp,
      ac: derivedAc,
      acSource: armor.source || 'inventory',
      speed: movement.speed,
      speedBonus: movement.bonus,
      speedPenalty: movement.penalty,
      speedReason: movement.reason || null,
      init: finiteOr(combat.initiative, 0),
      fly: !!combat.fly,
      climb: !!combat.climb,
      notProficient: !!armor.notProficient,
      proficiencyWarning: armor.profReason || null,
      stealthDisadvantage: !!armor.stealthDisadvantage,
      sourceUpdatedAt: characterRow.updatedAt || characterRow.updated_at || null,
      inventory: projectedInventory,
      source: 'character-database'
    };
  }

  return {
    derive: derive,
    backfillInventory: backfillInventory,
    requireApis: requireApis
  };
});
