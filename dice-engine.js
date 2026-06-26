// dice-engine.js
// ---------------------------------------------------------------------------
// The single combat-roll engine, shared by the Battle HUD (battle.js) and the
// at-a-glance sheet. Pure + stateless: every call takes its modifiers as an
// argument ({advantage, disadvantage, bless}) rather than reading shared state,
// so each surface owns its own toggles. No DOM, no side effects, no logging —
// the caller decides what to do with the result (render it, post it to the feed).
//
// The formatted `main` / `detail` / `dmg` strings are byte-for-byte what
// battle.js's rollActionFull produced inline (same b-rh-* classes, same glyphs),
// so a roll from the sheet and a roll from the HUD read identically in the feed.
// Structured fields (d20, total, dmgRolls, …) are also returned for callers that
// render their own layout instead of the HUD strings.
//
// Loads as a browser global (window.DiceEngine) and as a CommonJS module
// (require) for the jsdom smokes — exactly like resource-derive.js.
// ---------------------------------------------------------------------------
(function (global) {
  'use strict';

  function die(sides) { return Math.floor(Math.random() * sides) + 1; }
  function modStr(n) { return n >= 0 ? '+' + n : '' + n; }

  // 2d20, keep one by advantage/disadvantage. `twin` = a second die is shown.
  function rollD20(opts) {
    opts = opts || {};
    var r1 = die(20), r2 = die(20), kept, dropped;
    if (opts.advantage) { kept = Math.max(r1, r2); dropped = Math.min(r1, r2); }
    else if (opts.disadvantage) { kept = Math.min(r1, r2); dropped = Math.max(r1, r2); }
    else { kept = r1; dropped = r2; }
    return { kept: kept, dropped: dropped, twin: !!(opts.advantage || opts.disadvantage),
             isCrit: kept === 20, isFumble: kept === 1,
             label: opts.advantage ? 'adv' : (opts.disadvantage ? 'dis' : null) };
  }

  function fmtD20(roll) {
    if (roll && roll.twin)
      return '[<span class="b-rh-kept">' + roll.kept + '</span> <span class="b-rh-drop">' + roll.dropped + '</span>]';
    return '[<span class="b-rh-kept">' + roll.kept + '</span>]';
  }

  function rollDice(diceStr, mod) {
    mod = mod || 0;
    var m = String(diceStr).match(/(\d+)d(\d+)/);
    if (!m) return { rolls: [0], total: mod };
    var n = parseInt(m[1], 10), sides = parseInt(m[2], 10), rolls = [];
    for (var i = 0; i < n; i++) rolls.push(die(sides));
    return { rolls: rolls, total: rolls.reduce(function (a, b) { return a + b; }, 0) + mod };
  }

  // d4 bonus (bless 🙏 / guidance ✦) when active; {val,str} so callers can fold
  // the value into a total and the string into the display.
  function bonus(active, emoji) {
    if (!active) return { val: 0, str: '' };
    var b = die(4);
    return { val: b, str: ' +' + b + emoji };
  }

  // "NdM" -> "(2N)dM", for crit-doubling a damage component's dice.
  function doubleDice(s) { var m = String(s).match(/(\d+)d(\d+)/); return m ? (2 * parseInt(m[1], 10)) + 'd' + m[2] : s; }
  // Roll the action's EXTRA damage components (the editor's multi-type damage stack:
  // Divine Strike fire, a booming-blade thunder rider, …). Each is flat dice + bonus
  // with its own type, rolled separately so resistances apply per type; doubled on a
  // crit like every other damage die. Returns the structured parts plus the feed-string
  // fragment to append after the base damage. No-op (empty) when there are no extras, so
  // the HUD / normal rolls are byte-for-byte unchanged.
  function rollExtraParts(action, isCrit) {
    var parts = [], str = '', ex = action && action.extraDamage;
    if (!ex || !ex.length) return { parts: parts, str: str };
    for (var i = 0; i < ex.length; i++) {
      var c = ex[i]; if (!c || !c.dice) continue;
      var dd = rollDice(isCrit ? doubleDice(c.dice) : c.dice, c.bonus || 0);
      parts.push({ dice: c.dice, rolls: dd.rolls, total: dd.total, mod: c.bonus || 0, type: c.type || '' });
      str += ' \u00B7 [' + dd.rolls.join('][') + ']' + (c.bonus ? ' ' + modStr(c.bonus) : '') + ' = <strong>' + dd.total + '</strong> ' + (c.type || '');
    }
    return { parts: parts, str: str };
  }

  // Roll a whole action. Mirrors battle.js rollActionFull exactly.
  function rollAction(action, opts) {
    opts = opts || {};
    if (!action || action.type === 'utility') {
      return { name: (action && action.label) || 'Utility', kind: 'utility',
               main: (action && action.note) || '\u2014', detail: 'No roll needed' };
    }
    if (action.type === 'damage-only') {
      if (!action.dmgDice) return { name: action.label, kind: 'damage', main: 'No dice', detail: action.note || '' };
      var d = rollDice(action.dmgDice, action.dmgMod || 0);
      var exD = rollExtraParts(action, false);
      var resD = { name: action.label, kind: 'damage',
               dmgRolls: d.rolls, dmgTotal: d.total, dmgMod: action.dmgMod || 0, dmgType: action.dmgType || '',
               main: 'Dmg: [' + d.rolls.join('][') + ']' + (action.dmgMod ? ' ' + modStr(action.dmgMod) : '') + ' = <span class="b-rh-total">' + d.total + '</span>' + exD.str,
               detail: action.dmgDice + (action.dmgMod ? ' ' + modStr(action.dmgMod) : '') + ' ' + (action.dmgType || '') };
      if (exD.parts.length) resD.dmgParts = [{ dice: action.dmgDice, rolls: d.rolls, total: d.total, mod: action.dmgMod || 0, type: action.dmgType || '' }].concat(exD.parts);
      return resD;
    }
    // attack / attack-cantrip
    var roll = rollD20(opts), bless = bonus(opts.bless, '\uD83D\uDE4F');
    var hitMod = action.hitMod || 0;
    var total = roll.kept + hitMod + bless.val;
    var isCrit = roll.isCrit;
    var dmg = rollDice(isCrit ? (action.critDice || action.dmgDice) : action.dmgDice, action.dmgMod || 0);
    var exA = rollExtraParts(action, isCrit);
    var critStr = isCrit ? '<span class="b-rh-crit">\u2605 CRIT</span>'
                : (roll.isFumble ? '<span class="b-rh-fumble">\u2717 MISS</span>' : '');
    var resA = { name: action.label, kind: 'attack',
             d20: roll, hitMod: hitMod, bless: bless.val, total: total, isCrit: isCrit, isFumble: roll.isFumble,
             dmgRolls: dmg.rolls, dmgTotal: dmg.total, dmgMod: action.dmgMod || 0, dmgType: action.dmgType || '',
             main: fmtD20(roll) + ' ' + modStr(hitMod) + bless.str + ' = <span class="b-rh-total">' + total + '</span> ' + critStr,
             detail: 'd20:' + roll.kept + (roll.label ? ' (' + roll.label + ')' : '') + (action.note ? ' \u00B7 ' + action.note : ''),
             dmg: (isCrit ? '\u2605 Crit dmg' : 'Dmg') + ': [' + dmg.rolls.join('][') + ']' + (action.dmgMod ? ' ' + modStr(action.dmgMod) : '') + ' = <strong>' + dmg.total + '</strong> ' + (action.dmgType || '') + exA.str };
    if (exA.parts.length) resA.dmgParts = [{ dice: action.dmgDice, rolls: dmg.rolls, total: dmg.total, mod: action.dmgMod || 0, type: action.dmgType || '' }].concat(exA.parts);
    return resA;
  }

  // A flat d20 check — ability checks, saving throws, skills, initiative. Same d20
  // roller + bless as an attack's to-hit, but no damage. Nat 20 / nat 1 are carried
  // structurally for the die highlight; the feed string stays clean (a check doesn't
  // auto-succeed, so no CRIT/MISS wording).
  function rollCheck(label, mod, opts) {
    opts = opts || {};
    mod = mod || 0;
    var roll = rollD20(opts), bless = bonus(opts.bless, '\uD83D\uDE4F');
    var total = roll.kept + mod + bless.val;
    return { name: label || 'Check', kind: 'check',
             d20: roll, mod: mod, bless: bless.val, total: total, isCrit: roll.isCrit, isFumble: roll.isFumble,
             main: fmtD20(roll) + ' ' + modStr(mod) + bless.str + ' = <span class="b-rh-total">' + total + '</span>',
             detail: 'd20:' + roll.kept + (roll.label ? ' (' + roll.label + ')' : '') };
  }

  var API = { die: die, modStr: modStr, rollD20: rollD20, fmtD20: fmtD20, rollDice: rollDice, bonus: bonus, rollAction: rollAction, rollCheck: rollCheck };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.DiceEngine = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
