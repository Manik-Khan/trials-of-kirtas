// The vault — a character's journal as an Obsidian-style set of pages
// in sections. In-memory for the mock; real Phase 2.5 maps this to a
// `journal_pages` table (id, character_key, folder, title, doc, html).
//
// Two link systems coexist:
//   @mention   → world entities (NPCs / locations) — the shared graph
//   [[page]]   → this journal's own pages — the private graph

export const extractPageLinks = docJSON => {
  const out = []
  const walk = n => {
    if (!n) return
    if (n.type === 'pageLink' && n.attrs) out.push({ pageId: n.attrs.pageId, label: n.attrs.label })
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(docJSON)
  return out
}

export const extractOutline = docJSON => {
  const out = []
  const walk = n => {
    if (!n) return
    if (n.type === 'heading' && n.attrs) {
      const text = (n.content || []).map(c => c.text || '').join('')
      if (text) out.push({ level: n.attrs.level, text })
    }
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(docJSON)
  return out
}

const slug = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ── baked sample vault (Líadan's) ──
const P = {}
const mk = (folder, title, html) => {
  const id = slug(title)
  P[id] = { id, folder, title, html, json: null }
  return id
}

mk('Sessions', 'Session 12 — The Ambush', `
<h2>The road east</h2>
<p>We left <span data-mention-type="location" data-mention-key="tiersgard">@Tiersgard</span> at dawn. <span data-mention-type="npc" data-mention-key="darius">@Darius</span> warned us the toll road was watched — he was right.</p>
<blockquote><p>“Coin buys silence. Silence buys arrows.” — the toll keeper, moments before it all went wrong</p></blockquote>
<h2>What we learned</h2>
<ul><li><p>The ambushers carried no colors — hired, not sworn</p></li><li><p>One carried a ledger page pointing to the caravan (see <span data-pagelink="the-missing-caravan" data-pagelink-label="The Missing Caravan">The Missing Caravan</span>)</p></li></ul>
`.trim())

mk('Sessions', 'Session 13 — The Docks', `
<p>Back in <span data-mention-type="location" data-mention-key="tiersgard">@Tiersgard</span>. The harbormaster stalls; someone paid him to.</p>
<p><em>Threads to pull next session:</em> the ledger hand, the missing manifests.</p>
`.trim())

mk('Quests', 'The Missing Caravan', `
<h2>The trail</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Question the toll keeper</p></div></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Match the ledger hand (it's a Tiersgard clerk's)</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Find which warehouse took the cargo</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Ask <span data-mention-type="npc" data-mention-key="darius">@Darius</span> who insures the route</p></div></li></ul>
<p>The ambush (<span data-pagelink="session-12-the-ambush" data-pagelink-label="Session 12 — The Ambush">Session 12 — The Ambush</span>) was cover for the theft, not banditry.</p>
<div data-callout="warning"><p>If the clerk's hand matches the harbor ledgers, someone inside <span data-mention-type="location" data-mention-key="tiersgard">@Tiersgard</span>'s own offices set this up.</p></div>
`.trim())

mk('Musings', 'On Darius', `
<p><span data-mention-type="npc" data-mention-key="darius">@Darius</span> knows more than he sells. He gave us the toll road warning <strong>for free</strong> — nothing from him is free.</p>
<blockquote><p>Either he owes someone, or we are the payment.</p></blockquote>
`.trim())

const folders = ['Sessions', 'Quests', 'Musings']

export const vault = {
  character: 'Líadan Luchóg',
  folders: () => [...folders],
  pages: () => Object.values(P),
  pagesIn: f => Object.values(P).filter(p => p.folder === f)
    .sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9)),
  get: id => P[id] || null,
  has: id => !!P[id],

  renamePage(id, title) {
    const p = P[id]; const t = (title || '').trim()
    if (p && t) p.title = t                        // slug (id) stays — links hold
  },

  deletePage(id) { delete P[id] },

  reorder(folder, orderedIds) {
    orderedIds.forEach((id, i) => {
      const p = P[id]
      if (p) { p.folder = folder; p.sort_order = i }
    })
  },

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
    if (!folders.includes(folder)) this.addFolder(folder)
    P[id] = { id, folder, title: t, html: '', json: null }
    return P[id]
  },

  saveDoc(id, { html, json }) {
    const p = P[id]
    if (!p) return
    p.html = html
    p.json = json
  },

  movePage(id, folder) {
    const p = P[id]
    if (p) p.folder = folder
  },

  // pages whose doc links to `id` — the [[wikilink]] backlink query
  backlinksTo(id) {
    return Object.values(P).filter(p =>
      p.id !== id && (
        p.json
          ? extractPageLinks(p.json).some(l => l.pageId === id)
          : (p.html || '').includes(`data-pagelink="${id}"`)
      ))
  },
}
