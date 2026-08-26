import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const html = readFileSync(new URL('../../_edits/mock-quest-session-correction.html', import.meta.url), 'utf8')
let pass = 0, fail = 0
const ok = (condition, label) => condition ? pass += 1 : (fail += 1, console.log('  FAIL:', label))
const data = JSON.parse(html.match(/<script id="mock-data" type="application\/json">([\s\S]*?)<\/script>/)[1])
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(source => source.includes('QuestSessionCorrectionMock'))

ok(data.contract === 'tok-quest-session-correction/v1-candidate', 'mock carries the session-correction review contract')
ok(data.boundary === 'standalone-review-only-no-reads-no-writes', 'mock declares its no-production boundary')
ok(/any approved campaign member/.test(data.permissionAssumption), 'collaborative correction permission is explicit for approval')
ok(/original Quest begun receipt.*never rewritten/.test(data.historyRule), 'append-only historical receipt remains authoritative')
ok(html.includes('Edit session') && html.includes('Save session'), 'expanded quest exposes one direct correction action')
ok(html.includes('Original Chronicle source') && html.includes('Kept exactly where it was written'), 'source session stays separately visible and honest')
ok(/This changes where the quest is organized and searched/.test(html), 'person-facing copy explains the correction effect')
ok(/@media\(max-width:620px\)/.test(html) && /min-height:52px/.test(html), 'mobile correction actions retain touch size')
ok(!/supabase|\.from\(|\.rpc\(|fetch\(|localStorage|sessionStorage/i.test(inline), 'mock script performs no reads, writes, or persistence')
try { new Function(inline); ok(true, 'mock interaction script parses') } catch (error) { ok(false, 'mock interaction script parses: ' + error.message) }

const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://tok.test/mock' })
const { document } = dom.window
document.querySelector('[data-edit-session]').click()
ok(!document.querySelector('[data-session-editor]').hidden, 'Edit session opens the contained selector')
document.querySelector('[data-session-select]').value = '7'
document.querySelector('[data-save]').click()
ok(document.querySelector('[data-current-session]').textContent.includes('Session 7'), 'saving repaints the quest under the corrected session')
ok(/Session 9 Chronicle source remains unchanged/.test(document.querySelector('[data-notice-copy]').textContent), 'success keeps the original Chronicle source explicit')
ok(document.querySelectorAll('.history-entry').length === 2 && /Session 8 → Session 7/.test(document.querySelector('.history-entry').textContent), 'correction appends visible history instead of rewriting it')

console.log(`\nsmoke-quest-session-correction-mock: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`)
process.exit(fail ? 1 : 0)
