// ============================================================
// battle.js — Battle Mode HUD Overlay
// The Trials of Kirtas
// ============================================================
//
// DEPENDENCIES: characters.js must load before this file.
//   <script src="characters.js"></script>
//   <script src="battle.js"></script>
//
// WHAT THIS FILE DOES:
//   1. Injects a ⚔ Battle button + character switcher into #site-nav
//   2. On activation: shows flash, marquee, and HUD overlay
//   3. Mobile (≤600px): radial orb layout, fixed bottom-left
//   4. Desktop (>600px): full-width bar layout, fixed bottom
//   5. Reads ALL character data from CHARACTERS (characters.js)
//   6. State lives in memory for the session — no persistence yet
//
// CHARACTER DEFAULT:
//   Reads localStorage 'kirtas-active-character'.
//   Falls back to first character in CHAR_KEYS if nothing stored.
// ============================================================

(function () {
  'use strict';

  // ── Portrait URLs (Cloudinary) ──
  const PORTRAITS = {
    cosmere:  'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833033/kirtas/characters/cosmere.png',
    caim:     'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833008/kirtas/characters/caim.png',
    liadan:   'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779732202/kirtas/portraits/liadan.png',
    vesperian:'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833079/kirtas/characters/vesperian.png',
  };

  // ── Character accent colors ──
  const CHAR_COLOR = {
    cosmere:  '#9d4edd',
    caim:     '#c0001a',
    liadan:   '#1d9e75',
    vesperian:'#b8952a',
  };

  const CHAR_KEYS = ['liadan', 'cosmere', 'caim', 'vesperian'];

  // ── Battle cries ──
  const CRIES = [
    'Fight or DIE!', 'Round 1... FIGHT', 'Steel yourselves.',
    'For the Mousketeers.', 'Into the dark.', 'The mouse has entered combat.',
    'No mercy. No retreat.', 'The Gold Leaf feels far away.',
    "Fight or DIE! (Please don't die.)", "Veren's Watch is watching.",
  ];

  // ── Session-only combat state ──
  // Mirrors classFeatures from characters.js but mutable for the session.
  // Keys match CHARACTERS[key].classFeatures structure.
  const SESSION = {};

  function initSession(key) {
    if (SESSION[key]) return;
    const cf = CHARACTERS[key].classFeatures || {};
    const s = {};

    // HP
    s.hp = CHARACTERS[key].combat.hp;

    // Generic slot mirroring — copy each feature's {current, max} pair
    for (const [k, v] of Object.entries(cf)) {
      if (v && typeof v.current !== 'undefined') {
        s[k] = { current: v.current, max: v.max };
      } else if (k === 'spellSlots' || k === 'sorcererSlots') {
        s[k] = {};
        for (const [lvl, slot] of Object.entries(v)) {
          s[k][lvl] = { current: slot.current, max: slot.max };
        }
      }
    }

    SESSION[key] = s;
  }

  // ── Resource helpers ──
  // Returns flat array of { key, label, cur, max, color, type } for a character
  function getResources(charKey) {
    initSession(charKey);
    const ch = CHARACTERS[charKey];
    const s  = SESSION[charKey];
    const col = CHAR_COLOR[charKey];
    const res = [];

    const cf = ch.classFeatures || {};

    if (cf.bardicInspiration) {
      res.push({ key:'bardicInspiration', label:'Bardic', cur: s.bardicInspiration.current, max: s.bardicInspiration.max, color: col, type:'lute' });
    }
    if (cf.spellSlots) {
      for (const lvl of Object.keys(cf.spellSlots).sort()) {
        res.push({ key:`spell_${lvl}`, label:`L${lvl} Slot`, cur: s.spellSlots[lvl].current, max: s.spellSlots[lvl].max, color: col, type:'circle' });
      }
    }
    if (cf.pactSlots) {
      res.push({ key:'pactSlots', label:'Pact', cur: s.pactSlots.current, max: s.pactSlots.max, color: col, type:'diamond' });
    }
    if (cf.sorcererSlots) {
      for (const lvl of Object.keys(cf.sorcererSlots).sort()) {
        res.push({ key:`sorc_${lvl}`, label:`Sorc L${lvl}`, cur: s.sorcererSlots[lvl].current, max: s.sorcererSlots[lvl].max, color: col, type:'circle' });
      }
    }
    if (cf.kiPoints) {
      res.push({ key:'kiPoints', label:'Ki', cur: s.kiPoints.current, max: s.kiPoints.max, color: col, type:'fist' });
    }
    if (cf.actionSurge) {
      res.push({ key:'actionSurge', label:'Surge', cur: s.actionSurge.current, max: s.actionSurge.max, color: col, type:'circle' });
    }
    if (cf.secondWind) {
      res.push({ key:'secondWind', label:'2nd Wind', cur: s.secondWind.current, max: s.secondWind.max, color: col, type:'circle' });
    }

    return res;
  }

  function spendResource(charKey, resKey, amt) {
    initSession(charKey);
    const s = SESSION[charKey];
    // Map resource key back to session location
    if (resKey === 'bardicInspiration') {
      s.bardicInspiration.current = Math.max(0, s.bardicInspiration.current - amt);
    } else if (resKey.startsWith('spell_')) {
      const lvl = resKey.replace('spell_', '');
      s.spellSlots[lvl].current = Math.max(0, s.spellSlots[lvl].current - amt);
    } else if (resKey === 'pactSlots') {
      s.pactSlots.current = Math.max(0, s.pactSlots.current - amt);
    } else if (resKey.startsWith('sorc_')) {
      const lvl = resKey.replace('sorc_', '');
      s.sorcererSlots[lvl].current = Math.max(0, s.sorcererSlots[lvl].current - amt);
    } else if (resKey === 'kiPoints') {
      s.kiPoints.current = Math.max(0, s.kiPoints.current - amt);
    } else if (resKey === 'actionSurge') {
      s.actionSurge.current = Math.max(0, s.actionSurge.current - amt);
    } else if (resKey === 'secondWind') {
      s.secondWind.current = Math.max(0, s.secondWind.current - amt);
    }
  }

  function restoreResource(charKey, resKey, amt) {
    initSession(charKey);
    const s = SESSION[charKey];
    const orig = CHARACTERS[charKey].classFeatures || {};
    if (resKey === 'bardicInspiration') {
      s.bardicInspiration.current = Math.min(s.bardicInspiration.max, s.bardicInspiration.current + amt);
    } else if (resKey.startsWith('spell_')) {
      const lvl = resKey.replace('spell_', '');
      s.spellSlots[lvl].current = Math.min(s.spellSlots[lvl].max, s.spellSlots[lvl].current + amt);
    } else if (resKey === 'pactSlots') {
      s.pactSlots.current = Math.min(s.pactSlots.max, s.pactSlots.current + amt);
    } else if (resKey === 'kiPoints') {
      s.kiPoints.current = Math.min(s.kiPoints.max, s.kiPoints.current + amt);
    } else if (resKey === 'actionSurge') {
      s.actionSurge.current = Math.min(s.actionSurge.max, s.actionSurge.current + amt);
    } else if (resKey === 'secondWind') {
      s.secondWind.current = Math.min(s.secondWind.max, s.secondWind.current + amt);
    }
  }

  // Which spells use which resource key
  function getSpellsForResource(charKey, resKey) {
    const ch = CHARACTERS[charKey];
    const spells = ch.spells || {};
    const result = [];

    if (resKey === 'bardicInspiration') {
      // Bardic inspiration doesn't map to spells — it's given away
      return [{ name: 'Give Bardic Inspiration', note: 'Grant d6 to a creature within 60 ft', type: 'utility' }];
    }
    if (resKey === 'kiPoints') {
      // Ki maps to specific actions flagged with kiCost
      return (ch.actions || []).filter(a => a.kiCost || a.note && a.note.toLowerCase().includes('ki'));
    }
    if (resKey === 'actionSurge') {
      return [{ name: 'Action Surge', note: 'Take one additional action this turn', type: 'utility' }];
    }
    if (resKey === 'secondWind') {
      const sw = (ch.actions || []).find(a => a.id === 'second_wind');
      return sw ? [sw] : [{ name: 'Second Wind', note: 'Regain 1d10+lvl HP (bonus action)', type: 'damage-only' }];
    }

    // Spell slots — find spells of that level
    if (resKey.startsWith('spell_') || resKey.startsWith('sorc_') || resKey === 'pactSlots') {
      let lvl = resKey.startsWith('spell_') ? parseInt(resKey.replace('spell_',''))
              : resKey.startsWith('sorc_')  ? parseInt(resKey.replace('sorc_',''))
              : 1; // pact slots are level 1 for this party

      const atLevel = spells[lvl] || spells[String(lvl)] || [];
      // Also include cantrips separately — they never cost slots
      return atLevel;
    }

    return [];
  }

  // ── Conditions tracked per session ──
  const CONDITIONS = {};
  function getConditions(key) {
    if (!CONDITIONS[key]) CONDITIONS[key] = [];
    return CONDITIONS[key];
  }

  // ── State ──
  const CHAR_STORAGE_KEY = 'kirtas-active-character';
  let battleOn    = false;
  let activeKey   = 'liadan';
  let openPanel   = null;   // 'act' | 'bon' | 'spl' | 'hp' | 'res' | 'res-detail'
  let resDetailKey = null;  // which resource is open in res-detail
  let activeSet   = 0;
  let resIdx      = 0;
  let holdTimer   = null;
  let rollTimer   = null;
  let toastTimer  = null;
  let isMobile    = () => window.innerWidth <= 600;

  function C() { return CHARACTERS[activeKey]; }
  function S() { initSession(activeKey); return SESSION[activeKey]; }
  function col() { return CHAR_COLOR[activeKey]; }
  function res() { return getResources(activeKey); }

  // ── SVG icons ──
  const LUTE_SVG = `<svg viewBox="0 0 12 12" fill="currentColor"><path d="M8 1C10 1 11 2.5 11 4C11 6 9.5 7.5 8 7.5C7.2 7.5 6.6 7.2 6 6.8L2 10.5C1.6 11 1 10.5 1 10C1 9.5 1.4 9 1.8 8.6L5.5 5C5 4.4 4.5 3.8 4.5 3C4.5 1.8 6 1 8 1Z"/></svg>`;
  const FIST_SVG = `<svg viewBox="0 0 12 12" fill="currentColor"><path d="M4 2L4 6L2 6C1.5 6 1 6.5 1 7L1 9C1 10.5 2.5 12 4 12L8 12C9.5 12 11 10.5 11 9L11 5C11 4.5 10.5 4 10 4L9 4L9 2C9 1.5 8.5 1 8 1C7.5 1 7 1.5 7 2L7 4L6 4L6 2C6 1.5 5.5 1 5 1C4.5 1 4 1.5 4 2Z"/></svg>`;

  // ── Pip HTML ──
  function pipHtml(r) {
    let h = '';
    for (let i = 0; i < r.max; i++) {
      const on = i < r.cur;
      if (r.type === 'lute') {
        h += `<span class="b-pip-lute ${on?'on':'off'}" style="${on?`animation-delay:${i*0.35}s`:''}">${LUTE_SVG}</span>`;
      } else if (r.type === 'fist') {
        h += `<span class="b-pip-fist ${on?'on':'off'}">${FIST_SVG}</span>`;
      } else if (r.type === 'diamond') {
        h += `<span class="b-pip-diamond ${on?'on':'off'}" style="${on?`color:${r.color}`:''}" ></span>`;
      } else {
        h += `<span class="b-pip-circle ${on?'on':'off'}" style="${on?`background:${r.color}`:''}"></span>`;
      }
    }
    return h;
  }

  // ── Roll helper ──
  function parseDice(str) {
    if (!str) return 0;
    const m = str.match(/(\d+)d(\d+)/);
    if (!m) return 0;
    let total = 0;
    for (let i = 0; i < parseInt(m[1]); i++)
      total += Math.floor(Math.random() * parseInt(m[2])) + 1;
    return total;
  }

  function rollAction(action) {
    const isAttack = action.type === 'attack' || action.type === 'attack-cantrip';
    const isHeal   = action.dmgType === 'Healing';
    let label, val, detail;

    if (isAttack) {
      const d20 = Math.floor(Math.random() * 20) + 1;
      const total = d20 + (action.hitMod || 0);
      const crit  = d20 === 20;
      const dice  = crit ? (action.critDice || action.dmgDice) : action.dmgDice;
      const dmg   = parseDice(dice) + (action.dmgMod || 0);
      label  = action.label;
      val    = `${total}${crit ? ' ✦ CRIT' : ''}`;
      detail = `d20(${d20}) ${action.hitMod >= 0 ? '+' : ''}${action.hitMod} · ${dmg} ${action.dmgType || ''}${action.note ? ' · ' + action.note : ''}`;
    } else if (action.dmgDice) {
      const dmg = parseDice(action.dmgDice) + (action.dmgMod || 0);
      label  = action.label;
      val    = `${dmg} ${isHeal ? 'healed' : action.dmgType || ''}`;
      detail = `${action.dmgDice}${action.dmgMod ? '+'+action.dmgMod : ''}${action.note ? ' · '+action.note : ''}`;
    } else {
      label  = action.label;
      val    = action.note || '—';
      detail = action.type;
    }

    showRollResult(label, val, detail);
  }

  function showRollResult(label, val, detail) {
    const el = document.getElementById('b-rroll');
    if (!el) return;
    document.getElementById('b-rrName').textContent = label;
    document.getElementById('b-rrVal').textContent  = val;
    document.getElementById('b-rrDet').textContent  = detail;
    el.classList.add('show');
    if (rollTimer) clearTimeout(rollTimer);
    rollTimer = setTimeout(() => el.classList.remove('show'), 5000);
  }

  function showToast(msg, color) {
    const t = document.getElementById('b-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.cssText = `background:${color}18;border:1px solid ${color}44;color:${color};display:block`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2500);
  }

  // ── Action type classification ──
  function actionResourceKey(action) {
    const ch = C(); const cf = ch.classFeatures || {};
    if (!action) return null;
    // Cantrips never consume slots
    if (action.type === 'attack-cantrip' || action.type === 'utility') return null;
    // ki
    if (action.note && action.note.toLowerCase().includes('ki') && cf.kiPoints) return 'kiPoints';
    // secondWind
    if (action.id === 'second_wind' && cf.secondWind) return 'secondWind';
    // damage-only for spells
    if (action.type === 'damage-only' && (cf.spellSlots || cf.pactSlots || cf.sorcererSlots)) {
      // figure out level — default to lowest available
      if (cf.pactSlots)   return 'pactSlots';
      if (cf.spellSlots)  return `spell_${Object.keys(cf.spellSlots).sort()[0]}`;
      if (cf.sorcererSlots) return `sorc_${Object.keys(cf.sorcererSlots).sort()[0]}`;
    }
    return null;
  }

  function doAction(action) {
    const rk = actionResourceKey(action);
    if (rk) {
      spendResource(activeKey, rk, 1);
      const resArr = getResources(activeKey);
      const r = resArr.find(r => r.key === rk);
      if (r) showToast(`${r.label}: ${r.cur - 1}/${r.max}`, col());
    }
    rollAction(action);
    closePanel();
    renderAll();
  }

  // ── Panel open/close ──
  function openPanelFn(id) {
    openPanel = id;
    renderPanel();
    // Highlight active node on mobile orb
    document.querySelectorAll('.b-rnode').forEach(n => n.classList.remove('active'));
    const map = { act:'b-nAct', bon:'b-nBon', spl:'b-nSpl', hp:'b-nHp' };
    if (map[id]) { const el = document.getElementById(map[id]); if (el) el.classList.add('active'); }
  }

  function closePanel() {
    openPanel = null; resDetailKey = null;
    const p = document.getElementById('b-panel');
    if (p) p.classList.remove('show');
    document.querySelectorAll('.b-rnode').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.b-dact-btn').forEach(n => n.classList.remove('active'));
  }

  // ── Build panels ──
  function panelHeader(color, title) {
    return `<div class="b-ph"><span class="b-ph-dot" style="background:${color}"></span><span class="b-ph-title" style="color:${color}">${title}</span><button class="b-ph-close" onclick="window.__battle.closePanel()">✕</button></div>`;
  }

  function actionRow(action, color) {
    const ch = C();
    const rk = actionResourceKey(action);
    const resArr = rk ? getResources(activeKey) : [];
    const r = rk ? resArr.find(r => r.key === rk) : null;
    const canUse = !r || r.cur > 0;

    const isCantrip  = action.type === 'attack-cantrip';
    const isAttack   = action.type === 'attack';
    const isUtility  = action.type === 'utility';

    const tagHtml = isCantrip ? '<span class="b-ai-tag b-tag-cantrip">cantrip</span>'
                  : rk && rk === 'kiPoints' ? '<span class="b-ai-tag b-tag-ki">1 ki</span>'
                  : rk ? `<span class="b-ai-tag b-tag-spell">slot</span>`
                  : '';

    const hitHtml = (isAttack || isCantrip) && action.hitMod !== undefined
      ? `<span class="b-ai-hit" style="color:${color}">+${action.hitMod}</span>` : '';

    const dmgHtml = action.dmgDice
      ? `<span class="b-ai-dmg">${action.dmgDice}${action.dmgMod?'+'+action.dmgMod:''} ${action.dmgType||''}</span>`
      : action.note ? `<span class="b-ai-dmg">${action.note.substring(0,40)}</span>` : '';

    return `<div class="b-aitem${canUse?'':' empty'}" onclick="window.__battle.doActionById('${activeKey}','${action.id}')">
      <span class="b-ai-name">${action.label}${tagHtml}</span>
      ${hitHtml}${dmgHtml}
      <span class="b-ai-roll">d</span>
    </div>`;
  }

  function renderPanel() {
    const p = document.getElementById('b-panel');
    if (!p || !openPanel) { if(p) p.classList.remove('show'); return; }
    p.classList.add('show');

    const ch = C(); const color = col();
    const resources = getResources(activeKey);
    const conditions = getConditions(activeKey);

    if (openPanel === 'act') {
      // Standard actions — use defaultSlots to determine the primary set
      const slots = ch.defaultSlots || [];
      const allActions = ch.actions || [];
      const setA = slots.map(id => allActions.find(a => a.id === id)).filter(Boolean);
      const setB = allActions.filter(a => !slots.includes(a.id));
      const setActions = activeSet === 0 ? setA : setB;
      const tabHtml = `<div class="b-set-tabs">
        <button class="b-stab${activeSet===0?' on':''}" style="${activeSet===0?`color:#f0ece4;border-bottom:2px solid ${color}`:''}" onclick="window.__battle.switchSet(0)">Primary</button>
        <button class="b-stab${activeSet===1?' on':''}" style="${activeSet===1?`color:#f0ece4;border-bottom:2px solid ${color}`:''}" onclick="window.__battle.switchSet(1)">All</button>
      </div>`;
      p.innerHTML = panelHeader('#c0001a', 'Standard action') + tabHtml + setActions.map(a => actionRow(a, '#c0001a')).join('');

    } else if (openPanel === 'bon') {
      // Bonus actions — look for bonus-action-tagged items
      const bon = (ch.actions || []).filter(a =>
        (a.note && (a.note.toLowerCase().includes('bonus action') || a.note.toLowerCase().includes('bonus')))
        || a.id === 'healing_word' || a.id === 'second_wind' || a.id === 'hand_of_healing'
      );
      p.innerHTML = panelHeader('#2d7dd2', 'Bonus action') + (bon.length ? bon.map(a => actionRow(a, '#2d7dd2')).join('') : '<div style="padding:12px 10px;font-size:11px;color:#444">No bonus actions defined</div>');

    } else if (openPanel === 'spl') {
      const spells = ch.spells || {};
      let html = panelHeader(color, ch.subclass && ch.subclass.toLowerCase().includes('monk') ? 'Ki abilities' : 'Spells & cantrips');
      // Cantrips first
      const cantrips = spells.cantrip || spells.cantrips || [];
      if (cantrips.length) {
        html += `<div class="b-spell-section-lbl">Cantrips</div>`;
        html += cantrips.map(s => {
          const a = (ch.actions||[]).find(a => a.label && a.label.toLowerCase() === s.name.toLowerCase());
          if (a) return actionRow(a, color);
          return `<div class="b-aitem" onclick="window.__battle.doSpellByName('${s.name}')"><span class="b-ai-name">${s.name}<span class="b-ai-tag b-tag-cantrip">cantrip</span></span><span class="b-ai-dmg">${s.castingTime||''} · ${s.range||''}</span><span class="b-ai-roll">d</span></div>`;
        }).join('');
      }
      // Spell levels
      for (let lvl = 1; lvl <= 9; lvl++) {
        const levelSpells = spells[lvl] || spells[String(lvl)] || [];
        if (!levelSpells.length) continue;
        const rk = ch.classFeatures?.pactSlots ? 'pactSlots' : `spell_${lvl}`;
        const r = resources.find(r => r.key === rk);
        const avail = r ? r.cur : '?';
        html += `<div class="b-spell-section-lbl">Level ${lvl} <span style="color:${color};margin-left:4px">${avail} left</span></div>`;
        html += levelSpells.map(s => {
          const a = (ch.actions||[]).find(a => a.label && a.label.toLowerCase() === s.name.toLowerCase());
          if (a) return actionRow(a, color);
          return `<div class="b-aitem${avail>0?'':' empty'}" onclick="window.__battle.castSpell('${rk}','${s.name}','${s.castingTime||''}','${s.range||''}')"><span class="b-ai-name">${s.name}${s.ritual?'<span class="b-ai-tag b-tag-ritual">R</span>':''}</span><span class="b-ai-dmg">${s.castingTime||''} · ${s.range||''}</span><span class="b-ai-roll">d</span></div>`;
        }).join('');
      }
      p.innerHTML = html;

    } else if (openPanel === 'hp') {
      const hpPct = S().hp / ch.combat.hpMax;
      const hpCol = hpPct > 0.5 ? '#5a9a6a' : hpPct > 0.25 ? '#c8a020' : '#c0001a';
      const saves = ch.saves || {};
      const conds = ['Poisoned','Frightened','Paralyzed','Prone','Stunned','Concentration','Blinded','Deafened'];
      const activeC = getConditions(activeKey);
      p.innerHTML = `${panelHeader('#5a9a6a','Stats & HP')}
        <div class="b-hp-panel">
          <div class="b-hp-track-row">
            <span class="b-hp-num" id="b-hpNum" style="color:${hpCol}">${S().hp}</span>
            <span class="b-hp-max">/ ${ch.combat.hpMax}</span>
            <div class="b-hp-adj">
              <input class="b-hp-adj-input" id="b-hpInput" type="number" min="1" max="99" value="1">
              <button class="b-hp-adj-btn dmg"  onclick="window.__battle.adjHp(-1)">−</button>
              <button class="b-hp-adj-btn heal" onclick="window.__battle.adjHp(1)">+</button>
            </div>
          </div>
          <div class="b-stat-grid">
            <div class="b-stat-box"><span class="b-stat-val">${ch.combat.ac}</span><span class="b-stat-lbl">AC</span></div>
            <div class="b-stat-box"><span class="b-stat-val">${ch.combat.speed}</span><span class="b-stat-lbl">Speed</span></div>
            <div class="b-stat-box"><span class="b-stat-val">+${ch.combat.initiative}</span><span class="b-stat-lbl">Init</span></div>
          </div>
          <div class="b-sec-lbl">Save Proficiencies</div>
          <div class="b-save-row">${Object.entries(saves).map(([k,v]) =>
            `<span class="b-save-pip ${v.proficient?'prof':'no'}">${k.toUpperCase()}</span>`).join('')}</div>
          <div class="b-sec-lbl">Conditions</div>
          <div class="b-cond-row">${conds.map(cd =>
            `<span class="b-cond${activeC.includes(cd)?' active':''}" onclick="window.__battle.toggleCond('${cd}')">${cd}</span>`).join('')}</div>
        </div>`;

    } else if (openPanel === 'res') {
      let html = panelHeader(col(), 'Resources');
      html += '<div class="b-res-list">';
      html += resources.map(r =>
        `<div class="b-rh-row" onclick="window.__battle.openResDetail('${r.key}')">
          <span class="b-rh-label" style="color:${r.color}">${r.label}</span>
          <div class="b-rh-pips">${pipHtml(r)}</div>
          <span class="b-rh-count" style="color:${r.color}">${r.cur}/${r.max}</span>
          <span class="b-rh-arrow">›</span>
        </div>`).join('');
      html += '<div class="b-rh-hint">tap a resource to view spells or spend</div></div>';
      p.innerHTML = html;

    } else if (openPanel === 'res-detail') {
      const r = resources.find(r => r.key === resDetailKey);
      if (!r) { openPanelFn('res'); return; }
      const spellsForRes = getSpellsForResource(activeKey, resDetailKey);
      let html = `<div class="b-ph">
        <button class="b-ph-back" onclick="window.__battle.openPanel('res')">‹</button>
        <span class="b-ph-dot" style="background:${r.color}"></span>
        <span class="b-ph-title" style="color:${r.color}">${r.label} · ${r.cur}/${r.max}</span>
        <button class="b-ph-close" onclick="window.__battle.closePanel()">✕</button>
      </div>`;
      // Spend/restore controls
      html += `<div class="b-res-ctrl">
        <button class="b-rc-btn restore" onclick="window.__battle.changeRes('${resDetailKey}',1)" ${r.cur>=r.max?'disabled':''}>+ restore</button>
        <div class="b-rh-pips" style="flex:1;justify-content:center">${pipHtml(r)}</div>
        <button class="b-rc-btn spend" onclick="window.__battle.changeRes('${resDetailKey}',-1)" ${r.cur<=0?'disabled':''}>− spend</button>
      </div>`;
      if (spellsForRes.length) {
        html += `<div class="b-spell-section-lbl">Cast with this slot</div>`;
        html += spellsForRes.map(s => {
          if (s.id) {
            // It's a full action object
            return actionRow(s, r.color);
          }
          return `<div class="b-aitem" onclick="window.__battle.castSpell('${resDetailKey}','${s.name}','${s.castingTime||''}','${s.range||''}')">
            <span class="b-ai-name">${s.name}</span>
            <span class="b-ai-dmg">${s.castingTime||''} ${s.range?'· '+s.range:''}</span>
            <span class="b-ai-roll">d</span>
          </div>`;
        }).join('');
      }
      p.innerHTML = html;
    }
  }

  // ── Mobile: Orb layout ──
  function buildMobileHud() {
    return `
    <div id="b-orb-zone">
      <svg id="b-orb-svg" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="55" cy="55" r="50" id="b-ro-bg" stroke-width="3.5"/>
        <circle cx="55" cy="55" r="50" id="b-ro"    stroke-width="3.5" stroke-linecap="round" stroke-dashoffset="70" style="transform-origin:center;transform:rotate(-90deg)"/>
        <circle cx="55" cy="55" r="41" id="b-ri-bg" stroke-width="2.5"/>
        <circle cx="55" cy="55" r="41" id="b-ri"    stroke-width="2.5" stroke-linecap="round" stroke-dashoffset="55" opacity="0.4" style="transform-origin:center;transform:rotate(-90deg)"/>
      </svg>
      <div class="b-rnode b-n-top"    id="b-nAct" onclick="window.__battle.openPanel('act')"><span class="b-rn-ico" style="color:#c0001a">⚔</span><span class="b-rn-lbl" style="color:#c0001a">Act</span></div>
      <div class="b-rnode b-n-right"  id="b-nBon" onclick="window.__battle.openPanel('bon')"><span class="b-rn-ico" style="color:#2d7dd2">⚡</span><span class="b-rn-lbl" style="color:#2d7dd2">Bon</span></div>
      <div class="b-rnode b-n-bottom" id="b-nSpl" onclick="window.__battle.openPanel('spl')"></div>
      <div class="b-rnode b-n-left"   id="b-nHp"  onclick="window.__battle.openPanel('hp')"><span class="b-rn-ico" style="color:#5a9a6a">♡</span><span class="b-rn-lbl" style="color:#5a9a6a">Info</span></div>
      <button class="b-orb-btn" id="b-orbBtn">
        <img class="b-orb-portrait" id="b-orbPortrait" src="" alt="">
        <span class="b-orb-hp-tag" id="b-orbHpTag">0/0</span>
      </button>
    </div>`;
  }

  // ── Desktop: Bar layout ──
  function buildDesktopHud() {
    return `
    <div id="b-desktop-bar">
      <div id="b-dbar-top">
        <div id="b-dchar-chip">
          <img class="b-dbar-portrait" id="b-dPortrait" src="" alt="">
          <div class="b-dchar-info">
            <span class="b-dchar-name" id="b-dCharName"></span>
            <span class="b-dchar-hp"   id="b-dCharHp"></span>
          </div>
        </div>
        <div class="b-ddivider"></div>
        <div id="b-dstats">
          <div class="b-dstat"><span class="b-dstat-val" id="b-dAC"></span><span class="b-dstat-lbl">AC</span></div>
          <div class="b-dstat"><span class="b-dstat-val" id="b-dSpd"></span><span class="b-dstat-lbl">Spd</span></div>
          <div class="b-dstat"><span class="b-dstat-val" id="b-dInit"></span><span class="b-dstat-lbl">Init</span></div>
        </div>
        <div class="b-ddivider"></div>
        <div id="b-dres-strip" class="b-dres-strip"></div>
      </div>
      <div id="b-dbar-btns">
        <button class="b-dact-btn" id="b-dAct" onclick="window.__battle.openPanel('act')"><span class="b-dact-ico">⚔</span><span class="b-dact-lbl">Action</span></button>
        <button class="b-dact-btn" id="b-dBon" onclick="window.__battle.openPanel('bon')"><span class="b-dact-ico">⚡</span><span class="b-dact-lbl">Bonus</span></button>
        <button class="b-dact-btn" id="b-dSpl" onclick="window.__battle.openPanel('spl')"><span class="b-dact-ico">✦</span><span class="b-dact-lbl">Spells</span></button>
        <button class="b-dact-btn" id="b-dHp"  onclick="window.__battle.openPanel('hp')"><span class="b-dact-ico">♡</span><span class="b-dact-lbl">Info</span></button>
        <button class="b-dact-btn" id="b-dRes" onclick="window.__battle.openPanel('res')"><span class="b-dact-ico">◎</span><span class="b-dact-lbl">Resources</span></button>
      </div>
    </div>`;
  }

  // ── Full HUD DOM ──
  function buildHudHtml() {
    return `
      <div id="battle-mq"><div class="bm-inner"><span class="bm-txt" id="bm-txt">Fight or DIE!</span><span class="bm-sep">✦</span><span class="bm-txt">Round 1</span><span class="bm-sep">✦</span><span class="bm-txt" id="bm-txt2">Fight or DIE!</span></div></div>
      <div id="battle-flash" onclick="window.__battle.dismissFlash()">
        <div class="bf-eye">Roll for Initiative</div>
        <div class="bf-txt" id="bf-txt">Fight or DIE!</div>
        <div class="bf-sub">tap to dismiss</div>
      </div>
      <div id="battle-hud">
        <div id="b-rroll"><div class="b-rr-name" id="b-rrName"></div><span class="b-rr-val" id="b-rrVal"></span><div class="b-rr-det" id="b-rrDet"></div></div>
        <div id="b-toast"></div>
        <div class="b-hud-row">
          ${buildMobileHud()}
          <div id="b-shelf-zone">
            <div id="b-shelf"></div>
            <div id="b-panel"></div>
          </div>
        </div>
        ${buildDesktopHud()}
        <div id="b-panel-desktop"></div>
      </div>`;
  }

  // ── Render mobile orb ──
  function renderMobileOrb() {
    const ch = C(); const s = S(); const resources = res();
    const color = col();
    const portrait = PORTRAITS[activeKey] || '';

    // Portrait
    const po = document.getElementById('b-orbPortrait');
    if (po) { po.src = portrait; po.style.borderColor = color; }

    // HP tag
    const ht = document.getElementById('b-orbHpTag');
    if (ht) {
      ht.textContent = s.hp + '/' + ch.combat.hpMax;
      ht.style.color = s.hp <= ch.combat.hpMax * 0.25 ? '#c0001a' : s.hp <= ch.combat.hpMax * 0.5 ? '#c8a020' : '#5a9a6a';
    }

    // Spell/Ki node
    const ns = document.getElementById('b-nSpl');
    if (ns) {
      ns.style.borderColor = color;
      ns.innerHTML = `<span class="b-rn-ico" style="color:${color}">✦</span><span class="b-rn-lbl" style="color:${color}">${ch.subclass && ch.subclass.toLowerCase().includes('monk') ? 'Ki' : 'Spl'}</span>`;
    }

    // Rings
    const primary = resources[0];
    const secondary = resources[1];
    const co = 2 * Math.PI * 50, ci = 2 * Math.PI * 41;

    const roBg = document.getElementById('b-ro-bg');
    const ro   = document.getElementById('b-ro');
    const riBg = document.getElementById('b-ri-bg');
    const ri   = document.getElementById('b-ri');

    if (roBg && ro && primary) {
      roBg.setAttribute('stroke', color + '22');
      ro.setAttribute('stroke', color);
      const pct = primary.max > 0 ? primary.cur / primary.max : 0;
      ro.setAttribute('stroke-dasharray', `${co * pct} ${co * (1 - pct)}`);
    }
    if (riBg && ri) {
      if (secondary) {
        const pct2 = secondary.max > 0 ? secondary.cur / secondary.max : 0;
        riBg.setAttribute('stroke', (secondary.color || color) + '22');
        ri.setAttribute('stroke', secondary.color || color);
        ri.setAttribute('stroke-dasharray', `${ci * pct2} ${ci * (1 - pct2)}`);
        ri.style.display = ''; riBg.style.display = '';
      } else {
        ri.style.display = 'none'; riBg.style.display = 'none';
      }
    }

    // Shelf
    const shelf = document.getElementById('b-shelf');
    if (shelf) {
      shelf.innerHTML = resources.map(r =>
        `<div class="b-srow"><span class="b-slbl">${r.label}</span><div class="b-pips">${pipHtml(r)}</div></div>`
      ).join('');
    }
  }

  // ── Render desktop bar ──
  function renderDesktopBar() {
    const ch = C(); const s = S(); const resources = res();
    const color = col();
    const portrait = PORTRAITS[activeKey] || '';

    const dp = document.getElementById('b-dPortrait');
    if (dp) dp.src = portrait;
    const dn = document.getElementById('b-dCharName');
    if (dn) { dn.textContent = ch.name; dn.style.color = color; }
    const dh = document.getElementById('b-dCharHp');
    if (dh) {
      dh.textContent = s.hp + '/' + ch.combat.hpMax + ' hp';
      dh.style.color = s.hp <= ch.combat.hpMax * 0.25 ? '#c0001a' : s.hp <= ch.combat.hpMax * 0.5 ? '#c8a020' : '#5a9a6a';
    }
    const da = document.getElementById('b-dAC');   if (da) da.textContent = ch.combat.ac;
    const ds = document.getElementById('b-dSpd');  if (ds) ds.textContent = ch.combat.speed;
    const di = document.getElementById('b-dInit'); if (di) di.textContent = '+' + ch.combat.initiative;

    // Resource strip
    const strip = document.getElementById('b-dres-strip');
    if (strip) {
      strip.innerHTML = resources.map(r =>
        `<div class="b-dres-chip" onclick="window.__battle.openResDetail('${r.key}')">
          <span class="b-dres-lbl">${r.label}</span>
          <div class="b-dres-pips">${pipHtml(r)}</div>
        </div>`
      ).join('');
    }

    // Desktop action button colors
    const btnColor = (id, c) => {
      const el = document.getElementById(id);
      if (el) el.querySelector('.b-dact-ico').style.color = c;
    };
    btnColor('b-dSpl', color);
    btnColor('b-dRes', color);

    // Sync panel if open
    if (openPanel) renderPanel();
  }

  // ── renderAll ──
  function renderAll() {
    if (isMobile()) {
      renderMobileOrb();
    } else {
      renderDesktopBar();
    }
  }

  // ── Mount HUD ──
  function mountHud() {
    if (document.getElementById('battle-hud')) return;
    const wrap = document.createElement('div');
    wrap.id = 'battle-hud-root';
    wrap.innerHTML = buildHudHtml();
    document.body.appendChild(wrap);

    // Mobile orb: tap = cycle resource in ring display, hold = open resource panel
    const ob = document.getElementById('b-orbBtn');
    if (ob) {
      ob.addEventListener('click', () => { resIdx = (resIdx + 1) % res().length; renderMobileOrb(); });
      const startHold = () => { holdTimer = setTimeout(() => { holdTimer = null; openPanelFn('res'); }, 500); };
      const endHold   = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
      ob.addEventListener('mousedown', startHold);
      ob.addEventListener('touchstart', startHold, { passive: true });
      ['mouseup','mouseleave','touchend'].forEach(e => ob.addEventListener(e, endHold));
    }

    // Desktop panel syncs to #b-panel-desktop instead of #b-panel on large screens
    // Both exist in DOM; we toggle visibility via renderAll
  }

  // ── Show/hide layouts ──
  function syncLayouts() {
    const mobile = isMobile();
    const orbZone = document.getElementById('b-orb-zone');
    const shelfZone = document.getElementById('b-shelf-zone');
    const dbar = document.getElementById('b-desktop-bar');
    const panel = document.getElementById('b-panel');
    const panelD = document.getElementById('b-panel-desktop');

    if (orbZone)   orbZone.style.display   = mobile ? '' : 'none';
    if (shelfZone) shelfZone.style.display = mobile ? '' : 'none';
    if (dbar)      dbar.style.display      = mobile ? 'none' : '';

    // Route panel rendering to correct container
    if (panel && panelD) {
      if (mobile) {
        panelD.style.display = 'none';
      } else {
        panel.classList.remove('show');
        panel.style.display = 'none';
        panelD.style.display = '';
      }
    }
  }

  // Override renderPanel to target correct container
  const _renderPanelOrig = renderPanel;
  function renderPanelRouted() {
    if (!isMobile()) {
      // redirect panel target
      const realPanel = document.getElementById('b-panel-desktop');
      if (!realPanel) return;
      // temporarily remap getElementById for 'b-panel'
      const orig = document.getElementById('b-panel');
      if (orig) orig.id = 'b-panel-hidden';
      realPanel.id = 'b-panel';
      _renderPanelOrig();
      realPanel.id = 'b-panel-desktop';
      if (orig) orig.id = 'b-panel';
      if (openPanel) realPanel.classList.add('show');
      else realPanel.classList.remove('show');
    } else {
      _renderPanelOrig();
    }
  }
  // Patch renderPanel globally in this scope
  // (We do this inline because closures share the same renderPanel reference)

  // ── Battle toggle ──
  function toggleBattle() {
    battleOn = !battleOn;
    const btn = document.getElementById('battle-btn');
    if (btn) btn.classList.toggle('on', battleOn);

    if (battleOn) {
      mountHud();
      initSession(activeKey);

      const cry = CRIES[Math.floor(Math.random() * CRIES.length)];
      const bf = document.getElementById('bf-txt');
      const bm1 = document.getElementById('bm-txt');
      const bm2 = document.getElementById('bm-txt2');
      if (bf) bf.textContent = cry;
      if (bm1) bm1.textContent = cry;
      if (bm2) bm2.textContent = cry;

      document.getElementById('battle-flash').classList.add('show');
      document.getElementById('battle-mq').classList.add('show');
      const hud = document.getElementById('battle-hud');
      if (hud) hud.classList.add('show');

      const sw = document.getElementById('battle-char-switcher');
      if (sw) sw.classList.add('visible');

      syncLayouts();
      renderAll();
    } else {
      ['battle-flash','battle-mq','battle-hud'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('show');
      });
      const sw = document.getElementById('battle-char-switcher');
      if (sw) sw.classList.remove('visible');
      closePanel();
    }
  }

  // ── Character switch ──
  function setChar(key) {
    activeKey = key; activeSet = 0; resIdx = 0;
    try { localStorage.setItem(CHAR_STORAGE_KEY, key); } catch(e) {}
    document.querySelectorAll('.bchar-tab').forEach(t => t.classList.toggle('on', t.dataset.key === key));
    initSession(key);
    closePanel();
    syncLayouts();
    renderAll();
  }

  // ── Inject nav button ──
  function injectNavButton() {
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    const group = document.createElement('div');
    group.id = 'battle-nav-group';
    group.classList.add('visible');

    const switcher = document.createElement('div');
    switcher.id = 'battle-char-switcher';
    CHAR_KEYS.forEach(key => {
      if (!CHARACTERS[key]) return;
      const btn = document.createElement('button');
      btn.className = 'bchar-tab' + (key === activeKey ? ' on' : '');
      btn.dataset.key = key;
      btn.textContent = CHARACTERS[key].name.split(' ')[0]; // first name only
      btn.addEventListener('click', () => setChar(key));
      switcher.appendChild(btn);
    });

    const battleBtn = document.createElement('button');
    battleBtn.id = 'battle-btn';
    battleBtn.textContent = '⚔ Battle';
    battleBtn.addEventListener('click', toggleBattle);

    group.appendChild(switcher);
    group.appendChild(battleBtn);
    nav.appendChild(group);
  }

  // ── Inject styles ──
  function injectStyles() {
    if (document.getElementById('battle-styles')) return;
    const style = document.createElement('style');
    style.id = 'battle-styles';
    style.textContent = `
      /* Nav group */
      #battle-nav-group { display:none; align-items:center; gap:5px; margin-left:6px; flex-shrink:0; }
      #battle-nav-group.visible { display:flex; }
      #battle-btn { padding:3px 9px; border:1.5px solid #c0001a; background:transparent; color:#c0001a; font-family:var(--font-title,'Barlow Condensed',system-ui); font-size:0.5rem; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; cursor:pointer; transition:background 0.15s,color 0.15s; height:24px; flex-shrink:0; line-height:1; }
      #battle-btn:hover, #battle-btn.on { background:#c0001a; color:#f0ece4; }
      #battle-char-switcher { display:none; align-items:center; gap:4px; }
      #battle-char-switcher.visible { display:flex; }
      .bchar-tab { padding:2px 6px; border:1px solid transparent; background:transparent; font-family:var(--font-title,'Barlow Condensed',system-ui); font-size:0.44rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted,#555); cursor:pointer; transition:all 0.12s; white-space:nowrap; border-radius:2px; }
      .bchar-tab:hover { color:var(--aged,#888); }
      .bchar-tab.on { color:#f0ece4; background:#1e1e2a; border-color:#2a2a3a; }

      /* Marquee */
      #battle-mq { position:fixed; top:52px; left:0; right:0; height:18px; background:#c0001a; overflow:hidden; z-index:149; display:none; }
      #battle-mq.show { display:block; }
      .bm-inner { display:flex; align-items:center; height:18px; white-space:nowrap; animation:bm-roll 14s linear infinite; }
      @keyframes bm-roll { from{transform:translateX(50%)} to{transform:translateX(-100%)} }
      .bm-txt { font-family:var(--font-title,'Barlow Condensed',system-ui); font-size:8px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:#f0ece4; padding:0 20px; }
      .bm-sep { color:rgba(240,236,228,0.35); padding:0 8px; }

      /* Flash */
      #battle-flash { position:fixed; inset:0; background:rgba(6,4,8,0.96); z-index:300; display:none; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; }
      #battle-flash.show { display:flex; }
      .bf-eye { font-family:var(--font-title,'Barlow Condensed',system-ui); font-size:9px; letter-spacing:0.4em; text-transform:uppercase; color:rgba(192,0,26,0.5); }
      .bf-txt { font-family:var(--font-title,'Barlow Condensed',system-ui); font-size:clamp(1.8rem,5vw,2.8rem); font-weight:900; text-transform:uppercase; color:#f0ece4; letter-spacing:0.06em; line-height:1.1; text-align:center; padding:0 1.5rem; }
      .bf-sub { font-family:var(--font-title,'Barlow Condensed',system-ui); font-size:8px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(192,0,26,0.4); margin-top:4px; }

      /* HUD root */
      #battle-hud { position:fixed; z-index:150; display:none; flex-direction:column; gap:5px; font-family:var(--font-title,'Barlow Condensed',system-ui); }
      #battle-hud.show { display:flex; }

      /* ── MOBILE layout ── */
      @media (max-width:600px) {
        #battle-hud { bottom:16px; left:12px; width:300px; }
        #b-desktop-bar { display:none !important; }
        #b-panel-desktop { display:none !important; }
      }
      /* ── DESKTOP layout ── */
      @media (min-width:601px) {
        #battle-hud { bottom:0; left:0; right:0; width:100%; gap:0; }
        #b-orb-zone { display:none !important; }
        #b-shelf-zone { display:none !important; }
        #b-rroll { position:fixed; bottom:130px; left:12px; width:260px; }
        #b-toast { position:fixed; bottom:130px; left:280px; width:200px; text-align:left; }
      }

      /* Roll result */
      #b-rroll { background:#111018; border-left:3px solid #b8952a; border-radius:4px; padding:6px 10px; display:none; }
      #b-rroll.show { display:block; }
      .b-rr-name { font-size:10px; font-weight:700; color:#f0ece4; }
      .b-rr-val  { font-size:22px; font-weight:900; color:#f0ece4; display:block; line-height:1.1; }
      .b-rr-det  { font-size:8px; color:#555; }

      /* Toast */
      #b-toast { padding:5px 8px; border-radius:4px; font-size:9px; letter-spacing:0.06em; display:none; border-radius:4px; }

      /* Mobile orb row */
      .b-hud-row { display:flex; gap:8px; align-items:flex-start; }
      #b-orb-zone { position:relative; width:110px; height:110px; flex-shrink:0; }
      #b-orb-svg  { position:absolute; top:0; left:0; width:110px; height:110px; pointer-events:none; }

      .b-rnode { position:absolute; border-radius:50%; background:#09090d; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; z-index:6; user-select:none; transition:background 0.12s; width:30px; height:30px; border:1.5px solid #333; }
      .b-rnode:hover, .b-rnode.active { background:#1a1a2a; }
      .b-rn-ico { font-size:11px; line-height:1; }
      .b-rn-lbl { font-size:6px; letter-spacing:0.06em; text-transform:uppercase; margin-top:1px; }
      .b-n-top    { top:3px;    left:50%; transform:translateX(-50%); }
      .b-n-right  { top:50%;   right:3px; transform:translateY(-50%); }
      .b-n-bottom { bottom:3px; left:50%; transform:translateX(-50%); }
      .b-n-left   { top:50%;   left:3px;  transform:translateY(-50%); }

      .b-orb-btn { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:62px; height:62px; border-radius:50%; background:#09090d; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; z-index:6; user-select:none; transition:background 0.12s; border:none; outline:none; overflow:hidden; padding:0; }
      .b-orb-btn:hover { background:#111018; }
      .b-orb-portrait { width:62px; height:62px; border-radius:50%; object-fit:cover; object-position:center top; border:2px solid transparent; display:block; }
      .b-orb-hp-tag { position:absolute; bottom:3px; left:50%; transform:translateX(-50%); font-size:7px; font-weight:700; white-space:nowrap; background:rgba(9,9,13,0.8); padding:0 3px; border-radius:2px; }

      /* Mobile shelf */
      #b-shelf-zone { flex:1; display:flex; flex-direction:column; gap:5px; min-width:0; }
      #b-shelf { background:#111018; border-radius:5px; padding:5px 8px; display:flex; flex-direction:column; gap:3px; }
      .b-srow { display:flex; align-items:center; gap:4px; }
      .b-slbl { font-size:7px; letter-spacing:0.1em; text-transform:uppercase; color:#444; width:36px; flex-shrink:0; }
      .b-pips { display:flex; gap:2px; align-items:center; flex-wrap:wrap; }

      /* ── Desktop bar ── */
      #b-desktop-bar { background:#0d0d14; border-top:1px solid #1a1a28; }
      #b-dbar-top { display:flex; align-items:center; gap:10px; padding:8px 16px; border-bottom:1px solid #1a1a28; }
      #b-dbar-btns { display:flex; }

      #b-dchar-chip { display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .b-dbar-portrait { width:36px; height:36px; border-radius:4px; object-fit:cover; object-position:center top; }
      .b-dchar-info { display:flex; flex-direction:column; gap:1px; }
      .b-dchar-name { font-size:14px; font-weight:700; line-height:1; }
      .b-dchar-hp   { font-size:10px; }

      .b-ddivider { width:1px; height:36px; background:#1a1a28; flex-shrink:0; }
      #b-dstats { display:flex; gap:14px; align-items:center; flex-shrink:0; }
      .b-dstat { display:flex; flex-direction:column; align-items:center; gap:1px; }
      .b-dstat-val { font-size:16px; font-weight:700; color:#f0ece4; line-height:1; }
      .b-dstat-lbl { font-size:7px; color:#444; letter-spacing:0.1em; text-transform:uppercase; }

      .b-dres-strip { display:flex; gap:10px; align-items:center; flex:1; flex-wrap:wrap; }
      .b-dres-chip { display:flex; flex-direction:column; gap:2px; align-items:center; cursor:pointer; padding:2px 4px; border-radius:3px; transition:background 0.12s; }
      .b-dres-chip:hover { background:#1a1a28; }
      .b-dres-lbl  { font-size:7px; color:#444; text-transform:uppercase; letter-spacing:0.08em; }
      .b-dres-pips { display:flex; gap:2px; align-items:center; }

      .b-dact-btn { flex:1; padding:8px 6px; background:#0d0d14; border:none; border-top:1px solid #1a1a28; border-right:1px solid #1a1a28; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; cursor:pointer; transition:background 0.12s; }
      .b-dact-btn:last-child { border-right:none; }
      .b-dact-btn:hover, .b-dact-btn.active { background:#111018; }
      .b-dact-ico { font-size:16px; color:#f0ece4; line-height:1; }
      .b-dact-lbl { font-size:8px; color:#555; letter-spacing:0.1em; text-transform:uppercase; }
      #b-dAct .b-dact-ico { color:#c0001a; }
      #b-dBon .b-dact-ico { color:#2d7dd2; }
      #b-dHp  .b-dact-ico { color:#5a9a6a; }

      #b-panel-desktop { background:#0d0d14; border-top:1px solid #1a1a28; display:none; max-height:280px; overflow-y:auto; }
      #b-panel-desktop.show { display:block; }

      /* ── Pips ── */
      .b-pip-circle { display:inline-block; width:8px; height:8px; border-radius:50%; background:#1a1a28; transition:all 0.15s; }
      .b-pip-circle.on { }
      .b-pip-circle.off { background:#1a1a28 !important; border:1px solid #2a2a3a; }
      .b-pip-diamond { display:inline-block; width:8px; height:8px; transform:rotate(45deg); border-radius:1px; background:#1a1a28; }
      .b-pip-diamond.on { }
      .b-pip-diamond.off { background:#1a1a28 !important; border:1px solid #2a2a3a; }
      .b-pip-lute { display:inline-flex; align-items:center; justify-content:center; width:12px; height:12px; color:#1a1a28; }
      .b-pip-lute.on { color:inherit; }
      @keyframes b-lp { 0%,100%{opacity:1} 50%{opacity:0.35} }
      .b-pip-lute.on { animation:b-lp 2.2s ease-in-out infinite; }
      .b-pip-fist { display:inline-flex; align-items:center; justify-content:center; width:12px; height:12px; color:#1a1a28; }
      .b-pip-fist.on { color:inherit; }

      /* ── Panel (shared) ── */
      #b-panel { background:#0d0d14; border-radius:8px; border:1px solid #1e1e2a; overflow:hidden; display:none; max-height:260px; overflow-y:auto; }
      #b-panel.show { display:block; }
      .b-ph { display:flex; align-items:center; gap:5px; padding:6px 10px; border-bottom:1px solid #1e1e2a; position:sticky; top:0; background:#0d0d14; z-index:1; }
      .b-ph-dot   { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
      .b-ph-title { font-size:9px; letter-spacing:0.15em; text-transform:uppercase; flex:1; font-weight:700; }
      .b-ph-close, .b-ph-back { font-size:12px; color:#444; cursor:pointer; padding:0 3px; background:none; border:none; font-family:inherit; line-height:1; }
      .b-ph-close:hover, .b-ph-back:hover { color:#f0ece4; }

      .b-set-tabs { display:flex; border-bottom:1px solid #1e1e2a; }
      .b-stab { flex:1; padding:5px; text-align:center; font-size:8px; letter-spacing:0.12em; text-transform:uppercase; cursor:pointer; color:#444; border-bottom:2px solid transparent; background:none; border-left:none; border-right:none; border-top:none; font-family:inherit; }

      .b-aitem { display:flex; align-items:center; gap:6px; padding:7px 10px; border-bottom:1px solid #131320; cursor:pointer; transition:background 0.1s; }
      .b-aitem:last-child { border-bottom:none; }
      .b-aitem:hover { background:#111018; }
      .b-aitem.empty { opacity:0.3; cursor:default; pointer-events:none; }
      .b-ai-name { font-size:13px; color:#e8e3da; flex:1; }
      .b-ai-hit  { font-size:12px; font-weight:700; flex-shrink:0; }
      .b-ai-dmg  { font-size:10px; color:#555; flex-shrink:0; max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .b-ai-roll { width:20px; height:20px; border-radius:3px; background:#1e1e2a; border:1px solid #2a2a3a; display:flex; align-items:center; justify-content:center; font-size:9px; color:#b8952a; flex-shrink:0; }
      .b-ai-tag { font-size:7px; padding:1px 4px; border-radius:2px; margin-left:4px; }
      .b-tag-cantrip { background:rgba(90,138,170,0.15); color:#5a8aaa; }
      .b-tag-spell   { background:rgba(157,78,221,0.12); color:#9d4edd; }
      .b-tag-ki      { background:rgba(192,0,26,0.12);   color:#c0001a; }
      .b-tag-ritual  { background:rgba(184,149,42,0.12); color:#b8952a; }

      .b-spell-section-lbl { font-size:8px; letter-spacing:0.2em; text-transform:uppercase; color:#333; padding:5px 10px 2px; border-bottom:1px solid #0f0f1a; }

      /* HP panel */
      .b-hp-panel { padding:10px; display:flex; flex-direction:column; gap:8px; }
      .b-hp-track-row { display:flex; align-items:center; gap:6px; }
      .b-hp-num  { font-size:28px; font-weight:900; line-height:1; }
      .b-hp-max  { font-size:13px; color:#444; align-self:flex-end; margin-bottom:2px; }
      .b-hp-adj  { display:flex; gap:4px; margin-left:auto; align-items:center; }
      .b-hp-adj-input { width:38px; padding:4px; background:#111018; border:1px solid #1e1e2a; border-radius:3px; color:#f0ece4; font-family:inherit; font-size:13px; text-align:center; outline:none; }
      .b-hp-adj-input:focus { border-color:#5a9a6a; }
      .b-hp-adj-btn { width:28px; height:28px; border-radius:4px; border:1px solid; background:#111018; color:inherit; font-size:16px; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; }
      .b-hp-adj-btn.dmg  { border-color:#c0001a; color:#c0001a; }
      .b-hp-adj-btn.heal { border-color:#5a9a6a; color:#5a9a6a; }
      .b-stat-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:3px; }
      .b-stat-box  { background:#111018; border-radius:3px; padding:5px 6px; text-align:center; }
      .b-stat-val  { font-size:16px; font-weight:700; color:#f0ece4; display:block; line-height:1; }
      .b-stat-lbl  { font-size:7px; letter-spacing:0.1em; text-transform:uppercase; color:#444; display:block; margin-top:2px; }
      .b-sec-lbl   { font-size:7px; letter-spacing:0.2em; text-transform:uppercase; color:#333; margin-top:2px; }
      .b-save-row, .b-cond-row { display:flex; flex-wrap:wrap; gap:3px; }
      .b-save-pip { padding:2px 5px; border-radius:3px; font-size:7px; letter-spacing:0.08em; text-transform:uppercase; border:1px solid; }
      .b-save-pip.prof { background:rgba(58,122,80,0.12); border-color:rgba(58,122,80,0.3); color:#3a7a50; }
      .b-save-pip.no   { background:transparent; border-color:#1e1e2a; color:#333; }
      .b-cond { padding:2px 6px; border-radius:3px; font-size:8px; background:#1e1e2a; border:1px solid #2a2a3a; color:#555; cursor:pointer; transition:all 0.12s; }
      .b-cond.active { background:rgba(192,0,26,0.15); border-color:rgba(192,0,26,0.3); color:#c0001a; }

      /* Resource panel */
      .b-res-list { padding:6px 8px; display:flex; flex-direction:column; gap:3px; }
      .b-rh-row   { display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:4px; background:#111018; border:1px solid #1e1e2a; cursor:pointer; transition:all 0.12s; }
      .b-rh-row:hover { border-color:#2a2a3a; }
      .b-rh-label { font-size:9px; letter-spacing:0.1em; text-transform:uppercase; width:58px; flex-shrink:0; }
      .b-rh-pips  { display:flex; gap:2px; align-items:center; flex:1; }
      .b-rh-count { font-size:12px; font-weight:700; margin-left:auto; }
      .b-rh-arrow { font-size:14px; color:#444; }
      .b-rh-hint  { font-size:8px; color:#333; text-align:center; padding:4px 0 2px; }
      .b-res-ctrl { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid #1a1a28; }
      .b-rc-btn   { padding:4px 10px; border-radius:4px; border:1px solid #2a2a3a; background:#111018; color:#f0ece4; font-size:9px; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer; font-family:inherit; }
      .b-rc-btn:hover { background:#1a1a28; }
      .b-rc-btn:disabled { opacity:0.25; cursor:default; }
      .b-rc-btn.spend   { border-color:#c0001a44; color:#c0001a; }
      .b-rc-btn.restore { border-color:#5a9a6a44; color:#5a9a6a; }
    `;
    document.head.appendChild(style);
  }

  // ── Public API ──
  window.__battle = {
    openPanel:     openPanelFn,
    closePanel,
    switchSet:     (i) => { activeSet = i; renderPanel(); },
    doActionById:  (charKey, id) => {
      const a = (CHARACTERS[charKey].actions||[]).find(a => a.id === id);
      if (a) doAction(a);
    },
    doSpellByName: (name) => {
      showRollResult(name, '—', 'Cantrip — no slot used');
      closePanel();
    },
    castSpell:     (resKey, name, time, range) => {
      spendResource(activeKey, resKey, 1);
      const resources = getResources(activeKey);
      const r = resources.find(r => r.key === resKey);
      if (r) showToast(`${r.label} used → ${r.cur}/${r.max}`, col());
      showRollResult(name, `Cast`, `${time} · ${range}`);
      closePanel();
      renderAll();
    },
    adjHp: (dir) => {
      initSession(activeKey);
      const ch = C(); const s = S();
      const amt = Math.max(1, parseInt(document.getElementById('b-hpInput')?.value) || 1);
      s.hp = Math.max(0, Math.min(ch.combat.hpMax, s.hp + dir * amt));
      const el = document.getElementById('b-hpNum');
      if (el) { el.textContent = s.hp; el.style.color = s.hp <= ch.combat.hpMax*0.25 ? '#c0001a' : s.hp <= ch.combat.hpMax*0.5 ? '#c8a020' : '#5a9a6a'; }
      const ht = document.getElementById('b-orbHpTag');
      if (ht) { ht.textContent = s.hp + '/' + ch.combat.hpMax; ht.style.color = el?.style.color || ''; }
      const dh = document.getElementById('b-dCharHp');
      if (dh) { dh.textContent = s.hp + '/' + ch.combat.hpMax + ' hp'; dh.style.color = el?.style.color || ''; }
      showToast(`${dir > 0 ? '+' : ''}${dir * amt} HP → ${s.hp}/${ch.combat.hpMax}`, dir > 0 ? '#5a9a6a' : '#c0001a');
    },
    toggleCond: (cd) => {
      const arr = getConditions(activeKey);
      const i = arr.indexOf(cd);
      i >= 0 ? arr.splice(i, 1) : arr.push(cd);
      renderPanel();
    },
    changeRes: (resKey, amt) => {
      if (amt < 0) spendResource(activeKey, resKey, 1);
      else         restoreResource(activeKey, resKey, 1);
      renderAll();
      openPanel = 'res-detail'; resDetailKey = resKey;
      renderPanelRouted();
    },
    openResDetail: (key) => {
      openPanel = 'res-detail'; resDetailKey = key;
      renderPanelRouted();
      if (!isMobile()) {
        const panelD = document.getElementById('b-panel-desktop');
        if (panelD) panelD.classList.add('show');
      }
    },
    dismissFlash: () => {
      const f = document.getElementById('battle-flash');
      if (f) f.classList.remove('show');
    },
  };

  // ── Override renderPanel to route correctly ──
  // Patch the internal renderPanel used by openPanelFn
  const _rp = renderPanel;
  // We rebind openPanelFn to use the routed version
  function openPanelFnRouted(id) {
    openPanel = id;
    renderPanelRouted();
    document.querySelectorAll('.b-rnode').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.b-dact-btn').forEach(n => n.classList.remove('active'));
    const nodeMap = { act:'b-nAct', bon:'b-nBon', spl:'b-nSpl', hp:'b-nHp' };
    const btnMap  = { act:'b-dAct', bon:'b-dBon', spl:'b-dSpl', hp:'b-dHp', res:'b-dRes' };
    if (nodeMap[id]) { const el = document.getElementById(nodeMap[id]); if (el) el.classList.add('active'); }
    if (btnMap[id])  { const el = document.getElementById(btnMap[id]);  if (el) el.classList.add('active'); }
    if (!isMobile()) {
      const panelD = document.getElementById('b-panel-desktop');
      if (panelD) panelD.classList.add('show');
    }
  }
  window.__battle.openPanel = openPanelFnRouted;

  // ── Init ──
  injectStyles();

  // Default character from localStorage
  try {
    const saved = localStorage.getItem(CHAR_STORAGE_KEY);
    if (saved && CHARACTERS[saved]) activeKey = saved;
  } catch(e) {}

  // Wait for nav to exist (nav.js runs synchronously before this, so it should exist)
  if (document.getElementById('site-nav')) {
    injectNavButton();
  } else {
    document.addEventListener('DOMContentLoaded', injectNavButton);
  }

  // Resize handler — re-sync layouts when crossing the breakpoint
  let lastMobile = isMobile();
  window.addEventListener('resize', () => {
    const nowMobile = isMobile();
    if (nowMobile !== lastMobile) {
      lastMobile = nowMobile;
      if (battleOn) { syncLayouts(); renderAll(); }
    }
  });

})();
