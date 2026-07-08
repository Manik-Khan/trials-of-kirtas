// bookModel.js — the book's PURE model: feed rows → chapters. No imports,
// no DOM, headlessly testable (the match.js discipline).
//
// The feed is one live stream; the book is a READING LAYER over it — this
// module is that layer's whole brain:
//   • chapters = sessions (session 0 renders as the Prologue)
//   • chapter title = the first meta.sessionTitle a session's rows carry
//   • the Narrator = actor_key 'dm' (the golden box, not an accent card)
//   • provenance: meta.fromJournal → the 📄 badge; meta.written_at → the
//     entry is PLACED at its written-at time (the "proper time" design),
//     and earns the ⏱ badge when it was shared more than a day after
//   • hidden rows never render; order inside a chapter is by placement time

const DAY = 24 * 60 * 60 * 1000

// The five seats. Old drawer rows carry the CLASS in meta.character
// ('Fighter', 'Bard'…) — display the character, hover the player.
// TODO(multi-campaign): read these from profiles instead of the map.
const SEAT_CHARACTERS = {
  cosmere: 'Cosmere Runestar',
  liadan: 'Líadan Luchóg',
  caim: 'Caim',
  vesperian: 'Vesperian Vale',
  narrator: 'Narrator',
}
const PLAYER_ALIASES = {
  cosmere: 'ianakira',
  liadan: 'nazanroseaktas',
  caim: 'jayvanmidde',
  vesperian: 'thebraveruby',
  narrator: 'hagakuredisc',
}

export function rowToBookEntry(r) {
  const m = r.meta || {}
  const created = Date.parse(r.created_at)
  const written = m.written_at ? Date.parse(m.written_at) : null
  const at = written != null && !Number.isNaN(written) ? written : created
  const seat = r.actor_key === 'dm' ? 'narrator' : (r.actor_key || 'narrator')
  const section = typeof m.section === 'string' && m.section.trim() ? m.section.trim() : null
  return {
    id: String(r.id),
    kind: section ? 'section' : (seat === 'narrator' ? 'narrator' : 'entry'),
    seat,
    // character name leads; the CLASS that old rows stored in meta.character
    // never displays. Hover reveals the player's alias.
    character: SEAT_CHARACTERS[seat] || m.character || r.actor_name || 'Narrator',
    player: PLAYER_ALIASES[seat] || r.actor_name || '',
    session: r.session == null ? 0 : r.session,
    sessionTitle: m.sessionTitle || null,
    section,                                          // a DM-posted sub-heading ("The Parlay")
    location: m.location || null,
    fromJournal: m.fromJournal || null,
    // facet fuel: #tags (feed.tags column) + NPC/location @mentions parsed from the body
    tags: Array.isArray(r.tags) ? r.tags : (Array.isArray(m.tags) ? m.tags : []),
    mentions: extractMentions(r.body || ''),
    sharedLate: written != null && !Number.isNaN(written) && created - written > DAY,
    at,
    html: r.body || '',
  }
}

