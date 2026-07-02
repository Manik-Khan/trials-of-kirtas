/* ════════════════════════════════════════════════════════════════════
   JOURNAL-CAPTURE-V1 — journal field notes on the v11 sheet.

   Lives in the Notes tab (sheet-mount.js stamps a hidden
   [data-journal-block]; this module reveals + drives it). Three pieces:
     • quick capture  — mention-composer.js surface; save inserts a REAL
       journal_pages row (TipTap doc truth + html cache + refs graph +
       entity stubs for new names) — the page opens in the journal live.
     • your pages     — read-only list of YOUR pages on THIS seat
       (author = you AND character_key = key), rendered from the html
       cache; tooltips.js hover cards attach when present.
     • the doorway    — journal.html?character=<key>.

   Identity idiom (pinned lesson): wait for nav:ready — a one-shot
   window.__tok check is a latent race. Composer renders only when the
   seat is YOURS (profile.character_key === key); everyone else gets the
   list + doorway. Every supabase call checks {error}; .maybeSingle()
   for the single-row read. ONE client: window.__tok.sb.
   ════════════════════════════════════════════════════════════════════ */

import { createComposer, ensureCanon, buildPool, serializeDoc, docToHTML, docToRefs, slug } from './mention-composer.js';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* nav:ready idiom — resolve __tok whether nav.js already ran or not.   */
function whenTok(timeoutMs) {
  return new Promise((res, rej) => {
    const w = window;
    if (w.__tok && w.__tok.sb) { res(w.__tok); return; }
    let done = false;
    const ok = () => { if (!done && w.__tok && w.__tok.sb) { done = true; res(w.__tok); } };
    document.addEventListener('nav:ready', ok);           // nav.js dispatches on document
    const iv = setInterval(ok, 250);                        // belt & braces: nav versions predating the event
    setTimeout(() => {
      clearInterval(iv);
      if (!done) { done = true; rej(new Error('nav.js never became ready')); }
    }, timeoutMs || 15000);
  });
}

/* ── data ops (all over window.__tok.sb; every call checks {error}) ──*/
async function fetchSeatPages(sb, key) {
  const res = await sb.from('journal_pages')
    .select('id, author_id, character_key, folder, title, slug, html, session, shared_feed_id, created_at, updated_at')
    .eq('character_key', key)
    .order('updated_at', { ascending: false });
  if (res.error) throw new Error('journal pages: ' + res.error.message);
  return res.data || [];
}
async function fetchEntities(sb) {
  const res = await sb.from('entities').select('id, type, name, curated');
  if (res.error) throw new Error('entities: ' + res.error.message);
  return res.data || [];
}
async function currentSession(sb) {
  const res = await sb.from('campaign').select('current_session').maybeSingle();
  if (res.error) return null;                               // non-fatal: page just goes untagged
  return (res.data && res.data.current_session != null) ? res.data.current_session : null;
}
/* dup-slug: uniqueness is (author, seat, slug) — suffix against MY slugs */
export function freeSlug(title, mySlugs) {
  const base = slug(title) || 'note';
  if (!mySlugs.has(base)) return base;
  for (let i = 2; i < 200; i++) if (!mySlugs.has(base + '-' + i)) return base + '-' + i;
  return base + '-' + Date.now();
}
export async function insertPage(sb, row) {
  const res = await sb.from('journal_pages').insert(row).select().maybeSingle();
  if (res.error) throw new Error('save: ' + res.error.message);
  return res.data;
}
export async function insertRefs(sb, pageId, refs) {
  if (!refs.length) return;
  const rows = refs.map(r => ({
    page_id: pageId, kind: r.kind,
    ref_type: r.kind === 'entity' ? r.type : null,
    ref_id: r.id, label: r.label,
  }));
  const res = await sb.from('journal_refs').insert(rows);
  if (res.error) throw new Error('refs: ' + res.error.message);
}
/* mirrors supabase-adapter.js addEntity: a duplicate is fine (someone
   created it mid-session) — only real errors surface.                  */
