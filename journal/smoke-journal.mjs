// jsdom smoke + logic harness for the Phase 0/1 journal corner.
// 1. Pure: buildItems matching + slug + extractRefs walk
// 2. Headless TipTap: TokMention round-trips HTML → doc → HTML with
//    atomic typed attrs, and extractRefs sees the nodes.
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><body><div id="m"></div></body>', { url: 'http://localhost/' })
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true })
for (const k of ['MutationObserver','Element','Node','Text','Range','DOMParser','XMLSerializer','HTMLElement','Document','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','CustomEvent','KeyboardEvent','InputEvent','ClipboardEvent','DragEvent'])
  if (dom.window[k] !== undefined) global[k] = dom.window[k]

let pass = 0, fail = 0
const t = (name, cond) => { cond ? pass++ : (fail++, console.error('FAIL:', name)) }

// ── 1. pure logic ──
const { buildItems, slug } = await import('./src/editor/match.js')
const { extractRefs } = await import('./src/editor/MentionExtension.js')
const { NPCS, LOCATIONS } = await import('./src/data/sample.js')

t('sample data loaded', NPCS.length === 12 && LOCATIONS.length === 16)
t('empty query → npcs then locations, 5 each', (() => {
  const i = buildItems('', NPCS, LOCATIONS)
  return i.length === 10 && i[0].section === 'NPCs' && i[5].section === 'Locations'
})())
t('substring match on name', buildItems('rey', NPCS, LOCATIONS).some(i => i.id === 'reykoldt'))
t('substring match on key', buildItems('tiersg', NPCS, LOCATIONS).some(i => i.label === 'Tiersgard'))
t('multi-word query matches', buildItems('lord rey', NPCS, LOCATIONS).some(i => i.id === 'reykoldt'))
t('case-insensitive', buildItems('TIERS', NPCS, LOCATIONS).length > 0)
t('no match → 2 unresolved creates (npc + location)', (() => {
  const i = buildItems('Ser Bellamy of the Vale', NPCS, LOCATIONS)
  return i.length === 2 && i.every(x => !x.resolved) &&
    i[0].type === 'npc' && i[1].type === 'location' &&
    i[0].id === 'ser-bellamy-of-the-vale' && i[0].label === 'Ser Bellamy of the Vale'
})())
t('slug strips diacritic-free punctuation + spaces', slug('  The  Broken–Crown!! ') === 'the-broken-crown')

t('extractRefs dedupes + counts nested', (() => {
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [
      { type: 'tokMention', attrs: { id: 'darius', type: 'npc', label: 'Darius', resolved: true } },
      { type: 'text', text: ' met ' },
      { type: 'tokMention', attrs: { id: 'darius', type: 'npc', label: 'Darius', resolved: true } },
    ]},
    { type: 'blockquote', content: [ { type: 'paragraph', content: [
      { type: 'tokMention', attrs: { id: 'tiersgard', type: 'location', label: 'Tiersgard', resolved: true } },
    ]}]},
  ]}
  const r = extractRefs(doc)
  return r.length === 2 && r.find(x => x.id === 'darius').count === 2 &&
    r.find(x => x.id === 'tiersgard').type === 'location'
})())
t('extractRefs empty doc → []', extractRefs({ type: 'doc', content: [] }).length === 0)

// ── 2. headless TipTap round-trip ──
const { Editor } = await import('@tiptap/core')
const { default: StarterKit } = await import('@tiptap/starter-kit')
const { TokMention } = await import('./src/editor/MentionExtension.js')

const SEED = '<p>Met <span data-mention-type="npc" data-mention-key="darius">@Darius</span> in <span data-mention-type="location" data-mention-key="tiersgard">@Tiersgard</span>, chasing <span data-mention-type="npc-unresolved" data-mention-key="the-mask">@The Mask</span>.</p>'

const editor = new Editor({
  element: document.getElementById('m'),
  extensions: [StarterKit, TokMention],
  content: SEED,
})

