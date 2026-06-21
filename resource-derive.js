// resource-derive.js
// ---------------------------------------------------------------------------
// Derives a character's non-spellcasting resource pools from data the character
// already carries — class, subclass, level, ability mods, proficiency bonus, race.
// Nothing is hand-seeded: being a Monk IS Ki, being an Astral Elf IS Starlight
// Step. Level up or bump a stat and the maxes recompute on the next render.
//
// Grounded in the 5etools 2014 dataset (the same mirror Soul Shards reads):
//   Ki                  = Monk level                                  (class-monk table)
//   Bardic Inspiration  = CHA mod uses; d6→d8→d10→d12 at L1/5/10/15;  short-or-long rest from L5
//   Superiority Dice    = 4/5/6 at Battle Master L3/7/15;             d8→d10→d12 at L3/10/18; short-or-long rest
//   Starlight Step      = proficiency-bonus uses, long rest           (Astral Elf, AAG)
//
// Spell slots / sorcery points deliberately stay in the Spellcasting section
// (static for now) — unifying those is the larger derive reconciliation thread.
//
// Output: array of pool specs, presentation-agnostic. Consumers (the sheet's
// Resources section, the combat orbs) format + subtract vitals.pipState[id]:
//   { id, label, tag, max, die, recharge, tone, source }
//   current = max - (pipState[id] || 0)
// ---------------------------------------------------------------------------
(function () {
  'use strict';
  if (window.ResourceDerive) return;

  function abilMod(structural, ab) { var a = ((structural.abilities || {})[ab]) || {}; return a.mod || 0; }
  function profBonus(structural) {
    if (structural.proficiencyBonus != null) return structural.proficiencyBonus;
    return 2 + Math.floor((Math.max(1, structural.level || 1) - 1) / 4);
  }
  function bardDie(L) { return L >= 15 ? 'd12' : L >= 10 ? 'd10' : L >= 5 ? 'd8' : 'd6'; }
  function bmCount(L) { return L >= 15 ? 6 : L >= 7 ? 5 : 4; }
  function bmDie(L) { return L >= 18 ? 'd12' : L >= 10 ? 'd10' : 'd8'; }
  function has(s, frag) { return (s || '').toLowerCase().indexOf(frag) !== -1; }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'res'; }
  function tagFromLabel(label) { var w = String(label || '').trim().split(/\s+/); return w.length === 1 ? w[0].slice(0, 4) : (w[0][0] + w[w.length - 1][0]).toUpperCase(); }
  function rechargeText(r) { return r === 'short' ? 'short rest' : r === 'short-long' ? 'short or long rest' : 'long rest'; }
  // A custom resource's max is a number or a formula token resolved against the sheet,
  // so a "Proficiency bonus" custom resource tracks level-ups like the derived ones.
  function resolveMax(m, s) {
    if (m == null) return 1;
    if (typeof m === 'number') return Math.max(0, m);
    if (m.type === 'fixed') return Math.max(0, m.value || 0);
    if (m.type === 'pb') return profBonus(s);
    if (m.type === 'level') return s.level || 0;
    if (m.type === 'mod') return Math.max(0, abilMod(s, m.ability || 'cha'));
    return 0;
  }

  function derive(structural) {
    structural = structural || {};
    var classes = structural.classes || [];
    var out = [];

    classes.forEach(function (c) {
      var name = c.name || '', sub = c.subclass || '', L = c.level || 0;

      if (has(name, 'monk') && L >= 2) {
        out.push({ id: 'ki', label: 'Ki Points', tag: 'Ki', max: L, die: null, recharge: 'short rest', tone: 'class', source: 'class' });
      }
      if (has(name, 'bard')) {
        out.push({ id: 'bardicInspiration', label: 'Bardic Inspiration', tag: 'Bard', max: Math.max(1, abilMod(structural, 'cha')), die: bardDie(L), recharge: L >= 5 ? 'short or long rest' : 'long rest', tone: 'class', source: 'class' });
      }
      if (has(name, 'fighter') && (has(sub, 'battle master') || has(sub, 'battlemaster')) && L >= 3) {
        out.push({ id: 'superiorityDice', label: 'Superiority Dice', tag: 'Sup', max: bmCount(L), die: bmDie(L), recharge: 'short or long rest', tone: 'subclass', source: 'subclass' });
      }
      // Sorcerer / spell slots stay in Spellcasting (static) — not derived here, to avoid duplication.
    });

    if (has(structural.race, 'astral elf')) {
      out.push({ id: 'starlightStep', label: 'Starlight Step', tag: 'Step', max: profBonus(structural), die: null, recharge: 'long rest', tone: 'class', source: 'race' });
    }

    // Player-authored resources (homebrew, magic-item charges, anything not in the
    // tables). Same spec shape as the derived pools — rendered + spent identically.
    (structural.customResources || []).forEach(function (cr) {
      if (!cr || !cr.label) return;
      out.push({ id: cr.id || ('cr_' + slug(cr.label)), label: cr.label, tag: tagFromLabel(cr.label),
                 max: resolveMax(cr.max, structural), die: null, recharge: rechargeText(cr.recharge), tone: 'class', source: 'custom' });
    });
    return out;
  }

  window.ResourceDerive = {
    derive: derive,
    // exposed for tests / reuse
    _fn: { bardDie: bardDie, bmCount: bmCount, bmDie: bmDie, profBonus: profBonus, abilMod: abilMod, resolveMax: resolveMax, tagFromLabel: tagFromLabel, rechargeText: rechargeText, slug: slug }
  };
})();
