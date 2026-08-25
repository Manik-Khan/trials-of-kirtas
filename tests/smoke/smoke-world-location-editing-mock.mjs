import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../../_edits/mock-world-location-editing.html', import.meta.url), 'utf8')
let pass = 0, fail = 0
const ok = (condition, label) => condition ? (pass += 1) : (fail += 1, console.log('  FAIL: ' + label))
const has = (value, label) => ok(html.includes(value), label)

const dataMatch = html.match(/<script id="mock-data" type="application\/json">([\s\S]*?)<\/script>/)
let data
try { data = JSON.parse(dataMatch?.[1] || '') } catch (_) {}
ok(data?.contract === 'tok-world-location-editing/v1-candidate', 'editing contract is named')
ok(data?.boundary === 'standalone-review-only-no-reads-no-writes', 'mock is review-only')
ok(data?.authority === 'dm-or-overseer', 'editing authority matches existing entity update policy')
ok(!/<script[^>]+src=|<link[^>]+stylesheet|\bfetch\s*\(|supabase|localStorage/.test(html), 'mock has no dependencies, reads, or writes')
has('Edit description', 'location reader exposes one clear edit action')
has('Use a blank line to start a new paragraph', 'formatting help is person-facing')
has('This changes Mortaine’s shared World description and its hover preview.', 'shared effect is explicit')
has('overscroll-behavior:contain', 'panel owns its scrolling')
has('min-height:0;overflow:auto', 'flex overflow footgun is closed')
has('Save description', 'editing has an explicit save action')
has('Add a description before saving.', 'empty save narrates the problem')
has('window.WorldLocationEditingMock', 'review helpers are exposed')
const scripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)]
try { new Function(scripts[0]?.[1] || ''); ok(true, 'interaction script parses') } catch (error) { ok(false, 'interaction script parses: ' + error.message) }

console.log(`\nsmoke-world-location-editing-mock: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`)
process.exit(fail ? 1 : 0)