async function addEntity(sb, item) {
  const res = await sb.from('entities').insert({ id: item.id, type: item.type, name: item.label });
  if (res.error && !/duplicate|unique/i.test(res.error.message)) {
    console.warn('[capture] entity stub:', res.error.message);
  }
}

/* ── render: the pages list ──────────────────────────────────────────*/
function fmtDate(ts) {
  try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch (_) { return ''; }
}
function renderList(listEl, pages) {
  if (!pages.length) {
    listEl.innerHTML = '<div class="jc-empty">No pages of yours on this seat yet.</div>';
    return;
  }
  listEl.innerHTML = pages.map(p =>
    '<div class="jc-page" data-page="' + esc(p.id) + '">' +
      '<div class="jc-page-row">' +
        '<span class="jc-chev">▸</span>' +
        '<span class="jc-page-t">' + esc(p.title) + '</span>' +
        '<span class="jc-folder">' + esc(p.folder || 'Unsorted') + '</span>' +
        (p.shared_feed_id ? '<span class="jc-shared">shared</span>' : '') +
        '<span class="jc-page-d">' + (p.session != null ? 'Session ' + esc(p.session) + ' · ' : '') + fmtDate(p.created_at) + '</span>' +
      '</div>' +
      '<div class="jc-page-body">' + (p.html || '<p class="jc-empty">(empty page)</p>') +
        '<div class="ro">read-only here <span>·</span> <a data-jc-edit href="#">edit in the Journal →</a></div>' +
      '</div>' +
    '</div>'
  ).join('');
}