const json = editor.getJSON()
const refs = extractRefs(json)
t('parses 3 mentions from chronicle-shaped HTML', refs.length === 3)
t('npc parsed with type + resolved', (() => {
  const d = refs.find(r => r.id === 'darius')
  return d && d.type === 'npc' && d.resolved === true
})())
t('location parsed', (() => {
  const l = refs.find(r => r.id === 'tiersgard')
  return l && l.type === 'location' && l.resolved === true
})())
t('unresolved variant parsed (type stripped, resolved=false)', (() => {
  const u = refs.find(r => r.id === 'the-mask')
  return u && u.type === 'npc' && u.resolved === false
})())
t('mention label parses with leading @ STRIPPED (no @@ on render)', (() => {
  const u = refs.find(r => r.id === 'the-mask')
  const d = refs.find(r => r.id === 'darius')
  return u.label === 'The Mask' && d.label === 'Darius'
})())
t('round-trip render has single @ per mention', (() => {
  const h = editor.getHTML()
  return h.includes('>@Darius<') && !h.includes('@@')
})())

const html = editor.getHTML()
t('serializes chronicle-compatible spans', html.includes('data-mention-type="npc"') && html.includes('data-mention-key="darius"'))
t('serializes unresolved as -unresolved', html.includes('data-mention-type="npc-unresolved"'))
t('serializes classes for chronicle CSS', html.includes('npc-link') && html.includes('location-link') && html.includes('npc-unresolved'))

// atomicity: mention node is atom (no content), selectable
const mentionType = editor.schema.nodes.tokMention
t('mention node is atomic', mentionType.spec.atom === true)

// insert via command (what the dropdown's props.command does)
editor.commands.insertContentAt(editor.state.doc.content.size, [{ type: 'tokMention', attrs: { id: 'eneos', type: 'npc', label: 'King Eneos', resolved: true } }])
t('programmatic insert lands in refs', extractRefs(editor.getJSON()).some(r => r.id === 'eneos'))

editor.destroy()

// ── 3. Phase 2: entity store, stub-create resolve, backlink query ──
const { entityStore } = await import('./src/data/entityStore.js')
const { resolveUnresolvedMentions } = await import('./src/editor/MentionExtension.js')
const { SEATS } = await import('./src/data/party.js')

t('store seeds canon pool', entityStore.npcs().length === 12 && entityStore.locations().length === 16)
t('seats: 4 PCs + Narrator(null key)', SEATS.length === 5 && SEATS.filter(s=>s.key===null).length === 1)

const ed2 = new Editor({
  element: document.getElementById('m'),
  extensions: [StarterKit, TokMention],
  content: '<p>Met <span data-mention-type="npc-unresolved" data-mention-key="ser-bellamy">@Ser Bellamy</span> near <span data-mention-type="location-unresolved" data-mention-key="the-broken-mill">@The Broken Mill</span> and again <span data-mention-type="npc-unresolved" data-mention-key="ser-bellamy">@Ser Bellamy</span>.</p>',
})
const stubs = resolveUnresolvedMentions(ed2)
t('resolve returns deduped stubs', stubs.length === 2 && stubs[0].id === 'ser-bellamy' && stubs[1].type === 'location')
t('doc nodes flipped to resolved', extractRefs(ed2.getJSON()).every(r => r.resolved === true))
t('resolved html drops -unresolved markers', !ed2.getHTML().includes('-unresolved'))

stubs.forEach(st => entityStore.add(st))
t('stubs joined the pool (npc 13, loc 17)', entityStore.npcs().length === 13 && entityStore.locations().length === 17)
t('created stubs queue for curation', entityStore.createdStubs().length === 2)
t('duplicate add is a no-op', entityStore.add({id:'ser-bellamy',type:'npc',label:'Ser Bellamy'}) === false && entityStore.npcs().length === 13)
t('new stub is now @-matchable', buildItems('bellamy', entityStore.npcs(), entityStore.locations()).some(i => i.id==='ser-bellamy' && i.resolved))


// ── 4. Phase 2.5: vault, wikilinks, outline, page backlinks ──
const { vault, extractPageLinks, extractOutline } = await import('./src/data/vault.js')
const { PageLink } = await import('./src/editor/PageLink.js')

t('vault seeds 4 pages in 3 folders', vault.pages().length === 4 && vault.folders().length === 3)
t('vault get by slug', vault.get('the-missing-caravan')?.folder === 'Quests')

