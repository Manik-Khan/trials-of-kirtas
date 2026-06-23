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
      return { name: action.label, kind: 'damage',
               dmgRolls: d.rolls, dmgTotal: d.total, dmgMod: action.dmgMod || 0, dmgType: action.dmgType || '',
               main: 'Dmg: [' + d.rolls.join('][') + ']' + (action.dmgMod ? ' ' + modStr(action.dmgMod) : '') + ' = <span class="b-rh-total">' + d.total + '</span>',
               detail: action.dmgDice + (action.dmgMod ? ' ' + modStr(action.dmgMod) : '') + ' ' + (action.dmgType || '') };
    }
    // attack / attack-cantrip
    var roll = rollD20(opts), bless = bonus(opts.bless, '\uD83D\uDE4F');
    var hitMod = action.hitMod || 0;
    var total = roll.kept + hitMod + bless.val;
    var isCrit = roll.isCrit;
    var dmg = rollDice(isCrit ? (action.critDice || action.dmgDice) : action.dmgDice, action.dmgMod || 0);
    var critStr = isCrit ? '<span class="b-rh-crit">\u2605 CRIT</span>'
                : (roll.isFumble ? '<span class="b-rh-fumble">\u2717 MISS</span>' : '');
    return { name: action.label, kind: 'attack',
             d20: roll, hitMod: hitMod, bless: bless.val, total: total, isCrit: isCrit, isFumble: roll.isFumble,
             dmgRolls: dmg.rolls, dmgTotal: dmg.total, dmgMod: action.dmgMod || 0, dmgType: action.dmgType || '',
             main: fmtD20(roll) + ' ' + modStr(hitMod) + bless.str + ' = <span class="b-rh-total">' + total + '</span> ' + critStr,
             detail: 'd20:' + roll.kept + (roll.label ? ' (' + roll.label + ')' : '') + (action.note ? ' \u00B7 ' + action.note : ''),
             dmg: (isCrit ? '\u2605 Crit dmg' : 'Dmg') + ': [' + dmg.rolls.join('][') + ']' + (action.dmgMod ? ' ' + modStr(action.dmgMod) : '') + ' = <strong>' + dmg.total + '</strong> ' + (action.dmgType || '') };
  }

  var API = { die: die, modStr: modStr, rollD20: rollD20, fmtD20: fmtD20, rollDice: rollDice, bonus: bonus, rollAction: rollAction };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.DiceEngine = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
