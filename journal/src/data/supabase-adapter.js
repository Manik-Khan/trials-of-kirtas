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
        .select('id, author_id, folder, title, slug, doc, html, session, shared_feed_id, sort_order, created_at, updated_at')
      q = characterKey === null
        ? q.is('character_key', null)              // the Narrator's journal
        : q.eq('character_key', characterKey)
      const res = await q
        .order('folder')
        .order('sort_order', { nullsFirst: false })
        .order('created_at')
      if (res.error) throw new Error(`loadPages: ${res.error.message}`)
      return res.data || []
    },

    // Rename is TITLE-ONLY by design: the slug is the [[wikilink]] target —
    // re-slugging (savePage's title path does) would orphan every backlink.
    async renamePage(id, title) {
      const res = await sb.from('journal_pages')
        .update({ title: title.trim() }).eq('id', id).select('id').maybeSingle()
      if (res.error) throw new Error(`renamePage: ${res.error.message}`)
      return res.data
    },

    // Contiguous 0..n within a folder; own pages only (author-only RLS).
    async reorderPages(updates /* [{id, folder, sort_order}] */) {
      const results = await Promise.all(updates.map(u =>
        sb.from('journal_pages')
          .update({ folder: u.folder, sort_order: u.sort_order })
          .eq('id', u.id)))
      const bad = results.find(r => r.error)
      if (bad) throw new Error(`reorderPages: ${bad.error.message}`)
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
      const [res, al] = await Promise.all([
        sb.from('entities').select('id, type, name, curated'),
        sb.from('entity_aliases').select('type, alias_id, canonical_id'),
      ])
      if (res.error) throw new Error(`loadEntities: ${res.error.message}`)
      const rows = res.data || []
      // typo → canon map written by merge_entity; consulted at typing time so
      // a merged-away key resolves to canon instead of re-seeding the stub
      const aliases = {}
      for (const a of (al.error ? [] : al.data || [])) {
        aliases[`${a.type}:${a.alias_id}`] = a.canonical_id
      }
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
        aliases,
      }
    },

    // ── comments (journal_comments): rows ABOUT a page, never writes TO it ──
    async loadComments(pageId) {
      const res = await sb.from('journal_comments')
        .select('id, page_id, author_id, seat, body_html, quote, prefix, suffix, status, created_at')
        .eq('page_id', pageId)
        .eq('status', 'open')
        .order('created_at')
      if (res.error) throw new Error(`loadComments: ${res.error.message}`)
      return res.data || []
    },

    async addComment({ page_id, seat, body_html, quote, prefix, suffix }) {
      const res = await sb.from('journal_comments')
        .insert({ page_id, author_id: uid, seat, body_html, quote, prefix, suffix })
        .select()
        .maybeSingle()
      if (res.error) throw new Error(`addComment: ${res.error.message}`)
      return res.data
    },

    // status flips are the page owner's verbs (accept / dismiss); the words
    // themselves are trigger-guarded server-side — only the author edits them.
    async setCommentStatus(id, status) {
      const res = await sb.from('journal_comments')
        .update({ status }).eq('id', id).select('id').maybeSingle()
      if (res.error) throw new Error(`setCommentStatus: ${res.error.message}`)
      return res.data
    },

    async deleteComment(id) {
      const res = await sb.from('journal_comments').delete().eq('id', id)
      if (res.error) throw new Error(`deleteComment: ${res.error.message}`)
    },

    // ── seat accents: colors are NEVER stored in content — content stores the
    // seat key; paint resolves through this map at render time. Change the
    // accent → every chip/underline/dot ever made repaints. ──
    async loadSeatAccents() {
      const res = await sb.from('profiles').select('character_key, role, appearance')
      if (res.error) return {}                    // non-fatal: fallback palette
      const map = {}
      for (const p of res.data || []) {
        const accent = p.appearance && p.appearance.accent
        if (!accent) continue
        if (p.character_key) map[p.character_key] = accent
        if (p.role === 'overseer' || p.role === 'dm') map.narrator = accent
      }
      return map
    },

    // Replace-not-merge RPC: send the FULL merged appearance.
    async saveMyAccent(hex) {
      const cur = await sb.from('profiles').select('appearance')
        .eq('user_id', uid).maybeSingle()
      if (cur.error) throw new Error(`saveMyAccent/read: ${cur.error.message}`)
      const merged = Object.assign({}, (cur.data && cur.data.appearance) || {}, { accent: hex })
      const res = await sb.rpc('set_my_appearance', { p_appearance: merged })
      if (res.error) throw new Error(`saveMyAccent: ${res.error.message}`)
      return merged
    },

    // ── the reading look: ink + paper, per-reader (pinned decision) ──
    // Stored as KEYS ({ ink:'sumi', paper:'bone' }) in the same appearance
    // jsonb, resolved to hexes at render by shelfTheme.js. Same replace-
    // not-merge discipline: read the full object, patch, send it whole.
    async loadMyAppearance() {
      const res = await sb.from('profiles').select('appearance')
        .eq('user_id', uid).maybeSingle()
      if (res.error) return {}                    // non-fatal: default look
      return (res.data && res.data.appearance) || {}
    },

    async saveMyLook(patch /* { ink? , paper? } */) {
      const cur = await sb.from('profiles').select('appearance')
        .eq('user_id', uid).maybeSingle()
      if (cur.error) throw new Error(`saveMyLook/read: ${cur.error.message}`)
      const merged = Object.assign({}, (cur.data && cur.data.appearance) || {}, patch)
      const res = await sb.rpc('set_my_appearance', { p_appearance: merged })
      if (res.error) throw new Error(`saveMyLook: ${res.error.message}`)
      return merged
    },

    // ── open-comment counts for the tree badges (boot-time snapshot) ──
    async loadOpenCommentCounts() {
      const res = await sb.from('journal_comments')
        .select('page_id').eq('status', 'open')
      if (res.error) return {}                    // non-fatal: badges just hide
      const map = {}
      for (const r of res.data || []) map[r.page_id] = (map[r.page_id] || 0) + 1
      return map
    },

    // ── the book: the chronicle feed as a reading layer ──
    async loadChronicleBook() {
      const res = await sb.from('feed')
        .select('id, channel, kind, actor_key, actor_name, body, session, meta, hidden, created_at')
        .eq('channel', 'chronicle')
        .order('created_at')
      if (res.error) throw new Error(`loadChronicleBook: ${res.error.message}`)
      return res.data || []
    },

    // combat rows + encounter names, so the book can weave each fight in at
    // the moment it happened. Encounter load is non-fatal (fights fall back to
    // a generic "Combat" title). `result` carries the round markers.
    async loadChronicleCombat() {
      const [rowsRes, encRes] = await Promise.all([
        sb.from('feed')
          .select('id, channel, kind, actor_key, actor_name, body, result, session, encounter_id, hidden, created_at')
          .eq('channel', 'combat')
          .order('created_at'),
        sb.from('encounters').select('id, name'),
      ])
      if (rowsRes.error) throw new Error(`loadChronicleCombat: ${rowsRes.error.message}`)
      const encounters = {}
      if (!encRes.error) (encRes.data || []).forEach(e => { encounters[e.id] = e.name || null })
      return { rows: rowsRes.data || [], encounters }
    },

    // canonical per-session titles (session_titles table). Read-all;
    // non-fatal on error — the book falls back to row meta.
    async loadSessionTitles() {
      const res = await sb.from('session_titles').select('session, title')
      if (res.error) return {}
      const map = {}
      for (const r of res.data || []) map[r.session] = r.title
      return map
    },

    // staff-only write (RLS-enforced). Empty title deletes the canonical row
    // so the session falls back to row meta / plain number. Lesson 1 applies:
    // a blocked write matches 0 rows and raises NO error — count the rows.
    async saveSessionTitle(session, title) {
      const t = String(title || '').trim()
      if (!t) {
        const res = await sb.from('session_titles').delete().eq('session', session).select('session')
        if (res.error) throw new Error(`saveSessionTitle: ${res.error.message}`)
        return null
      }
      const res = await sb.from('session_titles')
        .upsert({ session, title: t, updated_at: new Date().toISOString() }, { onConflict: 'session' })
        .select('session')
      if (res.error) throw new Error(`saveSessionTitle: ${res.error.message}`)
      if (!res.data || res.data.length === 0) throw new Error('saveSessionTitle: write blocked (staff only)')
      return t
    },

    // ── curation (staff) ──
    async loadCurationQueue() {
      const res = await sb.from('entities')
        .select('id, type, name, descr, created_by, created_at')
        .eq('curated', false)
        .order('created_at')
      if (res.error) throw new Error(`loadCurationQueue: ${res.error.message}`)
      return res.data || []
    },

    // rewrite footprint for the merge preview: pages / refs / chat counts
    async entityFootprint(type, id) {
      const [refs, feed] = await Promise.all([
        sb.from('journal_refs').select('page_id', { count: 'exact', head: true })
          .eq('kind', 'entity').eq('ref_type', type).eq('ref_id', id),
        sb.from('feed').select('id', { count: 'exact', head: true })
          .like('body', `%data-mention-key="${id}"%`),
      ])
      return {
        refs: refs.error ? 0 : (refs.count ?? 0),
        feed: feed.error ? 0 : (feed.count ?? 0),
      }
    },

    async updateEntity(type, id, { name, descr }) {
      const res = await sb.from('entities')
        .update({ name, descr }).eq('type', type).eq('id', id).select('id').maybeSingle()
      if (res.error) throw new Error(`updateEntity: ${res.error.message}`)
      return res.data
    },

    async discardEntity(type, id) {
      const res = await sb.from('entities').delete().eq('type', type).eq('id', id)
      if (res.error) throw new Error(`discardEntity: ${res.error.message}`)
    },

    // Both RPCs are SECURITY DEFINER + is_staff()-gated server-side; they are
    // called from the browser with the user's token (never the service key —
    // service role has no auth.uid(), the gate would fail by design).
    async canonizeEntity(type, id) {
      const res = await sb.rpc('canonize_entity', { p_type: type, p_id: id })
      if (res.error) throw new Error(`canonize_entity: ${res.error.message}`)
      return res.data                              // { pages, feed }
    },

    async mergeEntity(type, oldId, canonId, canonLabel, fixFeed) {
      const res = await sb.rpc('merge_entity', {
        p_type: type, p_old: oldId, p_canon: canonId,
        p_canon_label: canonLabel, p_fix_feed: !!fixFeed,
      })
      if (res.error) throw new Error(`merge_entity: ${res.error.message}`)
      return res.data                              // { pages, refs, feed }
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

    // ── live: stream chronicle-channel changes so the book updates at the table ──
    // Mirrors chronicle.html's proven realtime path (no setAuth needed — non-hidden
    // chronicle rows read for every authenticated user; hidden rows correctly do not
    // stream to players). Returns an unsubscribe. DELETE is left unfiltered and matched
    // by id (Supabase can't filter deletes on a non-PK column reliably); a delete of a
    // row not in the book is simply a no-op.
    subscribeChronicle({ onInsert, onUpdate, onCombatInsert, onCombatUpdate, onDelete }) {
      const ch = sb.channel('journal-chronicle-live')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'feed', filter: 'channel=eq.chronicle' },
          ({ new: row }) => { if (row && onInsert) onInsert(row) })
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'feed', filter: 'channel=eq.chronicle' },
          ({ new: row }) => { if (row && onUpdate) onUpdate(row) })
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'feed', filter: 'channel=eq.combat' },
          ({ new: row }) => { if (row && onCombatInsert) onCombatInsert(row) })
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'feed', filter: 'channel=eq.combat' },
          ({ new: row }) => { if (row && onCombatUpdate) onCombatUpdate(row) })
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'feed' },
          ({ old }) => { if (old && old.id != null && onDelete) onDelete(old.id) })
        .subscribe()
      return () => { try { sb.removeChannel(ch) } catch (e) { /* already gone */ } }
    },
  }
}
