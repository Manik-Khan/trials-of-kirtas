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

import { assembleActions, meleeWeaponOptions } from './weapon-actions.js';

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

// ── inventory drag mutations (pure, dup-safe; unit-tested). Each takes the
// inventory array and returns a NEW array; the controller reassigns and persists.
// rebuildFromTop replays a desired top-level order, dropping each container's
// children in right after it, and a `used` set guards every push so an item can
// never appear twice even if a top order and the containerId fields momentarily
// disagree. Mirrors the approved mock's rebuildItems / fileInto / moveToTop. ──
export function topItemsOf(inv) { var o = []; for (var i = 0; i < inv.length; i++) { if (inv[i] && !inv[i].containerId) o.push(inv[i]); } return o; }
export function childrenRef(inv, bag) { var o = []; if (!bag || bag.id == null) return o; for (var i = 0; i < inv.length; i++) { var x = inv[i]; if (x && x.containerId != null && x.containerId === bag.id) o.push(x); } return o; }
export function rebuildFromTop(inv, topItems) {
  var used = new Set(), out = [];
  topItems.forEach(function (t) {
    if (!t || used.has(t)) return;
    out.push(t); used.add(t);
    if (t.isContainer && t.id != null) childrenRef(inv, t).forEach(function (c) { if (!used.has(c)) { out.push(c); used.add(c); } });
  });
  inv.forEach(function (x) { if (x && !used.has(x)) { out.push(x); used.add(x); } });
  return out;
}
// File an item INTO a bag: it leaves the top order and lands after its bag.
export function fileItemInto(inv, dragItem, bag) {
  if (!dragItem || !bag || !bag.isContainer || bag.id == null || dragItem.isContainer || dragItem === bag) return { inv: inv, ok: false };
  dragItem.containerId = bag.id; dragItem.slot = undefined;
  return { inv: rebuildFromTop(inv, topItemsOf(inv)), ok: true };
}
// Place an item at top level before `beforeItem` (null = end). Clearing
// containerId first means this ALSO pulls an item out of a bag and reorders a top
// item via one path — the cleared containerId is why a pulled item can't dup.
export function moveItemToTop(inv, dragItem, beforeItem) {
  if (!dragItem) return { inv: inv, ok: false };
  dragItem.containerId = undefined;
  var top = topItemsOf(inv).filter(function (x) { return x !== dragItem; });
  var at = beforeItem ? top.indexOf(beforeItem) : top.length; if (at < 0) at = top.length;
  top.splice(at, 0, dragItem);
  return { inv: rebuildFromTop(inv, top), ok: true };
}