// pull @mention keys out of stored body HTML (the chronicle writes
// data-mention-type / data-mention-key spans). Pure string work — no DOM.
function extractMentions(html) {
  const out = []
  const re = /data-mention-type="([^"]+)"\s+data-mention-key="([^"]+)"/g
  let mm
  while ((mm = re.exec(html))) out.push({ type: mm[1], key: mm[2] })
  return out
}

export function buildBook(rows) {
  const bySession = new Map()
  for (const r of rows || []) {
    if (r.hidden) continue
    if (r.channel && r.channel !== 'chronicle') continue
    const e = rowToBookEntry(r)
    if (!bySession.has(e.session)) bySession.set(e.session, [])
    bySession.get(e.session).push(e)
  }
  // Chapters read freshest-first — the current session opens the book and
  // the Prologue closes it. WITHIN a chapter, entries stay in narrative
  // order (oldest → newest): a chapter is a story, not a feed.
  const chapters = [...bySession.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([session, entries]) => {
      entries.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
      const titled = entries.find(e => e.sessionTitle)
      const first = entries[0]
      return {
        session,
        title: session === 0
          ? (titled ? titled.sessionTitle : 'Prologue')
          : (titled ? titled.sessionTitle : ''),
        date: first ? new Date(first.at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : '',
        entries,
      }
    })
  return chapters
}

// ── combat → fights, grouped by round ──────────────────────────────────────
// Combat rows live in the same feed (channel:'combat'). Rolls carry no round
// of their own; the ROUND signal comes from the 'turn'/'combat_start' events
// logEvent writes ({ result:{ type:'turn', round:N } }) — non-hidden, so players
// see them. We walk each encounter's stream in time order, track the current
// round, and bucket the roll rows under it. Pure + headless (match.js discipline).
const PARTY_SEATS = new Set(['cosmere', 'liadan', 'caim', 'vesperian'])
function rollSide(actorKey) {
  if (!actorKey) return 'dm'
  return PARTY_SEATS.has(actorKey) ? 'party' : 'enemy'
}

export function buildFights(combatRows, encounters) {
  const enc = encounters || {}
  const byEnc = new Map()                            // session::encounter → rows
  for (const r of combatRows || []) {
    if (r.hidden) continue                            // player view never sees hidden replay rows
    if (r.channel && r.channel !== 'combat') continue
    const session = r.session == null ? 0 : r.session
    const key = session + '::' + (r.encounter_id || 'none')
    if (!byEnc.has(key)) byEnc.set(key, [])
    byEnc.get(key).push(r)
  }
  const fights = []
  for (const [key, rows] of byEnc.entries()) {
    rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || (a.id < b.id ? -1 : 1))
    const session = rows[0].session == null ? 0 : rows[0].session
    const encId = rows[0].encounter_id || null
    const rounds = new Map()                           // round → [roll]
    let curRound = 1
    for (const r of rows) {
      const res = r.result || {}
      if (r.kind === 'event') {
        if ((res.type === 'turn' || res.type === 'combat_start') && res.round != null) curRound = res.round
        continue                                        // events delineate rounds; they aren't rolls
      }
      if (!rounds.has(curRound)) rounds.set(curRound, [])
      rounds.get(curRound).push({
        id: String(r.id),
        seat: r.actor_key || null,
        name: r.actor_name || '?',
        side: rollSide(r.actor_key),
        body: r.body || '',
        at: Date.parse(r.created_at),
      })
    }
    const roundList = [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([round, rolls]) => ({ round, rolls }))
    const rollCount = roundList.reduce((n, r) => n + r.rolls.length, 0)
    if (rollCount === 0) continue                       // nothing visible to show
    fights.push({
      id: encId || key,
      session,
      encounter: (encId && enc[encId]) || 'Combat',
      startAt: Date.parse(rows[0].created_at),
      rounds: roundList,
      rollCount,
      roundCount: roundList.length,
    })
  }
  return fights
}

// group fights by session for the reader (chapter → its fights)
export function fightsBySession(fights) {
  const m = {}
  for (const f of fights || []) (m[f.session] = m[f.session] || []).push(f)
  return m
}

// ── the Index: pure faceting + filtering over book entries ─────────────────
function stripHtml(s) { return String(s || '').replace(/<[^>]*>/g, ' ') }

export function facetCounts(entries) {
  const authors = {}, tags = {}, npcs = {}
  for (const e of entries || []) {
    if (e.kind === 'section') continue
    if (e.seat) authors[e.seat] = (authors[e.seat] || 0) + 1
    for (const t of e.tags || []) tags[t] = (tags[t] || 0) + 1
    for (const mn of e.mentions || []) if (mn.type === 'npc') npcs[mn.key] = (npcs[mn.key] || 0) + 1
  }
  return { authors, tags, npcs }
}

export function entryMatches(e, s) {
  if (!e || e.kind === 'section') return false
  s = s || {}
  if (s.author && e.seat !== s.author) return false
  const tk = Object.keys(s.tags || {})
  if (tk.length && !tk.every(t => (e.tags || []).includes(t))) return false
  const nk = Object.keys(s.npcs || {})
  if (nk.length && !nk.every(k => (e.mentions || []).some(mn => mn.type === 'npc' && mn.key === k))) return false
  if (s.q) {
    const hay = (String(e.character || '') + ' ' + stripHtml(e.html)).toLowerCase()
    if (!hay.includes(String(s.q).toLowerCase())) return false
  }
  return true
}

export function indexActive(s) {
  s = s || {}
  return !!(s.author || (s.q && s.q.trim()) || Object.keys(s.tags || {}).length || Object.keys(s.npcs || {}).length)
}

export function filterBookEntries(entries, s) {
  if (!indexActive(s)) return []
  return (entries || []).filter(e => entryMatches(e, s))
}
