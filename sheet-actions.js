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

  // ── Resource trackers (the curated left-rail panel): spend / reorder / remove /
  // add / edit. Shares THIS hub's structural + vitals so a tracker spend and a rest
  // never fight over the same row. Pure render lives in sheet-mount.js
  // (renderTrackers); here we mutate optimistically → refresh() (re-renders the
  // panel) → save → reconcile, all gated on canEdit, exactly like the rest above.
  var trkForm = null, trkOrigin = 'custom', trkEditId = null;
  function sheetApi() { return (typeof window !== 'undefined' ? window : globalThis).__sheet || {}; }
  function deriveIds(st) { var R = rd(); return (R && R.derive) ? R.derive(st || {}).map(function (s) { return s.id; }) : []; }
  function orderIdsNow() { return (structural.trackerOrder && structural.trackerOrder.length) ? structural.trackerOrder.slice() : deriveIds(structural); }
  function specFor(id) { var api = sheetApi(); var list = api.trackerSpecs ? api.trackerSpecs(structural) : []; for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function curOf(spec) { return Math.max(0, (spec.max || 0) - (((vitals.pipState || {})[spec.id]) || 0)); }
  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18); }
  function newCustomId(label) { return 'cr_' + (slugify(label) || 'res') + '_' + Math.random().toString(36).slice(2, 6); }
  function rechargeKey(t) { t = String(t || '').toLowerCase(); if (t.indexOf('short') >= 0 && t.indexOf('long') >= 0) return 'short-long'; if (t.indexOf('short') >= 0) return 'short'; return 'long'; }

  async function persistStructural(prev) {
    busy(true);
    try { var saved = await characterData.save(key, { structural: structural }); structural = (saved && saved.structural) ? saved.structural : structural; refresh(); }
    catch (e) { structural = prev; refresh(); showStat('error', "couldn't save \u00B7 tap to retry", false); }
    finally { busy(false); }
  }
  async function persistVitals(prev) {
    busy(true);
    try { var saved = await characterData.save(key, { vitals: vitals }); vitals = (saved && saved.vitals) ? saved.vitals : vitals; refresh(); }
    catch (e) { vitals = prev; refresh(); showStat('error', "couldn't save \u00B7 tap to retry", false); }
    finally { busy(false); }
  }

  function applySpend(id, newCur) {
    if (saving) return;
    var spec = specFor(id); if (!spec) return;
    var max = spec.max || 0; newCur = Math.max(0, Math.min(max, newCur));
    var prev = vitals;
    var nv = JSON.parse(JSON.stringify(vitals)); nv.pipState = Object.assign({}, nv.pipState || {});
    var spent = max - newCur;
    if (spent > 0) nv.pipState[id] = spent; else delete nv.pipState[id];
    vitals = nv; refresh(); persistVitals(prev);
  }
  function onPip(pip) {
    var row = pip.closest('.trk[data-tid]'); if (!row) return;
    var id = row.getAttribute('data-tid'); var spec = specFor(id); if (!spec) return;
    var i = parseInt(pip.getAttribute('data-tpip'), 10) || 0; var cur = curOf(spec);
    applySpend(id, (i + 1 === cur) ? i : (i + 1));   // tap the boundary pip to spend one; else fill up to it
  }
  function onStep(step) {
    var row = step.closest('.trk[data-tid]'); if (!row) return;
    var id = row.getAttribute('data-tid'); var spec = specFor(id); if (!spec) return;
    applySpend(id, curOf(spec) + (parseInt(step.getAttribute('data-tstep'), 10) || 0));
  }

  function clearConfirm(host) { if (host) host.querySelectorAll('.trk.confirming').forEach(function (r) { r.classList.remove('confirming'); }); }
  function openConfirm(row) { if (!row) return; clearConfirm(row.parentNode); row.classList.add('confirming'); }
  function doRemove(id, isCustom) {
    if (saving) return;
    var prev = structural; var ns = JSON.parse(JSON.stringify(structural));
    ns.trackerOrder = orderIdsNow().filter(function (x) { return x !== id; });
    if (isCustom) ns.customResources = (ns.customResources || []).filter(function (c) { return c.id !== id; });
    structural = ns; refresh(); persistStructural(prev);
  }

  function moveByKey(grip, dir) {
    if (saving) return;
    var row = grip.closest('.trk[data-tid]'); if (!row) return;
    var id = row.getAttribute('data-tid');
    var ids = Array.prototype.slice.call(row.parentNode.querySelectorAll('.trk[data-tid]')).map(function (r) { return r.getAttribute('data-tid'); });
    var pos = ids.indexOf(id); if (pos < 0) return; var np = pos + dir; if (np < 0 || np >= ids.length) return;
    ids.splice(pos, 1); ids.splice(np, 0, id);
    var prev = structural; var ns = JSON.parse(JSON.stringify(structural)); ns.trackerOrder = ids; structural = ns; refresh();
    persistStructural(prev).then(function () {
      var rows = root.querySelectorAll('.trk[data-tid]');
      for (var i = 0; i < rows.length; i++) if (rows[i].getAttribute('data-tid') === id) { var g = rows[i].querySelector('[data-tgrip]'); if (g) g.focus(); break; }
    });
  }

  // pointer drag: lift the row with a transform, show a drop-line, commit ONCE on release
  function startDrag(e) {
    if (saving) return;
    var grip = e.target.closest('[data-tgrip]'); if (!grip) return;
    var row = grip.closest('.trk[data-tid]'); if (!row) return;
    var host = row.parentNode; if (!host) return;
    var d = root.ownerDocument || (typeof document !== 'undefined' ? document : null); if (!d) return;
    e.preventDefault();
    var rows = Array.prototype.slice.call(host.querySelectorAll('.trk[data-tid]'));
    var startY = e.clientY;
    var L = rows.map(function (r) { var b = r.getBoundingClientRect(); return { top: b.top, mid: b.top + b.height / 2, bot: b.top + b.height }; });
    var before = rows.map(function (r) { return r.getAttribute('data-tid'); });
    var id = row.getAttribute('data-tid');
    var targetIndex = before.indexOf(id);
    host.classList.add('is-dragging'); row.classList.add('dragging');
    var line = d.createElement('div'); line.className = 'drop-line'; host.appendChild(line);
    function placeLine(idx) { var hostTop = host.getBoundingClientRect().top; var y = (idx >= L.length) ? L[L.length - 1].bot - hostTop : L[idx].top - hostTop; line.style.top = y + 'px'; }
    function onMove(ev) {
      row.style.transform = 'translateY(' + (ev.clientY - startY) + 'px)';
      var idx = L.length; for (var i = 0; i < L.length; i++) if (ev.clientY < L[i].mid) { idx = i; break; }
      targetIndex = idx; placeLine(idx);
    }
    function onUp() {
      d.removeEventListener('pointermove', onMove, true); d.removeEventListener('pointerup', onUp, true);
      host.classList.remove('is-dragging'); row.classList.remove('dragging'); row.style.transform = '';
      if (line.parentNode) line.parentNode.removeChild(line);
      var ids = before.slice(); var from = ids.indexOf(id); if (from < 0) return;
      var insertAt = targetIndex; ids.splice(from, 1); if (insertAt > from) insertAt--; insertAt = Math.max(0, Math.min(ids.length, insertAt)); ids.splice(insertAt, 0, id);
      if (ids.join(',') === before.join(',')) return;                 // dropped in place → no write
      var prev = structural; var ns = JSON.parse(JSON.stringify(structural)); ns.trackerOrder = ids; structural = ns; refresh(); persistStructural(prev);
    }
    placeLine(targetIndex);
    d.addEventListener('pointermove', onMove, true); d.addEventListener('pointerup', onUp, true);
  }

  // add / edit flyout
  function trkMaxToken() {
    var t = trkForm.mtype ? trkForm.mtype.value : 'fixed';
    if (t === 'fixed') return { type: 'fixed', value: Math.max(1, parseInt(trkForm.mfixed && trkForm.mfixed.value, 10) || 1) };
    if (t === 'pb') return { type: 'pb' };
    if (t === 'level') return { type: 'level' };
    if (t === 'mod') return { type: 'mod', ability: (trkForm.mability && trkForm.mability.value) || 'cha' };
    return { type: 'fixed', value: 1 };
  }
  function setTrkOrigin(o) { trkOrigin = o; if (trkForm && trkForm.origins) trkForm.origins.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-o') === o); }); }
  function syncMaxFields() { var t = trkForm.mtype ? trkForm.mtype.value : 'fixed'; if (trkForm.mfixed) trkForm.mfixed.hidden = (t !== 'fixed'); if (trkForm.mability) trkForm.mability.hidden = (t !== 'mod'); }
  function storedMaxOf(id) { var arr = structural.customResources || []; for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i].max; return null; }
  function openForm(mode, spec) {
    if (!trkForm || !trkForm.box) return;
    trkEditId = (mode === 'edit' && spec) ? spec.id : null;
    if (trkForm.name) trkForm.name.value = spec ? (spec.label || '') : '';
    setTrkOrigin(spec ? (spec.origin || 'custom') : 'custom');
    var raw = (mode === 'edit' && spec) ? storedMaxOf(spec.id) : null;
    var tok = (typeof raw === 'number') ? { type: 'fixed', value: raw } : (raw || { type: 'fixed', value: spec ? (spec.max || 1) : 1 });
    if (trkForm.mtype) trkForm.mtype.value = tok.type || 'fixed';
    if (trkForm.mfixed) trkForm.mfixed.value = (tok.type === 'fixed') ? (tok.value || 1) : 1;
    if (trkForm.mability) trkForm.mability.value = (tok.type === 'mod') ? (tok.ability || 'cha') : 'cha';
    syncMaxFields();
    if (trkForm.recharge) trkForm.recharge.value = spec ? rechargeKey(spec.recharge) : 'long';
    if (trkForm.head) trkForm.head.classList.toggle('on', mode === 'edit');
    if (trkForm.save) trkForm.save.textContent = (mode === 'edit') ? 'Save changes' : 'Add tracker';
    if (trkForm.addRow) trkForm.addRow.setAttribute('aria-expanded', 'true');
    trkForm.box.hidden = false;
    if (trkForm.name) trkForm.name.focus();
  }
  function closeForm() { if (trkForm && trkForm.box) trkForm.box.hidden = true; trkEditId = null; if (trkForm && trkForm.addRow) trkForm.addRow.setAttribute('aria-expanded', 'false'); }
  function toggleForm() { if (trkForm && trkForm.box && trkForm.box.hidden) openForm('add', null); else closeForm(); }
  function saveForm() {
    if (saving || !trkForm) return;
    var label = ((trkForm.name && trkForm.name.value) || '').trim(); if (!label) { if (trkForm.name) trkForm.name.focus(); return; }
    var tok = trkMaxToken(); var rech = (trkForm.recharge && trkForm.recharge.value) || 'long';
    var prev = structural; var ns = JSON.parse(JSON.stringify(structural)); ns.customResources = (ns.customResources || []).slice();
    if (trkEditId) {
      for (var i = 0; i < ns.customResources.length; i++) if (ns.customResources[i].id === trkEditId) { ns.customResources[i] = Object.assign({}, ns.customResources[i], { label: label, origin: trkOrigin, max: tok, recharge: rech }); break; }
    } else {
      var id = newCustomId(label);
      ns.customResources.push({ id: id, label: label, origin: trkOrigin, max: tok, recharge: rech });
      var ord = orderIdsNow(); ord.push(id); ns.trackerOrder = ord;
    }
    structural = ns; refresh(); closeForm(); persistStructural(prev);
  }

  function onTrkClick(e) {
    var t = e.target;
    var pip = t.closest('[data-tpip]'); if (pip) { onPip(pip); return; }
    var step = t.closest('[data-tstep]'); if (step) { onStep(step); return; }
    var del = t.closest('[data-tdel]'); if (del) { openConfirm(del.closest('.trk[data-tid]')); return; }
    var no = t.closest('[data-tcancel]'); if (no) { var r1 = no.closest('.trk[data-tid]'); if (r1) r1.classList.remove('confirming'); return; }
    var yes = t.closest('[data-tconfirm]'); if (yes) { doRemove(yes.getAttribute('data-tconfirm'), yes.getAttribute('data-tcustom') === '1'); return; }
    var ed = t.closest('[data-tedit]'); if (ed) { var sp = specFor(ed.getAttribute('data-tedit')); if (sp) openForm('edit', sp); return; }
  }
  function onTrkKey(e) {
    var pip = e.target.closest('[data-tpip]'); if (pip && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPip(pip); return; }
    var grip = e.target.closest('[data-tgrip]'); if (grip && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveByKey(grip, e.key === 'ArrowUp' ? -1 : 1); return; }
  }
  function onTrkEsc(e) {
    if (e.key !== 'Escape') return;
    var host = root.querySelector('[data-list="trackers"]');
    if (host) { var c = host.querySelector('.trk.confirming'); if (c) { c.classList.remove('confirming'); return; } }
    if (trkForm && trkForm.box && !trkForm.box.hidden) closeForm();
  }
  function bindTrackers(editable) {
    var host = root.querySelector('[data-list="trackers"]');
    trkForm = {
      box: root.querySelector('[data-trk-form]'), addRow: root.querySelector('[data-trk-add]'),
      name: root.querySelector('[data-trk-name]'), origins: root.querySelector('[data-trk-origins]'),
      mtype: root.querySelector('[data-trk-mtype]'), mfixed: root.querySelector('[data-trk-mfixed]'),
      mability: root.querySelector('[data-trk-mability]'), recharge: root.querySelector('[data-trk-recharge]'),
      save: root.querySelector('[data-trk-save]'), head: root.querySelector('[data-trk-edithead]'),
      title: root.querySelector('[data-trk-edittitle]'), cancel: root.querySelector('[data-trk-cancel]')
    };
    if (!editable) { if (trkForm.addRow) trkForm.addRow.classList.add('view-only'); return; }
    if (host) {
      host.addEventListener('click', onTrkClick);
      host.addEventListener('keydown', onTrkKey);
      host.addEventListener('pointerdown', function (e) { if (e.target.closest('[data-tgrip]')) startDrag(e); });
    }
    if (trkForm.addRow) {
      trkForm.addRow.addEventListener('click', toggleForm);
      trkForm.addRow.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleForm(); } });
    }
    if (trkForm.origins) trkForm.origins.addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (c) setTrkOrigin(c.getAttribute('data-o')); });
    if (trkForm.mtype) trkForm.mtype.addEventListener('change', syncMaxFields);
    if (trkForm.save) trkForm.save.addEventListener('click', saveForm);
    if (trkForm.cancel) trkForm.cancel.addEventListener('click', closeForm);
    root.addEventListener('keydown', onTrkEsc);
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
      bindTrackers(true);
    } else {
      toggle.classList.add('view-only');
      toggle.setAttribute('aria-disabled', 'true');
      root.querySelectorAll('[data-rest]').forEach((b) => {
        b.addEventListener('click', () => showStat('hint', 'view only', true));
      });
      bindTrackers(false);
    }
  })();

  return { ready };
}

// Page bootstrap removed: sheet-mount.js's mountSheet owns the wiring lifecycle
// and calls wireInspiration scoped to its container. The smoke imports the pure
// planners + wireInspiration and drives them directly.
