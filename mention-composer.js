/* ════════════════════════════════════════════════════════════════════
   MENTION-COMPOSER-V1 — the shared vanilla writing surface with live
   @ mentions and [[wikilinks]].

   Consumers: journal-capture.js (the sheet's Notes-tab capture) today;
   rail.js's feed composer next; the chronicle-book composer in the
   phase-5 arc. One mention engine, every writing surface.

   The wall stays: no React, no TipTap runtime. This module authors the
   journal's LOCKED data formats directly:
     • doc JSON  — paragraph / text / tokMention / pageLink nodes
                   (journal/src/editor/MentionExtension.js, PageLink.js)
     • html      — the exact spans those nodes' renderHTML emits, so the
                   render cache is indistinguishable from the journal's
   Matching imports the journal's OWN pure matcher (match.js is committed
   source, served by Netlify) — one source of truth, no drift.

   ES module. No Supabase in here — callers own persistence; this module
   owns the editing surface + serialization.
   ════════════════════════════════════════════════════════════════════ */

import { buildItems, slug } from './journal/src/editor/match.js';

/* Mirrors CLASS_FOR + mentionClass in journal/src/editor/MentionExtension.js
   (that file imports @tiptap and can't be loaded outside the bundle — keep
   these four entries in lockstep with it). */
const CLASS_FOR = {
  'npc':                 'npc-link',
  'location':            'location-link',
  'npc-unresolved':      'npc-unresolved',
  'location-unresolved': 'location-unresolved',
};
function mentionClass(a) {
  const key = a.resolved ? a.type : (a.type + '-unresolved');
  return 'tok-mention ' + (CLASS_FOR[key] || 'npc-link');
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ── canon self-heal ─────────────────────────────────────────────────
   tooltips.js declares NPC_DATA / LOCATION_DATA as top-level consts in a
   CLASSIC script — global-lexical, invisible to module code. journal.html
   bridges them onto window.__tokCanon with an inline classic script; here
   we self-heal the same way on pages that don't (the sheet). Injected
   classic scripts share the realm's global lexical scope, so a second
   inline classic script can do the bridge. Idempotent; degrades to an
   empty canon (entities rows still work) if tooltips.js can't load.     */
let __canonPromise = null;
export function ensureCanon(doc) {
  const w = typeof window !== 'undefined' ? window : null;
  if (!w) return Promise.resolve({ npcs: {}, locations: {} });
  if (w.__tokCanon) return Promise.resolve(w.__tokCanon);
  if (__canonPromise) return __canonPromise;
  doc = doc || document;
  __canonPromise = new Promise(res => {
    let done = false;
    const bridge = () => {
      if (done) return; done = true;
      const b = doc.createElement('script');   // classic → sees global lexicals
      b.textContent =
        'window.__tokCanon = {' +
        ' npcs: typeof NPC_DATA !== "undefined" ? NPC_DATA : {},' +
        ' locations: typeof LOCATION_DATA !== "undefined" ? LOCATION_DATA : {} };';
      (doc.head || doc.documentElement).appendChild(b);
      res(w.__tokCanon || { npcs: {}, locations: {} });
    };
    if (doc.querySelector('script[src$="tooltips.js"]')) { bridge(); return; }
    const s = doc.createElement('script');
    s.src = 'tooltips.js'; s.async = false;
    s.onload = bridge; s.onerror = bridge;
    (doc.head || doc.documentElement).appendChild(s);
    setTimeout(bridge, 4000);                  // never hang — degrade to empty canon
  });
  return __canonPromise;
}

/* Canon objects → the flat {id,type,label,hint} arrays match.js expects.
   Canon shape mirrors the journal's entityStore merge: object keyed by
   slug/id with .name (+ optional .role/.descr as the hint).             */
function canonToArrays(canon) {
  const flat = (obj, type) => Object.keys(obj || {}).map(k => {
    const e = obj[k] || {};
    return { id: k, type, label: e.name || k, hint: e.role || e.hint || e.descr || '' };
  });
  return { npcs: flat(canon.npcs, 'npc'), locations: flat(canon.locations, 'location') };
}

/* Merge canon + play-created entities rows (same precedence as the
   journal's entityStore: canon first, entity rows add the new names).   */
export function buildPool(canon, entityRows) {
  const { npcs, locations } = canonToArrays(canon || {});
  const seen = { npc: new Set(npcs.map(e => e.id)), location: new Set(locations.map(e => e.id)) };
  (entityRows || []).forEach(r => {
    if (!r || !r.id || !r.type || seen[r.type] == null || seen[r.type].has(r.id)) return;
    seen[r.type].add(r.id);
    (r.type === 'npc' ? npcs : locations).push({ id: r.id, type: r.type, label: r.name || r.id, hint: r.curated ? '' : 'pending curation' });
  });
  return { npcs, locations };
}

/* ── serialization: contenteditable → doc JSON / html / refs ─────────
   The editable's content model is deliberately tiny: block elements
   (div/p, or a bare top-level run) containing text and atomic chip
   spans. Chips carry their node data as data-* attributes.             */
function chipToNode(el) {
  if (el.hasAttribute('data-pagelink')) {
    return { type: 'pageLink', attrs: {
      pageId: el.getAttribute('data-pagelink'),
      label:  el.getAttribute('data-pagelink-label') || el.textContent,
    } };
  }
  if (el.hasAttribute('data-mention-type')) {
    const t = el.getAttribute('data-mention-type') || 'npc';
    return { type: 'tokMention', attrs: {
      id:       el.getAttribute('data-mention-key'),
      type:     t.replace('-unresolved', ''),
      label:    (el.textContent || '').replace(/^@/, ''),
      resolved: !t.endsWith('-unresolved'),
    } };
  }
  return null;
}

function inlineOf(container) {
  const out = [];
  const pushText = t => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.type === 'text') last.text += t; else out.push({ type: 'text', text: t });
  };
  container.childNodes.forEach(n => {
    if (n.nodeType === 3) { pushText(n.nodeValue.replace(/\u00a0/g, ' ')); return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === 'BR') return;                       // trailing <br> in empty blocks
    const chip = chipToNode(n);
    if (chip) { out.push(chip); return; }
    pushText(n.textContent);                              // any other markup flattens to text
  });
  // TipTap forbids empty text nodes; also trim pure-whitespace-only runs at the ends
  return out.filter(x => x.type !== 'text' || x.text.length);
}