const ed3 = new Editor({
  element: document.getElementById('m'),
  extensions: [StarterKit, TokMention, PageLink],
  content: vault.get('session-12-the-ambush').html,
})
const j3 = ed3.getJSON()
t('baked page parses heading + list + quote', JSON.stringify(j3).includes('"heading"') && JSON.stringify(j3).includes('"blockquote"'))
t('page link parses from baked html', extractPageLinks(j3).some(l => l.pageId === 'the-missing-caravan'))
t('world mentions coexist on the page', extractRefs(j3).some(r => r.id === 'darius'))
t('outline extracts h2s in order', (() => {
  const o = extractOutline(j3)
  return o.length === 2 && o[0].text === 'The road east' && o[1].level === 2
})())
t('pagelink serializes round-trip', (() => {
  const h = ed3.getHTML()
  return h.includes('data-pagelink="the-missing-caravan"') && h.includes('class="page-link"')
})())
ed3.destroy()

t('backlinksTo: caravan ← session 12', vault.backlinksTo('the-missing-caravan').some(p => p.id === 'session-12-the-ambush'))
t('backlinksTo: session 12 ← caravan (mutual)', vault.backlinksTo('session-12-the-ambush').some(p => p.id === 'the-missing-caravan'))

const np = vault.addPage('Unsorted', 'The Harbormaster Problem')
t('addPage creates + auto-creates Unsorted folder', np.id === 'the-harbormaster-problem' && vault.folders().includes('Unsorted'))
t('addPage dedupes by slug', vault.addPage('Quests', 'The Harbormaster Problem').id === np.id && vault.pages().length === 5)
vault.saveDoc(np.id, { html: '<p>x <span data-pagelink="on-darius" data-pagelink-label="On Darius">On Darius</span></p>', json: null })
t('backlinks work off html when no json cached', vault.backlinksTo('on-darius').some(p => p.id === np.id))


// ── 5. the Chronicle book: html-side refs, weave integrity, threads ──
const { CHRONICLE, CHARACTER_ACCENTS, parseRefsFromHTML } = await import('./src/data/chronicleSample.js')

t('chronicle: 2 sessions, 8 entries total', CHRONICLE.length === 2 && CHRONICLE.reduce((n,c)=>n+c.entries.length,0) === 8)
t('every entry carries both identities', CHRONICLE.every(c => c.entries.every(e => e.character && e.player && 'characterKey' in e)))
t('entries chronological within each session', CHRONICLE.every(c => c.entries.every((e,i,a) => i===0 || a[i-1].at <= e.at)))
t('provenance flags present (fromJournal + sharedLate)',
  CHRONICLE[0].entries.some(e=>e.fromJournal) && CHRONICLE[0].entries.some(e=>e.sharedLate))
t('all five accents defined', ['liadan','cosmere','caim','vesperian','narrator'].every(k => CHARACTER_ACCENTS[k]))

const refs12 = parseRefsFromHTML(CHRONICLE[0].entries[0].html)
t('parseRefsFromHTML reads mention spans', refs12.some(r=>r.id==='tiersgard'&&r.type==='location') && refs12.some(r=>r.id==='darius'&&r.type==='npc'))
t('parseRefsFromHTML strips the @ from labels', refs12.every(r => !r.label.startsWith('@')))
t('parseRefsFromHTML counts duplicates', (() => {
  const r = parseRefsFromHTML('<p><span data-mention-type="npc" data-mention-key="x">@X</span><span data-mention-type="npc" data-mention-key="x">@X</span></p>')
  return r.length === 1 && r[0].count === 2
})())
t('thread filter: darius dims non-mentioning entries', (() => {
  const es = CHRONICLE[0].entries.map(e => ({...e, refs: parseRefsFromHTML(e.html)}))
  const touches = (e,k) => !k || e.refs.some(r => `${r.type}:${r.id}` === k)
  const lit = es.filter(e => touches(e,'npc:darius'))
  return lit.length === 2 && es.length === 5
})())


// ── 6. callouts: one node, both surfaces ──
const { Callout, CALLOUT_VARIANTS } = await import('./src/editor/Callout.js')
const ed4 = new Editor({
  element: document.getElementById('m'),
  extensions: [StarterKit, TokMention, Callout],
  content: '<div data-callout="warning"><p>inside job</p></div><p>after</p>',
})
t('callout parses with variant', ed4.getJSON().content[0].type === 'callout' && ed4.getJSON().content[0].attrs.variant === 'warning')
t('callout serializes for the shared stylesheet', ed4.getHTML().includes('data-callout="warning"') && ed4.getHTML().includes('class="tok-callout"'))
t('4 variants defined', CALLOUT_VARIANTS.length === 4)
t('baked chronicle entry carries a callout', CHRONICLE[1].entries.some(e => e.html.includes('data-callout="quest"')))
t('baked vault page carries a callout', vault.get('the-missing-caravan').html.includes('data-callout="warning"'))
ed4.destroy()


