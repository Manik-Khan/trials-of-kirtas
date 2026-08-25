// smoke-book.mjs — the book model: feed rows → chapters. Pure, no DOM.
import { buildBook, rowToBookEntry, facetCounts, entryMatches } from './src/data/bookModel.js'
import { buildQuestStarts, chaptersWithQuestSessions, mergeStoryTimeline, questCaptureEnabled, questTitle, questStartsBySession } from './src/data/questModel.js'
let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
const R = (o) => ({ channel: 'chronicle', kind: 'message', hidden: false, meta: {}, ...o })

const rows = [
  R({ id: 1, actor_key: 'dm', actor_name: 'Mortain', session: 4, body: '<p>scene</p>',
      created_at: '2026-07-01T19:00:00Z', meta: { sessionTitle: 'The Fort Siege' } }),
  R({ id: 2, actor_key: 'vesperian', actor_name: 'thebraveruby', session: 4, body: '<p>we fought</p>',
      created_at: '2026-07-01T19:30:00Z', meta: { character: 'Vesperian Vale' } }),
  R({ id: 3, actor_key: 'liadan', actor_name: 'nazanroseaktas', session: 4, body: '<p>my page</p>',
      created_at: '2026-07-03T09:00:00Z',
      meta: { character: 'Líadan Luchóg', fromJournal: 'Session 4 — notes', written_at: '2026-07-01T19:15:00Z' } }),
  R({ id: 4, actor_key: 'caim', actor_name: 'jayvanmidde', session: 3, body: '<p>earlier</p>',
      created_at: '2026-06-20T19:00:00Z', meta: { character: 'Caim' } }),
  R({ id: 5, actor_key: 'dm', session: 4, body: '<p>ghost</p>', hidden: true, created_at: '2026-07-01T20:00:00Z' }),
  R({ id: 6, actor_key: 'dm', session: 0, body: '<p>before it all</p>', created_at: '2026-05-01T12:00:00Z' }),
  R({ id: 7, actor_key: 'cosmere', channel: 'combat', session: 4, body: '<p>combat noise</p>', created_at: '2026-07-01T19:10:00Z' }),
]
const book = buildBook(rows)

console.log('smoke-book')
t('chapters read freshest-first; the Prologue closes the book', book.map(c => c.session).join(',') === '4,3,0')
t('session 0 titles as Prologue', book[2].title === 'Prologue')
t('chapter title from the first sessionTitle', book[0].title === 'The Fort Siege')
t('hidden rows never render', !book[0].entries.some(e => e.id === '5'))
t('non-chronicle channels excluded', !book[0].entries.some(e => e.id === '7'))
t('dm rows are the Narrator (golden box kind)', book[0].entries[0].kind === 'narrator' && book[0].entries[0].seat === 'narrator')
t('character rows carry seat + both identities',
  (() => { const e = book[0].entries.find(x => x.id === '2'); return e.kind === 'entry' && e.seat === 'vesperian' && e.character === 'Vesperian Vale' && e.player === 'thebraveruby' })())
t('written_at PLACES the late share at its proper time (between 19:00 and 19:30)',
  book[0].entries.map(e => e.id).join(',') === '1,3,2')
t('late share earns the badge; on-time entries do not',
  book[0].entries.find(e => e.id === '3').sharedLate === true
  && book[0].entries.find(e => e.id === '2').sharedLate === false)
t('fromJournal provenance carried', book[0].entries.find(e => e.id === '3').fromJournal === 'Session 4 — notes')
t('CLASS in old meta.character never displays — the seat map wins',
  (() => { const e = rowToBookEntry(R({ id: 20, actor_key: 'vesperian', actor_name: 'Vesperian', session: 4, body: '', created_at: '2026-07-01T00:00:00Z', meta: { character: 'Fighter' } })); return e.character === 'Vesperian Vale' })())
t('hover identity is the PLAYER ALIAS, not the drawer label',
  rowToBookEntry(R({ id: 21, actor_key: 'vesperian', actor_name: 'Vesperian', session: 4, body: '', created_at: '2026-07-01T00:00:00Z' })).player === 'thebraveruby')
t('narrator hover reveals the DM alias',
  rowToBookEntry(R({ id: 22, actor_key: 'dm', session: 4, body: '', created_at: '2026-07-01T00:00:00Z' })).player === 'hagakuredisc')
