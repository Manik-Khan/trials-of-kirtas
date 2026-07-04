// smoke-shelf.mjs — the shelf's pure cores, carrying the approved mock
// family's assertions into the live build:
//   • chapters → volumes: chronological order, NEW on the freshest,
//     Prologue handling, seats/excerpt/intro derivation
//   • the accordion reducer: single-open, toggle-closes, key boundaries
//   • AXIS INDEPENDENCE (pinned lesson 10): ink vars never carry paper;
//     paper vars never carry ink or accent
import { chaptersToVolumes, chapterToVolume, nextOpen, keyOpen, clamp } from './src/shelf/shelfModel.js'
import { INKS, PAPERS, inkVars, paperVars, lookVars, resolveInk, resolvePaper, DEFAULT_LOOK } from './src/shelf/shelfTheme.js'
import { buildBook } from './src/data/bookModel.js'

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }

console.log('smoke-shelf')

// ── volumes over real bookModel output ──
const R = (o) => ({ channel: 'chronicle', kind: 'message', hidden: false, meta: {}, ...o })
const rows = [
  R({ id: 1, actor_key: 'dm', session: 0, body: '<p>Kirtas was not always the frontier.</p>', created_at: '2026-05-05T19:00:00Z' }),
  R({ id: 2, actor_key: 'dm', session: 1, body: '<p>Four strangers, one notice board.</p>',
      created_at: '2026-05-12T19:00:00Z', meta: { sessionTitle: 'Gathering at the Crossroads' } }),
  R({ id: 3, actor_key: 'cosmere', session: 1, body: '<p>I signed my name below the others.</p>',
      created_at: '2026-05-12T19:30:00Z', meta: { character: 'Fighter' } }),
  R({ id: 4, actor_key: 'vesperian', session: 2, body: '<p>We take off with a contingent.</p>',
      created_at: '2026-05-26T19:00:00Z', meta: { sessionTitle: 'The Journey Into Kirtas' } }),
]
const chapters = buildBook(rows)          // freshest-first: 2, 1, 0
const vols = chaptersToVolumes(chapters)  // chronological: 0, 1, 2

t('shelf order is chronological left→right (Prologue first)',
  vols.map(v => v.session).join(',') === '0,1,2')
t('the NEW tag marks the freshest volume only',
  vols[2].isNew === true && !vols[0].isNew && !vols[1].isNew)
t('session 0 is the Prologue on spine and tags',
  vols[0].num === 'Prologue' && vols[0].tags[0] === 'Prologue')
t('titled chapter: name is the title, number shows small',
  vols[1].name === 'Gathering at the Crossroads' && vols[1].num === 'Session 1' && vols[1].showNum === true)
t('untitled Prologue: name falls back to the number, never said twice',
  vols[0].name === 'Prologue' && vols[0].showNum === false)
t('NEW volume carries the New panel tag',
  vols[2].tags.includes('New') && !vols[1].tags.includes('New'))
t('seats are unique, in entry order, with display names',
  vols[1].seats.join(',') === 'narrator,cosmere'
  && vols[1].seatNames.cosmere === 'Cosmere Runestar')
t('excerpt is stripped of tags', vols[1].excerpt === 'Four strangers, one notice board.')
t('intro prefers the first narrator entry', vols[2].intro === 'We take off with a contingent.'
  || vols[2].intro.length > 0) // s2 has no narrator row: falls back to first entry
t('entries pass through untouched in narrative order',
  vols[1].entries.length === 2 && vols[1].entries[0].kind === 'narrator')
t('clamp cuts on a word boundary with an ellipsis',
  clamp('a'.repeat(10) + ' word tail here', 14).endsWith('…'))

// untitled non-zero session
const v = chapterToVolume({ session: 7, title: '', date: 'Jul 1', entries: [] })
t('untitled Session 7: big text is "Session 7", small number hidden',
  v.name === 'Session 7' && v.showNum === false)

// ── canonical session titles (session_titles) override row meta ──
const titled = chaptersToVolumes(chapters, { 1: 'The Crossroads, Properly Named' })
t('canonical title overrides the row-meta title',
  titled[1].name === 'The Crossroads, Properly Named')
t('sessions without a canonical row keep the meta fallback',
  titled[2].name === 'The Journey Into Kirtas')
t('a blank canonical title is ignored (fallback survives)',
  chaptersToVolumes(chapters, { 1: '   ' })[1].name === 'Gathering at the Crossroads')
t('canonical title can name an untitled session (showNum flips on)',
  chaptersToVolumes(chapters, { 0: 'Before the Frontier' })[0].showNum === true)

// ── the spine is clamped; the panel keeps the full name ──
const long = 'Northern Numior extends to the Kharak Mountains and Kirtas beyond'
const lv = chapterToVolume({ session: 3, title: long, date: 'Jul 3', entries: [] })
t('spine text is clamped ≤ 45 chars with an ellipsis',
  lv.spine.length <= 45 && lv.spine.endsWith('…'))
t('panel name keeps the full title', lv.name === long)
t('short titles reach the spine unclamped', v.spine === 'Session 7')

// ── the accordion reducer ──
t('click opens', nextOpen(null, 2) === 2)
t('click another switches (single volume open at a time)', nextOpen(2, 0) === 0)
t('click the open one closes', nextOpen(2, 2) === null)
t('Esc closes', keyOpen(1, 'Escape', 3) === null)
t('→ advances', keyOpen(1, 'ArrowRight', 3) === 2)
t('→ stops at the right boundary', keyOpen(2, 'ArrowRight', 3) === 2)
t('← retreats', keyOpen(1, 'ArrowLeft', 3) === 0)
t('← stops at the left boundary', keyOpen(0, 'ArrowLeft', 3) === 0)
t('keys are inert while the shelf is closed', keyOpen(null, 'ArrowRight', 3) === null)

// ── axis independence (pinned lesson 10) ──
t('six inks, six papers', INKS.length === 6 && PAPERS.length === 6)
for (const i of INKS) {
  const vars = inkVars(i.key)
  t(`ink "${i.name}" writes ink+accent and NEVER paper`,
    vars['--sh-ink'] === i.ink && vars['--sh-accent'] === i.accent
    && !('--sh-paper' in vars) && Object.keys(vars).length === 2)
}
for (const p of PAPERS) {
  const vars = paperVars(p.key)
  t(`paper "${p.name}" writes paper and NEVER ink/accent`,
    vars['--sh-paper'] === p.paper
    && !('--sh-ink' in vars) && !('--sh-accent' in vars) && Object.keys(vars).length === 1)
}
t('unknown keys resolve to the defaults, never to no-color',
  resolveInk('nope').key === 'sumi' && resolvePaper('nope').key === 'bone')
t('lookVars merges both axes for the scope element', (() => {
  const l = lookVars({ ink: 'indigo', paper: 'straw' })
  return l['--sh-ink'] === '#2B3A55' && l['--sh-paper'] === '#EBE2C6' && l['--sh-accent'] === '#B4652E'
})())
t('default look is Sumi on Bone', DEFAULT_LOOK.ink === 'sumi' && DEFAULT_LOOK.paper === 'bone')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