// ── 7. supabase adapter against a stub client ──
const { makeJournalStore } = await import('./src/data/supabase-adapter.js')

// minimal chainable stub: records ops, returns canned {data,error}
function stubSB(cans = {}) {
  const ops = []
  const mk = table => {
    const ctx = { table, filters: {}, op: null, payload: null }
    const chain = {
      select: (cols) => { ctx.op = ctx.op || 'select'; ctx.cols = cols; return chain },
      insert: (p) => { ctx.op = 'insert'; ctx.payload = p; return chain },
      update: (p) => { ctx.op = 'update'; ctx.payload = p; return chain },
      delete: () => { ctx.op = 'delete'; return chain },
      eq: (k, v) => { ctx.filters[k] = v; return chain },
      is: (k, v) => { ctx.filters[k] = v; return chain },
      order: () => finish(),
      maybeSingle: () => finish(true),
      then: (res, rej) => finish().then(res, rej),
    }
    const finish = (single) => {
      ops.push(ctx)
      const can = (cans[ctx.table] && cans[ctx.table][ctx.op]) || { data: single ? null : [], error: null }
      return Promise.resolve(can)
    }
    return chain
  }
  return { from: mk, ops }
}

// loadPages: character journal filters by eq; Narrator by is-null
{
  const sb = stubSB({ journal_pages: { select: { data: [{ id: 'p1', folder: 'Sessions' }], error: null } } })
  const store = makeJournalStore({ sb, uid: 'u1', characterKey: 'liadan' })
  const pages = await store.loadPages()
  t('adapter loadPages returns rows', pages.length === 1 && pages[0].id === 'p1')
  t('adapter loads by CHARACTER across all authors (party-readable)', sb.ops[0].filters.character_key === 'liadan' && !('author_id' in sb.ops[0].filters))
}
{
  const sb = stubSB()
  const store = makeJournalStore({ sb, uid: 'u1', characterKey: null })
  await store.loadPages()
  t('adapter Narrator journal filters character_key IS NULL', sb.ops[0].filters.character_key === null)
}

// error surfacing: {error} must throw, not silently pass (the .rpc gotcha)
{
  const sb = stubSB({ journal_pages: { select: { data: null, error: { message: 'permission denied' } } } })
  const store = makeJournalStore({ sb, uid: 'u1', characterKey: 'liadan' })
  let threw = false
  try { await store.loadPages() } catch (e) { threw = /permission denied/.test(e.message) }
  t('adapter surfaces {error} as a throw', threw)
}

// replaceRefs: wholesale delete + insert with kind/ref_type mapping
{
  const sb = stubSB()
  const store = makeJournalStore({ sb, uid: 'u1', characterKey: 'liadan' })
  await store.replaceRefs('p1', [
    { kind: 'entity', type: 'npc', id: 'darius', label: 'Darius' },
    { kind: 'page', id: 'on-darius', label: 'On Darius' },
  ])
  const [del, ins] = sb.ops
  t('replaceRefs deletes then inserts', del.op === 'delete' && ins.op === 'insert' && ins.payload.length === 2)
  t('replaceRefs maps kinds (entity carries ref_type, page does not)',
    ins.payload[0].ref_type === 'npc' && ins.payload[1].ref_type === null && ins.payload[1].kind === 'page')
}

// addPage slugs the title; shareToChronicle inserts a chronicle feed row + marks the page
{
  const sb = stubSB({ feed: { insert: { data: { id: 77 }, error: null } } })
  const store = makeJournalStore({ sb, uid: 'u1', characterKey: 'liadan' })
  await store.addPage('Quests', 'The Harbormaster Problem', 13)
  t('addPage slugs + carries session', sb.ops[0].payload.slug === 'the-harbormaster-problem' && sb.ops[0].payload.session === 13)

  const fid = await store.shareToChronicle(
    { id: 'p1', html: '<p>x</p>', title: 'The Docks', session: 13, created_at: 'T' },
    { characterName: 'Líadan Luchóg', session: 13 })
  const feedIns = sb.ops.find(o => o.table === 'feed')
  const mark = sb.ops.find(o => o.table === 'journal_pages' && o.op === 'update')
  t('share inserts channel=chronicle kind=message with provenance meta',
    feedIns.payload.channel === 'chronicle' && feedIns.payload.kind === 'message' &&
    feedIns.payload.meta.fromJournal === 'The Docks' && feedIns.payload.meta.written_at === 'T')
  t('share marks the page with the feed id', fid === 77 && mark.payload.shared_feed_id === 77)
}


