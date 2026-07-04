// smoke-skin.mjs — jsdom mount of the REAL App (sample mode: no
// data-tok-shell in the DOM → bootJournal returns the baked vault).
// Asserts the reskin's living behaviors:
//   • the scope paints ink+paper as --sh-* vars before the surfaces
//   • the strip carries 6 ink + 6 paper dots; clicking one axis NEVER
//     writes the other (lesson 10, asserted in the real DOM)
//   • the vault renders rail + tree + seat dots; the shelf renders
//     spines; the accordion holds single-open in the real render
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="journal-root"></div></body></html>', { url: 'http://localhost/' })
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of ['MutationObserver','Element','Node','Text','Range','DOMParser','XMLSerializer','HTMLElement','Document','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','CustomEvent','KeyboardEvent','MouseEvent','InputEvent','ClipboardEvent','DragEvent'])
  if (dom.window[k] !== undefined) global[k] = dom.window[k]
// jsdom has no scrollIntoView; the render guards it, the stub keeps it quiet
dom.window.HTMLElement.prototype.scrollIntoView = function () {}
global.IS_REACT_ACT_ENVIRONMENT = true
dom.window.IS_REACT_ACT_ENVIRONMENT = true

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// .jsx can't be imported by node directly — smoke runs against an esbuild
// bundle of the real sources (rebuild with the npx esbuild line in DEPLOY.md)
const { React, act, createRoot, App } = await import('./.smoke-app.mjs')

console.log('smoke-skin')

const root = createRoot(document.getElementById('journal-root'))
await act(async () => { root.render(React.createElement(App)); await sleep(30) })

const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

// ── the scope + the look ──
const scope = $('.sh-scope')
t('the scope mounts', !!scope)
t('ink + paper painted on the scope before the surfaces',
  scope.style.getPropertyValue('--sh-ink') === '#26231E'
  && scope.style.getPropertyValue('--sh-paper') === '#E9E4D6'
  && scope.style.getPropertyValue('--sh-accent') === '#A93A26')
t('grain + mottle ride above the surfaces', !!$('.sh-grain') && !!$('.sh-mottle'))

// ── the strip ──
const rows = $$('.sh-swrow')
t('two switcher rows: Ink and Paper', rows.length === 2)
t('six dots per axis', rows[0].querySelectorAll('.sh-dot').length === 6
  && rows[1].querySelectorAll('.sh-dot').length === 6)

const inkBefore = scope.style.getPropertyValue('--sh-ink')
const paperBefore = scope.style.getPropertyValue('--sh-paper')
await act(async () => { rows[0].querySelectorAll('.sh-dot')[1].click(); await sleep(10) })  // Indigo
t('ink swap repaints ink + accent…',
  scope.style.getPropertyValue('--sh-ink') === '#2B3A55'
  && scope.style.getPropertyValue('--sh-accent') === '#B4652E')
t('…and NEVER touches --sh-paper (lesson 10, live DOM)',
  scope.style.getPropertyValue('--sh-paper') === paperBefore)
await act(async () => { rows[1].querySelectorAll('.sh-dot')[4].click(); await sleep(10) })  // Straw
t('paper swap repaints paper…', scope.style.getPropertyValue('--sh-paper') === '#EBE2C6')
t('…and NEVER touches --sh-ink / --sh-accent',
  scope.style.getPropertyValue('--sh-ink') === '#2B3A55'
  && scope.style.getPropertyValue('--sh-accent') === '#B4652E')

// ── the vault ──
t('rail brand: kicker + wordmark', $('.j-eyebrow') && $('.j-side-title')?.textContent === 'The Journal')
t('seat-dot vault switcher renders the four PCs', $$('.j-vault-dot').length === 4)
t('own-vault label reads Yours', $('.j-vault-label')?.textContent === 'Yours')
t('the tree renders pages', $$('.j-tree-page').length > 0)
t('the rail foot names the vault', ($('.j-rail-foot')?.textContent || '').includes('pages'))
t('the page eyebrow shows the section', !!$('.j-page-eyebrow'))
t('the editor mounts under the skin', !!$('.j-editor-content'))

// ── the shelf ──
const tabs = $$('.sh-tab')
await act(async () => { tabs[1].click(); await sleep(120) })
const spines = $$('.sh-spine')
t('the shelf renders spines from the sample book', spines.length > 0)
t('the intro spine stands at the far left', !!$('.sh-intro-spine'))
t('nothing open on arrival', $$('.sh-vol.is-open').length === 0)

await act(async () => { spines[0].click(); await sleep(150) })
t('clicking a spine opens its volume', $$('.sh-vol.is-open').length === 1)
t('aria-expanded follows', spines[0].getAttribute('aria-expanded') === 'true')
const panel = $('.sh-vol.is-open .sh-panel-inner')
t('the panel carries head, entries, and the turn footer',
  !!panel?.querySelector('.sh-p-head') && !!panel?.querySelector('.sh-entry') && !!panel?.querySelector('.sh-p-turn'))

await act(async () => { spines[1].click(); await sleep(150) })
t('opening another volume closes the first (single open)',
  $$('.sh-vol.is-open').length === 1 && spines[1].getAttribute('aria-expanded') === 'true')

await act(async () => {
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await sleep(50)
})
t('Esc closes the shelf', $$('.sh-vol.is-open').length === 0)

t('the leftmost volume disables Previous at the boundary', (() => {
  const prev = $$('.sh-vol')[0].querySelector('.sh-turn-prev')
  return prev && prev.disabled
})())

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
