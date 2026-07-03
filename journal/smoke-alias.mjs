// smoke-alias.mjs — entity_aliases consulted at typing time.
// The loop under test: merge_entity retires 'sir-belamy' → alias points at
// 'ser-bellamy' → typing the OLD key must (a) surface canon in the pool,
// (b) never re-seed the stub, (c) insert the chip with the CANON id + label.
import { buildItems } from './src/editor/match.js'
import { entityStore } from './src/data/entityStore.js'
import { makeJournalStore } from './src/data/supabase-adapter.js'

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-alias')

const NPCS = [
  { id: 'ser-bellamy', label: 'Ser Bellamy', type: 'npc', origin: 'canon' },
  { id: 'darius', label: 'Darius', type: 'npc', origin: 'canon' },
]
const LOCS = [{ id: 'verens-watch', label: "Veren's Watch", type: 'location', origin: 'canon' }]
const ALIASES = { 'npc:sir-belamy': 'ser-bellamy' }

// ── the matcher ──
{
  const items = buildItems('sir bel', NPCS, LOCS, ALIASES)
  t('typing the retired key surfaces CANON (no Create rows)',
    items.some(i => i.id === 'ser-bellamy' && i.resolved) && !items.some(i => i.section === 'Create'))
  const items2 = buildItems('sir-belamy', NPCS, LOCS, ALIASES)
  t('dashed form of the alias matches too', items2.some(i => i.id === 'ser-bellamy'))
  const items3 = buildItems('sir bel', NPCS, LOCS, {})
  t('without the alias map the same query falls through to Create (the old failure)',
    items3.some(i => i.section === 'Create'))
  t('aliases never leak across types',
    !buildItems('sir bel', [], LOCS, ALIASES).some(i => i.resolved))
}

// ── the store ──
{
  entityStore.hydrate({ npcs: [...NPCS], locations: [...LOCS], aliases: { ...ALIASES } })
  const r = entityStore.resolve('npc', 'sir-belamy')
  t('resolve(alias) → the canonical entity', !!r && r.id === 'ser-bellamy' && r.label === 'Ser Bellamy')
  t('resolve(direct) still works', entityStore.resolve('npc', 'darius').id === 'darius')
  t('resolve(unknown) → null', entityStore.resolve('npc', 'nobody') === null)
  const before = entityStore.npcs().length
  const added = entityStore.add({ id: 'sir-belamy', type: 'npc', label: 'Sir Belamy' })
  t('add() refuses to re-seed a merged-away key', added === false && entityStore.npcs().length === before)
  t('add() still creates genuinely new stubs', entityStore.add({ id: 'the-tollkeeper', type: 'npc', label: 'The Tollkeeper' }) === true)
}

// ── the insert decision (resolve-before-create), pure ──
{
  const { resolveMentionInsert } = await import('./src/editor/match.js')
  const r = resolveMentionInsert({ id: 'sir-belamy', type: 'npc', label: 'Sir Belamy', resolved: false }, entityStore)
  t('insert decision intercepts the alias: CANON id + label, resolved, not created',
    r.id === 'ser-bellamy' && r.label === 'Ser Bellamy' && r.resolved === true && r.created === false)
  const r2 = resolveMentionInsert({ id: 'brand-new', type: 'npc', label: 'Brand New', resolved: false }, entityStore)
  t('genuinely new entities still create', r2.created === true && r2.id === 'brand-new' && r2.resolved === true)
  const r3 = resolveMentionInsert({ id: 'darius', type: 'npc', label: 'Darius', resolved: true }, entityStore)
  t('already-resolved picks pass through untouched', r3.id === 'darius' && r3.created === false)
}

// ── the adapter shape ──
{
  const calls = []
  function chain(table) {
    const c = { __table: table }
    c.select = () => { calls.push(table); return Promise.resolve(
      table === 'entities'
        ? { data: [{ id: 'x', type: 'npc', name: 'X', curated: true }], error: null }
        : { data: [{ type: 'npc', alias_id: 'old-x', canonical_id: 'x' }], error: null }) }
    return c
  }
  const store = makeJournalStore({ sb: { from: t2 => chain(t2) }, uid: 'me', characterKey: 'liadan' })
  const out = await store.loadEntities({})
  t('loadEntities returns the alias map keyed type:alias → canon',
    out.aliases && out.aliases['npc:old-x'] === 'x')
  t('both tables consulted in one load', calls.includes('entities') && calls.includes('entity_aliases'))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
