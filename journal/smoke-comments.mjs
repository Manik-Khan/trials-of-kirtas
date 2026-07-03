// smoke-comments.mjs — the comments arc.
// 1. Pure: docWalk mapping (atoms as \uFFFC, block \n), strict findAnchor
//    (exact → unique → orphan), captureAnchor, insertionIndex.
// 2. Headless TipTap: Attribution round-trips HTML ↔ doc atomically;
//    CommentMarks paints decorations at the right positions, drops them when
//    the anchor breaks, and never touches the serialized doc.
// 3. Adapter contracts: comment CRUD payloads; saveMyAccent sends the FULL
//    merged appearance (replace-not-merge RPC).
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><body><div id="m"></div></body>', { url: 'http://localhost/' })
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of ['MutationObserver','Element','Node','Text','Range','DOMParser','XMLSerializer','HTMLElement','Document','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','CustomEvent','KeyboardEvent','InputEvent','ClipboardEvent','DragEvent'])
  if (dom.window[k] !== undefined) global[k] = dom.window[k]

let pass = 0, fail = 0
const t = (name, cond) => { cond ? (pass++, console.log('  ✓ ' + name)) : (fail++, console.log('  ✗ ' + name)) }

const { docWalk, docText, indexToPos, captureAnchor, findAnchor, insertionIndex, splitByAnchor, ATOM } =
  await import('./src/comments/anchor.js')

console.log('smoke-comments')
console.log(' — pure anchor engine —')

const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [
    { type: 'text', text: 'We met ' },
    { type: 'tokMention', attrs: { id: 'darius', type: 'npc', label: 'Darius', resolved: true } },
    { type: 'text', text: ' at the pass. The tracks ended at the waterline, oddly.' },
  ]},
  { type: 'paragraph', content: [ { type: 'text', text: 'We take the barge at dawn.' } ]},
]}

{
  const w = docWalk(doc)
  t('docWalk: atoms are one placeholder char', w.text.includes('We met ' + ATOM + ' at the pass'))
  t('docWalk: block boundaries are newlines', w.text.split('\n').length >= 3)
  t('docWalk: map covers every text char', w.map.length === w.text.length)
  const i = w.text.indexOf('tracks')
  t('indexToPos: monotonic over the doc', indexToPos(w, i) > indexToPos(w, 0) && indexToPos(w, i + 5) > indexToPos(w, i))
}
{
  const text = docText(doc)
  const c = { quote: 'ended at the waterline', prefix: 'tracks ', suffix: ', oddly' }
  const a = findAnchor(text, c)
  t('findAnchor: exact context match', !!a && text.slice(a.start, a.end) === c.quote)
  t('findAnchor: unique quote alone matches', !!findAnchor(text, { quote: 'the barge', prefix: 'ZZ', suffix: 'ZZ' }))
  t('findAnchor: ambiguous quote orphans (never guesses)', findAnchor(text, { quote: 'the', prefix: 'ZZ', suffix: 'ZZ' }) === null)
  t('findAnchor: vanished quote orphans', findAnchor(text, { quote: 'council of five', prefix: '', suffix: '' }) === null)
  const cap = captureAnchor(text, text.indexOf('ended'), text.indexOf('waterline') + 9)
  t('captureAnchor round-trips through findAnchor', (() => { const m = findAnchor(text, cap); return m && text.slice(m.start, m.end) === cap.quote })())
  const ii = insertionIndex(text, a.end)
  t('insertionIndex: lands after the sentence period', text[ii - 1] === '.' && text.slice(a.end, ii).includes('oddly'))
  const split = splitByAnchor(text, [c, { quote: 'gone forever', prefix: '', suffix: '' }])
  t('splitByAnchor separates anchored from orphaned', split.anchored.length === 1 && split.orphaned.length === 1)
}

console.log(' — headless TipTap: Attribution + CommentMarks —')
const { Editor } = await import('@tiptap/core')
const StarterKit = (await import('@tiptap/starter-kit')).default
const { TokMention } = await import('./src/editor/MentionExtension.js')
const { Attribution } = await import('./src/editor/Attribution.js')
const { CommentMarks } = await import('./src/comments/CommentMarks.js')

let jumped = null
const editor = new Editor({
  element: document.getElementById('m'),
  extensions: [StarterKit, TokMention, Attribution, CommentMarks.configure({ onJump: id => { jumped = id } })],
  content: '<p>The tracks ended at the waterline, which should have been impossible.</p>',
})

{
  // Attribution round-trip
  editor.commands.insertContentAt(editor.state.doc.content.size - 1, [
    { type: 'text', text: ' ' },
    { type: 'attribution', attrs: { seat: 'caim', seatName: 'Caim', text: 'Check the hull for claw marks.' } },
  ])
  const html = editor.getHTML()
  t('Attribution serializes: data-attrib + name + class', /data-attrib="caim"/.test(html) && /data-attrib-name="Caim"/.test(html) && /class="tok-attrib"/.test(html))
  t('Attribution serializes the seat tag', /— Caim/.test(html))
  const json = editor.getJSON()
  const node = json.content[0].content.find(n => n.type === 'attribution')
  t('Attribution is a typed atomic node in the doc', !!node && node.attrs.text === 'Check the hull for claw marks.')

  const ed2 = new Editor({ element: document.createElement('div'), extensions: [StarterKit, TokMention, Attribution], content: html })
  const n2 = ed2.getJSON().content[0].content.find(n => n.type === 'attribution')
  t('Attribution round-trips HTML → doc with attrs intact', !!n2 && n2.attrs.seat === 'caim' && /claw marks/.test(n2.attrs.text))
  ed2.destroy()
}