export function wireInspiration({ root, characterData, key, depsReady } = {}) {
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
  let inventory = [];     // for weapon-derived attack actions (mirrors renderActions)
  let currency = {};      // coins (pp/gp/ep/sp/cp) — a separate full-column save
  let coinPrev = null;    // pre-edit currency snapshot, for the optimistic revert
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
      if (S && S.renderSheet && S.toRenderShape) S.renderSheet(root, S.toRenderShape({ structural, vitals, inventory, currency }));
    } catch (_) {}
    paint(!!vitals.inspiration);   // renderSheet doesn't own the cluster button / portrait class
    decorateActionEditor();        // re-assert edit-mode chrome + reopen panel (renderSheet rewrote the section)
    paintSplitIfOpen();            // GM re-rendered the split shell names-less; repaint with live party names
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
  async function persistInventory(prev) {
    busy(true);
    try { var saved = await characterData.save(key, { inventory: inventory }); inventory = (saved && saved.inventory) ? saved.inventory : inventory; refresh(); }
    catch (e) { inventory = prev; refresh(); showStat('error', "couldn't save \u00B7 tap to retry", false); }
    finally { busy(false); }
  }
  async function persistCurrency(prev) {
    busy(true);
    // no refresh() on success: it would rebuild the coin inputs and steal focus
    // mid-edit. Coins don't touch the doll/AC/carry, so the adopted value just
    // shows on the next natural render. Errors still revert + repaint.
    try { var saved = await characterData.save(key, { currency: currency }); currency = (saved && saved.currency) ? saved.currency : currency; }
    catch (e) { currency = prev; refresh(); showStat('error', "couldn't save \u00B7 tap to retry", false); }
    finally { busy(false); }
  }

  // ── equipment slots: equip / unequip / attune all write item.slot / item.attuned
  // on the inventory, then persist. EquipSlots owns the taxonomy + classifier. ──
  function equipAPI() { return (typeof window !== 'undefined' ? window : globalThis).EquipSlots || null; }
  function armorAPI() { return (typeof window !== 'undefined' ? window : globalThis).ArmorAC || null; }
  // First load: if nothing is slotted, assign best-fit slots so the doll is populated.
  // In-memory only here (matches toRenderShape's display backfill); persisted on the
  // first explicit equip change, so opening a sheet never writes on its own.
  function backfillInventory() {
    var ES = equipAPI(); if (!ES || !inventory.length) return;
    if (inventory.some(function (it) { return it && it.slot; })) return;
    if (!inventory.some(function (it) { return ES.canEquip(it); })) return;
    var AAC = armorAPI();
    inventory = ES.backfillSlots(inventory, AAC ? { score: function (it) { var i2 = AAC.classifyArmor(it); return i2 ? (i2.base + (i2.magic || 0)) : 0; } } : undefined);
  }
  function doEquip(idx) {
    var ES = equipAPI(); if (!ES) return;
    var it = inventory[idx]; if (!it) return;
    var slots = ES.slotsFor(ES.classifyItem(it)); if (!slots.length) return;
    var target = null;
    for (var i = 0; i < slots.length; i++) { if (!inventory.filter(function (x) { return x.slot === slots[i]; })[0]) { target = slots[i]; break; } }
    if (!target) { target = slots[0]; var occ = inventory.filter(function (x) { return x.slot === target; })[0]; if (occ) occ.slot = null; }
    it.slot = target;
  }
  function doUnequip(slotKey) { var w = inventory.filter(function (x) { return x.slot === slotKey; })[0]; if (w) w.slot = null; }
  function doAttune(idx) {
    var it = inventory[idx]; if (!it || !it.reqAttune) return;
    if (it.attuned) { it.attuned = false; return; }
    if (inventory.filter(function (x) { return x.attuned; }).length < 3) it.attuned = true;
  }
  function onEquipClick(e) {
    var eq = e.target.closest('[data-eq]'), un = e.target.closest('[data-un]'), at = e.target.closest('[data-at]');
    if (!eq && !un && !at) return;
    e.stopPropagation();
    var prev = JSON.parse(JSON.stringify(inventory));
    if (eq) { if (eq.classList.contains('capped')) return; doEquip(parseInt(eq.getAttribute('data-eq'), 10)); }
    else if (un) { doUnequip(un.getAttribute('data-un')); }
    else if (at) { if (at.classList.contains('capped')) return; doAttune(parseInt(at.getAttribute('data-at'), 10)); }
    refresh(); persistInventory(prev);
  }
  function bindEquip() {
    var sec = root.querySelector('[data-sec="inventory"]'); if (sec) sec.classList.add('can-edit');
    root.addEventListener('click', onEquipClick);
  }

  // ── gear writes. Lock + coins are the 2a quick-edits. The item edit form (2b)
  // renders from a DRAFT held on the GearManager box state (box.__gmState), so the
  // live inventory is untouched until Save: field writes land on the draft (no
  // re-render, focus holds), Save copies the draft back and persists, Cancel drops
  // it. GearManager owns the render; this owns every mutation. ──
  function gmBox() { return root.querySelector('[data-equip]'); }
  function gmState() { var b = gmBox(); return (b && b.__gmState) ? b.__gmState : null; }
  function keyToItem(key) {
    if (key == null) return null;
    if (key.indexOf('id:') === 0) { var id = key.slice(3); return inventory.filter(function (it) { return it && String(it.id) === id; })[0] || null; }
    if (key.indexOf('ix:') === 0) { var ix = parseInt(key.slice(3), 10); return inventory[ix] || null; }
    return null;
  }
  function updateDraftField(f) {
    var st = gmState(); if (!st || !st.editing || !st.draft) return;
    var k = f.getAttribute('data-ef'), v;
    if (f.type === 'number') { v = parseFloat(f.value); if (isNaN(v)) v = 0; if (k === 'qty') v = Math.max(1, Math.round(v)); else if (k !== 'atkBonus' && k !== 'dmgBonus' && v < 0) v = 0; }
    else v = f.value;
    st.draft[k] = v;
  }
  function openEdit(key) {
    var st = gmState(); if (!st) return;
    var it = keyToItem(key); if (!it) return;
    st.editing = key;
    st.draft = JSON.parse(JSON.stringify(it));
    st.picker = false;
    st.pickerCat = null;                                   // GearManager defaults to the item's category
    if (!st.open) st.open = Object.create(null);
    if (it.containerId) st.open['id:' + it.containerId] = true;   // open the parent bag so the form is visible
    st.open[key] = true;
    refresh();
    try { var nm = root.querySelector('[data-ef="name"]'); if (nm && nm.focus) { nm.focus(); if (nm.setSelectionRange) nm.setSelectionRange(nm.value.length, nm.value.length); } } catch (e) {}
  }
  function clearEdit(st) { st.editing = null; st.picker = false; st.pickerCat = null; st.draft = null; }
  function cancelEdit() { var st = gmState(); if (!st) return; clearEdit(st); refresh(); }
  function saveEdit() {
    var st = gmState(); if (!st || !st.editing) return;
    var it = keyToItem(st.editing), d = st.draft;
    if (it && d) {
      var prev = JSON.parse(JSON.stringify(inventory));
      it.name = d.name; it.qty = d.qty; it.weight = d.weight; it.rarity = d.rarity;
      it.reqAttune = !!d.reqAttune; it.flavor = d.flavor;
      // weapon-combat fields (only meaningful on weapons; harmless otherwise) — magic bonuses,
      // an extra-damage rider, and a pinned attack ability. buildWeaponActions reads these
      // straight off the item, so a +1 / Dex pin flows into the attack with no reforge.
      if (+d.atkBonus) it.atkBonus = +d.atkBonus; else delete it.atkBonus;
      if (+d.dmgBonus) it.dmgBonus = +d.dmgBonus; else delete it.dmgBonus;
      var exd = (d.exDice != null ? d.exDice : (d.extraDmg && d.extraDmg.dice)) || '';
      var ext = (d.exType != null ? d.exType : (d.extraDmg && d.extraDmg.type)) || '';
      if (String(exd).trim()) it.extraDmg = { dice: String(exd).trim(), type: String(ext).trim() }; else delete it.extraDmg;
      var pin = String(d.attackAbil || '').toLowerCase();
      if (pin && pin !== 'auto') it.attackAbil = pin; else delete it.attackAbil;
      if (d.icon != null) it.icon = d.icon;
      clearEdit(st);
      refresh(); persistInventory(prev);
    } else { clearEdit(st); refresh(); }
  }

  function onGearClick(e) {
    // ── add-item surface ──
    var atog = e.target.closest('[data-addtoggle]');
    if (atog && root.contains(atog)) {
      e.stopPropagation();
      var sA = gmState(); if (!sA) return;
      sA.adding = !sA.adding;
      if (sA.adding) sA.search = { q: '', loading: false, results: null, error: null, open: null };
      else clearTimeout(searchTimer);
      refresh();
      if (sA.adding) { var inp = gmBox() && gmBox().querySelector('[data-addsearch]'); if (inp && inp.focus) inp.focus(); }
      return;
    }
    var aitem = e.target.closest('[data-additem]');   // checked BEFORE the row, so the quick + doesn't also toggle the row
    if (aitem && root.contains(aitem)) {
      e.stopPropagation();
      var sB = gmState(); if (!sB || !sB.search || !sB.search.results) return;
      addItemFromSearch(sB.search.results[parseInt(aitem.getAttribute('data-additem'), 10)]);
      return;
    }
    var ares = e.target.closest('[data-addresult]');
    if (ares && root.contains(ares)) {
      e.stopPropagation();
      var sC = gmState(); if (!sC || !sC.search) return;
      var ri = parseInt(ares.getAttribute('data-addresult'), 10);
      sC.search.open = (sC.search.open === ri) ? null : ri;
      paintSearchResults();
      return;
    }
    // ── currency: loot splitter ──
    var stog = e.target.closest('[data-splittoggle]');
    if (stog && root.contains(stog)) {
      e.stopPropagation();
      var ss = splitState(); if (!ss) return;
      ss.open = !ss.open;
      var panel = gmBox() && gmBox().querySelector('[data-splitpanel]');
      if (panel) panel.classList.toggle('open', ss.open);
      stog.classList.toggle('on', ss.open);
      if (ss.open) { paintSplit(); ensurePartyNames(); }
      return;
    }
    var umine = e.target.closest('[data-usemine]');
    if (umine && root.contains(umine)) {
      e.stopPropagation();
      var ss2 = splitState(); if (!ss2) return;
      var b2 = gmBox();
      ['pp', 'gp', 'ep', 'sp', 'cp'].forEach(function (c) { ss2.loot[c] = (parseInt(currency[c], 10) || 0); if (b2) { var li = b2.querySelector('input[data-loot="' + c + '"]'); if (li) li.value = ss2.loot[c]; } });
      paintSplit();
      return;
    }
    var wbtn = e.target.closest('[data-waysdn],[data-waysup]');
    if (wbtn && root.contains(wbtn)) {
      e.stopPropagation();
      var ss3 = splitState(); if (!ss3) return;
      var up = wbtn.hasAttribute('data-waysup');
      ss3.ways = Math.max(1, Math.min(12, (ss3.ways || 4) + (up ? 1 : -1)));
      var nEl = gmBox() && gmBox().querySelector('[data-waysn]'); if (nEl) nEl.textContent = ss3.ways;
      paintSplit();
      return;
    }
    var tmine = e.target.closest('[data-takemine]');
    if (tmine && root.contains(tmine)) { e.stopPropagation(); takeMyShare(); return; }
    var lk = e.target.closest('[data-lock]');
    if (lk && root.contains(lk)) {
      e.stopPropagation();
      var idx = parseInt(lk.getAttribute('data-lock'), 10);
      var it = inventory[idx]; if (!it) return;
      var prev = JSON.parse(JSON.stringify(inventory));
      it.locked = !it.locked;
      refresh(); persistInventory(prev); return;
    }
    var op = e.target.closest('[data-editopen]'); if (op && root.contains(op)) { e.stopPropagation(); openEdit(op.getAttribute('data-editopen')); return; }
    var pt = e.target.closest('[data-pktoggle]'); if (pt && root.contains(pt)) { e.stopPropagation(); var s1 = gmState(); if (s1) { s1.picker = !s1.picker; refresh(); } return; }
    var pc = e.target.closest('[data-pkcat]'); if (pc && root.contains(pc)) { e.stopPropagation(); var s2 = gmState(); if (s2) { s2.pickerCat = pc.getAttribute('data-pkcat'); refresh(); } return; }
    var pp = e.target.closest('[data-pkpick]'); if (pp && root.contains(pp)) { e.stopPropagation(); var s3 = gmState(); if (s3 && s3.draft) { s3.draft.icon = pp.getAttribute('data-pkpick'); refresh(); } return; }
    var tg = e.target.closest('[data-eftoggle]'); if (tg && root.contains(tg)) { e.stopPropagation(); var s4 = gmState(); if (s4 && s4.draft) { var fk = tg.getAttribute('data-eftoggle'); s4.draft[fk] = !s4.draft[fk]; refresh(); } return; }
    var cancel = e.target.closest('[data-ecancel]'); if (cancel && root.contains(cancel)) { e.stopPropagation(); cancelEdit(); return; }
    var save = e.target.closest('[data-esave]'); if (save && root.contains(save)) { e.stopPropagation(); saveEdit(); return; }
  }
  function onGearInput(e) {
    var coin = e.target.closest('[data-coin]');
    if (coin && root.contains(coin)) {
      if (coinPrev === null) coinPrev = JSON.parse(JSON.stringify(currency));
      var v = parseInt(coin.value, 10); if (isNaN(v) || v < 0) v = 0;
      var next = {}; for (var k in currency) next[k] = currency[k];   // copy-merge (save does a full-column update)
      next[coin.getAttribute('data-coin')] = v;
      currency = next; paintWorth(); return;   // keep the Total worth live on typed edits too
    }
    var asq = e.target.closest('[data-addsearch]');
    if (asq && root.contains(asq)) { var sS = gmState(); if (sS && sS.search) { sS.search.q = asq.value; runItemSearch(); } return; }   // debounced; no re-render so focus holds
    var lootEl = e.target.closest('[data-loot]');
    if (lootEl && root.contains(lootEl)) { var ssL = splitState(); if (ssL) { var lv = parseInt(lootEl.value, 10); ssL.loot[lootEl.getAttribute('data-loot')] = (isNaN(lv) || lv < 0) ? 0 : lv; paintSplit(); } return; }   // repaints only the breakdown; loot input holds focus
    var f = e.target.closest('[data-ef]');
    if (f && root.contains(f)) { updateDraftField(f); return; }       // live draft write; no re-render so focus holds
  }
  function onGearChange(e) {
    var conv = e.target.closest('[data-convert]');
    if (conv && root.contains(conv)) { var ssC = splitState(); if (ssC) { ssC.convert = !!conv.checked; paintSplit(); } return; }   // money-changer toggle
    var coin = e.target.closest('[data-coin]');
    if (coin && root.contains(coin)) { if (coinPrev !== null) { var p = coinPrev; coinPrev = null; persistCurrency(p); } return; }
    var f = e.target.closest('[data-ef]');
    if (f && root.contains(f)) { updateDraftField(f); return; }       // covers <select> (rarity) which may only fire change
  }

  function keyOfEl(el) { return el ? (el.getAttribute('data-row') || el.getAttribute('data-tile')) : null; }
  function startGearDrag(e) {
    var sec = root.querySelector('[data-sec="inventory"]'); if (!sec || !sec.classList.contains('can-edit')) return;
    var grip = e.target.closest('[data-grip]'); if (!grip || !root.contains(grip)) return;
    var dragItem = keyToItem(grip.getAttribute('data-grip')); if (!dragItem || dragItem.locked) return;
    var box = gmBox(); if (!box) return;
    var d = root.ownerDocument || (typeof document !== 'undefined' ? document : null); if (!d) return;
    e.preventDefault();
    var st = gmState();
    var grid = !!(st && st.view === 'grid');
    var handleEl = grip.closest('.gm-tile,.gm-row'); if (!handleEl) return;
    var isTile = handleEl.classList.contains('gm-tile');
    var start = { x: e.clientX, y: e.clientY };
    var moved = false, overBag = null, beforeKey = null, insertEl = null;
    handleEl.classList.add('dragging');
    handleEl.style.pointerEvents = 'none';                 // so elementFromPoint sees the bag UNDER the cursor
    var line = d.createElement('div'); line.className = 'drop-line'; line.style.display = 'none'; box.appendChild(line);

    function topHandles() {
      var sel = grid ? '.gm-grid > .gm-tile' : '.gm-item > .gm-row';
      return Array.prototype.slice.call(box.querySelectorAll(sel)).filter(function (el) { var t = keyToItem(keyOfEl(el)); return t && !t.containerId; });
    }
    function clearBag() { if (overBag) { overBag.classList.remove('bagdrop'); overBag = null; } }
    function clearInsert() { if (insertEl) { insertEl.classList.remove('insert-before'); insertEl = null; } line.style.display = 'none'; }

    function onMove(ev) {
      if (!moved && (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y)) < 4) return;   // ignore a grip click / micro-move
      moved = true;
      if (!isTile) handleEl.style.transform = 'translateY(' + (ev.clientY - start.y) + 'px)';
      var under = d.elementFromPoint(ev.clientX, ev.clientY);
      var bagEl = under && under.closest ? under.closest('[data-row],[data-tile]') : null;
      var bagItem = bagEl ? keyToItem(keyOfEl(bagEl)) : null;
      if (bagItem && bagItem.isContainer && bagItem !== dragItem && !dragItem.isContainer) {
        if (overBag !== bagEl) { clearBag(); clearInsert(); overBag = bagEl; bagEl.classList.add('bagdrop'); }
        beforeKey = null; return;
      }
      clearBag();
      var handles = topHandles(), before = null, i, b;
      if (grid) {
        for (i = 0; i < handles.length; i++) { b = handles[i].getBoundingClientRect();
          if (ev.clientY < b.top) { before = handles[i]; break; }
          if (ev.clientY <= b.bottom && ev.clientX < b.left + b.width / 2) { before = handles[i]; break; } }
      } else {
        for (i = 0; i < handles.length; i++) { b = handles[i].getBoundingClientRect(); if (ev.clientY < b.top + b.height / 2) { before = handles[i]; break; } }
      }
      beforeKey = before ? keyOfEl(before) : null;
      if (grid) {
        clearInsert(); if (before) { before.classList.add('insert-before'); insertEl = before; }
      } else {
        var boxTop = box.getBoundingClientRect().top;
        if (before) { b = before.getBoundingClientRect(); line.style.top = (b.top - boxTop) + 'px'; }
        else { var last = handles[handles.length - 1]; if (last) { b = last.getBoundingClientRect(); line.style.top = (b.bottom - boxTop) + 'px'; } }
        line.style.display = 'block';
      }
    }
    function onUp() {
      d.removeEventListener('pointermove', onMove, true);
      d.removeEventListener('pointerup', onUp, true);
      handleEl.classList.remove('dragging'); handleEl.style.transform = ''; handleEl.style.pointerEvents = '';
      var bagWas = overBag, beforeWas = beforeKey; clearBag(); clearInsert();
      if (line.parentNode) line.parentNode.removeChild(line);
      if (!moved) return;                                  // a click with no drag leaves the inventory untouched
      var prev = JSON.parse(JSON.stringify(inventory));
      if (bagWas) {
        var bag = keyToItem(keyOfEl(bagWas));
        var rf = fileItemInto(inventory, dragItem, bag);
        if (rf.ok) { inventory = rf.inv; if (st) { if (!st.open) st.open = Object.create(null); st.open['id:' + bag.id] = true; } refresh(); persistInventory(prev); }
        return;
      }
      var beforeItem = beforeWas ? keyToItem(beforeWas) : null;
      var rm = moveItemToTop(inventory, dragItem, beforeItem);
      if (rm.ok) { inventory = rm.inv; refresh(); persistInventory(prev); }
    }
    d.addEventListener('pointermove', onMove, true);
    d.addEventListener('pointerup', onUp, true);
  }
  function onGearPointerDown(e) {
    if (e.target.closest && e.target.closest('[data-grip]')) { startGearDrag(e); return; }
    var cs = e.target.closest && e.target.closest('[data-cstep]');
    if (cs && root.contains(cs)) { e.preventDefault(); startCoinHold(cs, e); return; }
  }

  // ── 5etools "+ Add item" (Inc 3). The GM renders the search panel + results
  // (read from box.__gmState.search); this owns the debounced items2 fetch, the
  // add (same-name stacking + pack auto-explode), and the enrich pass that fills
  // weight/type on freshly-exploded pack children. Results repaint into
  // [data-addresults] so the [data-addsearch] input is never rebuilt mid-type
  // (focus holds); an add does a full refresh + persistInventory. ──
  var searchTimer = null;
  function gmAPI() { return (typeof window !== 'undefined' ? window : globalThis).GearManager || null; }
  function paintSearchResults() {
    var b = gmBox(), st = gmState(), API = gmAPI(); if (!b || !st || !API || !API.searchResultsHtml) return;
    var el = b.querySelector('[data-addresults]'); if (el) el.innerHTML = API.searchResultsHtml(st);
  }
  function newContainerId() { return 'bag_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function titleCase(s) { return String(s == null ? '' : s).replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function parsePackEntry(e) {
    if (typeof e === 'string') return { name: titleCase(e.split('|')[0]), qty: 1 };
    if (e && e.item) return { name: titleCase(String(e.item).split('|')[0]), qty: e.quantity || 1 };
    if (e && e.special) return { name: titleCase(e.special), qty: e.quantity || 1 };
    return null;
  }
  function looksLikeContainer(it) {
    if (!it) return false;
    var s = ((it.name || '') + ' ' + (it.typeLabel || it.type || '')).toLowerCase();
    if (/\b(backpack|haversack|knapsack|rucksack|satchel|pouch|sack|chest|coffer|barrel|crate|basket|case|quiver|bandolier|bag|pack|saddlebag|lockbox|strongbox)\b/.test(s)) {
      if (/bagpipe|bag pipe|sandbag|airbag|punching bag|bean bag/.test(s)) return false;
      return true;
    }
    return false;
  }
  function runItemSearch() {
    var st = gmState(); if (!st || !st.search) return;
    var q = (st.search.q || '').trim();
    st.search.open = null;
    clearTimeout(searchTimer);
    if (q.length < 2) { st.search.results = null; st.search.loading = false; st.search.error = null; paintSearchResults(); return; }
    st.search.loading = true; st.search.error = null; paintSearchResults();
    var f = (typeof fetch !== 'undefined') ? fetch : null;
    if (!f) { st.search.loading = false; st.search.error = 'Search unavailable'; paintSearchResults(); return; }
    searchTimer = setTimeout(function () {
      var qAt = q;
      f('/.netlify/functions/items2?q=' + encodeURIComponent(qAt)).then(function (r) { return r.json(); }).then(function (j) {
        var s = gmState(); if (!s || !s.search || (s.search.q || '').trim() !== qAt) return;   // ignore a stale response
        if (j && j.error) { s.search.loading = false; s.search.error = j.error; s.search.results = null; }
        else { s.search.results = (j && j.items) ? j.items : []; s.search.loading = false; s.search.error = null; }
        paintSearchResults();
      }).catch(function () {
        var s = gmState(); if (!s || !s.search || (s.search.q || '').trim() !== qAt) return;
        s.search.loading = false; s.search.error = 'Search failed'; s.search.results = null; paintSearchResults();
      });
    }, 300);
  }
  function addItemFromSearch(item) {
    if (!item) return;
    var prev = JSON.parse(JSON.stringify(inventory));
    var ex = -1; for (var i = 0; i < inventory.length; i++) { if (inventory[i] && inventory[i].name === item.name) { ex = i; break; } }
    if (ex >= 0) {
      inventory[ex] = Object.assign({}, inventory[ex], { qty: (inventory[ex].qty || 1) + 1 });   // same-name → stack qty
    } else {
      var isPack = Array.isArray(item.packContents) && item.packContents.length > 0;
      var isContainer = isPack || looksLikeContainer(item);
      var bagId = isContainer ? newContainerId() : null;
      inventory.push({
        name: item.name, detail: item.detail || null, qty: 1,
        weight: isPack ? 0 : (item.weight != null ? item.weight : null),   // a pack's weight lives in its contents
        dmg1: item.dmg1 || null, dmg2: item.dmg2 || null, dmgType: item.dmgType || null,
        ac: (item.ac != null ? item.ac : null), range: item.range || null, price: item.price || null,
        reqAttune: item.reqAttune || null, properties: item.properties || [], entries: item.entries || [],
        rarity: item.rarity || null, weaponCat: item.weaponCat || null, typeLabel: item.typeLabel || null,
        sourceFull: item.sourceFull || null, strength: item.strength || null, stealth: item.stealth || null,
        icon: null, isContainer: isContainer, extradimensional: false, locked: false, attuned: false,
        id: bagId, containerId: null, _enriched: true
      });
      if (isPack) {
        item.packContents.forEach(function (e) { var p = parsePackEntry(e); if (p && p.name) inventory.push({ name: p.name, qty: p.qty, weight: null, icon: null, containerId: bagId, _enriched: false }); });
        var st = gmState(); if (st && bagId) { if (!st.open) st.open = Object.create(null); st.open['id:' + bagId] = true; }   // auto-open so the explosion shows
      }
    }
    var st2 = gmState(); if (st2 && st2.search && st2.search.results) st2.search.results.forEach(function (r) { if (r && r.name === item.name) r.__added = true; });
    refresh(); persistInventory(prev);
    if (inventory.some(function (x) { return x && x._enriched === false; })) setTimeout(enrichInventory, 250);
    setTimeout(function () { var s = gmState(); if (s && s.search && s.search.results) { s.search.results.forEach(function (r) { if (r) r.__added = false; }); paintSearchResults(); } }, 1500);
  }
  // null-aware merge: 5etools data fills gaps, the child's own non-null fields win
  // (so an exploded child keeps its qty/containerId/display name but GAINS weight/
  // type — fixing the legacy merge where the child's weight:null shadowed the real one).
  function enrichMerge(match, cur) { var out = Object.assign({}, match); for (var k in cur) { if (cur[k] != null) out[k] = cur[k]; } return out; }
  function enrichInventory() {
    var todo = inventory.filter(function (it) { return it && it._enriched === false && it.name; });   // ONLY freshly-exploded children
    if (!todo.length) return;
    var f = (typeof fetch !== 'undefined') ? fetch : null; if (!f) { todo.forEach(function (it) { it._enriched = true; }); return; }
    var prev = JSON.parse(JSON.stringify(inventory));
    Promise.all(todo.map(function (item) {
      var query = item.alias || item.name;
      return f('/.netlify/functions/items2?q=' + encodeURIComponent(query) + '&limit=10').then(function (r) { return r.json(); }).then(function (j) {
        var idx = inventory.indexOf(item); if (idx < 0) return;
        var items = (j && j.items) ? j.items : [];
        if (!items.length) { inventory[idx]._enriched = true; return; }   // mark done so we never re-fetch
        var match = items.filter(function (x) { return (x.name || '').toLowerCase() === item.name.toLowerCase(); })[0]
          || items.filter(function (x) { return (x.name || '').toLowerCase() === query.toLowerCase(); })[0] || items[0];
        inventory[idx] = enrichMerge(match, Object.assign({}, inventory[idx], { _enriched: true, alias: item.alias || (inventory[idx].name !== match.name ? match.name : null) }));
      }).catch(function () { var idx = inventory.indexOf(item); if (idx >= 0) inventory[idx]._enriched = true; });
    })).then(function () { refresh(); persistInventory(prev); });
  }

  // ── Currency footer: steppers + the loot splitter (Inc: coin UX). Steppers
  // mutate `currency` optimistically and DEBOUNCE persistCurrency (a flurry of
  // taps = one save); worth + the split breakdown repaint surgically so the
  // inputs never lose focus. "Take my share" adds the computed cut to `currency`
  // and persists. Party names for the share chips load lazily on first open. ──
  var coinSaveTimer = null, stepHoldT = null, stepRepeatT = null, partyNames = [], partyLoaded = false;
  function splitState() { var st = gmState(); if (!st) return null; if (!st.split) st.split = { open: false, loot: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, ways: 4, convert: false }; return st.split; }
  function worthVal() { var API = gmAPI(); return (API && API.worthStr) ? API.worthStr(currency) : ''; }
  function paintWorth() { var b = gmBox(); if (!b) return; var w = b.querySelector('[data-worth]'); if (w) w.textContent = worthVal(); }
  function paintSplit() { var b = gmBox(), st = gmState(), API = gmAPI(); if (!b || !st || !st.split || !API || !API.splitOutHtml) return; var el = b.querySelector('[data-splitout]'); if (el) el.innerHTML = API.splitOutHtml(st.split.loot, st.split.ways, partyNames, st.split.convert); }
  function paintSplitIfOpen() { var st = gmState(); if (st && st.split && st.split.open) paintSplit(); }
  function syncCoinInput(coin) { var b = gmBox(); if (!b) return; var inp = b.querySelector('input[data-coin="' + coin + '"]'); if (inp) inp.value = (currency[coin] || 0); }
  function commitCoins() { clearTimeout(coinSaveTimer); coinSaveTimer = null; if (coinPrev !== null) { var p = coinPrev; coinPrev = null; persistCurrency(p); } }
  function scheduleCoinCommit() { clearTimeout(coinSaveTimer); coinSaveTimer = setTimeout(commitCoins, 500); }
  function coinStep(coin, delta) {
    if (coinPrev === null) coinPrev = JSON.parse(JSON.stringify(currency));   // pre-burst snapshot for revert
    var next = {}; for (var k in currency) next[k] = currency[k];             // copy-merge (save is a full-column update)
    next[coin] = Math.max(0, (parseInt(next[coin], 10) || 0) + delta);
    currency = next; syncCoinInput(coin); paintWorth(); scheduleCoinCommit();
  }
  function startCoinHold(btn, ev) {
    var coin = btn.getAttribute('data-coin'), dir = parseInt(btn.getAttribute('data-cstep'), 10), big = !!(ev && ev.shiftKey);
    coinStep(coin, dir * (big ? 10 : 1));                                     // immediate; Shift = x10
    clearTimeout(stepHoldT); clearInterval(stepRepeatT);
    stepHoldT = setTimeout(function () { stepRepeatT = setInterval(function () { coinStep(coin, dir * (big ? 10 : 1)); }, 80); }, 380);   // hold-to-repeat
    var stop = function () { clearTimeout(stepHoldT); clearInterval(stepRepeatT); stepHoldT = stepRepeatT = null; if (doc) { doc.removeEventListener('pointerup', stop, true); doc.removeEventListener('pointercancel', stop, true); } };
    if (doc) { doc.addEventListener('pointerup', stop, true); doc.addEventListener('pointercancel', stop, true); }
  }
  function takeMyShare() {
    var st = gmState(), API = gmAPI(); if (!st || !st.split || !API || !API.splitShare) return;
    var r = API.splitShare(st.split.loot, st.split.ways, st.split.convert); if (!r || !r.share) return;
    var prev = JSON.parse(JSON.stringify(currency));
    var next = {}; for (var k in currency) next[k] = currency[k];
    ['pp', 'gp', 'ep', 'sp', 'cp'].forEach(function (c) { next[c] = (parseInt(next[c], 10) || 0) + (r.share[c] || 0); });
    currency = next;
    var b = gmBox();
    ['pp', 'gp', 'ep', 'sp', 'cp'].forEach(function (c) { syncCoinInput(c); if (b && r.share[c] > 0) { var el = b.querySelector('.gm-coin.' + c); if (el) { el.classList.remove('gm-coin-flash'); void el.offsetWidth; el.classList.add('gm-coin-flash'); } } });
    paintWorth(); persistCurrency(prev);
  }
  function ensurePartyNames() {
    if (partyLoaded || !characterData || !characterData.loadParty) return; partyLoaded = true;
    Promise.resolve(characterData.loadParty()).then(function (rows) { partyNames = (rows || []).map(function (r) { return r && r.name; }).filter(Boolean); paintSplitIfOpen(); }).catch(function () {});
  }

  function bindGear() {
    root.addEventListener('click', onGearClick);
    root.addEventListener('input', onGearInput);
    root.addEventListener('change', onGearChange);
    root.addEventListener('pointerdown', onGearPointerDown);
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

  // ── custom features (passive) — structural.customFeatures: [{ id, name, desc }] ──
  // Mirrors the tracker form: clone structural → mutate → refresh → persistStructural.
  // Deliberately a SEPARATE field from the derive's structural.features (which a
  // reforge overwrites), so a hand-added feature survives re-forging. The remove
  // control is delegated on the features list; the add form is static panel markup.
  var cfForm = null;
  function newCustomFeatId(label) { return 'cf_' + (slugify(label) || 'feat') + '_' + Math.random().toString(36).slice(2, 6); }
  function cfClose() {
    if (!cfForm) return;
    if (cfForm.box) cfForm.box.hidden = true;
    if (cfForm.addRow) { cfForm.addRow.style.display = ''; cfForm.addRow.setAttribute('aria-expanded', 'false'); }
    if (cfForm.name) cfForm.name.value = '';
    if (cfForm.desc) cfForm.desc.value = '';
  }
  function cfToggle() {
    if (!cfForm || !cfForm.box) return;
    if (cfForm.box.hidden) {
      cfForm.box.hidden = false;
      if (cfForm.addRow) { cfForm.addRow.style.display = 'none'; cfForm.addRow.setAttribute('aria-expanded', 'true'); }
      if (cfForm.name) cfForm.name.focus();
    } else cfClose();
  }
  function cfSave() {
    if (saving || !cfForm) return;
    var name = ((cfForm.name && cfForm.name.value) || '').trim(); if (!name) { if (cfForm.name) cfForm.name.focus(); return; }
    var desc = ((cfForm.desc && cfForm.desc.value) || '').trim();
    var prev = structural; var ns = JSON.parse(JSON.stringify(structural));
    ns.customFeatures = (ns.customFeatures || []).slice();
    ns.customFeatures.push({ id: newCustomFeatId(name), name: name, desc: desc });
    structural = ns; refresh(); cfClose(); persistStructural(prev);
  }
  function cfRemove(id) {
    var prev = structural; var ns = JSON.parse(JSON.stringify(structural));
    ns.customFeatures = (ns.customFeatures || []).filter(function (x) { return x.id !== id; });
    structural = ns; refresh(); persistStructural(prev);
  }
  function onFeatClick(e) {
    var del = e.target.closest('[data-cf-del]'); if (del) { cfRemove(del.getAttribute('data-cf-del')); }
  }
  function bindCustomFeatures(editable) {
    cfForm = {
      box: root.querySelector('[data-cf-form]'), addRow: root.querySelector('[data-cf-add]'),
      name: root.querySelector('[data-cf-name]'), desc: root.querySelector('[data-cf-desc]'),
      save: root.querySelector('[data-cf-save]'), cancel: root.querySelector('[data-cf-cancel]')
    };
    if (!editable) { if (cfForm.addRow) cfForm.addRow.classList.add('view-only'); return; }
    var host = root.querySelector('[data-list="features"]');
    if (host) host.addEventListener('click', onFeatClick);
    if (cfForm.addRow) cfForm.addRow.addEventListener('click', cfToggle);
    if (cfForm.save) cfForm.save.addEventListener('click', cfSave);
    if (cfForm.cancel) cfForm.cancel.addEventListener('click', cfClose);
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cfForm && cfForm.box && !cfForm.box.hidden) cfClose(); });
  }

  // ── Feed: write rolls/casts straight to the shared `feed` via the authenticated
  // client (window.__tok.sb) — the same client the sheet already uses to load the
  // character, and the same insert combat.html's HUD uses. We deliberately do NOT
  // route through window.__battle.onLogRoll: battle.js's HUD always takes its
  // backend's logRoll, so that hook is only ever the sheet's path and was never
  // exercised. Session + active encounter are resolved once and cached 30s.
  var feedCtx = { session: 0, encId: null, at: 0 };
  function feedSB() { try { return (window.__tok && window.__tok.sb) || null; } catch (_) { return null; } }
  function stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); }
  function feedContext(sb) {
    if (Date.now() - feedCtx.at < 30000) return Promise.resolve(feedCtx);
    return Promise.all([
      sb.from('campaign').select('current_session').eq('id', 1).maybeSingle(),
      sb.from('encounters').select('id').eq('status', 'active').maybeSingle(),
    ]).then(function (res) {
      if (res[0] && res[0].data) feedCtx.session = res[0].data.current_session;
      feedCtx.encId = (res[1] && res[1].data) ? res[1].data.id : null;
      feedCtx.at = Date.now(); return feedCtx;
    }).catch(function () { feedCtx.at = Date.now(); return feedCtx; });
  }
  function postFeed(o) {
    var sb = feedSB();
    if (!sb) { try { console.warn('[sheet-feed] no Supabase client — roll not posted'); } catch (_) {} return; }
    var actor = (o && o.actorKey) || key || null;
    var name = (structural && structural.name) || (actor ? actor.charAt(0).toUpperCase() + actor.slice(1) : 'Dungeon Master');
    var body = stripTags((o && o.name) || 'Roll') + ': ' + stripTags((o && o.main) || '') + (o && o.dmg ? ' \u00B7 ' + stripTags(o.dmg) : '');
    feedContext(sb).then(function (c) {
      return sb.from('feed').insert({
        channel: 'combat', kind: 'roll', actor_key: actor, actor_name: name,
        body: body, hidden: false, session: c.session, encounter_id: c.encId,
      });
    }).then(function (res) {
      if (res && res.error) { try { console.warn('[sheet-feed] insert failed:', res.error.message); } catch (_) {} }
    }, function (err) { try { console.warn('[sheet-feed] post failed:', err && err.message); } catch (_) {} });
  }

  // ── Spellcasting: spend slots, cast spells (player picks level + pool), track
  // concentration. Slots ride the same vitals.pipState the orbs read (keys
  // pactSlots / spell_<L> / sorc_<L> / sorcery), max from classFeatures — so the
  // sheet + orbs stay in lockstep and rests already refill them. Casting posts to
  // the shared feed (postFeed above). Manual slot nudges stay quiet (often
  // corrections) — only casts and concentration changes hit the feed.
  // The cast/spend slot pools. Use the sheet's canonical slotPoolsLive (the SAME pools the
  // display paints — keyed, live, and resilient to characters forged before pools carried
  // a key) so tapping a spell finds exactly the slots the pips show. Fall back to the
  // legacy buildSpellcasting shape only if the helper isn't present.
  function castPools() {
    var api = sheetApi();
    if (api.slotPoolsLive) return api.slotPoolsLive(structural, vitals) || [];
    var sc = api.buildSpellcasting ? api.buildSpellcasting(structural, vitals) : { pools: [] };
    return sc.pools || [];
  }
  function poolByKey(k) { var ps = castPools(); for (var i = 0; i < ps.length; i++) if (ps[i].key === k) return ps[i]; return null; }
  function castSlots(base) { return castPools().filter(function (p) { return !p.points && p.level >= base && p.level >= 1 && (p.current || 0) > 0; }).sort(function (a, b) { return a.level - b.level; }); }
  function spellEl(name) { var els = root.querySelectorAll('.spell[data-spell]'); for (var i = 0; i < els.length; i++) if (els[i].getAttribute('data-spell') === name) return els[i]; return null; }
  function ordn(n) { return ({ 1:'1st',2:'2nd',3:'3rd',4:'4th',5:'5th',6:'6th',7:'7th',8:'8th',9:'9th' })[n] || (n + 'th'); }
  function poolDot(tone) { return tone === 'subclass' ? '#55c4c0' : '#e7c279'; }
  function feedPost(name, main) { postFeed({ actorKey: key, name: name, main: main }); }

  function spendSlot(slotKey, i) {
    if (saving) return;
    var p = poolByKey(slotKey); if (!p) return;
    var max = p.max || 0, c = p.current || 0, target = (i + 1 === c) ? i : (i + 1), newCur = Math.max(0, Math.min(max, target)), spent = max - newCur;
    var prev = vitals, nv = JSON.parse(JSON.stringify(vitals)); nv.pipState = Object.assign({}, nv.pipState || {});
    if (spent > 0) nv.pipState[slotKey] = spent; else delete nv.pipState[slotKey];
    vitals = nv; refresh(); persistVitals(prev);   // quiet — no feed line for a manual nudge
  }

  function doCast(spellName, base, isConc, poolKey) {
    if (saving) return;
    var p = null;
    if (base >= 1) {
      p = poolKey ? poolByKey(poolKey) : null;
      if (!p) { var opts = castSlots(base); if (!opts.length) { showStat('hint', 'no ' + ordn(base) + '-level slots', true); return; } if (opts.length === 1) p = opts[0]; else { openCastPicker(spellName, base, isConc); return; } }
      if (!p || (p.current || 0) <= 0) return;
    }
    // replace-guard only once we know we're actually committing the cast
    if (isConc && vitals.concentration && vitals.concentration.name !== spellName) {
      var okc = (typeof window !== 'undefined' && window.confirm) ? window.confirm('Concentrating on ' + vitals.concentration.name + '. Cast ' + spellName + ' and drop it?') : true;
      if (!okc) return;
    }
    var nv = JSON.parse(JSON.stringify(vitals)), prev = vitals, main;
    if (base >= 1) {
      nv.pipState = Object.assign({}, nv.pipState || {}); nv.pipState[p.key] = (nv.pipState[p.key] || 0) + 1;
      main = 'cast \u00B7 ' + ordn(p.level) + '-level (' + p.label + ')' + (p.level > base ? ' \u25B2 upcast from ' + ordn(base) : '');
    } else {
      // Damage/attack cantrip that's also a rollable action (Booming Blade,
      // Eldritch Blast) → roll it, exactly like tapping it in Actions. A utility
      // match (Minor Illusion) is inert in Actions too, so it falls through to the
      // cast announcement rather than rolling.
      var bridged = actionByLabel(spellName);
      if (bridged && bridged.type !== 'utility') { doRoll(bridged); return; }
      main = 'cast \u00B7 cantrip';
    }
    if (isConc) nv.concentration = { name: spellName, duration: '' };
    vitals = nv; refresh(); persistVitals(prev);
    feedPost(spellName, main + (isConc ? ' \u00B7 concentration' : ''));
  }

  function dropConcentration() {
    if (saving || !vitals.concentration) return;
    var nm = vitals.concentration.name, prev = vitals, nv = JSON.parse(JSON.stringify(vitals)); nv.concentration = null;
    vitals = nv; refresh(); persistVitals(prev); feedPost(nm, 'concentration dropped');
  }

  function openCastPicker(spellName, base, isConc) {
    if (!doc) return; closePops();
    var opts = castSlots(base); if (!opts.length) { showStat('hint', 'no ' + ordn(base) + '-level slots', true); return; }
    var pop = mkPop('sa-cast');
    var html = '<div class="sa-pop-t">Cast ' + esc(spellName) + '</div><div class="sa-pop-sub">choose a slot \u2014 your call</div><div class="scp-list">';
    opts.forEach(function (p) { var up = (p.level > base) ? '<span class="scp-up">\u25B2 upcast</span>' : ''; html += '<button class="scp-btn" type="button" data-pk="' + esc(p.key) + '"><span class="scp-dot" style="background:' + poolDot(p.tone) + '"></span>' + ordn(p.level) + '-level \u00B7 ' + esc(p.label) + ' \u00B7 ' + (p.current || 0) + ' left' + up + '</button>'; });
    html += '</div><button class="sa-btn ghost scp-cancel" type="button" data-pk-cancel>Cancel</button>';
    pop.innerHTML = html;
    mountPop(pop, spellEl(spellName));
    pop.querySelectorAll('[data-pk]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); closePops(); doCast(spellName, base, isConc, b.getAttribute('data-pk')); }); });
    var cx = pop.querySelector('[data-pk-cancel]'); if (cx) cx.addEventListener('click', function (e) { e.stopPropagation(); closePops(); });
  }

  function onCastClick(e) {
    var slot = e.target.closest('[data-slot]'); if (slot) { spendSlot(slot.getAttribute('data-slot'), +slot.getAttribute('data-i')); return; }
    var drop = e.target.closest('[data-conc-drop]'); if (drop) { dropConcentration(); return; }
    var sp = e.target.closest('.spell[data-spell]'); if (sp) { doCast(sp.getAttribute('data-spell'), parseInt(sp.getAttribute('data-level'), 10) || 0, sp.getAttribute('data-conc') === '1', null); return; }
  }
  function bindSpellcasting(editable) { if (!editable) return; root.addEventListener('click', onCastClick); }

  // ── Attacks: stateless rolling through the shared DiceEngine. Tap an action →
  // roll with the live Adv/Dis/Bless toggles → paint the result card + post to the
  // feed (the same engine the HUD uses, so rows read identically). Toggles consume
  // after each roll. No save path: a roll mutates nothing on the character.
  var rollRS = { advantage: false, disadvantage: false, bless: false };
  var rollHist = [];
  // The renderer paints assembleActions(inventory, structural); the click handler must
  // resolve against the SAME list or weapon-derived rows (ids wpn-* / cant-*) silently
  // no-op — they aren't in structural.actions. (That was the quarterstaff-won't-post /
  // dead-duplicate-longsword bug.) assembleActions is the one source of truth.
  function allActions() {
    try { return assembleActions(inventory, structural); }
    catch (_) { return structural.actions || []; }
  }
  function actionById(id) { var as = allActions(); for (var i = 0; i < as.length; i++) if ((as[i].id || as[i].label) === id) return as[i]; return null; }
  function actionByLabel(name) { var as = allActions(), n = String(name == null ? '' : name).trim().toLowerCase(); if (!n) return null; for (var i = 0; i < as.length; i++) if (String(as[i].label || '').trim().toLowerCase() === n) return as[i]; return null; }
  function deriveAction(a) {
    var api = sheetApi(), m = api.deriveActionMods ? api.deriveActionMods(a, structural) : { hitMod: +a.hitMod || 0, dmgMod: +a.dmgMod || 0 };
    var o = Object.assign({}, a); o.hitMod = m.hitMod; o.dmgMod = m.dmgMod;
    if (!o.critDice && o.dmgDice) { var mm = String(o.dmgDice).match(/(\d+)d(\d+)/); if (mm) o.critDice = (2 * parseInt(mm[1], 10)) + 'd' + mm[2]; }
    return o;
  }
  function renderRollMods() { root.querySelectorAll('[data-rmod]').forEach(function (b) { b.classList.toggle('on', !!rollRS[b.getAttribute('data-rmod')]); }); }
  function feedPostRoll(r) { postFeed({ actorKey: key, name: r.name, main: r.main, dmg: r.dmg }); }
  function doRoll(a) {
    var DE = (typeof window !== 'undefined' ? window : globalThis).DiceEngine;
    if (!DE) { showStat('hint', 'roll engine offline', true); return; }
    var r = DE.rollAction(deriveAction(a), { advantage: rollRS.advantage, disadvantage: rollRS.disadvantage, bless: rollRS.bless });
    rollHist.unshift(r);
    var api = sheetApi(); if (api.renderActionResult) api.renderActionResult(root, rollHist);
    feedPostRoll(r);
    if (a.type !== 'utility') { rollRS.advantage = false; rollRS.disadvantage = false; rollRS.bless = false; renderRollMods(); }   // consume per-roll toggles
  }
  function onActionClick(e) {
    // editor controls first: Edit toggle, per-row pencil (customize), eye (hide)
    var et = e.target.closest('[data-action-edit]'); if (et) { e.stopPropagation(); toggleAeMode(); return; }
    var pe = e.target.closest('[data-act-edit]'); if (pe) { e.stopPropagation(); openAeEditor(pe.getAttribute('data-act-edit')); return; }
    var ey = e.target.closest('[data-act-hide]'); if (ey) { e.stopPropagation(); aeToggleHide(ey.getAttribute('data-act-hide')); return; }
    var bd = e.target.closest('[data-act-bind]'); if (bd && aeEditable) { e.stopPropagation(); openBindMenu(bd.getAttribute('data-act-bind'), bd); return; }
    var sw = e.target.closest('[data-act-swap]'); if (sw && aeEditable) { e.stopPropagation(); openSwapMenu(sw.getAttribute('data-act-swap'), sw); return; }
    if (e.target.closest('.ae-editor')) return;   // panel has its own listeners
    var rm = e.target.closest('[data-rmod]');
    if (rm) { var k = rm.getAttribute('data-rmod');
      if (k === 'advantage') { rollRS.advantage = !rollRS.advantage; if (rollRS.advantage) rollRS.disadvantage = false; }
      else if (k === 'disadvantage') { rollRS.disadvantage = !rollRS.disadvantage; if (rollRS.disadvantage) rollRS.advantage = false; }
      else rollRS[k] = !rollRS[k];
      renderRollMods(); return;
    }
    var ac = e.target.closest('.act[data-act]'); if (ac) { if (aeMode) return; var a = actionById(ac.getAttribute('data-act')); if (a && a.type !== 'utility') doRoll(a); return; }
  }
  function onActionKey(e) { if (e.key !== 'Enter' && e.key !== ' ') return; if (aeMode) return; var ac = e.target.closest('.act[data-act]'); if (ac) { var a = actionById(ac.getAttribute('data-act')); if (a && a.type !== 'utility') { e.preventDefault(); doRoll(a); } } }
  // ── Checks: ability checks, saving throws, skills, initiative. Flat d20 + the
  // shown modifier through the same engine, toggles, result card, and feed as
  // attacks. Every [data-chk] row on the sheet is rollable.
  function doCheck(label, mod, forceDis) {
    var DE = (typeof window !== 'undefined' ? window : globalThis).DiceEngine;
    if (!DE) { showStat('hint', 'roll engine offline', true); return; }
    // A per-row forced disadvantage (e.g. Stealth in stealth-disadvantage armour) ORs
    // into the manual toggle; advantage + disadvantage cancel to a straight roll (RAW).
    var adv = rollRS.advantage, dis = rollRS.disadvantage || !!forceDis;
    if (adv && dis) { adv = false; dis = false; }
    var r = DE.rollCheck(label, mod, { advantage: adv, disadvantage: dis, bless: rollRS.bless });
    rollHist.unshift(r);
    var api = sheetApi(); if (api.renderActionResult) api.renderActionResult(root, rollHist);
    postFeed({ actorKey: key, name: r.name, main: r.main });
    rollRS.advantage = false; rollRS.disadvantage = false; rollRS.bless = false; renderRollMods();
  }
  function chkFrom(el) { return { label: el.getAttribute('data-chk-label') || 'Check', mod: parseInt(el.getAttribute('data-chk-mod'), 10) || 0, dis: el.getAttribute('data-chk-dis') === '1' }; }
  function onCheckClick(e) { var el = e.target.closest('[data-chk]'); if (!el) return; var c = chkFrom(el); doCheck(c.label, c.mod, c.dis); }
  function onCheckKey(e) { if (e.key !== 'Enter' && e.key !== ' ') return; var el = e.target.closest('[data-chk]'); if (!el) return; e.preventDefault(); var c = chkFrom(el); doCheck(c.label, c.mod, c.dis); }

  // ── Action editor ──────────────────────────────────────────────────────────
  // Edit-mode overlay on the Actions section: hide unwanted rows (e.g. stale Roll20
  // duplicates) and customize an action's label / to-hit ability / proficiency / bonuses
  // and a multi-type DAMAGE STACK (Divine Strike fire on a booming-blade swing, …). All
  // edits persist as a minimal structural.actionOverrides[id]; the renderer + roller read
  // them through assembleActions, so a tweak shows on the row, the result card, and the
  // feed. Rolling is suppressed while in edit mode.
  var aeEditable = false, aeMode = false, aeOpenId = null, aeDraft = null, aeArmedDel = null, aeArmTimer = null;
  var AE_TRASH = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-width="1.5" stroke-linecap="round"/></svg>';
  var AE_PLUS = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function aeNum(n) { n = parseInt(n, 10); return isNaN(n) ? 0 : n; }
  function aeEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function aeGroup(t) { return (t === 'attack' || t === 'attack-cantrip') ? 'attack' : (t === 'damage-only' ? 'damage' : 'utility'); }
  function aeSection() { return root.querySelector('[data-sec="actions"]'); }
  function aeList() { return root.querySelector('[data-list="actions"]'); }
  function aeRowEl(id) { var l = aeList(); if (!l) return null; var rows = l.querySelectorAll('.act[data-act]'); for (var i = 0; i < rows.length; i++) if (rows[i].getAttribute('data-act') === id) return rows[i]; return null; }
  // pristine (pre-override) action, for diffing a minimal override on save
  function aeBaseAction(id) { var s2 = Object.assign({}, structural); delete s2.actionOverrides; var list = assembleActions(inventory, s2); for (var i = 0; i < list.length; i++) if ((list[i].id || list[i].label) === id) return list[i]; return null; }
  // effective (current, override-applied) action, for seeding the editor
  function aeEffAction(id) { var list = assembleActions(inventory, structural, { includeHidden: true }); for (var i = 0; i < list.length; i++) if ((list[i].id || list[i].label) === id) return list[i]; return null; }

  function toggleAeMode() { aeMode = !aeMode; if (!aeMode) { aeOpenId = null; aeDraft = null; aeArmedDel = null; } decorateActionEditor(); }
  function openAeEditor(id) {
    if (!aeMode) return;
    if (aeOpenId === id) { aeOpenId = null; aeDraft = null; aeArmedDel = null; renderAePanel(); return; }
    var a = aeEffAction(id); if (!a) return;
    aeDraft = { type: a.type, label: a.label || '', ability: a.ability || '', proficient: !!a.proficient, atkBonus: aeNum(a.atkBonus),
                dmgAbility: !!a.dmgAbility, dmgDice: a.dmgDice || '', dmgBonus: aeNum(a.dmgBonus), dmgType: a.dmgType || '',
                extraDamage: (a.extraDamage || []).map(function (c) { return { dice: c.dice || '', bonus: aeNum(c.bonus), type: c.type || '' }; }) };
    aeOpenId = id; aeArmedDel = null; renderAePanel(); setTimeout(refreshAePreview, 0);
  }
  function aePanelHTML() {
    var d = aeDraft, g = aeGroup(d.type), showHit = (g === 'attack'), ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    var abilOpts = ['<option value="">\u2014 flat / none \u2014</option>'].concat(ABIL.map(function (k) { return '<option value="' + k + '"' + (d.ability === k ? ' selected' : '') + '>' + k.toUpperCase() + '</option>'; })).join('');
    var rows = '<div class="ae-dhdr"><span>Dice</span><span>Bonus</span><span>Type</span><span></span></div>';
    rows += '<div class="ae-drow"><input type="text" data-aed="dice" value="' + aeEsc(d.dmgDice) + '" placeholder="1d8"><input type="number" data-aed="bonus" value="' + d.dmgBonus + '"><input type="text" data-aed="type" value="' + aeEsc(d.dmgType) + '" placeholder="Slashing"><span class="ae-tag">' + (d.dmgAbility ? ('+' + (d.ability ? d.ability.toUpperCase() : 'mod')) : 'base') + '</span></div>';
    d.extraDamage.forEach(function (c, i) {
      var armed = (aeArmedDel === i);
      rows += '<div class="ae-drow"><input type="text" data-aex="' + i + '.dice" value="' + aeEsc(c.dice) + '" placeholder="1d8"><input type="number" data-aex="' + i + '.bonus" value="' + c.bonus + '"><input type="text" data-aex="' + i + '.type" value="' + aeEsc(c.type) + '" placeholder="Fire"><button type="button" class="ae-del' + (armed ? ' armed' : '') + '" data-aedel="' + i + '">' + (armed ? 'Remove?' : AE_TRASH) + '</button></div>';
    });
    return '<div class="ae-editor"><div class="ae-grid">'
      + '<div class="ae-f wide"><label>Label</label><input type="text" data-aef="label" value="' + aeEsc(d.label) + '"></div>'
      + (showHit ? '<div class="ae-f"><label>To-hit ability</label><select data-aef="ability">' + abilOpts + '</select></div>' : '')
      + (showHit ? '<div class="ae-f check"><input type="checkbox" data-aef="proficient"' + (d.proficient ? ' checked' : '') + '><label>Proficient (+PB)</label></div>' : '')
      + (showHit ? '<div class="ae-f"><label>Bonus to hit</label><input type="number" data-aef="atkBonus" value="' + d.atkBonus + '"></div>' : '')
      + '<div class="ae-dmg"><div class="ae-dmg-h">Damage<div class="ln"></div></div>' + rows + '<button type="button" class="ae-add" data-ae-add>' + AE_PLUS + ' Add damage</button></div>'
      + '<div class="ae-pv" data-ae-pv></div>'
      + '</div><div class="ae-act">'
      + '<button type="button" class="ae-btn danger" data-ae-hide>Hide action</button><span class="sp"></span>'
      + '<button type="button" class="ae-btn reset" data-ae-reset>Reset</button>'
      + '<button type="button" class="ae-btn save" data-ae-save>Save</button>'
      + '</div></div>';
  }
  function renderAePanel() {
    var l = aeList(); if (!l) return;
    var ex = l.querySelector('.ae-editor'); if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
    if (!aeOpenId || !aeDraft) return;
    var row = aeRowEl(aeOpenId); if (!row) return;
    row.insertAdjacentHTML('afterend', aePanelHTML());
    bindAePanel();
  }
  function refreshAePreview() {
    var l = aeList(); if (!l || !aeDraft) return; var pv = l.querySelector('[data-ae-pv]'); if (!pv) return;
    var api = sheetApi(); var inner = api.actionMeta ? api.actionMeta(aeDraft, structural) : '';
    pv.innerHTML = '<span class="pvn">' + aeEsc(aeDraft.label || '(unnamed)') + '</span> \u2014 ' + (aeGroup(aeDraft.type) === 'utility' ? 'utility' : inner);
  }
  function bindAePanel() {
    var l = aeList(); if (!l) return; var ed = l.querySelector('.ae-editor'); if (!ed) return;
    ed.querySelectorAll('[data-aef]').forEach(function (inp) {
      var f = inp.getAttribute('data-aef');
      var fn = function () { aeDraft[f] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? aeNum(inp.value) : inp.value); refreshAePreview(); };
      inp.addEventListener('input', fn); inp.addEventListener('change', fn);
    });
    ed.querySelectorAll('[data-aed]').forEach(function (inp) {
      inp.addEventListener('input', function () { var k = inp.getAttribute('data-aed'); if (k === 'dice') aeDraft.dmgDice = inp.value; else if (k === 'bonus') aeDraft.dmgBonus = aeNum(inp.value); else aeDraft.dmgType = inp.value; refreshAePreview(); });
    });
    ed.querySelectorAll('[data-aex]').forEach(function (inp) {
      inp.addEventListener('input', function () { var p = inp.getAttribute('data-aex').split('.'), i = +p[0], k = p[1]; if (!aeDraft.extraDamage[i]) return; if (k === 'bonus') aeDraft.extraDamage[i].bonus = aeNum(inp.value); else aeDraft.extraDamage[i][k] = inp.value; refreshAePreview(); });
    });
    var add = ed.querySelector('[data-ae-add]'); if (add) add.addEventListener('click', function (e) { e.stopPropagation(); aeDraft.extraDamage.push({ dice: '1d6', bonus: 0, type: '' }); aeArmedDel = null; renderAePanel(); setTimeout(refreshAePreview, 0); });
    ed.querySelectorAll('[data-aedel]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation(); var i = +b.getAttribute('data-aedel');
        if (aeArmedDel === i) { aeDraft.extraDamage.splice(i, 1); aeArmedDel = null; clearTimeout(aeArmTimer); renderAePanel(); setTimeout(refreshAePreview, 0); }
        else { aeArmedDel = i; renderAePanel(); setTimeout(refreshAePreview, 0); clearTimeout(aeArmTimer); aeArmTimer = setTimeout(function () { if (aeArmedDel === i) { aeArmedDel = null; renderAePanel(); setTimeout(refreshAePreview, 0); } }, 3000); }
      });
    });
    var sv = ed.querySelector('[data-ae-save]'); if (sv) sv.addEventListener('click', function (e) { e.stopPropagation(); aeSave(aeOpenId); });
    var rs = ed.querySelector('[data-ae-reset]'); if (rs) rs.addEventListener('click', function (e) { e.stopPropagation(); aeReset(aeOpenId); });
    var hb = ed.querySelector('[data-ae-hide]'); if (hb) hb.addEventListener('click', function (e) { e.stopPropagation(); aeToggleHide(aeOpenId); });
  }
  // diff the draft against the pristine action → smallest override that expresses the change
  function aeCommit(id) {
    var base = aeBaseAction(id) || {}, cur = (structural.actionOverrides || {})[id] || {}, o = {};
    if (cur.hidden) o.hidden = true;
    if (aeDraft.label !== (base.label || '')) o.label = aeDraft.label;
    if (aeGroup(base.type) === 'attack') {
      if ((aeDraft.ability || '') !== (base.ability || '')) o.ability = aeDraft.ability;
      if (!!aeDraft.proficient !== !!base.proficient) o.proficient = aeDraft.proficient;
      if (aeNum(aeDraft.atkBonus) !== aeNum(base.atkBonus)) o.atkBonus = aeNum(aeDraft.atkBonus);
    }
    if ((aeDraft.dmgDice || '') !== (base.dmgDice || '')) o.dmgDice = aeDraft.dmgDice;
    if (aeNum(aeDraft.dmgBonus) !== aeNum(base.dmgBonus)) o.dmgBonus = aeNum(aeDraft.dmgBonus);
    if ((aeDraft.dmgType || '') !== (base.dmgType || '')) o.dmgType = aeDraft.dmgType;
    var extras = aeDraft.extraDamage.filter(function (c) { return c.dice; }).map(function (c) { var e = { dice: c.dice, type: c.type || '' }; if (aeNum(c.bonus)) e.bonus = aeNum(c.bonus); return e; });
    if (extras.length) o.extraDamage = extras;
    return o;
  }
  // write/clear structural.actionOverrides[id], optimistic refresh, then persist
  function aeWriteOverride(id, mutate) {
    if (!aeEditable) return;
    var prev = structural, ns = JSON.parse(JSON.stringify(structural));
    ns.actionOverrides = ns.actionOverrides || {};
    mutate(ns.actionOverrides);
    if (ns.actionOverrides[id] && !Object.keys(ns.actionOverrides[id]).length) delete ns.actionOverrides[id];
    if (ns.actionOverrides && !Object.keys(ns.actionOverrides).length) delete ns.actionOverrides;
    aeOpenId = null; aeDraft = null; aeArmedDel = null;
    structural = ns; refresh(); persistStructural(prev);
  }
  function aeSave(id) { var o = aeCommit(id); aeWriteOverride(id, function (ov) { if (Object.keys(o).length) ov[id] = o; else delete ov[id]; }); }
  function aeReset(id) { aeWriteOverride(id, function (ov) { delete ov[id]; }); }
  function aeToggleHide(id) { aeWriteOverride(id, function (ov) { var o = ov[id] || (ov[id] = {}); if (o.hidden) delete o.hidden; else o.hidden = true; }); }
  // ── cantrip weapon-bind: which carried weapon a weapon-cantrip (Booming Blade, Green-Flame Blade) rides ──
  function setCantripBind(cantrip, weaponKey) {
    if (!aeEditable) return;
    var prev = structural, ns = JSON.parse(JSON.stringify(structural));
    ns.cantripBinds = ns.cantripBinds || {};
    if (weaponKey) ns.cantripBinds[cantrip] = weaponKey; else delete ns.cantripBinds[cantrip];   // '' clears → Auto (first melee)
    if (!Object.keys(ns.cantripBinds).length) delete ns.cantripBinds;
    structural = ns; refresh(); persistStructural(prev);
  }
  function openBindMenu(cantrip, anchor) {
    if (!aeEditable || !doc) return;
    closePops();
    var opts = []; try { opts = meleeWeaponOptions(inventory) || []; } catch (_) {}
    var cur = String((structural.cantripBinds || {})[cantrip] || '').toLowerCase();
    var nice = String(cantrip || '').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    var pop = mkPop('sa-bind');
    var html = '<div class="sa-pop-t">Weapon for ' + esc(nice) + '</div>';
    if (!opts.length) html += '<div class="sa-pop-sub">No melee weapon carried</div>';
    else {
      html += '<div class="bind-list">';
      html += '<button class="bind-opt' + (!cur ? ' on' : '') + '" type="button" data-wk=""><span>Auto \u00B7 first weapon</span>' + (!cur ? '<span class="bind-chk">\u2713</span>' : '') + '</button>';
      opts.forEach(function (o) {
        var on = !!cur && o.key === cur;
        html += '<button class="bind-opt' + (on ? ' on' : '') + '" type="button" data-wk="' + esc(o.key) + '"><span>' + esc(o.name) + '</span>' + (on ? '<span class="bind-chk">\u2713</span>' : '') + '</button>';
      });
      html += '</div>';
    }
    pop.innerHTML = html;
    mountPop(pop, anchor);
    pop.querySelectorAll('[data-wk]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); closePops(); setCantripBind(cantrip, b.getAttribute('data-wk')); });
    });
  }
  // ── swap: exchange this attack for one of your currently-hidden attacks (same group) ──
  function swapGroupOf(t) { return (t === 'attack' || t === 'attack-cantrip') ? 'attack' : (t === 'damage-only' ? 'damage' : 'utility'); }
  function doSwap(curId, inId) {
    aeWriteOverride(curId, function (ov) {
      (ov[curId] || (ov[curId] = {})).hidden = true;                                              // hide the current attack
      var b = ov[inId]; if (b) { delete b.hidden; if (!Object.keys(b).length) delete ov[inId]; }   // un-hide the chosen one
    });
  }
  function openSwapMenu(curId, anchor) {
    if (!aeEditable || !doc) return;
    closePops();
    var all = []; try { all = assembleActions(inventory, structural, { includeHidden: true }) || []; } catch (_) {}
    var cur = null; for (var i = 0; i < all.length; i++) if ((all[i].id || all[i].label) === curId) { cur = all[i]; break; }
    var curG = cur ? swapGroupOf(cur.type) : 'attack';
    var hidden = all.filter(function (a) { return a._hidden && swapGroupOf(a.type) === curG && (a.id || a.label) !== curId; });
    var pop = mkPop('sa-swap');
    var html = '<div class="sa-pop-t">Swap ' + esc((cur && cur.label) || 'attack') + '</div>';
    if (!hidden.length) html += '<div class="sa-pop-sub">No hidden attacks to swap in \u2014 hide one with the eye, or add more in Edit.</div>';
    else {
      html += '<div class="swap-list">';
      hidden.forEach(function (a) {
        html += '<button class="swap-opt" type="button" data-swp="' + esc(a.id || a.label) + '"><span>' + esc(a.label || '') + '</span><span class="swap-in">swap in</span></button>';
      });
      html += '</div>';
    }
    pop.innerHTML = html;
    mountPop(pop, anchor);
    pop.querySelectorAll('[data-swp]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); closePops(); doSwap(curId, b.getAttribute('data-swp')); });
    });
  }
  // re-assert edit-mode chrome after every render (renderSheet rewrites the section)
  function decorateActionEditor() {
    if (!aeEditable) return;
    var sec = aeSection(); if (sec) sec.classList.add('can-edit');
    var l = aeList(); if (l) l.classList.toggle('editing', aeMode);
    var btn = root.querySelector('[data-action-edit]'); if (btn) btn.classList.toggle('on', aeMode);
    if (aeMode && aeOpenId && aeDraft) renderAePanel();
    else { var ex = l && l.querySelector('.ae-editor'); if (ex && ex.parentNode) ex.parentNode.removeChild(ex); }
  }
  function bindActionEditor() { aeEditable = true; decorateActionEditor(); }

  function bindAttacks(editable) { renderRollMods(); if (!editable) return; root.addEventListener('click', onActionClick); root.addEventListener('keydown', onActionKey); root.addEventListener('click', onCheckClick); root.addEventListener('keydown', onCheckKey); }
  // load state + merge baseline, then gate + bind
  // ── Portrait picker ─────────────────────────────────────────────────────────
  // Click the portrait → a modal lists the Cloudinary kirtas/portraits/ library
  // (GET /.netlify/functions/list-portraits) to choose from, plus an "Upload new"
  // tile gated server-side by /.netlify/functions/portrait-upload-sign (approved
  // accounts only — 403 otherwise). Selecting writes structural.portrait through the
  // same optimistic persistStructural the rest of the sheet uses. No SQL.
  var PP_LIST_URL = '/.netlify/functions/list-portraits';
  var PP_SIGN_URL = '/.netlify/functions/portrait-upload-sign';
  var ppEl = null, ppSel = null;

  function ppToken() { try { return (window.__tok && window.__tok.session && window.__tok.session.access_token) || ''; } catch (_) { return ''; } }

  function ppInjectCss() {
    if (doc.getElementById('pp-css')) return;
    var s = doc.createElement('style'); s.id = 'pp-css';
    s.textContent = [
      '.pp-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;',
        'background:rgba(4,12,14,.62);backdrop-filter:blur(3px);opacity:0;transition:opacity .16s}',
      '.pp-overlay.open{opacity:1}',
      '.pp-modal{width:100%;max-width:560px;background:linear-gradient(180deg,#163840,#122e34);border:1px solid rgba(201,162,74,.4);',
        'border-radius:14px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.55);transform:translateY(8px) scale(.99);transition:transform .16s}',
      '.pp-overlay.open .pp-modal{transform:none}',
      '.pp-head{display:flex;align-items:center;justify-content:space-between;padding:15px 18px 13px;border-bottom:1px solid rgba(201,162,74,.22);background:linear-gradient(180deg,rgba(201,162,74,.06),transparent)}',
      '.pp-title{font-family:"Playfair Display",serif;font-weight:700;font-size:19px;color:var(--cream-hi,#f9f3e6)}',
      '.pp-title .sub{display:block;font-family:"Oswald",sans-serif;font-weight:300;letter-spacing:.16em;text-transform:uppercase;font-size:10px;color:var(--gold,#c79a4a);margin-top:3px}',
      '.pp-x{appearance:none;background:transparent;border:1px solid rgba(201,162,74,.22);color:var(--cream-dim,#c2b99f);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1;display:grid;place-items:center}',
      '.pp-x:hover{border-color:var(--gold,#c79a4a);color:var(--cream-hi,#f9f3e6)}',
      '.pp-body{padding:15px 18px;max-height:54vh;overflow:auto}',
      '.pp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:12px}',
      '.pp-tile{position:relative;aspect-ratio:1/1;border-radius:11px;overflow:hidden;cursor:pointer;padding:0;',
        'border:1px solid rgba(201,162,74,.22);background:#10292f;transition:transform .12s,border-color .12s,box-shadow .12s}',
      '.pp-tile:hover{transform:translateY(-2px);border-color:rgba(201,162,74,.4)}',
      '.pp-tile img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}',
      '.pp-tile .pp-nm{position:absolute;left:0;right:0;bottom:0;padding:14px 7px 5px;font-family:"Oswald",sans-serif;font-size:10.5px;',
        'letter-spacing:.04em;color:#fff;text-transform:capitalize;text-align:left;background:linear-gradient(transparent,rgba(0,0,0,.72))}',
      '.pp-tile.sel{border-color:var(--gold-br,#e7c279);box-shadow:0 0 0 2px var(--gold-br,#e7c279),0 8px 22px rgba(0,0,0,.45)}',
      '.pp-tile .pp-ck{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:var(--gold-br,#e7c279);',
        'color:#102;display:grid;place-items:center;font-size:12px;font-weight:700;opacity:0;transform:scale(.6);transition:.12s}',
      '.pp-tile.sel .pp-ck{opacity:1;transform:scale(1)}',
      '.pp-up{display:grid;place-items:center;gap:6px;border-style:dashed;background:rgba(201,162,74,.05);color:var(--gold,#c79a4a)}',
      '.pp-up svg{width:26px;height:26px}',
      '.pp-up .pp-uplab{font-family:"Oswald",sans-serif;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}',
      '.pp-loading{grid-column:1/-1;text-align:center;padding:26px 0;font-family:"EB Garamond",serif;font-style:italic;color:var(--cream-fnt,#8d8675)}',
      '.pp-loading.bad{color:#d98a8a}',
      '.pp-foot{display:flex;align-items:center;gap:13px;padding:12px 18px;border-top:1px solid rgba(201,162,74,.22);background:linear-gradient(0deg,rgba(0,0,0,.18),transparent)}',
      '.pp-prev{display:flex;align-items:center;gap:11px;min-width:0;flex:1}',
      '.pp-chip{width:40px;height:40px;border-radius:9px;border:1px solid rgba(201,162,74,.4);overflow:hidden;flex:none;background:#0f272d}',
      '.pp-chip img{width:100%;height:100%;object-fit:cover}',
      '.pp-meta{min-width:0}',
      '.pp-meta .k{font-family:"Oswald",sans-serif;font-weight:300;letter-spacing:.16em;text-transform:uppercase;font-size:9.5px;color:var(--cream-fnt,#8d8675)}',
      '.pp-meta .v{font-family:"EB Garamond",serif;font-size:15px;color:var(--cream,#ece2cd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:capitalize}',
      '.pp-btns{display:flex;gap:9px;flex:none}',
      '.pp-btn{appearance:none;font-family:"Oswald",sans-serif;font-weight:500;letter-spacing:.08em;text-transform:uppercase;font-size:12px;',
        'padding:9px 16px;border-radius:9px;cursor:pointer;border:1px solid rgba(201,162,74,.22);background:transparent;color:var(--cream-dim,#c2b99f)}',
      '.pp-btn:hover{border-color:var(--gold,#c79a4a);color:var(--cream-hi,#f9f3e6)}',
      '.pp-btn.primary{background:linear-gradient(180deg,var(--gold-br,#e7c279),var(--gold,#c79a4a));border-color:var(--gold-br,#e7c279);color:#10211f;font-weight:600}',
      '.pp-btn.primary:disabled{opacity:.4;cursor:not-allowed;filter:none}',
      '.pp-toast{position:absolute;left:18px;bottom:62px;font-family:"Oswald",sans-serif;font-size:12px;letter-spacing:.03em;',
        'padding:7px 12px;border-radius:8px;background:#1c3b42;border:1px solid rgba(201,162,74,.3);color:var(--cream,#ece2cd);opacity:0;transition:opacity .15s}',
      '.pp-toast.show{opacity:1}.pp-toast.bad{border-color:#a55;color:#e6b3b3}',
      '.portrait.pp-tappable{cursor:pointer}',
      '.portrait.pp-tappable:after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 2px rgba(231,194,121,0);transition:box-shadow .15s;pointer-events:none}',
      '.portrait.pp-tappable:hover:after{box-shadow:inset 0 0 0 2px rgba(231,194,121,.55)}'
    ].join('');
    doc.head.appendChild(s);
  }

  function ppToast(msg, bad) {
    if (!ppEl) return;
    var t = ppEl.querySelector('.pp-toast');
    if (!t) { t = doc.createElement('div'); t.className = 'pp-toast'; ppEl.querySelector('.pp-modal').appendChild(t); }
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
    clearTimeout(t._tm); t._tm = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function ppClose() {
    if (!ppEl) return;
    var el = ppEl; ppEl = null; el.classList.remove('open');
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 170);
  }

  function ppApplyPortrait(url) {
    if (!url) return;
    var prev = structural;
    structural = Object.assign({}, structural, { portrait: url });
    var frame = portrait && portrait.querySelector('.frame');
    if (frame) { var img = doc.createElement('img'); img.src = url; img.alt = ''; img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:top center;display:block'; frame.innerHTML = ''; frame.appendChild(img); }
    persistStructural(prev);   // optimistic save + reconcile + revert on error
  }

  function ppUpdateFoot() {
    if (!ppEl) return;
    var chip = ppEl.querySelector('.pp-chip'), nameEl = ppEl.querySelector('.pp-meta .v'), setBtn = ppEl.querySelector('.pp-set');
    if (ppSel) {
      chip.innerHTML = ''; var im = doc.createElement('img'); im.src = ppSel.thumb || ppSel.url; chip.appendChild(im);
      nameEl.textContent = (ppSel.name || 'selected').replace(/[-_]/g, ' ');
      if (setBtn) setBtn.disabled = false;
    } else { nameEl.textContent = '\u2014'; if (setBtn) setBtn.disabled = true; }
  }

  function ppRenderGrid(gridEl, portraits) {
    gridEl.innerHTML = '';
    var curUrl = (structural && structural.portrait) || '';
    portraits.forEach(function (p) {
      var t = doc.createElement('button'); t.type = 'button'; t.className = 'pp-tile';
      if ((ppSel && ppSel.url === p.url) || (!ppSel && p.url === curUrl)) { t.classList.add('sel'); if (!ppSel) ppSel = p; }
      var img = doc.createElement('img'); img.loading = 'lazy'; img.src = p.thumb || p.url; img.alt = '';
      var nm = doc.createElement('span'); nm.className = 'pp-nm'; nm.textContent = (p.name || '').replace(/[-_]/g, ' ');
      var ck = doc.createElement('span'); ck.className = 'pp-ck'; ck.textContent = '\u2713';
      t.appendChild(img); t.appendChild(nm); t.appendChild(ck);
      t.addEventListener('click', function () {
        ppSel = p;
        gridEl.querySelectorAll('.pp-tile').forEach(function (x) { x.classList.remove('sel'); });
        t.classList.add('sel'); ppUpdateFoot();
      });
      gridEl.appendChild(t);
    });
    var u = doc.createElement('button'); u.type = 'button'; u.className = 'pp-tile pp-up'; u.title = 'Upload a new portrait';
    u.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/></svg><span class="pp-uplab">Upload new</span>';
    u.addEventListener('click', ppUpload);
    gridEl.appendChild(u);
    ppUpdateFoot();
  }

  async function ppLoadGrid(gridEl) {
    gridEl.innerHTML = '<div class="pp-loading">Loading the library\u2026</div>';
    try {
      var res = await fetch(PP_LIST_URL, { headers: { Authorization: 'Bearer ' + ppToken() } });
      if (!res.ok) {
        var reason = 'Couldn\u2019t load the portrait library (' + res.status + ').';
        try { var j = await res.json(); if (j && j.error) reason = j.error; } catch (_) {}
        if (res.status === 404) reason = 'Portrait service isn\u2019t deployed yet.';
        gridEl.innerHTML = '<div class="pp-loading bad">' + reason + '</div>';
        return;
      }
      var data = await res.json();
      ppRenderGrid(gridEl, data.portraits || []);
    } catch (e) { gridEl.innerHTML = '<div class="pp-loading bad">Couldn\u2019t reach the portrait service.</div>'; }
  }

  function ppUpload() {
    var inp = doc.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', async function () {
      var file = inp.files && inp.files[0]; if (!file) return;
      ppToast('Uploading\u2026');
      try {
        var sres = await fetch(PP_SIGN_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + ppToken(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name }) });
        if (sres.status === 403) { ppToast('Your account isn\u2019t approved to upload portraits.', true); return; }
        if (!sres.ok) throw new Error('sign ' + sres.status);
        var sig = await sres.json();
        var fd = new FormData();
        fd.append('file', file); fd.append('api_key', sig.apiKey); fd.append('timestamp', sig.timestamp);
        fd.append('signature', sig.signature); fd.append('folder', sig.folder); fd.append('public_id', sig.publicId);
        var ures = await fetch(sig.uploadUrl, { method: 'POST', body: fd });
        if (!ures.ok) throw new Error('cloudinary ' + ures.status);
        var up = await ures.json();
        var url = up.secure_url || up.url;
        if (!url) throw new Error('no url');
        ppApplyPortrait(url); ppClose();
      } catch (e) { ppToast('Upload failed \u2014 try again.', true); }
    });
    inp.click();
  }

  function ppOpen() {
    ppInjectCss();
    ppSel = (structural && structural.portrait) ? { url: structural.portrait, name: 'current' } : null;
    ppEl = doc.createElement('div'); ppEl.className = 'pp-overlay';
    ppEl.innerHTML =
      '<div class="pp-modal" role="dialog" aria-label="Choose a portrait">' +
        '<div class="pp-head"><div class="pp-title">Choose a portrait<span class="sub">kirtas / portraits</span></div>' +
          '<button class="pp-x" title="Close">\u2715</button></div>' +
        '<div class="pp-body"><div class="pp-grid" id="pp-grid"></div></div>' +
        '<div class="pp-foot"><div class="pp-prev"><div class="pp-chip"></div>' +
          '<div class="pp-meta"><div class="k">Selected</div><div class="v">\u2014</div></div></div>' +
          '<div class="pp-btns"><button class="pp-btn pp-cancel">Cancel</button>' +
          '<button class="pp-btn primary pp-set" disabled>Set portrait</button></div></div>' +
      '</div>';
    (doc.body || root).appendChild(ppEl);
    ppEl.addEventListener('click', function (e) { if (e.target === ppEl) ppClose(); });
    ppEl.querySelector('.pp-x').addEventListener('click', ppClose);
    ppEl.querySelector('.pp-cancel').addEventListener('click', ppClose);
    ppEl.querySelector('.pp-set').addEventListener('click', function () { if (ppSel) { ppApplyPortrait(ppSel.url); ppClose(); } });
    doc.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { ppClose(); doc.removeEventListener('keydown', esc); } });
    requestAnimationFrame(function () { if (ppEl) ppEl.classList.add('open'); });
    ppLoadGrid(ppEl.querySelector('#pp-grid'));
  }

  function bindPortraitPicker() {
    if (!portrait) return;
    portrait.classList.add('pp-tappable');
    portrait.setAttribute('role', 'button');
    portrait.setAttribute('tabindex', '0');
    portrait.setAttribute('title', 'Change portrait');
    portrait.addEventListener('click', function (e) { e.stopPropagation(); ppOpen(); });
    portrait.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ppOpen(); } });
  }


  const ready = (async () => {
    let editable = false;
    try { editable = await characterData.canEdit(key); } catch (_) { editable = false; }
    try {
      const cd = await characterData.loadCharacter(key);
      vitals = (cd && cd.vitals) ? cd.vitals : {};
      structural = (cd && cd.structural) ? cd.structural : {};
      inventory = (cd && cd.inventory) ? cd.inventory : [];
      currency = (cd && cd.currency) ? cd.currency : {};
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
      bindCustomFeatures(true);
      bindSpellcasting(true);
      bindAttacks(true);
      bindActionEditor();
      bindPortraitPicker();
      try { await (depsReady || Promise.resolve()); } catch (_) {}   // EquipSlots may be self-loading on rail/float hosts
      backfillInventory();
      bindEquip();
      bindGear();
    } else {
      toggle.classList.add('view-only');
      toggle.setAttribute('aria-disabled', 'true');
      root.querySelectorAll('[data-rest]').forEach((b) => {
        b.addEventListener('click', () => showStat('hint', 'view only', true));
      });
      bindTrackers(false);
      bindCustomFeatures(false);
      bindSpellcasting(false);
      bindAttacks(false);
    }
  })();

  return { ready };
}

// Page bootstrap removed: sheet-mount.js's mountSheet owns the wiring lifecycle
// and calls wireInspiration scoped to its container. The smoke imports the pure
// planners + wireInspiration and drives them directly.
