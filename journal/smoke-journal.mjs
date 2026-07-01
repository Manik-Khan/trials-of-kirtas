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
console.log(`\n${pass}/${pass + fail} pass`)
process.exit(fail ? 1 : 0)