export function serializeDoc(editableEl) {
  const blocks = [];
  let bare = [];                                          // top-level inline run (no block wrapper yet)
  const flushBare = () => { if (bare.length) { blocks.push(bare); bare = []; } };
  editableEl.childNodes.forEach(n => {
    if (n.nodeType === 1 && (n.tagName === 'DIV' || n.tagName === 'P')) {
      flushBare(); blocks.push(inlineOf(n));
    } else if (n.nodeType === 1 && n.tagName === 'BR') {
      flushBare(); blocks.push([]);
    } else {
      const frag = editableEl.ownerDocument.createDocumentFragment(); frag.appendChild(n.cloneNode(true));
      bare = bare.concat(inlineOf(frag));
    }
  });
  flushBare();
  const mergeText = inl => inl.reduce((out, n) => {
    const last = out[out.length - 1];
    if (n.type === 'text' && last && last.type === 'text') last.text += n.text; else out.push(n);
    return out;
  }, []);
  const content = blocks
    .map(mergeText)
    .map(inl => (inl.length ? { type: 'paragraph', content: inl } : { type: 'paragraph' }))
    .filter((p, i, arr) => p.content || (i < arr.length - 1));   // drop a trailing empty paragraph
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/* html render cache — the same markup the journal's renderHTML emits.  */
export function docToHTML(doc) {
  const inline = n => {
    if (n.type === 'text') return esc(n.text);
    if (n.type === 'tokMention') {
      const a = n.attrs || {};
      const typeAttr = a.resolved ? a.type : (a.type + '-unresolved');
      return '<span data-mention-type="' + esc(typeAttr) + '" data-mention-key="' + esc(a.id) +
             '" class="' + mentionClass(a) + '">@' + esc(a.label != null ? a.label : a.id) + '</span>';
    }
    if (n.type === 'pageLink') {
      const a = n.attrs || {};
      return '<span data-pagelink="' + esc(a.pageId) + '" data-pagelink-label="' + esc(a.label) +
             '" class="page-link">' + esc(a.label != null ? a.label : a.pageId) + '</span>';
    }
    return '';
  };
  return (doc.content || []).map(p =>
    '<p>' + ((p.content || []).map(inline).join('') || '') + '</p>'
  ).join('');
}

/* refs — the journal_refs rows for this doc (mirrors live-vault.js's
   extractRefs + extractPageLinks mapping; deduped on kind:id).          */
export function docToRefs(doc) {
  const seen = new Set(), refs = [];
  const walk = n => {
    if (!n) return;
    if (n.type === 'tokMention' && n.attrs && n.attrs.id) {
      const k = 'entity:' + n.attrs.type + ':' + n.attrs.id;
      if (!seen.has(k)) { seen.add(k); refs.push({ kind: 'entity', type: n.attrs.type, id: n.attrs.id, label: n.attrs.label, resolved: !!n.attrs.resolved }); }
    }
    if (n.type === 'pageLink' && n.attrs && n.attrs.pageId) {
      const k = 'page:' + n.attrs.pageId;
      if (!seen.has(k)) { seen.add(k); refs.push({ kind: 'page', id: n.attrs.pageId, label: n.attrs.label }); }
    }
    (n.content || []).forEach(walk);
  };
  walk(doc);
  return refs;
}

/* feed-body serializer — for the rail arc: one line of html with the
   same spans, no <p> wrapper (feed bodies are inline html).             */
export function docToFeedBody(doc) {
  return docToHTML(doc).replace(/^<p>/, '').replace(/<\/p>$/, '').replace(/<\/p><p>/g, '<br>');
}

/* ── chip factory ────────────────────────────────────────────────────*/
function makeChip(doc, item) {
  const span = doc.createElement('span');
  span.contentEditable = 'false';
  if (item.type === 'page') {
    span.setAttribute('data-pagelink', item.id);
    span.setAttribute('data-pagelink-label', item.label);
    span.className = 'page-link';
    span.textContent = item.label;
  } else {
    const typeAttr = item.resolved ? item.type : (item.type + '-unresolved');
    span.setAttribute('data-mention-type', typeAttr);
    span.setAttribute('data-mention-key', item.id);
    span.className = mentionClass(item);
    span.textContent = '@' + item.label;
  }
  return span;
}

/* ── the composer ────────────────────────────────────────────────────
   createComposer(host, {
     placeholder,       — hint text
     pool: () => ({npcs, locations}),   — the @ pool (post-merge)
     pageItems: () => [{id,type:'page',label,hint}],  — the [[ pool
     onNewEntity(item)  — optional: an unresolved @ was chip-inserted
   }) → { el, getDoc, getRefs, isEmpty, clear, focus }                   */
export function createComposer(host, opts) {
  opts = opts || {};
  const doc = host.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'mc-wrap';
  const ed = doc.createElement('div');
  ed.className = 'mc-editor';
  ed.contentEditable = 'true';
  ed.setAttribute('data-placeholder', opts.placeholder || '');
  const pick = doc.createElement('div');
  pick.className = 'mc-pick';
  pick.style.display = 'none';
  wrap.appendChild(ed); wrap.appendChild(pick);
  host.appendChild(wrap);

  let items = [], sel = 0, trig = null;   // trig = {kind:'@'|'[[', node, start}

  /* find an open trigger in the text node before the caret */
  function findTrigger() {
    const s = doc.defaultView.getSelection();
    if (!s || !s.rangeCount || !s.isCollapsed) return null;
    const r = s.getRangeAt(0);
    if (r.startContainer.nodeType !== 3) return null;
    if (!ed.contains(r.startContainer)) return null;
    const text = r.startContainer.nodeValue.slice(0, r.startOffset);
    let m = text.match(/\[\[([^\]\[]{0,40})$/);
    if (m) return { kind: '[[', node: r.startContainer, start: r.startOffset - m[0].length, query: m[1] };
    m = text.match(/(^|[\s\u00a0(])@([\w' \-\u00c0-\u024f]{0,40})$/);
    if (m) return { kind: '@', node: r.startContainer, start: r.startOffset - m[0].length + m[1].length, query: m[2] };
    return null;
  }

  function renderPick() {
    if (!items.length) { pick.style.display = 'none'; return; }
    let html = '', lastSec = null;
    items.forEach((it, i) => {
      if (it.section !== lastSec) { lastSec = it.section; html += '<div class="mc-pick-sec">' + esc(it.section) + '</div>'; }
      html += '<div class="mc-pick-item' + (i === sel ? ' sel' : '') + (it.type === 'location' ? ' loc' : '') +
              (it.resolved === false ? ' create' : '') + '" data-i="' + i + '">' +
              (it.resolved === false ? '<span class="plus">+</span>' : '') +
              '<span class="nm">' + esc(it.label) + '</span>' +
              (it.hint ? '<span class="ht">' + esc(it.hint) + '</span>' : '') + '</div>';
    });
    pick.innerHTML = html; pick.style.display = 'block';
  }
  function closePick() { trig = null; items = []; pick.style.display = 'none'; }

  function refresh() {
    trig = findTrigger();
    if (!trig) { closePick(); return; }
    if (trig.kind === '[[') {
      const q = trig.query.toLowerCase().trim();
      const pages = (opts.pageItems ? opts.pageItems() : []);
      items = pages.filter(p => !q || p.label.toLowerCase().includes(q)).slice(0, 7)
                   .map(p => Object.assign({ section: 'Pages', resolved: true }, p));
    } else {
      const pool = opts.pool ? opts.pool() : { npcs: [], locations: [] };
      items = buildItems(trig.query, pool.npcs || [], pool.locations || []);
    }
    sel = 0; renderPick();
  }

  function insertChip(item) {
    if (!trig) return;
    const node = trig.node, from = trig.start;
    const sWin = doc.defaultView.getSelection();
    const to = sWin && sWin.rangeCount ? sWin.getRangeAt(0).startOffset : node.nodeValue.length;
    const range = doc.createRange();
    range.setStart(node, from); range.setEnd(node, Math.min(to, node.nodeValue.length));
    range.deleteContents();
    const chip = makeChip(doc, item);
    range.insertNode(chip);
    const space = doc.createTextNode('\u00a0');
    chip.after(space);
    const r2 = doc.createRange(); r2.setStartAfter(space); r2.collapse(true);
    sWin.removeAllRanges(); sWin.addRange(r2);
    if (item.resolved === false && item.type !== 'page' && opts.onNewEntity) opts.onNewEntity(item);
    closePick();
  }

  ed.addEventListener('input', refresh);
  ed.addEventListener('keyup', e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) >= 0) refresh(); });
  ed.addEventListener('keydown', e => {
    if (pick.style.display === 'none') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; renderPick(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; renderPick(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (items[sel]) insertChip(items[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); closePick(); }
  });
  pick.addEventListener('mousedown', e => {
    const it = e.target.closest('.mc-pick-item');
    if (!it) return;
    e.preventDefault();                                    // keep the editor's selection alive
    insertChip(items[Number(it.getAttribute('data-i'))]);
  });
  ed.addEventListener('blur', () => setTimeout(closePick, 150));
  ed.addEventListener('paste', e => {                      // plain text only
    e.preventDefault();
    const t = (e.clipboardData || doc.defaultView.clipboardData).getData('text/plain');
    doc.execCommand('insertText', false, t);
  });

  return {
    el: ed,
    getDoc:  () => serializeDoc(ed),
    getRefs: () => docToRefs(serializeDoc(ed)),
    isEmpty: () => !ed.textContent.trim() && !ed.querySelector('[data-mention-type],[data-pagelink]'),
    clear:   () => { ed.innerHTML = ''; closePick(); },
    focus:   () => ed.focus(),
  };
}

export { slug, mentionClass };