// ── 8. live vault over a stub store ──
const { makeLiveVault } = await import('./src/data/live-vault.js')

function stubStore() {
  const calls = []
  return {
    calls,
    savePage: (...a) => { calls.push(['savePage', ...a]); return Promise.resolve({}) },
    replaceRefs: (...a) => { calls.push(['replaceRefs', ...a]); return Promise.resolve() },
    addPage: (folder, title) => { calls.push(['addPage', folder, title]); return Promise.resolve({ id: 'row-9', created_at: 'T' }) },
    shareToChronicle: (...a) => { calls.push(['share', ...a]); return Promise.resolve(88) },
  }
}

{
  const st = stubStore()
  const lv = makeLiveVault({
    store: st, uid: 'me', characterName: 'Líadan Luchóg', session: 13, canWriteHere: true,
    rows: [
      { id: 'r1', author_id: 'me',   slug: 'mine',   folder: 'Sessions', title: 'Mine',   html: '<p>a</p>', doc: null, shared_feed_id: null },
      { id: 'r2', author_id: 'them', slug: 'theirs', folder: 'Sessions', title: 'Theirs', html: '<p>b</p>', doc: null, shared_feed_id: 5 },
    ],
  })
  t('live vault intakes rows keyed by slug', lv.get('mine')._rowId === 'r1' && lv.get('theirs').shared === true)
  t('canEdit: own page yes, another author no', lv.canEdit('mine') === true && lv.canEdit('theirs') === false)
  t('canWrite reflects seat', lv.canWrite() === true)

  const np = lv.addPage('Quests', 'New Lead')
  t('addPage optimistic + persists', np.id === 'new-lead' && st.calls.some(c => c[0] === 'addPage'))
  await new Promise(r => setTimeout(r, 0))
  t('row id backfills after insert resolves', lv.get('new-lead')._rowId === 'row-9')

  lv.saveDoc('mine', { html: '<p>z <span data-mention-type="npc" data-mention-key="darius">@Darius</span></p>',
    json: { type:'doc', content:[{ type:'paragraph', content:[{ type:'tokMention', attrs:{ id:'darius', type:'npc', label:'Darius', resolved:true } }] }] } })
  t('saveDoc is debounced (no immediate persist)', !st.calls.some(c => c[0] === 'savePage'))
  await new Promise(r => setTimeout(r, 800))
  t('debounced save persists doc then refs', st.calls.some(c => c[0] === 'savePage') && st.calls.some(c => c[0] === 'replaceRefs'))
  const refs = st.calls.find(c => c[0] === 'replaceRefs')[2]
  t('persisted refs carry the entity kind', refs.length === 1 && refs[0].kind === 'entity' && refs[0].id === 'darius')

  await lv.share('mine')
  t('share flushes, publishes, and marks', lv.get('mine').shared === true && st.calls.some(c => c[0] === 'share'))
}
{
  const lv = makeLiveVault({ store: stubStore(), uid: 'me', characterName: 'Caim', session: null, canWriteHere: false, rows: [] })
  t('viewer of another journal cannot write, empty vault still has a folder', lv.canWrite() === false && lv.folders().length === 1)
}

// backlink query (the journal_refs select, in-memory form)
const mkEntry = (id, refs) => ({ at:id, refs })
const E = [
  mkEntry(1, [{type:'npc',id:'darius'},{type:'location',id:'tiersgard'}]),
  mkEntry(2, [{type:'npc',id:'darius'}]),
  mkEntry(3, [{type:'location',id:'tiersgard'}]),
]
const backlinksFor = (entries, type, id) => entries.filter(e => e.refs.some(r => r.type===type && r.id===id))
t('backlinks: darius → 2 entries', backlinksFor(E,'npc','darius').length === 2)
t('backlinks: tiersgard → 2 entries', backlinksFor(E,'location','tiersgard').length === 2)
t('backlinks: unknown → 0', backlinksFor(E,'npc','nobody').length === 0)

ed2.destroy()

console.log(`\n${pass}/${pass + fail} pass`)
process.exit(fail ? 1 : 0)
