// sheet-actions.js
// ---------------------------------------------------------------------------
// Live write-affordances for the at-a-glance sheet (sheet-v2.html). Phase 2.
//
// Wired: the Hit-Dice cluster — INSPIRATION (centre) plus the two rest moons
// (SHORT / LONG), and the Hit-Dice medallion as a spend-to-heal surface.
//
// Every write mirrors party.html's HP save exactly: read the WHOLE vitals
// object, set what changed, write it back. CharacterData.save does a full-column
// .update, so a partial would wipe hp / conditions / etc. Writes are optimistic
// (flip UI → save → reconcile to the server row / revert on throw) and gated on
// CharacterData.canEdit. All resource ledgers live in vitals.pipState; spent hit
// dice live in vitals.hitDiceSpent — same "store only spent" model the orbs use.
//
// Rules (verified against the 5etools 2014 mirror, PHB "Resting"):
//   • Short rest — restores resources that recharge on a short rest (incl.
//     short-or-long), i.e. Pact slots + any pool whose recharge says "short".
//     You separately SPEND Hit Dice to heal (roll the die + CON mod, min 0).
//   • Long rest — all HP back, temp HP gone, concentration dropped, every
//     resource + spell slot restored, and you regain spent Hit Dice up to half
//     your total number of them (minimum one), largest die first.
//
// Rests confirm before firing and leave an Undo (a pre-rest vitals snapshot kept
// in memory; tapping Undo writes it back, restoring the exact prior state).
//
// planRest / rollHitDie / shortRestKeys are pure and exported so the jsdom smoke
// can drive the logic without a browser. The page bootstrap is owned by
// sheet-mount.js's mountSheet (it calls wireInspiration scoped to its container).
// ---------------------------------------------------------------------------

// ── ResourceDerive resolver (browser global, set by resource-derive.js) ──
function rd() {
  var w = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis.window : undefined);
  if (w && w.ResourceDerive) return w.ResourceDerive;
  return { derive: function () { return []; }, deriveHitDice: function () { return { pools: [], total: 0 }; } };
}

// pipState keys a SHORT rest restores: derived pools whose recharge contains
// "short" (short / short-or-long), plus Pact Magic slots. Spell/sorcerer slots
// and sorcery points are long-rest only and stay untouched.
export function shortRestKeys(structural, R) {
  R = R || rd(); structural = structural || {};
  var keys = [];
  if (R.derive) R.derive(structural).forEach(function (r) { if (/short/i.test(r.recharge || '')) keys.push(r.id); });
  var cf = structural.classFeatures || {};
  if (cf.pactSlots) keys.push('pactSlots');
  return keys;
}

// Regain up to `cap` spent dice, largest die first (deriveHitDice sorts pools so).
// Returns a new spent map + the count actually regained.
function regainHitDice(hd, spentIn, cap) {
  var spent = Object.assign({}, spentIn || {}), regained = 0;
  for (var i = 0; i < hd.pools.length && regained < cap; i++) {
    var die = hd.pools[i].die, sp = spent[die] || 0;
    while (sp > 0 && regained < cap) { sp--; regained++; }
    spent[die] = sp;
  }
  return { spent: spent, regained: regained };
}

// half total HD, min 1 — the number of dice a long rest regains.
export function longRegainCount(structural) {
  var total = (rd().deriveHitDice ? rd().deriveHitDice(structural) : { total: 0 }).total || 0;
  return Math.max(1, Math.floor(total / 2));
}

// PURE: the vitals AFTER a rest. Never mutates the input.
export function planRest(kind, structural, vitals) {
  structural = structural || {};
  var v = JSON.parse(JSON.stringify(vitals || {}));
  var R = rd();
  if (kind === 'long') {
    var cmb = structural.combat || {};
    var max = (cmb.hpMax || 0) + (v.hpBonus || 0);
    v.hp = max; v.hpTemp = 0; v.concentration = null; v.pipState = {};
    var hd = R.deriveHitDice ? R.deriveHitDice(structural) : { pools: [], total: 0 };
    var cap = Math.max(1, Math.floor((hd.total || 0) / 2));
    var got = regainHitDice(hd, v.hitDiceSpent || {}, cap);
    v.hitDiceSpent = got.spent;
    return { vitals: v, summary: { kind: 'long', hp: max, hdRegained: got.regained } };
  }
  var pip = v.pipState || (v.pipState = {});
  var keys = shortRestKeys(structural, R);
  keys.forEach(function (id) { if (pip[id]) pip[id] = 0; });
  return { vitals: v, summary: { kind: 'short', restoredKeys: keys } };
}

