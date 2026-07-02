// smoke-org.mjs — the organization arc's data layer.
// 1. live-vault: sorted pagesIn, rename (slug stable), delete, reorder →
//    contiguous sort_order persisted via the store.
// 2. supabase-adapter contracts against a recording sb stub: renamePage must
//    NOT patch slug (savePage's title path does — the backlink-orphaning
//    landmine), reorder payload shape, RPC names/params for canonize/merge.
import { makeLiveVault } from './src/data/live-vault.js'
import { makeJournalStore } from './src/data/supabase-adapter.js'

let pass = 0, fail = 0
const t = (name, cond) => { cond ? (pass++, console.log('  ✓ ' + name)) : (fail++, console.log('  ✗ ' + name)) }

// ── 1. live-vault over a recording store ──
const calls = []
const store = {
  savePage: (...a) => (calls.push(['savePage', ...a]), Promise.resolve({})),
  renamePage: (...a) => (calls.push(['renamePage', ...a]), Promise.resolve({})),
  deletePage: (...a) => (calls.push(['deletePage', ...a]), Promise.resolve()),
  reorderPages: (...a) => (calls.push(['reorderPages', ...a]), Promise.resolve()),
  addPage: () => Promise.resolve({ id: 'new-row' }),
  replaceRefs: () => Promise.resolve(),
  shareToChronicle: () => Promise.resolve(1),
}
const rows = [
  { id: 'r1', slug: 'p-one', author_id: 'me', folder: 'Sessions', title: 'P One', html: '', doc: null, sort_order: 1, created_at: '2026-06-01' },
  { id: 'r2', slug: 'p-two', author_id: 'me', folder: 'Sessions', title: 'P Two', html: '', doc: null, sort_order: 0, created_at: '2026-06-02' },
  { id: 'r3', slug: 'p-three', author_id: 'me', folder: 'Sessions', title: 'P Three', html: '', doc: null, sort_order: null, created_at: '2026-06-03' },
  { id: 'r4', slug: 'theirs', author_id: 'them', folder: 'Sessions', title: 'Theirs', html: '', doc: null, sort_order: null, created_at: '2026-06-04' },
]
const vault = makeLiveVault({ store, uid: 'me', characterName: 'Líadan', rows, session: 4, canWriteHere: true, isStaff: false })

t('pagesIn sorts by sort_order, nulls last, then created_at',
  vault.pagesIn('Sessions').map(p => p.id).join(',') === 'p-two,p-one,p-three,theirs')
t('canDelete: own yes, foreign no (not staff)',
  vault.canDelete('p-one') === true && vault.canDelete('theirs') === false)

const staffVault = makeLiveVault({ store, uid: 'me', characterName: 'N', rows: [...rows], session: 4, canWriteHere: true, isStaff: true })
t('canDelete: staff may delete foreign pages', staffVault.canDelete('theirs') === true)

vault.renamePage('p-one', '  P One Renamed  ')
t('renamePage trims + updates title locally', vault.get('p-one').title === 'P One Renamed')
t('renamePage keeps the slug (id) stable', vault.get('p-one').id === 'p-one')
t('renamePage persists via store.renamePage (rowId, title)',
  calls.some(c => c[0] === 'renamePage' && c[1] === 'r1' && c[2] === 'P One Renamed'))

vault.reorder('Sessions', ['p-three', 'p-one', 'p-two'])
t('reorder sets contiguous local sort_order',
  vault.get('p-three').sort_order === 0 && vault.get('p-one').sort_order === 1 && vault.get('p-two').sort_order === 2)
const ro = calls.find(c => c[0] === 'reorderPages')
t('reorder persists [{id, folder, sort_order}] for OWN rows only',
  !!ro && ro[1].length === 3 && ro[1].every(u => ['r1','r2','r3'].includes(u.id))
      && ro[1].find(u => u.id === 'r3').sort_order === 0)

vault.deletePage('p-two')
t('deletePage removes locally + persists', !vault.has('p-two') && calls.some(c => c[0] === 'deletePage' && c[1] === 'r2'))

// ── 2. adapter contracts against a recording sb ──
const sbCalls = []
function chain(table) {
  const c = { __table: table, __ops: [] }
  const rec = name => (...args) => { c.__ops.push([name, ...args]); return c }
  for (const m of ['update','eq','is','like','order','insert','delete','upsert']) c[m] = rec(m)
  c.select = (...a) => { c.__ops.push(['select', ...a]); return c }
  c.maybeSingle = () => { sbCalls.push(c); return Promise.resolve({ data: { id: 'x' }, error: null }) }
  c.then = (res) => { sbCalls.push(c); return Promise.resolve({ data: [], error: null, count: 0 }).then(res) }
  return c
}
const sb = {
  from: t2 => chain(t2),
  rpc: (name, params) => { sbCalls.push({ __rpc: name, __params: params }); return Promise.resolve({ data: { pages: 1 }, error: null }) },
}
const adapter = makeJournalStore({ sb, uid: 'me', characterKey: 'liadan' })

await adapter.renamePage('r1', ' New Title ')
{
  const c = sbCalls.find(x => x.__table === 'journal_pages' && x.__ops.some(o => o[0] === 'update'))
  const patch = c.__ops.find(o => o[0] === 'update')[1]
  t('adapter.renamePage patches title only — NO slug', patch.title === 'New Title' && !('slug' in patch))
}
sbCalls.length = 0
await adapter.reorderPages([{ id: 'r1', folder: 'Q', sort_order: 0 }, { id: 'r2', folder: 'Q', sort_order: 1 }])
t('adapter.reorderPages issues one update per row with folder+sort_order',
  sbCalls.filter(x => x.__ops && x.__ops.some(o => o[0] === 'update' && 'sort_order' in o[1] && o[1].folder === 'Q')).length === 2)

sbCalls.length = 0
await adapter.canonizeEntity('npc', 'ser-bellamy')
t('adapter.canonizeEntity → rpc canonize_entity(p_type, p_id)',
  sbCalls.some(x => x.__rpc === 'canonize_entity' && x.__params.p_type === 'npc' && x.__params.p_id === 'ser-bellamy'))

sbCalls.length = 0
await adapter.mergeEntity('npc', 'sir-belamy', 'ser-bellamy', 'Ser Bellamy', true)
t('adapter.mergeEntity → rpc merge_entity with all five params',
  sbCalls.some(x => x.__rpc === 'merge_entity'
    && x.__params.p_old === 'sir-belamy' && x.__params.p_canon === 'ser-bellamy'
    && x.__params.p_canon_label === 'Ser Bellamy' && x.__params.p_fix_feed === true))

sbCalls.length = 0
await adapter.savePage('r1', { doc: {}, html: '', title: 'X' })
{
  const c = sbCalls.find(x => x.__table === 'journal_pages')
  const patch = c.__ops.find(o => o[0] === 'update')[1]
  t('savePage title path still re-slugs (unchanged; rename must not use it)', patch.slug === 'x')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
