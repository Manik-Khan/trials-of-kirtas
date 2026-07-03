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
  return {
    id: String(r.id),
    kind: seat === 'narrator' ? 'narrator' : 'entry',
    seat,
    // character name leads; the CLASS that old rows stored in meta.character
    // never displays. Hover reveals the player's alias.
    character: SEAT_CHARACTERS[seat] || m.character || r.actor_name || 'Narrator',
    player: PLAYER_ALIASES[seat] || r.actor_name || '',
    session: r.session == null ? 0 : r.session,
    sessionTitle: m.sessionTitle || null,
    location: m.location || null,
    fromJournal: m.fromJournal || null,
    sharedLate: written != null && !Number.isNaN(written) && created - written > DAY,
    at,
    html: r.body || '',
  }
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