// PURE: roll one hit die + CON mod (min 0 gain).
export function rollHitDie(faces, conMod, rng) {
  rng = rng || Math.random;
  var roll = 1 + Math.floor(rng() * faces);
  return { roll: roll, gain: Math.max(0, roll + (conMod || 0)) };
}

function esc(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function raf(fn) { (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : function (f) { f(); })(fn); }

export function wireInspiration({ root, characterData, key } = {}) {
  root = root || (typeof document !== 'undefined' ? document : null);
  if (!root || !characterData) return null;

  const toggle = root.querySelector('#insp-toggle');
  if (!toggle) return null;
  const doc = (root.nodeType === 9) ? root
            : (root.ownerDocument || (typeof document !== 'undefined' ? document : null));
  const portrait = root.querySelector('.portrait');
  const statEl = root.querySelector('#insp-stat');
  const hdMed = root.querySelector('#hd-med');

  let vitals = {};        // baseline; reconciled with the server-confirmed row
  let structural = {};    // for ResourceDerive / hit dice / CON / hpMax
  let saving = false;
  let statTimer = null;
  let lastUndo = null;    // { snapshot, label } — the pre-rest vitals
  let pops = [];

  function paint(on) {
    toggle.classList.toggle('on', !!on);
    toggle.setAttribute('aria-pressed', String(!!on));
    if (portrait) portrait.classList.toggle('inspired', !!on);
  }
  function busy(b) {
    saving = b;
    toggle.classList.toggle('saving', b);
    toggle.setAttribute('aria-busy', String(b));
  }
  function showStat(kind, text, autohide) {
    if (!statEl) return;
    clearTimeout(statTimer);
    statEl.className = 'insp-stat show ' + kind;
    statEl.textContent = text;
    if (autohide) statTimer = setTimeout(() => statEl.classList.remove('show'), 1300);
  }

  // repaint pools / HP / status / hit dice from the current (structural, vitals)
  function refresh() {
    try {
      const S = (typeof window !== 'undefined' ? window : globalThis).__sheet;
      if (S && S.renderSheet && S.toRenderShape) S.renderSheet(root, S.toRenderShape({ structural, vitals }));
    } catch (_) {}
    paint(!!vitals.inspiration);   // renderSheet doesn't own the cluster button / portrait class
  }

  // ── popovers (fixed-positioned at an anchor; outside-click closes) ──
  function closePops() {
    pops.forEach((p) => { if (p.parentNode) p.parentNode.removeChild(p); });
    pops = [];
    if (doc) doc.removeEventListener('click', onOutside, true);
  }
  function onOutside(e) { for (let i = 0; i < pops.length; i++) if (pops[i].contains(e.target)) return; closePops(); }
  function mountPop(pop, anchor) {
    if (!doc) return;
    (doc.body || root).appendChild(pop);
    if (anchor && anchor.getBoundingClientRect) {
      const r = anchor.getBoundingClientRect();
      pop.style.position = 'fixed';
      pop.style.left = Math.round(r.left) + 'px';
      pop.style.top = Math.round(r.bottom + 6) + 'px';
    }
    pops.push(pop);
    raf(() => pop.classList.add('in'));
    setTimeout(() => { if (doc) doc.addEventListener('click', onOutside, true); }, 0);
  }
  function mkPop(cls) { const p = doc.createElement('div'); p.className = 'sa-pop ' + cls; return p; }

  function confirmRest(kind) {
    if (saving || !doc) return;
    const label = kind === 'long' ? 'Long rest' : 'Short rest';
    const n = longRegainCount(structural);
    const lines = kind === 'long'
      ? ['Restore all HP', 'Clear temp HP & concentration', 'Restore every resource & spell slot', 'Regain ' + n + ' hit ' + (n === 1 ? 'die' : 'dice')]
      : ['Restore short-rest resources', 'Leaves spell slots & HP untouched'];
    const pop = mkPop('sa-confirm');
    pop.innerHTML = '<div class="sa-pop-t">' + esc(label) + '?</div>'
      + '<ul class="sa-pop-l">' + lines.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'
      + '<div class="sa-pop-act"><button class="sa-btn ghost" data-no type="button">Cancel</button>'
      + '<button class="sa-btn go" data-yes type="button">Confirm</button></div>';
    mountPop(pop, kind === 'long' ? root.querySelector('[data-rest="long"]') : root.querySelector('[data-rest="short"]'));
    pop.querySelector('[data-no]').addEventListener('click', (e) => { e.stopPropagation(); closePops(); });
    pop.querySelector('[data-yes]').addEventListener('click', (e) => { e.stopPropagation(); closePops(); applyRest(kind, label); });
  }

  async function applyRest(kind, label) {
    if (saving) return;
    const snapshot = JSON.parse(JSON.stringify(vitals));   // pre-rest state for undo
    const plan = planRest(kind, structural, vitals);
    const prev = vitals;
    vitals = plan.vitals; busy(true); refresh(); showStat('saving', 'resting\u2026', false);
    try {
      const saved = await characterData.save(key, { vitals });
      vitals = (saved && saved.vitals) ? saved.vitals : vitals;
      refresh();
      lastUndo = { snapshot, label };
      showUndo(label + ' \u2713');
    } catch (e) {
      vitals = prev; refresh();
      showStat('error', "couldn't " + label.toLowerCase() + ' \u00B7 tap to retry', false);
    } finally { busy(false); }
  }

  function showUndo(text) {
    if (!statEl) return;
    clearTimeout(statTimer);
    statEl.className = 'insp-stat show saved';
    statEl.innerHTML = esc(text) + ' \u00B7 <button class="sa-undo" type="button">Undo</button>';
    const u = statEl.querySelector('.sa-undo');
    if (u) u.addEventListener('click', (e) => { e.stopPropagation(); undoRest(); });
  }
  async function undoRest() {
    if (!lastUndo || saving) return;
    const prev = vitals;
    vitals = JSON.parse(JSON.stringify(lastUndo.snapshot)); busy(true); refresh(); showStat('saving', 'undoing\u2026', false);
    try {
      const saved = await characterData.save(key, { vitals });
      vitals = (saved && saved.vitals) ? saved.vitals : vitals;
      refresh(); lastUndo = null; showStat('saved', 'undone \u2713', true);
    } catch (e) {
      vitals = prev; refresh(); showStat('error', "couldn't undo \u00B7 tap to retry", false);
    } finally { busy(false); }
  }

  // ── Hit-Dice spend (roll a die + CON mod → heal) ──
  function poolTotal(hd, die) { for (let i = 0; i < hd.pools.length; i++) if (hd.pools[i].die === die) return hd.pools[i].total; return 0; }
  function hdRowsHTML(hd, spent) {
    return hd.pools.map((p) => {
      const avail = Math.max(0, p.total - (spent[p.die] || 0));
      return '<div class="sa-hd-row"><span class="sa-hd-die">' + esc(p.die) + '</span>'
        + '<span class="sa-hd-av">' + avail + ' left</span>'
        + '<button class="sa-btn go" data-spend="' + esc(p.die) + '" data-faces="' + p.faces + '"' + (avail > 0 ? '' : ' disabled') + ' type="button">Spend</button></div>';
    }).join('');
  }
  function bindSpend(pop) {
    pop.querySelectorAll('[data-spend]').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); spendHd(b.getAttribute('data-spend'), +b.getAttribute('data-faces'), pop); });
    });
  }
  function openHdSpend() {
    if (saving || !doc) return;
    const hd = rd().deriveHitDice ? rd().deriveHitDice(structural) : { pools: [], total: 0 };
    const rows = hdRowsHTML(hd, vitals.hitDiceSpent || {});
    const pop = mkPop('sa-hd');
    pop.innerHTML = '<div class="sa-pop-t">Spend a Hit Die</div>'
      + '<div class="sa-hd-rows">' + (rows || '<div class="sa-hd-none">No hit dice</div>') + '</div>'
      + '<div class="sa-hd-out" aria-live="polite"></div>';
    mountPop(pop, hdMed);
    bindSpend(pop);
  }
  async function spendHd(die, faces, pop) {
    if (saving) return;
    const hd = rd().deriveHitDice(structural), spent = vitals.hitDiceSpent || {};
    if (Math.max(0, poolTotal(hd, die) - (spent[die] || 0)) <= 0) return;
    const conMod = (((structural.abilities || {}).con) || {}).mod || 0;
    const r = rollHitDie(faces, conMod);
    const cmb = structural.combat || {}, max = (cmb.hpMax || 0) + (vitals.hpBonus || 0);
    const curHp = (vitals.hp != null) ? vitals.hp : (cmb.hp != null ? cmb.hp : max);
    const prev = vitals;
    const nv = JSON.parse(JSON.stringify(vitals));
    nv.hp = Math.min(max, curHp + r.gain);
    nv.hitDiceSpent = Object.assign({}, nv.hitDiceSpent || {});
    nv.hitDiceSpent[die] = (nv.hitDiceSpent[die] || 0) + 1;
    vitals = nv; busy(true); refresh();
    const out = pop && pop.querySelector('.sa-hd-out');
    if (out) out.textContent = die + ' rolled ' + r.roll + (conMod ? (' ' + (conMod >= 0 ? '+' : '\u2212') + Math.abs(conMod)) : '') + ' \u2192 +' + r.gain + ' HP' + (nv.hp >= max ? ' (full)' : '');
    try {
      const saved = await characterData.save(key, { vitals });
      vitals = (saved && saved.vitals) ? saved.vitals : vitals; refresh();
      if (pop && pop.parentNode) {                                   // live-refresh rows for the next spend
        const host = pop.querySelector('.sa-hd-rows');
        if (host) { host.innerHTML = hdRowsHTML(rd().deriveHitDice(structural), vitals.hitDiceSpent || {}); bindSpend(pop); }
      }
    } catch (e) { vitals = prev; refresh(); if (out) out.textContent = "couldn't save"; }
    finally { busy(false); }
  }

  async function onActivate() {
    if (saving) return;
    const prev = !!vitals.inspiration;
    const next = !prev;
    paint(next); busy(true); showStat('saving', 'saving\u2026', false);
    try {
      const merged = Object.assign({}, vitals, { inspiration: next });
      const saved = await characterData.save(key, { vitals: merged });
      vitals = (saved && saved.vitals) ? saved.vitals : merged;
      paint(!!vitals.inspiration);
      showStat('saved', next ? 'inspired \u2713' : 'cleared \u2713', true);
    } catch (e) {
      paint(prev);
      showStat('error', "couldn't save \u00B7 tap to retry", false);
    } finally { busy(false); }
  }

  // load state + merge baseline, then gate + bind
  const ready = (async () => {
    let editable = false;
    try { editable = await characterData.canEdit(key); } catch (_) { editable = false; }
    try {
      const cd = await characterData.loadCharacter(key);
      vitals = (cd && cd.vitals) ? cd.vitals : {};
      structural = (cd && cd.structural) ? cd.structural : {};
    } catch (_) { vitals = {}; structural = {}; }
    paint(!!vitals.inspiration);

    if (editable) {
      toggle.addEventListener('click', onActivate);
      root.querySelectorAll('[data-rest]').forEach((b) => {
        b.addEventListener('click', (e) => { e.stopPropagation(); confirmRest(b.getAttribute('data-rest') === 'short' ? 'short' : 'long'); });
      });
      if (hdMed) {
        hdMed.classList.add('tappable');
        hdMed.setAttribute('role', 'button');
        hdMed.setAttribute('tabindex', '0');
        hdMed.setAttribute('aria-label', 'Hit Dice \u2014 tap to spend');
        hdMed.addEventListener('click', (e) => { e.stopPropagation(); openHdSpend(); });
        hdMed.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHdSpend(); } });
      }
    } else {
      toggle.classList.add('view-only');
      toggle.setAttribute('aria-disabled', 'true');
      root.querySelectorAll('[data-rest]').forEach((b) => {
        b.addEventListener('click', () => showStat('hint', 'view only', true));
      });
    }
  })();

  return { ready };
}

// Page bootstrap removed: sheet-mount.js's mountSheet owns the wiring lifecycle
// and calls wireInspiration scoped to its container. The smoke imports the pure
// planners + wireInspiration and drives them directly.
