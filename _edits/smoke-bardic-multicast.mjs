// smoke-bardic-multicast.mjs — same mood on multiple channels restored
// (selected-channel-first semantics, July 5).
//
//   npm i @babel/parser   (dev-only, not shipped)
//   node _edits/smoke-bardic-multicast.mjs      (from repo root)
//
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'

const src = readFileSync('bardic-app.jsx', 'utf8')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-bardic-multicast')

// ── JSX parses (the node --check of the babel-standalone world) ──
try { parse(src, { sourceType: 'script', plugins: ['jsx'] }); t('bardic-app.jsx parses clean', true) }
catch (e) { t('bardic-app.jsx parses clean: ' + e.message, false) }

// ── the any-channel gate is gone from BOTH interactive call sites.
//    ALL_CHANNELS.find on moodId must survive ONLY in non-casting
//    housekeeping (deleteMood's stop-sweep etc.), never deciding
//    toggle-vs-cast. ──
const gates = [...src.matchAll(/ALL_CHANNELS\.find\(c => chStates\[c\.id\]\.moodId ===/g)]
t('no ALL_CHANNELS.find moodId gate remains anywhere', gates.length === 0)

// ── both call sites use selected-channel-first ──
const selFirst = [...src.matchAll(/const selState = chStates\[selectedCh\];\s*\n\s*if \(selState\.moodId === (?:m|mood)\.id && selState\.sourceType !== 'sonus'\)/g)]
t('selected-first semantics at both call sites (hotkeys + pad)', selFirst.length === 2)
t('both sites cast onto selectedCh in the else branch',
  (src.match(/else\s*\{?\s*\n?\s*castMoodOnChannel\((?:m|mood)\.id, selectedCh\);/g) || []).length === 2)

// ── multi-channel indicators ──
t('pad computes ALL active channels (filter, sonus-guarded)',
  src.includes("const activeChs = channels.filter(c => chStates[c.id].moodId === m.id && chStates[c.id].sourceType !== 'sonus');"))
t('one dot per live channel', src.includes('activeChs.filter(c => !chStates[c.id].paused).map((c, di) =>'))
t('paused = active somewhere AND all paused',
  src.includes('const isPaused = activeChs.length > 0 && activeChs.every(c => chStates[c.id].paused);'))

// ── untouched invariants ──
t('deleteMood still stops the mood on every channel',
  src.includes('ALL_CHANNELS.forEach(c => { if (chStates[c.id].moodId === moodId) stopChannel(c.id); });'))
t('toggleMoodOnChannel body unchanged (owns its own sonus guard)',
  src.includes("if (cs.moodId === moodId && cs.sourceType !== 'sonus') {"))
t('castMoodOnChannel still builds a fresh per-channel bag',
  src.includes('bag = makeBag(mood.tracks.length);'))

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
