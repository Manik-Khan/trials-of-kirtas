// ============================================================
// battle.js — Battle Mode HUD Overlay
// The Trials of Kirtas
// ============================================================
//
// DEPENDENCIES: characters.js must load before this file.
//   <script src="characters.js"></script>
//   <script src="nav.js"></script>
//   <script src="battle.js"></script>
//
// NAV BEHAVIOUR:
//   Desktop (>600px): small ⚔ button injected left of ◐ theme button
//   Mobile (≤600px):  battle section prepended into existing ◐ theme dropdown
//
// HUD LAYOUT:
//   Desktop: compact panel fixed bottom-left (440px), dice roller bottom-right
//   Mobile:  radial orb fixed bottom-left
//
// DICE ROLLER: extracted from sheet.html — supports adv/dis/bless/guidance,
//   crit detection, roll history, proper die-by-die display.
//
// STATE: session-memory only — no persistence yet
// ============================================================

(function () {
  'use strict';

  // ── Portraits ──
  const PORTRAITS = {
    cosmere:   'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833033/kirtas/characters/cosmere.png',
    caim:      'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833008/kirtas/characters/caim.png',
    liadan:    'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779732202/kirtas/portraits/liadan.png',
    vesperian: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833079/kirtas/characters/vesperian.png',
  };

  const CHAR_COLOR = {
    cosmere: '#9d4edd', caim: '#c0001a', liadan: '#1d9e75', vesperian: '#b8952a',
  };

  const CHAR_KEYS = ['liadan', 'cosmere', 'caim', 'vesperian'];

  const CRIES = [
    'Fight or DIE!', 'Round 1... FIGHT', 'Steel yourselves.',
    'For the Mousketeers.', 'Into the dark.', 'The mouse has entered combat.',
    'No mercy. No retreat.', 'The Gold Leaf feels far away.',
    "Fight or DIE! (Please don't die.)", "Veren's Watch is watching.",
  ];

  // ── Session state ──
  const SESSION = {};
  const CONDITIONS = {};
  const CHAR_STORAGE_KEY = 'kirtas-active-character';

  function initSession(key) {
    if (SESSION[key]) return;
    const cf = CHARACTERS[key].classFeatures || {};
    const s = {
      hp: CHARACTERS[key].combat.hp,
      // Turn economy
      actionUsed:   false,
      bonusUsed:    false,
      reactionUsed: false,
      // Concentration
      concentration: null, // null or { name, duration }
    };
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

  function getConditions(key) {
    if (!CONDITIONS[key]) CONDITIONS[key] = [];
    return CONDITIONS[key];
  }

  // ── Resources ──
  function getResources(charKey) {
    initSession(charKey);
    const cf  = CHARACTERS[charKey].classFeatures || {};
    const s   = SESSION[charKey];
    const col = CHAR_COLOR[charKey];
    const res = [];
    if (cf.bardicInspiration) res.push({ key:'bardicInspiration', label:'Bardic',    cur:s.bardicInspiration.current, max:s.bardicInspiration.max, color:col, type:'lute' });
    if (cf.spellSlots)   for (const lvl of Object.keys(cf.spellSlots).sort())    res.push({ key:`spell_${lvl}`,  label:`L${lvl} Slot`,  cur:s.spellSlots[lvl].current,   max:s.spellSlots[lvl].max,   color:col, type:'circle' });
    if (cf.pactSlots)    res.push({ key:'pactSlots',   label:'Pact',      cur:s.pactSlots.current,   max:s.pactSlots.max,   color:col, type:'diamond' });
    if (cf.sorcererSlots) for (const lvl of Object.keys(cf.sorcererSlots).sort()) res.push({ key:`sorc_${lvl}`, label:`Sorc L${lvl}`, cur:s.sorcererSlots[lvl].current, max:s.sorcererSlots[lvl].max, color:col, type:'circle' });
    if (cf.kiPoints)     res.push({ key:'kiPoints',    label:'Ki',        cur:s.kiPoints.current,    max:s.kiPoints.max,    color:col, type:'fist' });
    if (cf.actionSurge)  res.push({ key:'actionSurge', label:'Surge',     cur:s.actionSurge.current, max:s.actionSurge.max, color:col, type:'circle' });
    if (cf.secondWind)   res.push({ key:'secondWind',  label:'2nd Wind',  cur:s.secondWind.current,  max:s.secondWind.max,  color:col, type:'circle' });
    return res;
  }

  function spendRes(charKey, resKey, amt) {
    initSession(charKey);
    const s = SESSION[charKey];
    if (resKey === 'bardicInspiration')      s.bardicInspiration.current  = Math.max(0, s.bardicInspiration.current - amt);
    else if (resKey.startsWith('spell_'))  { const l=resKey.replace('spell_','');  s.spellSlots[l].current    = Math.max(0, s.spellSlots[l].current - amt); }
    else if (resKey === 'pactSlots')         s.pactSlots.current          = Math.max(0, s.pactSlots.current - amt);
    else if (resKey.startsWith('sorc_'))   { const l=resKey.replace('sorc_','');   s.sorcererSlots[l].current = Math.max(0, s.sorcererSlots[l].current - amt); }
    else if (resKey === 'kiPoints')          s.kiPoints.current           = Math.max(0, s.kiPoints.current - amt);
    else if (resKey === 'actionSurge')       s.actionSurge.current        = Math.max(0, s.actionSurge.current - amt);
    else if (resKey === 'secondWind')        s.secondWind.current         = Math.max(0, s.secondWind.current - amt);
  }

  function restoreRes(charKey, resKey, amt) {
    initSession(charKey);
    const s = SESSION[charKey];
    if (resKey === 'bardicInspiration')      s.bardicInspiration.current  = Math.min(s.bardicInspiration.max,  s.bardicInspiration.current + amt);
    else if (resKey.startsWith('spell_'))  { const l=resKey.replace('spell_','');  s.spellSlots[l].current    = Math.min(s.spellSlots[l].max,    s.spellSlots[l].current + amt); }
    else if (resKey === 'pactSlots')         s.pactSlots.current          = Math.min(s.pactSlots.max,          s.pactSlots.current + amt);
    else if (resKey.startsWith('sorc_'))   { const l=resKey.replace('sorc_','');   s.sorcererSlots[l].current = Math.min(s.sorcererSlots[l].max,  s.sorcererSlots[l].current + amt); }
    else if (resKey === 'kiPoints')          s.kiPoints.current           = Math.min(s.kiPoints.max,           s.kiPoints.current + amt);
    else if (resKey === 'actionSurge')       s.actionSurge.current        = Math.min(s.actionSurge.max,        s.actionSurge.current + amt);
    else if (resKey === 'secondWind')        s.secondWind.current         = Math.min(s.secondWind.max,         s.secondWind.current + amt);
  }

  function getSpellsForResource(charKey, resKey) {
    const ch = CHARACTERS[charKey];
    if (resKey === 'bardicInspiration') return [{ name:'Give Bardic Inspiration', note:'Grant d6 to creature within 60 ft', type:'utility' }];
    if (resKey === 'kiPoints') return (ch.actions||[]).filter(a => a.note && a.note.toLowerCase().includes('ki'));
    if (resKey === 'actionSurge') return [{ name:'Action Surge', note:'Take one additional action this turn', type:'utility' }];
    if (resKey === 'secondWind') { const sw=(ch.actions||[]).find(a=>a.id==='second_wind'); return sw?[sw]:[{name:'Second Wind',note:'Regain 1d10+lvl HP',type:'damage-only'}]; }
    if (resKey.startsWith('spell_')||resKey.startsWith('sorc_')||resKey==='pactSlots') {
      const lvl = resKey.startsWith('spell_')?parseInt(resKey.replace('spell_','')):resKey.startsWith('sorc_')?parseInt(resKey.replace('sorc_','')):1;
      return (ch.spells||{})[lvl]||(ch.spells||{})[String(lvl)]||[];
    }
    return [];
  }

  // ── UI State ──
  let battleOn     = false;
  let activeKey    = 'liadan';
  let openPanel    = null;
  let resDetailKey = null;
  let activeSet    = 0;
  let resIdx       = 0;
  let holdTimer    = null;
  let charPickOpen = false;

  const isMobile = () => window.innerWidth <= 600;
  const C  = () => CHARACTERS[activeKey];
  const S  = () => { initSession(activeKey); return SESSION[activeKey]; };
  const col = () => CHAR_COLOR[activeKey];

  // ── SVG icons ──
  const LUTE = `<svg viewBox="0 0 12 12" fill="currentColor"><path d="M8 1C10 1 11 2.5 11 4C11 6 9.5 7.5 8 7.5C7.2 7.5 6.6 7.2 6 6.8L2 10.5C1.6 11 1 10.5 1 10C1 9.5 1.4 9 1.8 8.6L5.5 5C5 4.4 4.5 3.8 4.5 3C4.5 1.8 6 1 8 1Z"/></svg>`;
  const FIST = `<svg viewBox="0 0 12 12" fill="currentColor"><path d="M4 2L4 6L2 6C1.5 6 1 6.5 1 7L1 9C1 10.5 2.5 12 4 12L8 12C9.5 12 11 10.5 11 9L11 5C11 4.5 10.5 4 10 4L9 4L9 2C9 1.5 8.5 1 8 1C7.5 1 7 1.5 7 2L7 4L6 4L6 2C6 1.5 5.5 1 5 1C4.5 1 4 1.5 4 2Z"/></svg>`;

  function pipHtml(r) {
    let h = '';
    for (let i = 0; i < r.max; i++) {
      const on = i < r.cur;
      if      (r.type==='lute')    h+=`<span class="b-pip-lute ${on?'on':'off'}" ${on?`style="animation-delay:${i*0.35}s"`:''} >${LUTE}</span>`;
      else if (r.type==='fist')    h+=`<span class="b-pip-fist ${on?'on':'off'}">${FIST}</span>`;
      else if (r.type==='diamond') h+=`<span class="b-pip-diamond ${on?'on':'off'}" ${on?`style="color:${r.color}"`:''} ></span>`;
      else                         h+=`<span class="b-pip-circle ${on?'on':'off'}" ${on?`style="background:${r.color}"`:''} ></span>`;
    }
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // DICE ROLLER — extracted from sheet.html
  // Supports: advantage, disadvantage, bless, guidance
  // Crit detection, roll history, die-by-die display
  // ══════════════════════════════════════════════════════════

  const RS = { advantage: false, disadvantage: false, bless: false, guidance: false };
  let rollHistory = [];

  const die = sides => Math.floor(Math.random() * sides) + 1;

  function rollD20() {
    const r1 = die(20), r2 = die(20);
    let kept, dropped;
    if      (RS.advantage)    { kept=Math.max(r1,r2); dropped=Math.min(r1,r2); }
    else if (RS.disadvantage) { kept=Math.min(r1,r2); dropped=Math.max(r1,r2); }
    else                      { kept=r1; dropped=r2; }
    return { kept, dropped, isCrit:kept===20, isFumble:kept===1, label:RS.advantage?'adv':RS.disadvantage?'dis':null };
  }

  function fmtD20(roll) {
    if (RS.advantage || RS.disadvantage)
      return `[<span class="b-rh-kept">${roll.kept}</span> <span class="b-rh-drop">${roll.dropped}</span>]`;
    return `[<span class="b-rh-kept">${roll.kept}</span>]`;
  }

  function rollDice(diceStr, mod=0) {
    const m = diceStr.match(/(\d+)d(\d+)/);
    if (!m) return { rolls:[0], total:mod };
    const rolls = Array.from({length:parseInt(m[1])}, ()=>die(parseInt(m[2])));
    return { rolls, total: rolls.reduce((a,b)=>a+b,0) + mod };
  }

  function blessBonus()    { if (!RS.bless)    return {val:0,str:''}; const b=die(4); return {val:b,str:` +${b}🙏`}; }
  function guidanceBonus() { if (!RS.guidance) return {val:0,str:''}; const g=die(4); return {val:g,str:` +${g}✦`}; }
  function modStr(n) { return n>=0?`+${n}`:`${n}`; }

  function rollActionFull(action) {
    if (!action || action.type==='utility') {
      addRollHistory({ name:action?.label||'Utility', main:action?.note||'—', detail:'No roll needed' });
      return;
    }
    if (action.type==='damage-only') {
      if (!action.dmgDice) { addRollHistory({name:action.label, main:'No dice', detail:action.note||''}); return; }
      const dmg = rollDice(action.dmgDice, action.dmgMod||0);
      addRollHistory({ name:action.label,
        main:`Dmg: [${dmg.rolls.join('][')}]${action.dmgMod?` ${modStr(action.dmgMod)}`:''} = <span class="b-rh-total">${dmg.total}</span>`,
        detail:`${action.dmgDice}${action.dmgMod?` ${modStr(action.dmgMod)}`:''} ${action.dmgType||''}` });
      return;
    }
    // Attack or attack-cantrip
    const roll = rollD20(), bless = blessBonus();
    const total = roll.kept + (action.hitMod||0) + bless.val;
    const isCrit = roll.isCrit;
    const dmg = rollDice(isCrit?(action.critDice||action.dmgDice):action.dmgDice, action.dmgMod||0);
    const critStr = isCrit ? '<span class="b-rh-crit">★ CRIT</span>' : roll.isFumble ? '<span class="b-rh-fumble">✗ MISS</span>' : '';
    addRollHistory({ name:action.label,
      main:`${fmtD20(roll)} ${modStr(action.hitMod||0)}${bless.str} = <span class="b-rh-total">${total}</span> ${critStr}`,
      detail:`d20:${roll.kept}${roll.label?` (${roll.label})`:''}${action.note?' · '+action.note:''}`,
      dmg:`${isCrit?'★ Crit dmg':'Dmg'}: [${dmg.rolls.join('][')}]${action.dmgMod?` ${modStr(action.dmgMod)}`:''} = <strong>${dmg.total}</strong> ${action.dmgType||''}` });
  }

  function addRollHistory(entry) {
    rollHistory.unshift(entry);
    if (rollHistory.length > 20) rollHistory.pop();
    renderRollHistory();
    // Show roller if hidden
    const roller = document.getElementById('b-roller');
    if (roller) roller.classList.add('show');
  }

  function renderRollHistory() {
    const el = document.getElementById('b-roll-history');
    if (!el) return;
    if (!rollHistory.length) {
      el.innerHTML = '<div class="b-rh-empty">Tap an action to roll.</div>';
      return;
    }
    el.innerHTML = rollHistory.map(e => `
      <div class="b-rh-entry">
        <div class="b-rh-name">${e.name}</div>
        <div class="b-rh-main">${e.main}</div>
        ${e.dmg?`<div class="b-rh-dmg">${e.dmg}</div>`:''}
        <span class="b-rh-detail">${e.detail}</span>
      </div>`).join('');
  }

  function updateRollerToggles() {
    ['adv','dis','bless','guide'].forEach(k => {
      const el = document.getElementById(`b-tog-${k}`);
      if (!el) return;
      const stateKey = k==='adv'?'advantage':k==='dis'?'disadvantage':k==='guide'?'guidance':k;
      el.classList.toggle('on', RS[stateKey]);
      if (k==='adv')   el.classList.toggle('b-tog-adv-on',  RS.advantage);
      if (k==='dis')   el.classList.toggle('b-tog-dis-on',  RS.disadvantage);
    });
  }

  // ── Action helpers ──
  function actionResKey(action) {
    const cf = C().classFeatures || {};
    if (!action) return null;
    if (action.type==='attack-cantrip'||action.type==='utility') return null;
    if (action.note&&action.note.toLowerCase().includes('ki')&&cf.kiPoints) return 'kiPoints';
    if (action.id==='second_wind'&&cf.secondWind) return 'secondWind';
    if (action.type==='damage-only'&&(cf.spellSlots||cf.pactSlots||cf.sorcererSlots)) {
      if (cf.pactSlots)    return 'pactSlots';
      if (cf.spellSlots)   return `spell_${Object.keys(cf.spellSlots).sort()[0]}`;
      if (cf.sorcererSlots) return `sorc_${Object.keys(cf.sorcererSlots).sort()[0]}`;
    }
    return null;
  }

  function doAction(action) {
    const rk = actionResKey(action);
    if (rk) {
      spendRes(activeKey, rk, 1);
      const r = getResources(activeKey).find(r=>r.key===rk);
      if (r) showToast(`${r.label}: ${r.cur}/${r.max}`, col());
    }
    rollActionFull(action);
    closePanelFn();
    renderAll();
  }

  // ── Toast ──
  let toastTimer = null;
  function showToast(msg, color) {
    const t = document.getElementById('b-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.cssText = `background:${color}18;border:1px solid ${color}44;color:${color};display:block;padding:6px 10px;border-radius:4px;font-size:11px;`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{t.style.display='none';}, 2500);
  }

  // ── Panel ──
  let _panelTarget = () => document.getElementById('b-panel');

  function closePanelFn() {
    openPanel=null; resDetailKey=null;
    ['b-panel','b-panel-desktop'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.classList.remove('show');
    });
    document.querySelectorAll('.b-rnode,.b-dact-btn').forEach(n=>n.classList.remove('active'));
  }

  function openPanelFn(id) {
    openPanel=id;
    const p = _panelTarget();
    renderPanelInto(p);
    document.querySelectorAll('.b-rnode').forEach(n=>n.classList.remove('active'));
    document.querySelectorAll('.b-dact-btn').forEach(n=>n.classList.remove('active'));
    const nmap={act:'b-nAct',bon:'b-nBon',spl:'b-nSpl',hp:'b-nHp'};
    const bmap={act:'b-dAct',bon:'b-dBon',spl:'b-dSpl',hp:'b-dHp',res:'b-dRes'};
    if(nmap[id]) document.getElementById(nmap[id])?.classList.add('active');
    if(bmap[id]) document.getElementById(bmap[id])?.classList.add('active');
    p?.classList.add('show');
  }

  function pH(color, title) {
    return `<div class="b-ph"><span class="b-ph-dot" style="background:${color}"></span><span class="b-ph-title" style="color:${color}">${title}</span><button class="b-ph-close" onclick="window.__battle.closePanel()">✕</button></div>`;
  }

  function aRow(action, color) {
    const rk=actionResKey(action);
    const r=rk?getResources(activeKey).find(r=>r.key===rk):null;
    const ok=!r||r.cur>0;
    const tag=action.type==='attack-cantrip'?'<span class="b-ai-tag b-tag-cantrip">cantrip</span>'
             :rk==='kiPoints'?'<span class="b-ai-tag b-tag-ki">1 ki</span>'
             :rk?'<span class="b-ai-tag b-tag-spell">slot</span>':'';
    const hitH=(action.type==='attack'||action.type==='attack-cantrip')&&action.hitMod!==undefined
      ?`<span class="b-ai-hit" style="color:${color}">+${action.hitMod}</span>`:'';
    const dmgH=action.dmgDice
      ?`<span class="b-ai-dmg">${action.dmgDice}${action.dmgMod?'+'+action.dmgMod:''} ${action.dmgType||''}</span>`
      :action.note?`<span class="b-ai-dmg">${action.note.substring(0,42)}</span>`:'';
    return `<div class="b-aitem${ok?'':' empty'}" onclick="window.__battle.doActionById('${activeKey}','${action.id}')">
      <span class="b-ai-name">${action.label}${tag}</span>${hitH}${dmgH}
      <span class="b-ai-roll">d</span></div>`;
  }

  function renderPanelInto(p) {
    if (!p||!openPanel) { if(p) p.classList.remove('show'); return; }
    const ch=C(), color=col(), resources=getResources(activeKey);

    if (openPanel==='act') {
      const slots=ch.defaultSlots||[], all=ch.actions||[];
      const setA=slots.map(id=>all.find(a=>a.id===id)).filter(Boolean);
      const setB=all.filter(a=>!slots.includes(a.id));
      p.innerHTML=pH('#c0001a','Standard action')
        +`<div class="b-set-tabs"><button class="b-stab${activeSet===0?' on':''}" style="${activeSet===0?`color:#f0ece4;border-bottom:2px solid ${color}`:''}" onclick="window.__battle.switchSet(0)">Primary</button><button class="b-stab${activeSet===1?' on':''}" style="${activeSet===1?`color:#f0ece4;border-bottom:2px solid ${color}`:''}" onclick="window.__battle.switchSet(1)">All</button></div>`
        +(activeSet===0?setA:setB).map(a=>aRow(a,'#c0001a')).join('');

    } else if (openPanel==='bon') {
      const bon=(ch.actions||[]).filter(a=>(a.note&&(a.note.toLowerCase().includes('bonus action')||a.note.toLowerCase().includes('bonus')))||['healing_word','second_wind','hand_of_healing'].includes(a.id));
      p.innerHTML=pH('#2d7dd2','Bonus action')+(bon.length?bon.map(a=>aRow(a,'#2d7dd2')).join(''):'<div style="padding:12px 10px;font-size:12px;color:#444">None defined</div>');

    } else if (openPanel==='spl') {
      const spells=ch.spells||{};
      let html=pH(color,ch.subclass&&ch.subclass.toLowerCase().includes('monk')?'Ki abilities':'Spells & cantrips');
      const cantrips=spells.cantrip||spells.cantrips||[];
      if (cantrips.length) {
        html+=`<div class="b-spell-lbl">Cantrips</div>`;
        html+=cantrips.map(s=>{
          const a=(ch.actions||[]).find(a=>a.label&&a.label.toLowerCase()===s.name.toLowerCase());
          return a?aRow(a,color):`<div class="b-aitem" onclick="window.__battle.doSpellByName('${s.name}','${s.castingTime||''}',${!!s.concentration})"><span class="b-ai-name">${s.name}<span class="b-ai-tag b-tag-cantrip">cantrip</span>${s.concentration?'<span class="b-ai-tag b-tag-conc">C</span>':''}</span><span class="b-ai-dmg">${s.castingTime||''} · ${s.range||''}</span><span class="b-ai-roll">d</span></div>`;
        }).join('');
      }
      for (let lvl=1;lvl<=9;lvl++) {
        const ls=spells[lvl]||spells[String(lvl)]||[]; if(!ls.length) continue;
        const rk=ch.classFeatures?.pactSlots?'pactSlots':`spell_${lvl}`;
        const r=resources.find(r=>r.key===rk);
        html+=`<div class="b-spell-lbl">Level ${lvl} <span style="color:${color};margin-left:4px">${r?r.cur:'?'} left</span></div>`;
        html+=ls.map(s=>{
          const a=(ch.actions||[]).find(a=>a.label&&a.label.toLowerCase()===s.name.toLowerCase());
          return a?aRow(a,color):`<div class="b-aitem${r&&r.cur>0?'':' empty'}" onclick="window.__battle.castSpell('${rk}','${s.name}','${s.castingTime||''}','${s.range||''}',${!!s.concentration})"><span class="b-ai-name">${s.name}${s.ritual?'<span class="b-ai-tag b-tag-ritual">R</span>':''}${s.concentration?'<span class="b-ai-tag b-tag-conc">C</span>':''}</span><span class="b-ai-dmg">${s.castingTime||''} · ${s.range||''}</span><span class="b-ai-roll">d</span></div>`;
        }).join('');
      }
      p.innerHTML=html;

    } else if (openPanel==='hp') {
      const hpPct=S().hp/ch.combat.hpMax;
      const hpCol=hpPct>0.5?'#5a9a6a':hpPct>0.25?'#c8a020':'#c0001a';
      const conds=['Poisoned','Frightened','Paralyzed','Prone','Stunned','Concentration','Blinded','Deafened'];
      const activeC=getConditions(activeKey);
      p.innerHTML=`${pH('#5a9a6a','Stats & HP')}<div class="b-hp-panel">
        <div class="b-hp-track-row"><span class="b-hp-num" id="b-hpNum" style="color:${hpCol}">${S().hp}</span><span class="b-hp-max">/ ${ch.combat.hpMax}</span>
          <div class="b-hp-adj"><input class="b-hp-adj-input" id="b-hpInput" type="number" min="1" max="99" value="1"><button class="b-hp-adj-btn dmg" onclick="window.__battle.adjHp(-1)">−</button><button class="b-hp-adj-btn heal" onclick="window.__battle.adjHp(1)">+</button></div>
        </div>
        <div class="b-stat-grid">
          <div class="b-stat-box"><span class="b-stat-val">${ch.combat.ac}</span><span class="b-stat-lbl">AC</span></div>
          <div class="b-stat-box"><span class="b-stat-val">${ch.combat.speed}</span><span class="b-stat-lbl">Speed</span></div>
          <div class="b-stat-box"><span class="b-stat-val">+${ch.combat.initiative}</span><span class="b-stat-lbl">Init</span></div>
        </div>
        <div class="b-sec-lbl">Save Proficiencies</div>
        <div class="b-save-row">${Object.entries(ch.saves||{}).map(([k,v])=>`<span class="b-save-pip ${v.proficient?'prof':'no'}">${k.toUpperCase()}</span>`).join('')}</div>
        <div class="b-sec-lbl">Conditions</div>
        <div class="b-cond-row">${conds.map(cd=>`<span class="b-cond${activeC.includes(cd)?' active':''}" onclick="window.__battle.toggleCond('${cd}')">${cd}</span>`).join('')}</div>
      </div>`;

    } else if (openPanel==='res') {
      p.innerHTML=pH(col(),'Resources')+'<div class="b-res-list">'
        +getResources(activeKey).map(r=>`<div class="b-rh-row-res" onclick="window.__battle.openResDetail('${r.key}')"><span class="b-rh-label" style="color:${r.color}">${r.label}</span><div class="b-rh-pips">${pipHtml(r)}</div><span class="b-rh-count" style="color:${r.color}">${r.cur}/${r.max}</span><span class="b-rh-arrow">›</span></div>`).join('')
        +'<div class="b-rh-hint">tap to view spells or spend</div></div>';

    } else if (openPanel==='res-detail') {
      const r=getResources(activeKey).find(r=>r.key===resDetailKey);
      if (!r) { openPanel='res'; renderPanelInto(p); return; }
      const sf=getSpellsForResource(activeKey,resDetailKey);
      p.innerHTML=`<div class="b-ph"><button class="b-ph-back" onclick="window.__battle.openPanel('res')">‹</button><span class="b-ph-dot" style="background:${r.color}"></span><span class="b-ph-title" style="color:${r.color}">${r.label} · ${r.cur}/${r.max}</span><button class="b-ph-close" onclick="window.__battle.closePanel()">✕</button></div>
        <div class="b-res-ctrl"><button class="b-rc-btn restore" onclick="window.__battle.changeRes('${resDetailKey}',1)" ${r.cur>=r.max?'disabled':''}>+ restore</button><div class="b-rh-pips" style="flex:1;justify-content:center">${pipHtml(r)}</div><button class="b-rc-btn spend" onclick="window.__battle.changeRes('${resDetailKey}',-1)" ${r.cur<=0?'disabled':''}>− spend</button></div>`
        +(sf.length?`<div class="b-spell-lbl">Cast with this slot</div>`+sf.map(s=>s.id?aRow(s,r.color):`<div class="b-aitem" onclick="window.__battle.castSpell('${resDetailKey}','${s.name}','${s.castingTime||''}','${s.range||''}')"><span class="b-ai-name">${s.name}</span><span class="b-ai-dmg">${s.castingTime||''} ${s.range?'· '+s.range:''}</span><span class="b-ai-roll">d</span></div>`).join(''):'');
    }
  }

  // ── Mobile orb ──
  function buildMobileHud() {
    return `<div id="b-orb-zone">
      <svg id="b-orb-svg" viewBox="0 0 110 110" fill="none">
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

  // ── Desktop bar ──
  function buildDesktopHud() {
    return `<div id="b-desktop-bar">
      <div id="b-dbar-top">
        <div id="b-dchar-chip" onclick="window.__battle.toggleCharPick()">
          <img class="b-dbar-portrait" id="b-dPortrait" src="" alt="">
          <div class="b-dchar-info">
            <span class="b-dchar-name" id="b-dCharName"></span>
            <span class="b-dchar-hp"   id="b-dCharHp"></span>
          </div>
          <span class="b-dchar-arrow">▲</span>
        </div>
        <div id="b-char-pick" class="b-char-pick">
          ${CHAR_KEYS.filter(k=>CHARACTERS[k]).map(k=>`
            <div class="b-cpick-item" data-key="${k}" onclick="window.__battle.setChar('${k}')">
              <img class="b-cpick-portrait" src="${PORTRAITS[k]}" alt="${CHARACTERS[k].name}">
              <span class="b-cpick-name" style="color:${CHAR_COLOR[k]}">${CHARACTERS[k].name.split(' ')[0]}</span>
            </div>`).join('')}
        </div>
        <div class="b-ddivider"></div>
        <div id="b-dstats">
          <div class="b-dstat"><span class="b-dstat-val" id="b-dAC"></span><span class="b-dstat-lbl">AC</span></div>
          <div class="b-dstat"><span class="b-dstat-val" id="b-dSpd"></span><span class="b-dstat-lbl">Spd</span></div>
          <div class="b-dstat"><span class="b-dstat-val" id="b-dInit"></span><span class="b-dstat-lbl">Init</span></div>
        </div>
        <div class="b-ddivider"></div>
        <div id="b-dres-strip"></div>
      </div>
      <div id="b-dbar-btns">
        <button class="b-dact-btn" id="b-dAct" onclick="window.__battle.openPanel('act')"><span class="b-dact-ico" style="color:#c0001a">⚔</span><span class="b-dact-lbl">Action</span></button>
        <button class="b-dact-btn" id="b-dBon" onclick="window.__battle.openPanel('bon')"><span class="b-dact-ico" style="color:#2d7dd2">⚡</span><span class="b-dact-lbl">Bonus</span></button>
        <button class="b-dact-btn" id="b-dSpl" onclick="window.__battle.openPanel('spl')"><span class="b-dact-ico" id="b-dSplIco">✦</span><span class="b-dact-lbl">Spells</span></button>
        <button class="b-dact-btn" id="b-dHp"  onclick="window.__battle.openPanel('hp')"><span class="b-dact-ico" style="color:#5a9a6a">♡</span><span class="b-dact-lbl">Info</span></button>
        <button class="b-dact-btn" id="b-dRes" onclick="window.__battle.openPanel('res')"><span class="b-dact-ico" id="b-dResIco">◎</span><span class="b-dact-lbl">Resources</span></button>
        <button class="b-dact-btn b-end-turn" id="b-dEnd" onclick="window.__battle.endTurn()"><span class="b-dact-ico" style="color:#b8952a">⟳</span><span class="b-dact-lbl" style="color:#b8952a">End Turn</span></button>
      </div>
    </div>`;
  }

  // ── Roller panel (bottom-right on desktop, inline on mobile) ──
  function buildRollerHtml() {
    return `<div id="b-roller">
      <div class="b-roller-header" onclick="window.__battle.toggleRoller()">
        <span class="b-roller-title">Roll History</span>
        <span class="b-roller-chevron" id="b-roller-chevron">▼</span>
      </div>
      <div id="b-roller-body">
        <div class="b-roller-toggles">
          <button id="b-tog-adv"   class="b-tog" onclick="window.__battle.toggleRS('advantage')">Adv</button>
          <button id="b-tog-dis"   class="b-tog" onclick="window.__battle.toggleRS('disadvantage')">Dis</button>
          <button id="b-tog-bless" class="b-tog" onclick="window.__battle.toggleRS('bless')">Bless</button>
          <button id="b-tog-guide" class="b-tog" onclick="window.__battle.toggleRS('guidance')">Guide</button>
          <button class="b-tog b-tog-clr" onclick="window.__battle.clearHistory()">Clear</button>
        </div>
        <div class="b-roll-history" id="b-roll-history">
          <div class="b-rh-empty">Tap an action to roll.</div>
        </div>
      </div>
    </div>`;
  }

  function buildHudHtml() {
    return `
      <div id="battle-mq"><div class="bm-inner"><span class="bm-txt" id="bm-txt">Fight or DIE!</span><span class="bm-sep">✦</span><span class="bm-txt">Round 1</span><span class="bm-sep">✦</span><span class="bm-txt" id="bm-txt2">Fight or DIE!</span></div></div>
      <div id="battle-flash" onclick="window.__battle.dismissFlash()">
        <div class="bf-eye">Roll for Initiative</div>
        <div class="bf-txt" id="bf-txt">Fight or DIE!</div>
        <div class="bf-sub">tap to dismiss</div>
      </div>
      <div id="battle-hud">
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
      </div>
      ${buildRollerHtml()}`;
  }

  // ── Render mobile orb ──
  function renderMobileOrb() {
    const ch=C(), s=S(), color=col(), resources=getResources(activeKey);
    const po=document.getElementById('b-orbPortrait');
    if(po){po.src=PORTRAITS[activeKey]||'';po.style.borderColor=color;}
    const ht=document.getElementById('b-orbHpTag');
    if(ht){ht.textContent=`${s.hp}/${ch.combat.hpMax}`;ht.style.color=s.hp<=ch.combat.hpMax*0.25?'#c0001a':s.hp<=ch.combat.hpMax*0.5?'#c8a020':'#5a9a6a';}
    const ns=document.getElementById('b-nSpl');
    if(ns){ns.style.borderColor=color;ns.innerHTML=`<span class="b-rn-ico" style="color:${color}">✦</span><span class="b-rn-lbl" style="color:${color}">${ch.subclass&&ch.subclass.toLowerCase().includes('monk')?'Ki':'Spl'}</span>`;}
    const primary=resources[0], secondary=resources[1];
    const co=2*Math.PI*50, ci=2*Math.PI*41;
    const roBg=document.getElementById('b-ro-bg'),ro=document.getElementById('b-ro');
    const riBg=document.getElementById('b-ri-bg'),ri=document.getElementById('b-ri');
    if(roBg&&ro&&primary){roBg.setAttribute('stroke',color+'22');ro.setAttribute('stroke',color);ro.setAttribute('stroke-dasharray',`${co*(primary.max>0?primary.cur/primary.max:0)} ${co*(1-(primary.max>0?primary.cur/primary.max:0))}`);}
    if(riBg&&ri){if(secondary){const p2=secondary.max>0?secondary.cur/secondary.max:0;riBg.setAttribute('stroke',(secondary.color||color)+'22');ri.setAttribute('stroke',secondary.color||color);ri.setAttribute('stroke-dasharray',`${ci*p2} ${ci*(1-p2)}`);ri.style.display='';riBg.style.display='';}else{ri.style.display='none';riBg.style.display='none';}}
    const shelf=document.getElementById('b-shelf');
    if(shelf) shelf.innerHTML=resources.map(r=>`<div class="b-srow"><span class="b-slbl">${r.label}</span><div class="b-pips">${pipHtml(r)}</div></div>`).join('');
  }

  // ── Render desktop bar ──
  function renderDesktopBar() {
    const ch=C(), s=S(), color=col(), resources=getResources(activeKey);
    const dp=document.getElementById('b-dPortrait'); if(dp) dp.src=PORTRAITS[activeKey]||'';
    const dn=document.getElementById('b-dCharName'); if(dn){dn.textContent=ch.name;dn.style.color=color;}
    const dh=document.getElementById('b-dCharHp');   if(dh){dh.textContent=`${s.hp}/${ch.combat.hpMax} hp`;dh.style.color=s.hp<=ch.combat.hpMax*0.25?'#c0001a':s.hp<=ch.combat.hpMax*0.5?'#c8a020':'#5a9a6a';}
    const da=document.getElementById('b-dAC');   if(da) da.textContent=ch.combat.ac;
    const ds=document.getElementById('b-dSpd');  if(ds) ds.textContent=ch.combat.speed;
    const di=document.getElementById('b-dInit'); if(di) di.textContent=`+${ch.combat.initiative}`;
    const strip=document.getElementById('b-dres-strip');
    if(strip) strip.innerHTML=resources.map(r=>`<div class="b-dres-chip" onclick="window.__battle.openResDetail('${r.key}')"><span class="b-dres-lbl">${r.label}</span><div class="b-dres-pips">${pipHtml(r)}</div></div>`).join('');
    const si=document.getElementById('b-dSplIco'); if(si) si.style.color=color;
    const ri2=document.getElementById('b-dResIco'); if(ri2) ri2.style.color=color;
    // Highlight active char in picker
    document.querySelectorAll('.b-cpick-item').forEach(el=>el.classList.toggle('on',el.dataset.key===activeKey));
    if(openPanel){const pd=document.getElementById('b-panel-desktop');if(pd){renderPanelInto(pd);pd.classList.add('show');}}
  }

  function renderAll() {
    if(isMobile()) renderMobileOrb(); else renderDesktopBar();
    renderTurnOrbs();
  }

  // ── Mount HUD ──
  function mountHud() {
    if(document.getElementById('battle-hud')) return;
    const wrap=document.createElement('div');
    wrap.id='battle-hud-root';
    wrap.innerHTML=buildHudHtml();
    document.body.appendChild(wrap);

    // Orb hold
    const ob=document.getElementById('b-orbBtn');
    if(ob){
      ob.addEventListener('click',()=>{resIdx=(resIdx+1)%getResources(activeKey).length;renderMobileOrb();});
      const sh=()=>{holdTimer=setTimeout(()=>{holdTimer=null;openPanelFn('res');},500);};
      const eh=()=>{if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}};
      ob.addEventListener('mousedown',sh); ob.addEventListener('touchstart',sh,{passive:true});
      ['mouseup','mouseleave','touchend'].forEach(e=>ob.addEventListener(e,eh));
    }

    // Close char picker on outside click
    document.addEventListener('click', e=>{
      if(charPickOpen && !e.target.closest('#b-dchar-chip') && !e.target.closest('#b-char-pick')) {
        charPickOpen=false;
        document.getElementById('b-char-pick')?.classList.remove('open');
      }
    });

    _panelTarget = ()=>isMobile()?document.getElementById('b-panel'):document.getElementById('b-panel-desktop');
  }

  function syncLayouts() {
    const mobile=isMobile();
    const orb=document.getElementById('b-orb-zone');
    const shelf=document.getElementById('b-shelf-zone');
    const dbar=document.getElementById('b-desktop-bar');
    const pd=document.getElementById('b-panel-desktop');
    const pm=document.getElementById('b-panel');
    const roller=document.getElementById('b-roller');
    if(orb)   orb.style.display   =mobile?'':'none';
    if(shelf) shelf.style.display =mobile?'':'none';
    if(dbar)  dbar.style.display  =mobile?'none':'';
    if(pd)    pd.style.display    =mobile?'none':'';
    if(pm)    pm.style.display    =mobile?'':'none';
    if(roller) roller.className = mobile?'b-roller-mobile':'b-roller-desktop';
    if(roller && battleOn) roller.classList.add('show');
  }

  // ── Nav wiring ──
  // Button is rendered by nav.js — just attach the click listener
  function injectNav() {
    const btn = document.getElementById('battle-btn');
    if (btn && battleOn) btn.classList.add('on');

    if (isMobile()) {
      if(document.getElementById('battle-mobile-section')) return;
      const dropdown=document.getElementById('theme-dropdown');
      if(!dropdown) return;
      const section=document.createElement('div');
      section.id='battle-mobile-section';
      section.innerHTML=`
        <div class="bm-section-lbl">Battle</div>
        <div class="bm-toggle-row" id="bm-toggle-row" onclick="window.__battle.toggleBattle()">
          <span class="bm-toggle-ico">⚔</span>
          <span class="bm-toggle-name">Battle mode</span>
          <div class="bm-toggle" id="bm-toggle"></div>
        </div>
        <div class="bm-chars" id="bm-chars">
          ${CHAR_KEYS.filter(k=>CHARACTERS[k]).map(k=>`
            <div class="bm-char-row${k===activeKey?' on':''}" data-key="${k}" onclick="window.__battle.setChar('${k}')">
              <div class="bm-char-dot" style="background:${CHAR_COLOR[k]}"></div>
              <span class="bm-char-name">${CHARACTERS[k].name.split(' ')[0]}</span>
            </div>`).join('')}
        </div>
        <div class="bm-divider"></div>`;
      dropdown.insertBefore(section, dropdown.firstChild);
    }
  }

  // ── Battle toggle ──
  function toggleBattle() {
    battleOn=!battleOn;
    try { localStorage.setItem('kirtas-battle-on', battleOn); } catch(e) {}
    const btn=document.getElementById('battle-btn');
    if(btn) btn.classList.toggle('on',battleOn);
    const tog=document.getElementById('bm-toggle');
    if(tog) tog.classList.toggle('on',battleOn);
    const row=document.getElementById('bm-toggle-row');
    if(row) row.classList.toggle('on',battleOn);

    if(battleOn) {
      mountHud();
      initSession(activeKey);
      loadCombatFromDb(activeKey);
      const cry=CRIES[Math.floor(Math.random()*CRIES.length)];
      ['bf-txt','bm-txt','bm-txt2'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=cry;});
      document.getElementById('battle-flash')?.classList.add('show');
      document.getElementById('battle-mq')?.classList.add('show');
      document.getElementById('battle-hud')?.classList.add('show');
      syncLayouts();
      renderAll();
    } else {
      ['battle-flash','battle-mq','battle-hud'].forEach(id=>document.getElementById(id)?.classList.remove('show'));
      document.getElementById('b-roller')?.classList.remove('show');
      closePanelFn();
    }
  }

  // ── Character switch ──
  function setChar(key) {
    activeKey=key; activeSet=0; resIdx=0;
    try{localStorage.setItem(CHAR_STORAGE_KEY,key);}catch(e){}
    document.querySelectorAll('.bm-char-row').forEach(r=>r.classList.toggle('on',r.dataset.key===key));
    initSession(key); closePanelFn(); syncLayouts(); renderAll();
    // Close char picker
    charPickOpen=false;
    document.getElementById('b-char-pick')?.classList.remove('open');
  }

  function toggleCharPick() {
    charPickOpen=!charPickOpen;
    document.getElementById('b-char-pick')?.classList.toggle('open',charPickOpen);
  }

  // ── Roller toggle ──
  let rollerCollapsed=false;
  function toggleRoller() {
    rollerCollapsed=!rollerCollapsed;
    const body=document.getElementById('b-roller-body');
    const chev=document.getElementById('b-roller-chevron');
    if(body) body.style.display=rollerCollapsed?'none':'';
    if(chev) chev.textContent=rollerCollapsed?'▲':'▼';
  }

  // ── Styles ──
  function injectStyles() {
    if(document.getElementById('battle-styles')) return;
    const s=document.createElement('style');
    s.id='battle-styles';
    s.textContent=`
      /* ── Desktop nav button — styles live in nav.js ── */

      /* ── Mobile battle section in theme dropdown ── */
      .bm-section-lbl { font-family:var(--font-title); font-size:0.55rem; letter-spacing:0.35em; color:var(--muted); text-transform:uppercase; padding:0.5rem 0.75rem 0.3rem; }
      .bm-toggle-row { display:flex; align-items:center; gap:0.5rem; padding:0.35rem 0.75rem; cursor:pointer; transition:background 0.15s; }
      .bm-toggle-row:hover,.bm-toggle-row.on { background:rgba(192,0,26,0.08); }
      .bm-toggle-ico { font-size:0.9rem; color:#c0001a; width:14px; flex-shrink:0; }
      .bm-toggle-name { font-family:var(--font-title); font-size:0.62rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--aged); flex:1; }
      .bm-toggle { width:28px; height:14px; background:var(--gold-dim); border:1px solid var(--gold-dim); border-radius:7px; position:relative; transition:background 0.2s; flex-shrink:0; }
      .bm-toggle::after { content:''; position:absolute; top:1px; left:1px; width:10px; height:10px; background:var(--muted); border-radius:50%; transition:left 0.15s,background 0.15s; }
      .bm-toggle.on { background:#c0001a; border-color:#c0001a; }
      .bm-toggle.on::after { left:15px; background:#f0ece4; }
      .bm-chars { display:flex; flex-direction:column; padding:0.1rem 0 0.2rem; }
      .bm-char-row { display:flex; align-items:center; gap:0.5rem; padding:0.25rem 0.75rem 0.25rem 2.1rem; cursor:pointer; transition:background 0.12s; }
      .bm-char-row:hover { background:var(--gold-dim); }
      .bm-char-row.on { background:rgba(184,149,42,0.08); }
      .bm-char-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
      .bm-char-name { font-family:var(--font-title); font-size:0.62rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--aged); }
      .bm-char-row.on .bm-char-name { color:var(--gold-light); }
      .bm-divider { height:1px; background:var(--gold-dim); margin:0.25rem 0; }
      @media (min-width:601px) { #battle-mobile-section { display:none !important; } }

      /* ── Marquee ── */
      #battle-mq { position:fixed; top:52px; left:0; right:0; height:18px; background:#c0001a; overflow:hidden; z-index:149; display:none; }
      #battle-mq.show { display:block; }
      .bm-inner { display:flex; align-items:center; height:18px; white-space:nowrap; animation:bm-roll 14s linear infinite; }
      @keyframes bm-roll { from{transform:translateX(50%)} to{transform:translateX(-100%)} }
      .bm-txt { font-family:var(--font-title); font-size:9px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:#f0ece4; padding:0 20px; }
      .bm-sep { color:rgba(240,236,228,0.35); padding:0 8px; }

      /* ── Flash ── */
      #battle-flash { position:fixed; inset:0; background:rgba(6,4,8,0.96); z-index:300; display:none; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; }
      #battle-flash.show { display:flex; }
      .bf-eye { font-family:var(--font-title); font-size:10px; letter-spacing:0.4em; text-transform:uppercase; color:rgba(192,0,26,0.5); }
      .bf-txt { font-family:var(--font-title); font-size:clamp(2rem,5vw,3rem); font-weight:900; text-transform:uppercase; color:#f0ece4; letter-spacing:0.06em; line-height:1.1; text-align:center; padding:0 1.5rem; }
      .bf-sub { font-family:var(--font-title); font-size:9px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(192,0,26,0.4); margin-top:4px; }

      /* ── HUD root ── */
      #battle-hud { position:fixed; z-index:150; display:none; flex-direction:column; gap:6px; font-family:var(--font-title,'Barlow Condensed',system-ui); }
      #battle-hud.show { display:flex; }
      #b-toast { display:none; }

      /* ── MOBILE layout ── */
      @media (max-width:600px) {
        #battle-hud { bottom:16px; left:12px; width:310px; }
        #b-desktop-bar,#b-panel-desktop { display:none !important; }
      }

      /* ── DESKTOP layout ── */
      @media (min-width:601px) {
        #battle-hud { bottom:0; left:0; width:460px; gap:0; }
        #b-orb-zone,#b-shelf-zone { display:none !important; }
        #b-toast { position:fixed; bottom:80px; right:16px; width:240px; }
      }

      /* Mobile HUD row */
      .b-hud-row { display:flex; gap:9px; align-items:flex-start; }

      /* ── Orb ── */
      #b-orb-zone { position:relative; width:118px; height:118px; flex-shrink:0; }
      #b-orb-svg  { position:absolute; top:0; left:0; width:118px; height:118px; pointer-events:none; }
      .b-rnode { position:absolute; border-radius:50%; background:#09090d; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; z-index:6; user-select:none; transition:background 0.12s; width:32px; height:32px; border:1.5px solid #333; }
      .b-rnode:hover,.b-rnode.active { background:#1a1a2a; }
      .b-rn-ico { font-size:12px; line-height:1; }
      .b-rn-lbl { font-size:8px; letter-spacing:0.06em; text-transform:uppercase; margin-top:1px; }
      .b-n-top    { top:3px;    left:50%; transform:translateX(-50%); }
      .b-n-right  { top:50%;   right:3px; transform:translateY(-50%); }
      .b-n-bottom { bottom:3px; left:50%; transform:translateX(-50%); }
      .b-n-left   { top:50%;   left:3px;  transform:translateY(-50%); }
      .b-orb-btn { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:66px; height:66px; border-radius:50%; background:#09090d; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; z-index:6; border:none; outline:none; overflow:hidden; padding:0; }
      .b-orb-portrait { width:66px; height:66px; border-radius:50%; object-fit:cover; object-position:center top; border:2px solid transparent; display:block; }
      .b-orb-hp-tag { position:absolute; bottom:3px; left:50%; transform:translateX(-50%); font-size:8px; font-weight:700; white-space:nowrap; background:rgba(9,9,13,0.85); padding:0 3px; border-radius:2px; }

      /* Mobile shelf */
      #b-shelf-zone { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
      #b-shelf { background:#111018; border-radius:6px; padding:6px 9px; display:flex; flex-direction:column; gap:4px; }
      .b-srow { display:flex; align-items:center; gap:5px; }
      .b-slbl { font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:#444; width:40px; flex-shrink:0; }
      .b-pips { display:flex; gap:2px; align-items:center; flex-wrap:wrap; }

      /* ── Desktop bar ── */
      #b-desktop-bar { background:#0d0d14; border-top:1px solid #1a1a28; border-right:1px solid #1a1a28; }
      #b-dbar-top { display:flex; align-items:center; gap:11px; padding:9px 14px; border-bottom:1px solid #1a1a28; position:relative; }

      /* Character chip + portrait picker */
      #b-dchar-chip { display:flex; align-items:center; gap:9px; flex-shrink:0; cursor:pointer; padding:2px 4px; border-radius:4px; transition:background 0.12s; }
      #b-dchar-chip:hover { background:#1a1a28; }
      .b-dbar-portrait { width:36px; height:36px; border-radius:4px; object-fit:cover; object-position:center top; }
      .b-dchar-info { display:flex; flex-direction:column; gap:1px; }
      .b-dchar-name { font-size:14px; font-weight:700; line-height:1; }
      .b-dchar-hp   { font-size:11px; }
      .b-dchar-arrow { font-size:9px; color:#444; margin-left:2px; transition:transform 0.15s; }
      #b-dchar-chip:hover .b-dchar-arrow { color:#888; }

      /* Character picker popup */
      .b-char-pick { position:absolute; bottom:calc(100% + 4px); left:0; background:#0d0d14; border:1px solid #1a1a28; border-radius:6px; display:none; flex-direction:row; gap:6px; padding:10px 12px; z-index:10; }
      .b-char-pick.open { display:flex; }
      .b-cpick-item { display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; padding:5px 8px; border-radius:4px; border:1px solid transparent; transition:all 0.12s; }
      .b-cpick-item:hover { background:#1a1a28; border-color:#2a2a3a; }
      .b-cpick-item.on { border-color:#333; background:#111018; }
      .b-cpick-portrait { width:48px; height:48px; border-radius:50%; object-fit:cover; object-position:center top; }
      .b-cpick-name { font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; }

      .b-ddivider { width:1px; height:34px; background:#1a1a28; flex-shrink:0; }
      #b-dstats { display:flex; gap:14px; align-items:center; flex-shrink:0; }
      .b-dstat { display:flex; flex-direction:column; align-items:center; gap:1px; }
      .b-dstat-val { font-size:16px; font-weight:700; color:#f0ece4; line-height:1; }
      .b-dstat-lbl { font-size:9px; color:#444; letter-spacing:0.1em; text-transform:uppercase; }
      #b-dres-strip { display:flex; gap:9px; align-items:center; flex:1; flex-wrap:wrap; }
      .b-dres-chip { display:flex; flex-direction:column; gap:2px; align-items:center; cursor:pointer; padding:3px 5px; border-radius:3px; transition:background 0.12s; }
      .b-dres-chip:hover { background:#1a1a28; }
      .b-dres-lbl  { font-size:9px; color:#444; text-transform:uppercase; letter-spacing:0.08em; }
      .b-dres-pips { display:flex; gap:2px; align-items:center; }
      #b-dbar-btns { display:flex; }
      .b-dact-btn { flex:1; padding:8px 5px; background:#0d0d14; border:none; border-top:1px solid #1a1a28; border-right:1px solid #1a1a28; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; cursor:pointer; transition:background 0.12s; }
      .b-dact-btn:last-child { border-right:none; }
      .b-dact-btn:hover,.b-dact-btn.active { background:#111018; }
      .b-dact-ico { font-size:16px; color:#f0ece4; line-height:1; }
      .b-dact-lbl { font-size:10px; color:#555; letter-spacing:0.1em; text-transform:uppercase; }
      #b-panel-desktop { background:#0d0d14; border-top:1px solid #1a1a28; border-right:1px solid #1a1a28; display:none; max-height:280px; overflow-y:auto; }
      #b-panel-desktop.show { display:block; }

      /* ── Roller panel ── */
      #b-roller { background:#0e0d10; border:1px solid rgba(184,149,42,0.25); font-family:var(--font-title,'Barlow Condensed',system-ui); display:none; z-index:151; }
      #b-roller.show { display:block; }
      .b-roller-mobile { position:static; margin-top:6px; border-radius:6px; width:310px; }
      .b-roller-desktop { position:fixed; bottom:16px; right:16px; width:260px; border-radius:6px; }
      .b-roller-header { display:flex; align-items:center; justify-content:space-between; padding:7px 11px; border-bottom:1px solid rgba(184,149,42,0.12); cursor:pointer; user-select:none; }
      .b-roller-title { font-size:10px; font-weight:700; letter-spacing:0.25em; color:#b8952a; text-transform:uppercase; }
      .b-roller-chevron { font-size:9px; color:#555; }
      .b-roller-toggles { display:flex; gap:4px; flex-wrap:wrap; padding:7px 10px; border-bottom:1px solid rgba(184,149,42,0.08); }
      .b-tog { font-family:var(--font-title,system-ui); font-size:10px; letter-spacing:0.08em; text-transform:uppercase; padding:3px 8px; border:1px solid #2a2a3a; background:transparent; color:#555; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
      .b-tog.on { background:rgba(184,149,42,0.15); border-color:#b8952a; color:#b8952a; }
      .b-tog.b-tog-adv-on { background:rgba(90,154,106,0.15); border-color:#5a9a6a; color:#5a9a6a; }
      .b-tog.b-tog-dis-on { background:rgba(154,90,90,0.15); border-color:#9a5a5a; color:#9a5a5a; }
      .b-tog-clr { border-color:rgba(107,93,74,0.3); margin-left:auto; }
      .b-roll-history { max-height:220px; overflow-y:auto; padding:7px 10px; display:flex; flex-direction:column; gap:5px; scrollbar-width:thin; scrollbar-color:rgba(184,149,42,0.2) transparent; }
      .b-roll-history::-webkit-scrollbar { width:3px; }
      .b-roll-history::-webkit-scrollbar-thumb { background:rgba(184,149,42,0.2); }
      .b-rh-entry { border-bottom:1px solid rgba(255,255,255,0.04); padding-bottom:5px; }
      .b-rh-entry:last-child { border-bottom:none; }
      .b-rh-name  { font-size:10px; letter-spacing:0.1em; color:#555; text-transform:uppercase; }
      .b-rh-main  { font-size:14px; color:#e8e3da; line-height:1.4; }
      .b-rh-dmg   { font-size:13px; color:#c8b080; margin-top:1px; }
      .b-rh-detail { font-size:9px; color:#444; display:block; margin-top:1px; }
      .b-rh-total { font-family:var(--font-title,system-ui); font-size:18px; color:#b8952a; font-weight:700; }
      .b-rh-kept  { color:#b8952a; font-weight:700; }
      .b-rh-drop  { color:#555; text-decoration:line-through; }
      .b-rh-crit  { color:#c8a020; font-size:11px; letter-spacing:0.12em; margin-left:4px; }
      .b-rh-fumble{ color:#9a5a5a; font-size:11px; letter-spacing:0.12em; margin-left:4px; }
      .b-rh-empty { font-style:italic; color:#444; font-size:11px; text-align:center; padding:10px 0; }

      /* ── Pips ── */
      .b-pip-circle  { display:inline-block; width:9px; height:9px; border-radius:50%; background:#1a1a28; }
      .b-pip-circle.off  { background:#1a1a28 !important; border:1px solid #2a2a3a; }
      .b-pip-diamond { display:inline-block; width:9px; height:9px; transform:rotate(45deg); border-radius:1px; background:#1a1a28; }
      .b-pip-diamond.off { background:#1a1a28 !important; border:1px solid #2a2a3a; }
      .b-pip-lute { display:inline-flex; align-items:center; justify-content:center; width:13px; height:13px; color:#1a1a28; }
      .b-pip-lute.on { color:inherit; animation:b-lp 2.2s ease-in-out infinite; }
      @keyframes b-lp { 0%,100%{opacity:1} 50%{opacity:0.35} }
      .b-pip-fist { display:inline-flex; align-items:center; justify-content:center; width:13px; height:13px; color:#1a1a28; }
      .b-pip-fist.on { color:inherit; }

      /* ── Panel (shared) ── */
      #b-panel { background:#0d0d14; border-radius:8px; border:1px solid #1e1e2a; overflow:hidden; display:none; max-height:270px; overflow-y:auto; }
      #b-panel.show { display:block; }
      .b-ph { display:flex; align-items:center; gap:6px; padding:7px 11px; border-bottom:1px solid #1e1e2a; position:sticky; top:0; background:#0d0d14; z-index:1; }
      .b-ph-dot   { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
      .b-ph-title { font-size:11px; letter-spacing:0.15em; text-transform:uppercase; flex:1; font-weight:700; }
      .b-ph-close,.b-ph-back { font-size:14px; color:#444; cursor:pointer; padding:0 3px; background:none; border:none; font-family:inherit; line-height:1; }
      .b-ph-close:hover,.b-ph-back:hover { color:#f0ece4; }
      .b-set-tabs { display:flex; border-bottom:1px solid #1e1e2a; }
      .b-stab { flex:1; padding:6px; text-align:center; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; cursor:pointer; color:#444; border-bottom:2px solid transparent; background:none; border-left:none; border-right:none; border-top:none; font-family:inherit; }
      .b-aitem { display:flex; align-items:center; gap:7px; padding:9px 11px; border-bottom:1px solid #131320; cursor:pointer; transition:background 0.1s; }
      .b-aitem:last-child { border-bottom:none; }
      .b-aitem:hover { background:#111018; }
      .b-aitem.empty { opacity:0.3; cursor:default; pointer-events:none; }
      .b-ai-name { font-size:14px; color:#e8e3da; flex:1; }
      .b-ai-hit  { font-size:13px; font-weight:700; flex-shrink:0; }
      .b-ai-dmg  { font-size:11px; color:#555; flex-shrink:0; max-width:130px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .b-ai-roll { width:22px; height:22px; border-radius:3px; background:#1e1e2a; border:1px solid #2a2a3a; display:flex; align-items:center; justify-content:center; font-size:10px; color:#b8952a; flex-shrink:0; }
      .b-ai-tag { font-size:9px; padding:1px 5px; border-radius:2px; margin-left:4px; }
      .b-tag-cantrip { background:rgba(90,138,170,0.15); color:#5a8aaa; }
      .b-tag-spell   { background:rgba(157,78,221,0.12); color:#9d4edd; }
      .b-tag-ki      { background:rgba(192,0,26,0.12);   color:#c0001a; }
      .b-tag-ritual  { background:rgba(184,149,42,0.12); color:#b8952a; }
      .b-tag-conc    { background:rgba(138,43,226,0.15); color:#9d4edd; }

      /* ── Turn economy — used indicator on action/bonus buttons ── */
      .b-dact-btn.turn-used .b-dact-ico { opacity:0.25; }
      .b-dact-btn.turn-used .b-dact-lbl { opacity:0.25; }
      .b-dact-btn.turn-used::after { content:'✓'; position:absolute; top:4px; right:5px; font-size:8px; color:#5a9a6a; }
      .b-dact-btn { position:relative; }

      /* ── End Turn button ── */
      .b-end-turn { border-left:1px solid #2a2a3a !important; }
      .b-end-turn:hover .b-dact-ico, .b-end-turn:hover .b-dact-lbl { opacity:1 !important; }

      /* ── Concentration halo ── */
      .b-orb-portrait.concentrating { box-shadow:0 0 0 2px #9d4edd, 0 0 12px 3px rgba(157,78,221,0.5); border-radius:50%; }
      .b-dbar-portrait.concentrating { box-shadow:0 0 0 2px #9d4edd, 0 0 8px 2px rgba(157,78,221,0.4); border-radius:50%; }
      #b-conc-label { display:flex; align-items:center; gap:5px; padding:3px 8px; background:rgba(157,78,221,0.1); border:1px solid rgba(157,78,221,0.3); cursor:pointer; transition:background 0.15s; margin-left:auto; }
      #b-conc-label:hover { background:rgba(157,78,221,0.2); }
      .b-conc-ico { color:#9d4edd; font-size:10px; }
      .b-conc-name { font-size:10px; color:#c8a8f0; letter-spacing:0.05em; }
      .b-conc-drop { font-size:9px; color:#555; margin-left:3px; }

      /* ── Modal ── */
      #b-conc-modal, #b-endturn-modal { position:absolute; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:50; }
      .b-modal-box { background:#0d0d14; border:1px solid #2a2a3a; padding:20px 24px; max-width:280px; width:90%; }
      .b-modal-title { font-family:var(--font-title,inherit); font-size:0.65rem; letter-spacing:0.2em; text-transform:uppercase; color:#b8952a; margin-bottom:10px; }
      .b-modal-body { font-size:12px; color:#aaa; line-height:1.6; margin-bottom:16px; }
      .b-modal-body strong { color:#e0d8c8; }
      .b-modal-btns { display:flex; gap:8px; justify-content:flex-end; }
      .b-modal-btn { padding:6px 14px; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer; border:1px solid; transition:background 0.15s; }
      .b-modal-btn.cancel  { background:transparent; border-color:#2a2a3a; color:#666; }
      .b-modal-btn.confirm { background:rgba(192,0,26,0.1); border-color:#c0001a55; color:#c0001a; }
      .b-modal-btn.cancel:hover  { background:#1a1a28; }
      .b-modal-btn.confirm:hover { background:rgba(192,0,26,0.2); }
      .b-spell-lbl { font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#333; padding:6px 11px 3px; border-bottom:1px solid #0f0f1a; }
      .b-hp-panel { padding:12px; display:flex; flex-direction:column; gap:9px; }
      .b-hp-track-row { display:flex; align-items:center; gap:7px; }
      .b-hp-num  { font-size:30px; font-weight:900; line-height:1; }
      .b-hp-max  { font-size:14px; color:#444; align-self:flex-end; margin-bottom:2px; }
      .b-hp-adj  { display:flex; gap:4px; margin-left:auto; align-items:center; }
      .b-hp-adj-input { width:40px; padding:4px; background:#111018; border:1px solid #1e1e2a; border-radius:3px; color:#f0ece4; font-family:inherit; font-size:14px; text-align:center; outline:none; }
      .b-hp-adj-input:focus { border-color:#5a9a6a; }
      .b-hp-adj-btn { width:30px; height:30px; border-radius:4px; border:1px solid; background:#111018; color:inherit; font-size:17px; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; }
      .b-hp-adj-btn.dmg  { border-color:#c0001a; color:#c0001a; }
      .b-hp-adj-btn.heal { border-color:#5a9a6a; color:#5a9a6a; }
      .b-stat-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; }
      .b-stat-box  { background:#111018; border-radius:3px; padding:6px 7px; text-align:center; }
      .b-stat-val  { font-size:18px; font-weight:700; color:#f0ece4; display:block; line-height:1; }
      .b-stat-lbl  { font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:#444; display:block; margin-top:2px; }
      .b-sec-lbl   { font-size:9px; letter-spacing:0.2em; text-transform:uppercase; color:#333; margin-top:3px; }
      .b-save-row,.b-cond-row { display:flex; flex-wrap:wrap; gap:4px; }
      .b-save-pip { padding:3px 6px; border-radius:3px; font-size:9px; letter-spacing:0.08em; text-transform:uppercase; border:1px solid; }
      .b-save-pip.prof { background:rgba(58,122,80,0.12); border-color:rgba(58,122,80,0.3); color:#3a7a50; }
      .b-save-pip.no   { background:transparent; border-color:#1e1e2a; color:#333; }
      .b-cond { padding:3px 7px; border-radius:3px; font-size:10px; background:#1e1e2a; border:1px solid #2a2a3a; color:#555; cursor:pointer; transition:all 0.12s; }
      .b-cond.active { background:rgba(192,0,26,0.15); border-color:rgba(192,0,26,0.3); color:#c0001a; }
      .b-res-list { padding:7px 9px; display:flex; flex-direction:column; gap:4px; }
      .b-rh-row-res { display:flex; align-items:center; gap:7px; padding:7px 9px; border-radius:4px; background:#111018; border:1px solid #1e1e2a; cursor:pointer; transition:all 0.12s; }
      .b-rh-row-res:hover { border-color:#2a2a3a; }
      .b-rh-label { font-size:11px; letter-spacing:0.1em; text-transform:uppercase; width:64px; flex-shrink:0; }
      .b-rh-pips  { display:flex; gap:2px; align-items:center; flex:1; }
      .b-rh-count { font-size:13px; font-weight:700; margin-left:auto; }
      .b-rh-arrow { font-size:15px; color:#444; }
      .b-rh-hint  { font-size:10px; color:#333; text-align:center; padding:5px 0 2px; }
      .b-res-ctrl { display:flex; align-items:center; gap:9px; padding:9px 11px; border-bottom:1px solid #1a1a28; }
      .b-rc-btn { padding:5px 11px; border-radius:4px; border:1px solid #2a2a3a; background:#111018; color:#f0ece4; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer; font-family:inherit; }
      .b-rc-btn:hover { background:#1a1a28; }
      .b-rc-btn:disabled { opacity:0.25; cursor:default; }
      .b-rc-btn.spend   { border-color:#c0001a44; color:#c0001a; }
      .b-rc-btn.restore { border-color:#5a9a6a44; color:#5a9a6a; }
    `;
    document.head.appendChild(s);
  }

  // ── Turn economy & concentration helpers ──

  function _docast(resKey,name,time,range,isConc) {
    spendRes(activeKey,resKey,1);
    const r=getResources(activeKey).find(r=>r.key===resKey);
    if(r) showToast(`${r.label} used → ${r.cur}/${r.max}`,col());
    addRollHistory({name,main:'Cast',detail:`${time} · ${range}`});
    // Track action economy — most spells are actions, bonus action spells detected by castingTime
    const s=SESSION[activeKey];
    if(s) {
      if(time && time.toLowerCase().includes('bonus')) s.bonusUsed=true;
      else s.actionUsed=true;
      // Set concentration
      if(isConc) s.concentration={name,duration:''};
    }
    renderTurnOrbs();
    saveCombatState(activeKey);
    closePanelFn(); renderAll();
  }

  function _doEndTurn() {
    const s=SESSION[activeKey];
    if(s) { s.actionUsed=false; s.bonusUsed=false; s.reactionUsed=false; }
    // Increment round in marquee
    const mq=document.getElementById('battle-mq');
    if(mq) {
      const spans=[...mq.querySelectorAll('.bm-txt')];
      spans.forEach(sp=>{
        if(sp.textContent.match(/^Round \d+$/)) {
          const n=parseInt(sp.textContent.replace('Round ',''))||1;
          sp.textContent=`Round ${n+1}`;
        }
      });
    }
    renderTurnOrbs();
    showToast('Turn ended — new round!','#b8952a');
  }

  function renderTurnOrbs() {
    const s=SESSION[activeKey];
    if(!s) return;
    // Desktop orb dots on action buttons
    ['Act','Bon'].forEach((lbl,i)=>{
      const used = i===0 ? s.actionUsed : s.bonusUsed;
      const btn  = document.getElementById(`b-d${lbl}`);
      if(btn) btn.classList.toggle('turn-used', used);
    });
    // Concentration halo on orb portrait
    const orb=document.getElementById('b-orbBtn');
    if(orb) orb.classList.toggle('concentrating', !!s.concentration);
    const dport=document.getElementById('b-dPortrait');
    if(dport) dport.classList.toggle('concentrating', !!s.concentration);
    // Concentration label in desktop bar
    let concEl=document.getElementById('b-conc-label');
    if(s.concentration) {
      if(!concEl) {
        concEl=document.createElement('div');
        concEl.id='b-conc-label';
        concEl.onclick=()=>window.__battle.dropConcentration();
        document.getElementById('b-dchar-chip')?.after(concEl);
      }
      concEl.innerHTML=`<span class="b-conc-ico">◉</span><span class="b-conc-name">${s.concentration.name}</span><span class="b-conc-drop" title="Drop concentration">✕</span>`;
    } else if(concEl) { concEl.remove(); }
  }

  function showConcModal(currentSpell, newSpell, resKey, time, range) {
    document.getElementById('b-conc-modal')?.remove();
    const m=document.createElement('div'); m.id='b-conc-modal';
    m.innerHTML=`
      <div class="b-modal-box">
        <div class="b-modal-title">Concentration</div>
        <div class="b-modal-body">Currently concentrating on <strong>${currentSpell}</strong>.<br>Cast <strong>${newSpell}</strong> and drop concentration?</div>
        <div class="b-modal-btns">
          <button class="b-modal-btn cancel" onclick="window.__battle.cancelCast()">Cancel</button>
          <button class="b-modal-btn confirm" onclick="window.__battle.confirmCast('${resKey}','${newSpell}','${time}','${range}',true)">Cast & Drop</button>
        </div>
      </div>`;
    document.getElementById('battle-hud').appendChild(m);
  }

  function showEndTurnModal(unusedAction, unusedBonus) {
    document.getElementById('b-endturn-modal')?.remove();
    const unused=[unusedAction&&'Action',unusedBonus&&'Bonus Action'].filter(Boolean).join(' and ');
    const m=document.createElement('div'); m.id='b-endturn-modal';
    m.innerHTML=`
      <div class="b-modal-box">
        <div class="b-modal-title">End Turn?</div>
        <div class="b-modal-body">You still have your <strong>${unused}</strong> available.</div>
        <div class="b-modal-btns">
          <button class="b-modal-btn cancel" onclick="window.__battle.cancelEndTurn()">Go Back</button>
          <button class="b-modal-btn confirm" onclick="window.__battle.confirmEndTurn()">End Turn</button>
        </div>
      </div>`;
    document.getElementById('battle-hud').appendChild(m);
  }

  // ── Public API ──
  window.__battle = {
    openPanel:     openPanelFn,
    closePanel:    closePanelFn,
    toggleBattle,
    setChar,
    toggleCharPick,
    toggleRoller,
    switchSet: (i)=>{ activeSet=i; openPanelFn(openPanel); },
    doActionById: (charKey,id)=>{
      const a=(CHARACTERS[charKey].actions||[]).find(a=>a.id===id);
      if(a) {
        // Track turn economy
        const s=SESSION[charKey];
        if(s) {
          if(a.cost==='bonus') s.bonusUsed=true;
          else s.actionUsed=true;
        }
        renderTurnOrbs();
        doAction(a);
      }
    },
    doSpellByName: (name,time,isConc)=>{
      const s=SESSION[activeKey];
      // Concentration check
      if(isConc && s && s.concentration) {
        showConcModal(s.concentration.name, name, null, time, '');
        return;
      }
      // Track action economy
      if(s) {
        if(time && time.toLowerCase().includes('bonus')) s.bonusUsed=true;
        else s.actionUsed=true;
        if(isConc) s.concentration={name,duration:''};
      }
      addRollHistory({name,main:'—',detail:'Cantrip — no slot used'});
      renderTurnOrbs();
      closePanelFn();
    },
    castSpell: (resKey,name,time,range,isConc)=>{
      const s=SESSION[activeKey];
      // Concentration check
      if(isConc && s && s.concentration) {
        showConcModal(s.concentration.name, name, resKey, time, range);
        return;
      }
      _docast(resKey,name,time,range,isConc);
    },
    confirmCast: (resKey,name,time,range,isConc)=>{
      document.getElementById('b-conc-modal')?.remove();
      if(resKey && resKey !== 'null') _docast(resKey,name,time,range,isConc);
      else {
        // Cantrip — no slot, just track concentration and action
        const s=SESSION[activeKey];
        if(s) {
          if(time && time.toLowerCase().includes('bonus')) s.bonusUsed=true;
          else s.actionUsed=true;
          if(isConc) s.concentration={name,duration:''};
        }
        addRollHistory({name,main:'—',detail:'Cantrip — no slot used'});
        renderTurnOrbs();
        closePanelFn();
      }
    },
    cancelCast: ()=>{ document.getElementById('b-conc-modal')?.remove(); },
    endTurn: ()=>{
      const s=SESSION[activeKey];
      if(!s) return;
      // Check for unused action/bonus
      const unusedAction = !s.actionUsed;
      const unusedBonus  = !s.bonusUsed;
      if(unusedAction || unusedBonus) {
        showEndTurnModal(unusedAction, unusedBonus);
        return;
      }
      _doEndTurn();
    },
    confirmEndTurn: ()=>{
      document.getElementById('b-endturn-modal')?.remove();
      _doEndTurn();
    },
    cancelEndTurn: ()=>{ document.getElementById('b-endturn-modal')?.remove(); },
    dropConcentration: ()=>{
      const s=SESSION[activeKey];
      if(s) s.concentration=null;
      saveCombatState(activeKey);
      renderTurnOrbs();
      renderAll();
    },
    adjHp: (dir)=>{
      const ch=C(), s=S();
      const amt=Math.max(1,parseInt(document.getElementById('b-hpInput')?.value)||1);
      s.hp=Math.max(0,Math.min(ch.combat.hpMax,s.hp+dir*amt));
      const hpCol=s.hp<=ch.combat.hpMax*0.25?'#c0001a':s.hp<=ch.combat.hpMax*0.5?'#c8a020':'#5a9a6a';
      const hn=document.getElementById('b-hpNum'); if(hn){hn.textContent=s.hp;hn.style.color=hpCol;}
      const ht=document.getElementById('b-orbHpTag'); if(ht){ht.textContent=`${s.hp}/${ch.combat.hpMax}`;ht.style.color=hpCol;}
      const dh=document.getElementById('b-dCharHp'); if(dh){dh.textContent=`${s.hp}/${ch.combat.hpMax} hp`;dh.style.color=hpCol;}
      showToast(`${dir>0?'+':''}${dir*amt} HP → ${s.hp}/${ch.combat.hpMax}`,dir>0?'#5a9a6a':'#c0001a');
      saveCombatState(activeKey);
    },
    toggleCond: (cd)=>{ const arr=getConditions(activeKey); const i=arr.indexOf(cd); i>=0?arr.splice(i,1):arr.push(cd); openPanelFn('hp'); },
    openResDetail: (key)=>{ openPanel='res-detail'; resDetailKey=key; openPanelFn('res-detail'); },
    changeRes: (resKey,amt)=>{
      if(amt<0) spendRes(activeKey,resKey,1); else restoreRes(activeKey,resKey,1);
      saveCombatState(activeKey);
      renderAll(); openPanel='res-detail'; resDetailKey=resKey;
      const p=_panelTarget(); renderPanelInto(p); if(p) p.classList.add('show');
    },
    dismissFlash: ()=>document.getElementById('battle-flash')?.classList.remove('show'),
    toggleRS: (key)=>{
      if(key==='advantage')    { RS.advantage=!RS.advantage; if(RS.advantage) RS.disadvantage=false; }
      else if(key==='disadvantage') { RS.disadvantage=!RS.disadvantage; if(RS.disadvantage) RS.advantage=false; }
      else RS[key]=!RS[key];
      updateRollerToggles();
    },
    clearHistory: ()=>{ rollHistory=[]; renderRollHistory(); },
  };

  // ── Combat state persistence ──
  // On sheet.html: CharacterStore is available — use it (shares debounce + SHA management)
  // On other pages: POST directly to the Netlify function

  const BATTLE_FUNCTION_URL = '/.netlify/functions/character';
  let _battleSaveTimer = null;

  // ── Persistence backend ──────────────────────────────────────────────
  // battle.js talks to a single `backend` for loading, saving, and live
  // external changes to a character's COMBAT state. The default below is the
  // existing sheet / Netlify-function behavior, unchanged. Other pages may
  // swap in an alternate via window.__battle.useBackend() — e.g. combat.html
  // will point this at the Supabase `combatants` row.
  const sheetBackend = {
    // Resolve the durable combat object for `key`, or null.
    async load(key) {
      if (typeof CharacterStore !== 'undefined') {
        const d = CharacterStore.get();
        if (d && d.key === key) return d.combat || null;
        // CharacterStore holds a different character — fall through to a fetch.
      }
      try {
        const res  = await fetch(`${BATTLE_FUNCTION_URL}?character=${key}`);
        const json = await res.json();
        return json.data?.combat || null;
      } catch (e) { console.warn('[battle] load error:', e); return null; }
    },
    // Persist the given combat object for `key`.
    save(key, combat) {
      // CharacterStore (sheet.html) manages SHA + debounce itself.
      if (typeof CharacterStore !== 'undefined' && CharacterStore.get()?.key === key) {
        CharacterStore.save({ combat });
        return;
      }
      // Otherwise debounce a direct POST.
      clearTimeout(_battleSaveTimer);
      _battleSaveTimer = setTimeout(async () => {
        try {
          await fetch(`${BATTLE_FUNCTION_URL}?character=${key}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ combat }),
          });
        } catch (e) { console.warn('[battle] save error:', e); }
      }, 1200);
    },
    // Report external changes as onChange({ key, combat }).
    subscribe(onChange) {
      if (typeof CharacterStore === 'undefined') return;
      CharacterStore.onUpdate(({ type, data }) => {
        if (type !== 'data' || !data?.combat) return;
        onChange({ key: activeKey, combat: data.combat });
      });
    },
  };

  // The active backend. Pages swap it via window.__battle.useBackend(); the
  // default keeps every existing page on the sheet/Netlify path, unchanged.
  let backend = sheetBackend;

  // Apply an external combat change into SESSION + re-render. Shared by the
  // init subscription and by any re-subscribe after a backend swap.
  function applyCombatChange({ key, combat }) {
    const s = SESSION[key];
    if (!s) return;
    if (combat.hp     !== null && combat.hp !== undefined) s.hp     = combat.hp;
    if (combat.hpTemp  !== undefined) s.hpTemp  = combat.hpTemp;
    if (combat.hpBonus !== undefined) s.hpBonus = combat.hpBonus;
    if (battleOn) renderAll();
  }
  function bindRealtime() { backend.subscribe(applyCombatChange); }

  window.__battle.useBackend = (b) => {
    backend = b || sheetBackend;
    bindRealtime();                              // subscription follows the swap
    if (battleOn) loadCombatFromDb(activeKey);   // re-read from the new source
  };

  // Translate HUD resource keys → DB pipState keys (HUD keys already match DB)
  function hudResKeyToDb(resKey) {
    if (resKey.startsWith('spell_') || resKey.startsWith('sorc_')) return resKey;
    return resKey; // pactSlots, kiPoints, actionSurge, secondWind, bardicInspiration all match
  }

  // Build pipState object from current SESSION for a character
  function buildDbPipState(key) {
    const s  = SESSION[key];
    const cf = CHARACTERS[key].classFeatures || {};
    const ps = {};
    if (cf.spellSlots)    Object.keys(cf.spellSlots).forEach(lvl    => { ps[`spell_${lvl}`] = (cf.spellSlots[lvl].max   - (s.spellSlots?.[lvl]?.current    ?? cf.spellSlots[lvl].max));   });
    if (cf.sorcererSlots) Object.keys(cf.sorcererSlots).forEach(lvl => { ps[`sorc_${lvl}`]  = (cf.sorcererSlots[lvl].max - (s.sorcererSlots?.[lvl]?.current ?? cf.sorcererSlots[lvl].max)); });
    if (cf.pactSlots)         ps.pactSlots         = cf.pactSlots.max         - (s.pactSlots?.current         ?? cf.pactSlots.max);
    if (cf.kiPoints)          ps.kiPoints          = cf.kiPoints.max          - (s.kiPoints?.current          ?? cf.kiPoints.max);
    if (cf.actionSurge)       ps.actionSurge       = cf.actionSurge.max       - (s.actionSurge?.current       ?? cf.actionSurge.max);
    if (cf.secondWind)        ps.secondWind        = cf.secondWind.max        - (s.secondWind?.current        ?? cf.secondWind.max);
    if (cf.bardicInspiration) ps.bardicInspiration = cf.bardicInspiration.max - (s.bardicInspiration?.current ?? cf.bardicInspiration.max);
    return ps;
  }

  function saveCombatState(key) {
    initSession(key);
    const s      = SESSION[key];
    const combat = {
      hp:            s.hp,
      hpTemp:        s.hpTemp  || 0,
      hpBonus:       s.hpBonus || 0,
      pipState:      buildDbPipState(key),
      concentration: s.concentration || null,
    };
    backend.save(key, combat);
  }

  // Seed SESSION from DB combat state — called after initSession builds defaults
  function seedSessionFromDb(key, dbCombat) {
    if (!dbCombat) return;
    const s  = SESSION[key];
    const cf = CHARACTERS[key].classFeatures || {};
    if (dbCombat.hp     !== null && dbCombat.hp     !== undefined) s.hp     = dbCombat.hp;
    if (dbCombat.hpTemp  !== undefined) s.hpTemp  = dbCombat.hpTemp;
    if (dbCombat.hpBonus !== undefined) s.hpBonus = dbCombat.hpBonus;
    const ps = dbCombat.pipState || {};
    // Convert used-count back to current (remaining = max - used)
    if (cf.spellSlots)    Object.keys(cf.spellSlots).forEach(lvl    => { if (ps[`spell_${lvl}`] !== undefined && s.spellSlots?.[lvl])    s.spellSlots[lvl].current    = Math.max(0, cf.spellSlots[lvl].max    - ps[`spell_${lvl}`]); });
    if (cf.sorcererSlots) Object.keys(cf.sorcererSlots).forEach(lvl => { if (ps[`sorc_${lvl}`]  !== undefined && s.sorcererSlots?.[lvl]) s.sorcererSlots[lvl].current = Math.max(0, cf.sorcererSlots[lvl].max - ps[`sorc_${lvl}`]);  });
    if (cf.pactSlots         && ps.pactSlots         !== undefined) s.pactSlots.current         = Math.max(0, cf.pactSlots.max         - ps.pactSlots);
    if (cf.kiPoints          && ps.kiPoints          !== undefined) s.kiPoints.current          = Math.max(0, cf.kiPoints.max          - ps.kiPoints);
    if (cf.actionSurge       && ps.actionSurge       !== undefined) s.actionSurge.current       = Math.max(0, cf.actionSurge.max       - ps.actionSurge);
    if (cf.secondWind        && ps.secondWind        !== undefined) s.secondWind.current        = Math.max(0, cf.secondWind.max        - ps.secondWind);
    if (cf.bardicInspiration && ps.bardicInspiration !== undefined) s.bardicInspiration.current = Math.max(0, cf.bardicInspiration.max - ps.bardicInspiration);
    // Restore concentration
    if (dbCombat.concentration !== undefined) s.concentration = dbCombat.concentration || null;
  }

  // Load combat state for a character, seed SESSION, then re-render.
  async function loadCombatFromDb(key) {
    const combat = await backend.load(key);
    if (combat) { seedSessionFromDb(key, combat); renderAll(); }
  }
  try{const saved=localStorage.getItem(CHAR_STORAGE_KEY);if(saved&&CHARACTERS[saved])activeKey=saved;}catch(e){}

  // Silent resume — if battle was active on a previous page, restore without flash
  let resumeBattle = false;
  try { resumeBattle = localStorage.getItem('kirtas-battle-on') === 'true'; } catch(e) {}

  function init() {
    injectStyles();
    injectNav();

    // Real-time sync — the backend reports external changes to combat state.
    bindRealtime();
    if (resumeBattle) {
      battleOn = true;
      initSession(activeKey);
      loadCombatFromDb(activeKey);
      mountHud();
      syncLayouts();
      renderAll();
      document.getElementById('battle-mq')?.classList.add('show');
      const btn = document.getElementById('battle-btn');
      if (btn) btn.classList.add('on');
      const tog = document.getElementById('bm-toggle');
      if (tog) tog.classList.add('on');
      const row = document.getElementById('bm-toggle-row');
      if (row) row.classList.add('on');
      document.getElementById('battle-hud')?.classList.add('show');
    }
    let lastMobile=isMobile();
    window.addEventListener('resize',()=>{
      const nowMobile=isMobile();
      if(nowMobile!==lastMobile){lastMobile=nowMobile;injectNav();if(battleOn){syncLayouts();renderAll();}}
    });
  }

  // Boot once the nav exists. nav.js mounts the nav asynchronously (after the
  // session check), so #theme-dropdown isn't present at DOMContentLoaded — we
  // wait for nav.js's 'nav:ready' signal instead. The guard ensures init() runs
  // exactly once (it binds listeners that must not double-subscribe).
  let _battleBooted = false;
  function bootBattle(){ if(_battleBooted) return; _battleBooted = true; init(); }
  if (document.getElementById('site-nav')) bootBattle();
  else document.addEventListener('nav:ready', bootBattle, { once: true });

})();
