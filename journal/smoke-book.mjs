// smoke-book.mjs — the book model: feed rows → chapters. Pure, no DOM.
import { buildBook, rowToBookEntry } from './src/data/bookModel.js'
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
t('chapters sorted by session, prologue first', book.map(c => c.session).join(',') === '0,3,4')
t('session 0 titles as Prologue', book[0].title === 'Prologue')
t('chapter title from the first sessionTitle', book[2].title === 'The Fort Siege')
t('hidden rows never render', !book[2].entries.some(e => e.id === '5'))
t('non-chronicle channels excluded', !book[2].entries.some(e => e.id === '7'))
t('dm rows are the Narrator (golden box kind)', book[2].entries[0].kind === 'narrator' && book[2].entries[0].seat === 'narrator')
t('character rows carry seat + both identities',
  (() => { const e = book[2].entries.find(x => x.id === '2'); return e.kind === 'entry' && e.seat === 'vesperian' && e.character === 'Vesperian Vale' && e.player === 'thebraveruby' })())
t('written_at PLACES the late share at its proper time (between 19:00 and 19:30)',
  book[2].entries.map(e => e.id).join(',') === '1,3,2')
t('late share earns the badge; on-time entries do not',
  book[2].entries.find(e => e.id === '3').sharedLate === true
  && book[2].entries.find(e => e.id === '2').sharedLate === false)
t('fromJournal provenance carried', book[2].entries.find(e => e.id === '3').fromJournal === 'Session 4 — notes')
t('CLASS in old meta.character never displays — the seat map wins',
  (() => { const e = rowToBookEntry(R({ id: 20, actor_key: 'vesperian', actor_name: 'Vesperian', session: 4, body: '', created_at: '2026-07-01T00:00:00Z', meta: { character: 'Fighter' } })); return e.character === 'Vesperian Vale' })())
t('hover identity is the PLAYER ALIAS, not the drawer label',
  rowToBookEntry(R({ id: 21, actor_key: 'vesperian', actor_name: 'Vesperian', session: 4, body: '', created_at: '2026-07-01T00:00:00Z' })).player === 'thebraveruby')
t('narrator hover reveals the DM alias',
  rowToBookEntry(R({ id: 22, actor_key: 'dm', session: 4, body: '', created_at: '2026-07-01T00:00:00Z' })).player === 'hagakuredisc')
t('unknown seats fall back gracefully to actor_name',
  (() => { const e = rowToBookEntry(R({ id: 23, actor_key: 'guest-seat', actor_name: 'Guest', session: 4, body: '', created_at: '2026-07-01T00:00:00Z' })); return e.character === 'Guest' && e.player === 'Guest' })())
t('rowToBookEntry survives null meta/session', (() => { const e = rowToBookEntry({ id: 9, body: '', created_at: '2026-07-01T00:00:00Z', meta: null, session: null }); return e.session === 0 && e.kind === 'narrator' })())

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