/* ── mount ───────────────────────────────────────────────────────────*/
export async function mountJournalCapture(sheetRoot, key) {
  const block = sheetRoot.querySelector('[data-journal-block]');
  if (!block) return;                                       // host without the block (older template) — no-op

  let tok;
  try { tok = await whenTok(15000); }
  catch (e) { console.warn('[capture]', e.message); return; }   // sheet still works; journal block stays hidden
  const sb = tok.sb;
  let profile = null;
  try { profile = await tok.ready; } catch (_) {}
  const uid = tok.session && tok.session.user && tok.session.user.id;
  if (!uid) return;                                         // not signed in — leave hidden
  // nav.js profile shape is camelCase (characterKey) — see nav.js ~line 879.
  // Tolerate snake_case too in case the shape is ever normalized.
  const seatKey = profile ? (profile.characterKey !== undefined ? profile.characterKey : profile.character_key) : null;
  const mySeat = seatKey != null && seatKey === key;

  const doorEl = block.querySelector('[data-journal-door]');
  if (doorEl) doorEl.href = 'journal.html?character=' + encodeURIComponent(key);

  const capHost = block.querySelector('[data-jc-capture]');
  const listEl  = block.querySelector('[data-jc-list]');
  const labEl   = block.querySelector('[data-jc-list-lab]');

  /* load state (parallel; canon self-heals tooltips.js) */
  let pages = [], entities = [], canon = { npcs: {}, locations: {} }, session = null;
  try {
    const r = await Promise.all([
      fetchSeatPages(sb, key), fetchEntities(sb), ensureCanon(document), currentSession(sb),
    ]);
    pages = r[0]; entities = r[1]; canon = r[2] || canon; session = r[3];
  } catch (e) {
    console.warn('[capture] load:', e.message);
    block.style.display = '';                               // still reveal: doorway works even if lists don't
    if (listEl) listEl.innerHTML = '<div class="jc-empty">Couldn\u2019t load the journal \u2014 ' + esc(e.message) + '</div>';
    return;
  }

  const mine = pages.filter(p => p.author_id === uid);
  if (labEl) labEl.textContent = 'Your pages';
  renderList(listEl, mine);
  if (typeof window.attachTooltips === 'function') { try { window.attachTooltips(listEl); } catch (_) {} }

  /* expand/collapse + edit-in-journal links */
  listEl.addEventListener('click', e => {
    const edit = e.target.closest('[data-jc-edit]');
    if (edit) { e.preventDefault(); window.location.href = 'journal.html?character=' + encodeURIComponent(key); return; }
    const row = e.target.closest('.jc-page-row');
    if (!row) return;
    const pg = row.parentElement;
    pg.classList.toggle('open');
    row.querySelector('.jc-chev').textContent = pg.classList.contains('open') ? '▾' : '▸';
  });

  /* the composer — your own seat only */
  const pool = buildPool(canon, entities);
  if (mySeat && capHost) {
    const mySlugs = new Set(mine.map(p => p.slug));
    capHost.innerHTML =
      '<div class="jc-cap-lab">New entry <span class="sub">· vault → \u201cField Notes\u201d' +
        (session != null ? ', session ' + esc(session) : '') + '</span></div>' +
      '<input class="jc-title" type="text" maxlength="120" placeholder="Title \u2014 e.g. The Sable Gate, first watch">' +
      '<div class="jc-editor-host"></div>' +
      '<div class="jc-foot">' +
        '<span class="jc-hint">Yours alone until you share it from the Journal. @ and [[ link the world.</span>' +
        '<span class="jc-status" data-jc-status></span>' +
        '<button class="jc-btn" type="button" data-jc-save>Add to journal</button>' +
      '</div>';
    const titleEl  = capHost.querySelector('.jc-title');
    const statusEl = capHost.querySelector('[data-jc-status]');
    const saveBtn  = capHost.querySelector('[data-jc-save]');
    const newEntities = [];                                  // unresolved @ picks, persisted on save
    const composer = createComposer(capHost.querySelector('.jc-editor-host'), {
      placeholder: 'What happened \u2014 @ a name, [[ a page\u2026',
      pool: () => pool,
      pageItems: () => pages.map(p => ({ id: p.slug, type: 'page', label: p.title, hint: p.folder })),
      onNewEntity: it => { newEntities.push({ id: it.id, type: it.type, label: it.label }); },
    });

    saveBtn.addEventListener('click', async () => {
      const title = titleEl.value.trim();
      if (!title) { statusEl.textContent = 'a title first'; titleEl.focus(); return; }
      if (composer.isEmpty()) { statusEl.textContent = 'nothing to save yet'; composer.focus(); return; }
      saveBtn.disabled = true; statusEl.textContent = 'saving\u2026';
      try {
        const doc  = composer.getDoc();
        const html = docToHTML(doc);
        const refs = docToRefs(doc);
        const row = await insertPage(sb, {
          author_id: uid, character_key: key, folder: 'Field Notes',
          title: title, slug: freeSlug(title, mySlugs),
          doc: doc, html: html, session: session,
        });
        await insertRefs(sb, row.id, refs);
        for (const it of newEntities.splice(0)) await addEntity(sb, it);
        mySlugs.add(row.slug);
        pages.unshift(row); mine.unshift(row);
        renderList(listEl, mine);
        if (typeof window.attachTooltips === 'function') { try { window.attachTooltips(listEl); } catch (_) {} }
        titleEl.value = ''; composer.clear();
        statusEl.textContent = 'saved to the journal \u2713';
        setTimeout(() => { if (statusEl.textContent.indexOf('saved') === 0) statusEl.textContent = ''; }, 3500);
      } catch (e) {
        statusEl.textContent = e.message || 'save failed';
      } finally {
        saveBtn.disabled = false;
      }
    });
  } else if (capHost) {
    capHost.innerHTML = '<div class="jc-empty">Field notes are written from your own sheet \u2014 the full journal is through the doorway above.</div>';
  }

  block.style.display = '';                                  // reveal (tab visibility still owned by wireSheetTabs)
}

if (typeof window !== 'undefined') window.mountJournalCapture = mountJournalCapture;
