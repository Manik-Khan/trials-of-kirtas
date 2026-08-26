// smoke-records.mjs — approved Chronicle + Journal records workspace contract.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clampDockWidth, DEFAULT_DOCK_WIDTH, recordsModeFromSearch, recordsSearch } from './src/recordsLayout.js'

let pass = 0, fail = 0
const t = (name, condition) => {
  condition ? (pass++, console.log('  ✓ ' + name)) : (fail++, console.log('  ✗ ' + name))
}
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const read = p => fs.readFileSync(path.join(root, p), 'utf8')

console.log('smoke-records')

t('journal.html remains the direct Journal route', recordsModeFromSearch('') === 'journal')
t('?view=chronicle opens the Chronicle', recordsModeFromSearch('?view=chronicle') === 'chronicle')
t('?view=both opens the split workspace', recordsModeFromSearch('?view=both') === 'both')
t('unknown views fail safely to Journal', recordsModeFromSearch('?view=nope') === 'journal')
t('Journal route removes only view and preserves character scope', recordsSearch('journal', '?view=both&character=vesperian') === '?character=vesperian')
t('Chronicle route preserves character scope', recordsSearch('chronicle', '?character=vesperian') === '?character=vesperian&view=chronicle')
t('split route is bookmarkable', recordsSearch('both', '') === '?view=both')
t('records switch preserves the guarded quest-capture flag', recordsSearch('chronicle', '?questCapture=1') === '?questCapture=1&view=chronicle')
t('invalid requested mode falls back to Chronicle', recordsSearch('nope', '') === '?view=chronicle')
t('invalid dock width uses the approved default', clampDockWidth('nope') === DEFAULT_DOCK_WIDTH)
t('dock width clamps at 30%', clampDockWidth(4) === 30)
t('dock width clamps at 62%', clampDockWidth(90) === 62)
t('dock width preserves a valid value', clampDockWidth(44.5) === 44.5)

const nav = read('nav.js')
const app = read('journal/src/App.jsx')
const chronicle = read('journal/src/ChronicleView.jsx')
const journal = read('journal/src/JournalView.jsx')
const css = read('journal/src/styles.css')

t('top navigation keeps Chronicle + Feed and removes Journal',
  /label:\s*'Chronicle'/.test(nav) && /label:\s*'Feed'/.test(nav) && !/label:\s*'Journal'/.test(nav))
t('Chronicle stays active for every records workspace URL',
  nav.includes('Chronicle owns the whole records workspace') && !nav.includes('pView === curView'))
t('App renders all three modes with a real resize separator',
  app.includes("records-workspace is-${view}") && app.includes('role="separator"') && app.includes("view === 'both'"))
t('App keeps URL/back state and remembers Journal width',
  app.includes('window.history.pushState') && app.includes("window.addEventListener('popstate'") && app.includes('DOCK_WIDTH_KEY'))
t('Chronicle Index owns the workspace mode switch',
  chronicle.includes('<RecordsModeSwitch mode={recordsMode}') && chronicle.includes('IndexOverlay'))
t('Journal has a collapsible vault Index and compact dock picker',
  journal.includes('j-index-spine') && journal.includes('j-dock-nav') && journal.includes("j-vault${docked ? ' is-docked' : ''}"))
t('split mode stacks safely on narrow screens',
  css.includes('.records-workspace.is-both { flex-direction: column; }') && css.includes('.records-workspace.is-both .records-divider { display: none; }'))
t('Journal Index overlays instead of squeezing the editor',
  css.includes('.j-index {') && css.includes('transform: translateX(-100%)') && css.includes('.j-side.is-open'))

const stampedPages = [
  'admin.html', 'bardic-console.html', 'chronicle.html', 'combat.html', 'compendium.html',
  'factions.html', 'index.html', 'journal.html', 'journal/index.html', 'lore.html',
  'npcs.html', 'party.html', 'radio.html', 'shards.html', 'sheet-v2.html', 'world.html',
]
t('every production nav include carries the new cache stamp',
  stampedPages.every(p => read(p).includes('nav.js?v=sup9')))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
