/* ════════════════════════════════════════════════════════════════════
   MONSTER-ACTOR-V1 — 5etools statblock → HUD actor adapter (Phase M1).

   Turns a `combatants` row (whose `statblock` jsonb holds the raw
   5etools monster JSON the Bestiary dropped) into exactly the shape
   battle.js already consumes for PCs:

     MonsterActor.toCharacter(combatantRow) → {
       key:'mon:<uuid>', isMonster:true, name,
       combat:{ ac, hp, hpMax, hpTemp, speed, initiative },
       actions:[{ id,label,type,hitMod,dmgDice,critDice,dmgMod,dmgType,note }],
       defaultSlots:[ids], classFeatures:{}, spells:{},
     }

   Action types match battle.js rollActionFull exactly:
     attack      — {@hit} present: d20+hitMod, dmg dice, crit doubles dice
     damage-only — {@damage} without {@hit} (save effects, autos): DC in note
     utility     — no mechanics parsed: cleaned text as the note

   The parser DEGRADES GRACEFULLY: anything it can't extract mechanics
   from still appears as a readable utility note — never a broken or
   missing button. Versatile weapons emit a second "(2H)" action.
   Secondary damage riders ("plus 7 (2d6) poison") land in the note —
   the DM rolls those via the dice tray when they apply.

   Pure logic, no DOM, no Supabase — loaded before battle.js wherever
   monster driving is wanted (M2 wires the HUD; M3 the seamless flow).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY_PREFIX = 'mon:';

  function abilityMod(score) {
    const n = Number(score);
    return Number.isFinite(n) ? Math.floor((n - 10) / 2) : 0;
  }

  // ── 5etools tag cleanup (prose form, for notes) ──
  const ATK = { mw: 'Melee Weapon', rw: 'Ranged Weapon', ms: 'Melee Spell', rs: 'Ranged Spell',
                m: 'Melee', r: 'Ranged', mw_rw: 'Melee or Ranged Weapon' };
  function cleanText(str) {
    return String(str == null ? '' : str)
      .replace(/\{@atk ([^}]+)\}/g, (_, codes) => codes.split(',').map(c => ATK[c.trim()] || c.trim()).join(' or ') + ' Attack:')
      .replace(/\{@hit ([^}]+)\}/g, (_, n) => '+' + String(n).replace(/^\+/, ''))
      .replace(/\{@damage ([^}]+)\}/g, '$1')
      .replace(/\{@dc ([^}]+)\}/g, 'DC $1')
      .replace(/\{@recharge ([^}]*)\}/g, (_, n) => n ? `(Recharge ${n}–6)` : '(Recharge 6)')
      .replace(/\{@h\}/g, 'Hit: ')
      .replace(/\{@[a-zA-Z]+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1')   // generic {@tag text|src} → text
      .replace(/\s+/g, ' ').trim();
  }

  // Flatten an entries array (strings + nested lists/objects) to plain text.
  function entriesText(entries) {
    const out = [];
    (Array.isArray(entries) ? entries : [entries]).forEach(e => {
      if (e == null) return;
      if (typeof e === 'string') out.push(cleanText(e));
      else if (Array.isArray(e.items)) e.items.forEach(i => out.push(typeof i === 'string' ? cleanText(i) : entriesText(i.entries || [])));
      else if (e.entries) out.push(entriesText(e.entries));
    });
    return out.filter(Boolean).join(' ');
  }

  // ── dice helpers ──
  // Normalize a {@damage ...} payload: '1d6 + 2' → { dice:'1d6', mod:2 }.
  // Multi-term dice ('2d6+1d4') keep the full dice expr; flat tail is the mod.
  function splitDamage(expr) {
    const s = String(expr || '').replace(/\s+/g, '');
    const m = s.match(/^(\d+d\d+(?:\+\d+d\d+)*)([+-]\d+)?$/i);
    if (!m) return null;
    return { dice: m[1].toLowerCase(), mod: m[2] ? parseInt(m[2], 10) : 0 };
  }
  // Crit = double every dice term's count ('1d6' → '2d6', '2d6+1d4' → '4d6+2d4').
  function doubleDice(dice) {
    return String(dice).replace(/(\d+)d(\d+)/gi, (_, n, f) => (parseInt(n, 10) * 2) + 'd' + f);
  }

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'action'; }

  // Damage type: the word right after this damage tag's value, before 'damage'.
  // Searched in the raw entry around the tag occurrence.
  function damageTypeAfter(raw, tagEnd) {
    const tail = raw.slice(tagEnd, tagEnd + 60);
    const m = tail.match(/^\)?\s*([a-z]+)\s+damage/i);
    return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : '';
  }

  // ── the parser ──
  // One 5etools action {name, entries} → one or two HUD actions.
  function parseOneAction(act, idx) {
    const rawName = String(act.name || 'Action');
    // Recharge lives in the NAME ('Fire Breath {@recharge 5}').
    let recharge = '';
    const label = cleanText(rawName.replace(/\{@recharge ([^}]*)\}/g, (_, n) => { recharge = n ? `Recharge ${n}–6` : 'Recharge 6'; return ''; })).trim();
    const raw = (Array.isArray(act.entries) ? act.entries : []).filter(e => typeof e === 'string').join(' ');
    const fullText = entriesText(act.entries || []);
    const id = slug(label) + '_' + idx;

    // Collect every damage tag with its position (for type + rider detection).
    const dmgs = [];
    const dmgRe = /\{@damage ([^}]+)\}/g;
    let m;
    while ((m = dmgRe.exec(raw))) dmgs.push({ expr: m[1], end: m.index + m[0].length, parsed: splitDamage(m[1]) });

    const hitM = raw.match(/\{@hit ([+-]?\d+)\}/);
    const dcM  = raw.match(/\{@dc (\d+)\}\s*(\w+)/);

    // Multiattack (or anything with no parseable mechanics) → utility note.
    if (/^multiattack/i.test(label) || !dmgs.length || !dmgs[0].parsed) {
      return [{ id, label, type: 'utility', note: clip(fullText, 160) || '—' }];
    }

    const first = dmgs[0];
    const dmgType = damageTypeAfter(raw, first.end);
    const reach = (raw.match(/reach [^,.]+|range \d+(?:\/\d+)? ?ft\.?/i) || [''])[0];

    // Rider damages ("plus 7 ({@damage 2d6}) poison damage") → note text.
    const riders = dmgs.slice(1)
      .filter(d => d.parsed && !isVersatile(raw, d))
      .map(d => `+ ${d.expr.replace(/\s+/g, '')} ${damageTypeAfter(raw, d.end)}`.trim());

    const noteBits = [recharge, reach, ...riders].filter(Boolean);

    if (hitM) {
      const out = [{
        id, label, type: 'attack',
        hitMod: parseInt(hitM[1], 10),
        dmgDice: first.parsed.dice, critDice: doubleDice(first.parsed.dice),
        dmgMod: first.parsed.mod, dmgType,
        note: noteBits.join(' · ') || undefined,
      }];
      // Versatile: "or X ({@damage 1d10 + 2}) ... two hands" → second action.
      const vers = dmgs.slice(1).find(d => d.parsed && isVersatile(raw, d));
      if (vers) {
        out.push(Object.assign({}, out[0], {
          id: id + '_2h', label: label + ' (2H)',
          dmgDice: vers.parsed.dice, critDice: doubleDice(vers.parsed.dice),
          dmgMod: vers.parsed.mod,
          dmgType: damageTypeAfter(raw, vers.end) || dmgType,
        }));
      }
      return out;
    }

    // Save / automatic damage → damage-only with the DC spelled out.
    if (dcM) {
      const half = /half as much/i.test(raw) ? 'half on success' : '';
      noteBits.unshift(['DC ' + dcM[1] + ' ' + abbrevAbility(dcM[2]), half].filter(Boolean).join(' · '));
    }
    return [{
      id, label, type: 'damage-only',
      dmgDice: first.parsed.dice, dmgMod: first.parsed.mod, dmgType,
      note: noteBits.join(' · ') || undefined,
    }];
  }
  function isVersatile(raw, d) {
    const around = raw.slice(Math.max(0, d.end - 80), d.end + 80);
    return /two hands/i.test(around);
  }
  function abbrevAbility(word) {
    const w = String(word || '').toLowerCase();
    const map = { strength:'STR', dexterity:'DEX', constitution:'CON', intelligence:'INT', wisdom:'WIS', charisma:'CHA' };
    return map[w] || word.toUpperCase().slice(0, 3);
  }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function parseActions(statblock) {
    const acts = (statblock && Array.isArray(statblock.action)) ? statblock.action : [];
    const out = [];
    acts.forEach((a, i) => parseOneAction(a, i).forEach(x => out.push(x)));
    return out;
  }

  // ── statblock field helpers ──
  function acFrom(sb) {
    const ac = sb && sb.ac;
    if (Array.isArray(ac) && ac.length) return typeof ac[0] === 'object' ? (ac[0].ac || 10) : Number(ac[0]) || 10;
    return Number(ac) || 10;
  }
  function speedFrom(sb) {
    const sp = sb && sb.speed;
    if (typeof sp === 'number') return sp;
    if (sp && typeof sp === 'object') {
      const w = typeof sp.walk === 'object' ? sp.walk.number : sp.walk;
      return Number(w) || 30;
    }
    return 30;
  }

  // ── the adapter ──
  function toCharacter(comb) {
    const sb = (comb && comb.statblock) || {};
    const actions = parseActions(sb);
    return {
      key: KEY_PREFIX + comb.id,
      isMonster: true,
      hiddenFoe: !!comb.hidden,            // drives 🕯 + hidden:true feed rolls
      art: comb.art || null,               // page-resolved token art (optional)
      name: comb.name || sb.name || 'Monster',
      combat: {
        ac: (comb.ac != null ? comb.ac : acFrom(sb)),
        hp: (comb.hp != null ? comb.hp : (sb.hp && sb.hp.average) || 1),
        hpMax: (comb.max_hp != null ? comb.max_hp : (sb.hp && sb.hp.average) || 1),
        hpTemp: 0,
        speed: speedFrom(sb),
        initiative: abilityMod(sb.dex),
      },
      actions,
      // Primary tab: everything the statblock leads with (multiattack + attacks),
      // capped so the HUD row stays sane; All tab shows the rest.
      defaultSlots: actions.slice(0, 6).map(a => a.id),
      classFeatures: {},
      spells: {},
    };
  }

  window.MonsterActor = {
    toCharacter, parseActions, abilityMod, cleanText,
    isMonsterKey: k => typeof k === 'string' && k.indexOf(KEY_PREFIX) === 0,
    idFromKey: k => String(k).slice(KEY_PREFIX.length),
    keyFor: id => KEY_PREFIX + id,
  };
})();
