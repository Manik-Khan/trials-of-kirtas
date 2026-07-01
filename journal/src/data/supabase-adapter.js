// supabase-adapter.js — the real persistence layer.
// Same shape as the in-memory stores (vault / entityStore), backed by the
// shared client at window.__tok.sb (NEVER construct a second client).
//
// House gotchas honored throughout:
//   • .select()/.rpc()/.insert() return { data, error } — they do NOT throw;
//     every call checks res.error.
//   • .maybeSingle() for maybe-there lookups (never .single()'s 406).
//   • profiles keys on user_id = auth.uid(), not id.
//   • No writes to the characters table (its live-only policy stays untouched).
//
// Injected deps (testable headlessly with a stub):
//   makeJournalStore({ sb, uid, characterKey })

const slug = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function makeJournalStore({ sb, uid, characterKey }) {
  return {
    // ── vault (journal_pages) ──
    // A character's journal is EVERY page written for that seat (party-
    // readable; multiple players may have held the seat over time).
    // Edit rights are per page: author_id === uid.
    async loadPages() {
      let q = sb.from('journal_pages')
        .select('id, author_id, folder, title, slug, doc, html, session, shared_feed_id, created_at, updated_at')
      q = characterKey === null
        ? q.is('character_key', null)              // the Narrator's journal
        : q.eq('character_key', characterKey)
      const res = await q.order('folder')
      if (res.error) throw new Error(`loadPages: ${res.error.message}`)
      return res.data || []
    },

    async getCurrentSession() {
      const res = await sb.from('campaign').select('current_session').maybeSingle()
      if (res.error) return null                   // non-fatal — session tag is best-effort
      return res.data?.current_session ?? null
    },

    async addPage(folder, title, session) {
      const res = await sb.from('journal_pages')
        .insert({
          author_id: uid,
          character_key: characterKey,
          folder,
          title: title.trim(),
          slug: slug(title),
          session: session ?? null,
        })
        .select()
        .maybeSingle()
      if (res.error) throw new Error(`addPage: ${res.error.message}`)
      return res.data
    },

    async savePage(id, { doc, html, title, folder }) {
      const patch = { doc, html }
      if (title !== undefined) { patch.title = title.trim(); patch.slug = slug(title) }
      if (folder !== undefined) patch.folder = folder
      const res = await sb.from('journal_pages').update(patch).eq('id', id).select().maybeSingle()
      if (res.error) throw new Error(`savePage: ${res.error.message}`)
      return res.data
    },

    async deletePage(id) {
      const res = await sb.from('journal_pages').delete().eq('id', id)
      if (res.error) throw new Error(`deletePage: ${res.error.message}`)
    },

    // ── the graph (journal_refs) — rebuilt wholesale on each save ──
    async replaceRefs(pageId, refs) {
      const del = await sb.from('journal_refs').delete().eq('page_id', pageId)
      if (del.error) throw new Error(`replaceRefs/delete: ${del.error.message}`)
      if (!refs.length) return
      const rows = refs.map(r => ({
        page_id: pageId,
        kind: r.kind,                              // 'entity' | 'page'
        ref_type: r.kind === 'entity' ? r.type : null,
        ref_id: r.id,
        label: r.label,
      }))
      const ins = await sb.from('journal_refs').insert(rows)
      if (ins.error) throw new Error(`replaceRefs/insert: ${ins.error.message}`)
    },

    async backlinksTo(kind, refId) {
      const res = await sb.from('journal_refs')
        .select('page_id, label, journal_pages ( id, title, folder, character_key )')
        .eq('kind', kind)
        .eq('ref_id', refId)
      if (res.error) throw new Error(`backlinksTo: ${res.error.message}`)
      return (res.data || []).map(r => r.journal_pages).filter(Boolean)
    },

    // ── entities (the shared world pool) ──
    // Canon comes from tooltips.js globals when the page loads them;
    // play-created rows merge on top. Callers pass the canon arrays in.
    async loadEntities({ canonNPCs = [], canonLocations = [] } = {}) {
      const res = await sb.from('entities').select('id, type, name, curated')
      if (res.error) throw new Error(`loadEntities: ${res.error.message}`)
      const rows = res.data || []
      const merge = (canon, type) => {
        const seen = new Set(canon.map(e => e.id))
        return [
          ...canon.map(e => ({ ...e, origin: 'canon' })),
          ...rows.filter(r => r.type === type && !seen.has(r.id))
            .map(r => ({ id: r.id, label: r.name, type, hint: r.curated ? '' : 'new — from the journal', origin: 'journal' })),
        ]
      }
      return {
        npcs: merge(canonNPCs, 'npc'),
        locations: merge(canonLocations, 'location'),
      }
    },

    async addEntity({ id, type, label }) {
      const res = await sb.from('entities')
        .insert({ id, type, name: label })
        .select()
        .maybeSingle()
      // unique violation = someone created it mid-session — that's fine
      if (res.error && !/duplicate|unique/i.test(res.error.message)) {
        throw new Error(`addEntity: ${res.error.message}`)
      }
      return res.data
    },

    // ── publication: Share to Chronicle (a feed insert; RLS already live) ──
    async shareToChronicle(page, { characterName, session }) {
      const ins = await sb.from('feed')
        .insert({
          channel: 'chronicle',
          kind: 'message',
          actor_key: characterKey,
          actor_name: characterName,
          body: page.html || '',
          session: session ?? page.session ?? null,
          meta: {
            character: characterName,
            fromJournal: page.title,
            journal_page_id: page.id,
            written_at: page.created_at || null,   // "placed at the proper time"
          },
        })
        .select('id')
        .maybeSingle()
      if (ins.error) throw new Error(`shareToChronicle: ${ins.error.message}`)
      const mark = await sb.from('journal_pages')
        .update({ shared_feed_id: ins.data?.id ?? null })
        .eq('id', page.id)
      if (mark.error) throw new Error(`shareToChronicle/mark: ${mark.error.message}`)
      return ins.data?.id ?? null
    },
  }
}