t('unknown seats fall back gracefully to actor_name',
  (() => { const e = rowToBookEntry(R({ id: 23, actor_key: 'guest-seat', actor_name: 'Guest', session: 4, body: '', created_at: '2026-07-01T00:00:00Z' })); return e.character === 'Guest' && e.player === 'Guest' })())
t('rowToBookEntry survives null meta/session', (() => { const e = rowToBookEntry({ id: 9, body: '', created_at: '2026-07-01T00:00:00Z', meta: null, session: null }); return e.session === 0 && e.kind === 'narrator' })())
t('player-character mentions facet separately from NPCs', (() => {
  const e = rowToBookEntry(R({ id: 24, actor_key: 'dm', session: 4,
    body: '<p><span data-mention-type="character" data-mention-key="chonkalius-a1b2">Chonkalius</span></p>',
    created_at: '2026-07-01T00:00:00Z' }))
  const f = facetCounts([e])
  return f.characters['chonkalius-a1b2'] === 1 && !f.npcs['chonkalius-a1b2']
})())
t('character facet finds Chonkalius without an NPC filter', (() => {
  const e = rowToBookEntry(R({ id: 25, actor_key: 'dm', session: 4,
    body: '<p><span data-mention-type="character" data-mention-key="chonkalius-a1b2">Chonkalius</span></p>',
    created_at: '2026-07-01T00:00:00Z' }))
  return entryMatches(e, { characters: { 'chonkalius-a1b2': 1 }, npcs: {}, tags: {} })
})())

const questStarts = buildQuestStarts({
  starts: [
    { id: 's1', quest_id: 'q1', origin: 'chronicle', occurred_at: '2026-07-01T19:40:00Z', session_id: 4, feed_post_id: 1 },
    { id: 's2', quest_id: 'q2', origin: 'journal', occurred_at: '2026-07-10T20:00:00Z', session_id: 9, journal_page_id: 'p2' },
  ],
  quests: [
    { id: 'q1', title: 'The Bell Beneath', summary: 'A bell rings below the wastes.', giver_id: 'old-nan', giver_label: 'Old Nan', destination_location_id: 'barrow-wastes', destination_label: 'Barrow Wastes' },
    { id: 'q2', title: 'The Last Letter', summary: 'Carry the bottle home.' },
  ],
  objectives: [
    { id: 'o2b', quest_id: 'q2', position: 2, title: 'Return' },
    { id: 'o1', quest_id: 'q1', position: 1, title: 'Find the bell' },
    { id: 'o2a', quest_id: 'q2', position: 1, title: 'Deliver the letter' },
  ],
})
t('quest flag is explicit and off by default', !questCaptureEnabled('?view=both') && questCaptureEnabled('?view=both&questCapture=1'))
t('optional quest title falls back to the objective', questTitle('', 'Deliver the letter.') === 'Deliver the letter')
t('quest starts join canonical quest + first objective detail', questStarts[0].title === 'The Bell Beneath' && questStarts[0].objective === 'Find the bell' && questStarts[0].giverLabel === 'Old Nan')
t('quest starts group by Chronicle session', questStartsBySession(questStarts)[4][0].questId === 'q1')
t('Chronicle-origin quest lands immediately after its source prose', (() => {
  const timeline = mergeStoryTimeline(book[0].entries, [], [questStarts[0]])
  const source = timeline.findIndex(it => it.k === 'entry' && it.e.id === '1')
  return source >= 0 && timeline[source + 1].k === 'quest' && timeline[source + 1].q.questId === 'q1'
})())
t('Journal-origin quest keeps creation time in the session timeline', (() => {
  const q = { ...questStarts[1], session: 4, at: book[0].entries[1].at + 1 }
  const timeline = mergeStoryTimeline(book[0].entries, [], [q])
  return timeline.findIndex(it => it.k === 'quest') > timeline.findIndex(it => it.k === 'entry' && it.e.id === '3')
})())
t('a quest can create a Chronicle volume without copied prose', (() => {
  const chapters = chaptersWithQuestSessions(book, questStarts)
  const ch = chapters.find(c => c.session === 9)
  return ch && ch.entries.length === 0 && ch.date
})())

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