{
  // CommentMarks decorations
  const c = { id: 7, seat: 'caim', author_id: 'u-caim', quote: 'ended at the waterline', prefix: 'tracks ', suffix: ', which' }
  editor.commands.setCommentMarks([c])
  await new Promise(r => setTimeout(r, 10))
  const hl = editor.view.dom.querySelector('.j-c-hl[data-cid="7"]')
  t('CommentMarks paints the highlight in the view', !!hl && /ended at the waterline/.test(hl.textContent))
  t('CommentMarks decorations never enter the serialized doc', !/j-c-hl/.test(editor.getHTML()))

  // break the anchor by rewriting the sentence → decoration must drop
  editor.commands.setContent('<p>The tracks simply stopped, which should have been impossible.</p>')
  editor.commands.setCommentMarks([c])
  await new Promise(r => setTimeout(r, 10))
  t('CommentMarks drops the paint when the anchor breaks (orphan path)', !editor.view.dom.querySelector('.j-c-hl'))
}
editor.destroy()

console.log(' — adapter contracts —')
const { makeJournalStore } = await import('./src/data/supabase-adapter.js')
const sbCalls = []
function chain(table) {
  const c = { __table: table, __ops: [] }
  const rec = n => (...a) => { c.__ops.push([n, ...a]); return c }
  for (const m of ['update','eq','is','like','order','insert','delete','select']) c[m] = rec(m)
  c.maybeSingle = () => { sbCalls.push(c); return Promise.resolve({ data: { id: 'x', appearance: { bg: 'metaphor', grain: 9 } }, error: null }) }
  c.then = res => { sbCalls.push(c); return Promise.resolve({ data: [], error: null }).then(res) }
  return c
}
const sb = { from: t2 => chain(t2), rpc: (name, params) => { sbCalls.push({ __rpc: name, __params: params }); return Promise.resolve({ data: null, error: null }) } }
const store = makeJournalStore({ sb, uid: 'me', characterKey: 'liadan' })

await store.addComment({ page_id: 'pg1', seat: 'caim', body_html: 'hi', quote: 'q', prefix: 'p', suffix: 's' })
{
  const c = sbCalls.find(x => x.__table === 'journal_comments' && x.__ops.some(o => o[0] === 'insert'))
  const row = c.__ops.find(o => o[0] === 'insert')[1]
  t('addComment stamps author_id = uid', row.author_id === 'me' && row.page_id === 'pg1' && row.quote === 'q')
}
sbCalls.length = 0
await store.setCommentStatus('c1', 'accepted')
{
  const c = sbCalls.find(x => x.__table === 'journal_comments')
  const patch = c.__ops.find(o => o[0] === 'update')[1]
  t('setCommentStatus patches status ONLY (words are the trigger’s to guard)', patch.status === 'accepted' && Object.keys(patch).length === 1)
}
sbCalls.length = 0
await store.saveMyAccent('#aabbcc')
{
  const rpc = sbCalls.find(x => x.__rpc === 'set_my_appearance')
  t('saveMyAccent sends the FULL merged appearance (replace-not-merge RPC)',
    !!rpc && rpc.__params.p_appearance.accent === '#aabbcc' && rpc.__params.p_appearance.bg === 'metaphor' && rpc.__params.p_appearance.grain === 9)
}


console.log(' — pagelink fix: injected vault + click resolution —')
const { buildPageItems, resolvePageLinkClick } = await import('./src/editor/pagelink-core.js')
{
  const fake = { pages: () => [{ id: 'real-page', title: 'Real Page', folder: 'Sessions' }],
                 addPage: (folder, title) => ({ id: 'created', title }) }
  const items = buildPageItems(fake, 'real')
  t('[[ pool serves the INJECTED vault (no sample leak)', items.length >= 1 && items[0].id === 'real-page')
  t('[[ pool offers a create row for unmatched queries', buildPageItems(fake, 'brand new').some(i => i.section === 'Create'))

  const span = document.createElement('span')
  span.setAttribute('data-pagelink', 'real-page')
  document.body.appendChild(span)
  t('click resolves in read-only on plain click',
    resolvePageLinkClick(span, { metaKey: false, ctrlKey: false }, false) === 'real-page')
  t('click needs Cmd/Ctrl while editable (plain click places the cursor)',
    resolvePageLinkClick(span, { metaKey: false, ctrlKey: false }, true) === null
    && resolvePageLinkClick(span, { metaKey: true, ctrlKey: false }, true) === 'real-page')
  t('non-chip targets resolve to null',
    resolvePageLinkClick(document.body, { metaKey: true }, false) === null)
  span.remove()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
