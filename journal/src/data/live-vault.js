// live-vault.js — the vault interface backed by Supabase.
// Same synchronous surface JournalView already speaks (pages/get/addPage/
// saveDoc/backlinksTo/…) over a local cache, with optimistic persistence:
// the UI flips first, the adapter call follows, failures log and mark.
//
// Keys: the UI and [[wikilinks]] use the SLUG (stable, portable across
// authors); the Supabase row uuid rides along as _rowId for writes.
// Edit rights are per page: canEdit(id) → page.author_id === uid.

import { extractRefs } from '../editor/MentionExtension.js'
import { extractPageLinks } from './vault.js'

const slug = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function makeLiveVault({ store, uid, characterName, rows, session, canWriteHere }) {
  const P = {}
  const folders = []
  const timers = {}
  const created = []

  const intake = r => {
    P[r.slug] = {
      id: r.slug,
      _rowId: r.id,
      author_id: r.author_id,
      folder: r.folder,
      title: r.title,
      html: r.html || '',
      json: r.doc || null,
      shared: !!r.shared_feed_id,
      created_at: r.created_at,
    }
    if (!folders.includes(r.folder)) folders.push(r.folder)
  }
  rows.forEach(intake)
  if (!folders.length) folders.push('Sessions')

  const persistDoc = id => {
    const p = P[id]
    if (!p || !p._rowId) return
    const refs = [
      ...extractRefs(p.json || {}).map(r => ({ kind: 'entity', type: r.type, id: r.id, label: r.label })),
      ...extractPageLinks(p.json || {}).map(l => ({ kind: 'page', id: l.pageId, label: l.label })),
    ]
    store.savePage(p._rowId, { doc: p.json, html: p.html })
      .then(() => store.replaceRefs(p._rowId, refs))
      .catch(e => console.error('[journal] save failed:', e))
  }

  return {
    character: characterName,
    live: true,

    folders: () => [...folders],
    pages: () => Object.values(P),
    pagesIn: f => Object.values(P).filter(p => p.folder === f),
    get: id => P[id] || null,
    has: id => !!P[id],
    canEdit: id => {
      const p = P[id]
      if (!p) return false
      return p.author_id ? p.author_id === uid : true // just-created local page
    },
    canWrite: () => !!canWriteHere, // may the viewer create pages in THIS journal

    createdStubs: () => created,

    addFolder(name) {
      const n = name.trim()
      if (!n || folders.includes(n)) return false
      folders.push(n)
      return true
    },

    addPage(folder, title) {
      const t = title.trim()
      if (!t) return null
      const id = slug(t)
      if (P[id]) return P[id]
      if (!folders.includes(folder)) folders.push(folder)
      P[id] = { id, _rowId: null, author_id: uid, folder, title: t, html: '', json: null }
      created.push(P[id])
      store.addPage(folder, t, session)
        .then(row => { if (row) { P[id]._rowId = row.id; P[id].created_at = row.created_at } })
        .catch(e => console.error('[journal] addPage failed:', e))
      return P[id]
    },

    saveDoc(id, { html, json }) {
      const p = P[id]
      if (!p) return
      p.html = html
      p.json = json
      clearTimeout(timers[id])                     // debounce, house 700ms
      timers[id] = setTimeout(() => persistDoc(id), 700)
    },

    movePage(id, folder) {
      const p = P[id]
      if (!p) return
      p.folder = folder
      if (!folders.includes(folder)) folders.push(folder)
      if (p._rowId) store.savePage(p._rowId, { doc: p.json, html: p.html, folder })
        .catch(e => console.error('[journal] move failed:', e))
    },

    backlinksTo(id) {
      return Object.values(P).filter(p =>
        p.id !== id && (
          p.json
            ? extractPageLinks(p.json).some(l => l.pageId === id)
            : (p.html || '').includes(`data-pagelink="${id}"`)
        ))
    },

    async share(id) {
      const p = P[id]
      if (!p || !p._rowId) return
      clearTimeout(timers[id])
      persistDoc(id)                               // flush before publishing
      const feedId = await store.shareToChronicle(
        { id: p._rowId, html: p.html, title: p.title, session, created_at: p.created_at },
        { characterName, session },
      )
      p.shared = !!feedId
    },
  }
}
