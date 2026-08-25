import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const QuestFeedCapture = require('../../quest-feed-capture.js')
const page = readFileSync(new URL('../../chronicle.html', import.meta.url), 'utf8')
let pass = 0
let fail = 0

function ok(condition, label) {
  if (condition) { pass += 1; console.log(`  ✓ ${label}`) }
  else { fail += 1; console.error(`  ✗ ${label}`) }
}

ok(!QuestFeedCapture.isEnabled('') && QuestFeedCapture.isEnabled('?questCapture=1'), 'capture remains behind its explicit field flag')
ok(QuestFeedCapture.isRailEnabled('') && !QuestFeedCapture.isRailEnabled('?questCapture=0'), 'right-rail capture is live by default with an explicit rollback door')
ok(QuestFeedCapture.commandQuery('/que', 4)?.query === 'que', 'partial /quest opens the suggestion seam')
ok(QuestFeedCapture.commandQuery('Found the note\n/quest', 21)?.exact === true, 'exact /quest is detected at the cursor')
ok(QuestFeedCapture.commandQuery('do/quest', 8) === null, 'slash command requires a word boundary')
ok(QuestFeedCapture.commandQuery('/question', 9) === null, 'unrelated slash text stays prose')
ok(QuestFeedCapture.descriptionSeed('First beat\nThe skeleton held a note.\n/quest', 37) === 'The skeleton held a note.', 'last prose paragraph seeds the description')
ok(QuestFeedCapture.questTitle('', 'Find the bell.') === 'Find the bell', 'objective supplies an omitted title')
ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(QuestFeedCapture.requestId(null)), 'fallback request identity is a v4 UUID')

const richDescription = QuestFeedCapture.encodeDescription({
  type: 'doc',
  content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Soldiers from ' },
    { type: 'tokMention', attrs: { type: 'location', key: 'barrow-wastes', label: 'Barrow Wastes', resolved: true } },
    { type: 'text', text: ' follow' },
    { type: 'hardBreak' },
    { type: 'tokMention', attrs: { type: 'npc', key: 'old-nan', label: 'Old Nan', resolved: true } },
    { type: 'text', text: '.' },
  ] }],
})
ok(richDescription.startsWith('tok-quest-rich-v1:'), 'rich descriptions use a versioned text-safe envelope')
ok(QuestFeedCapture.descriptionText(richDescription) === 'Soldiers from @Barrow Wastes follow\n@Old Nan.', 'rich descriptions retain readable mention prose and line breaks')
ok(QuestFeedCapture.descriptionHTML(richDescription).includes('follow<br>'), 'rich descriptions safely retain an intentional hard break')
ok(QuestFeedCapture.descriptionHTML(richDescription).includes('class="quest-description-mention location-link" data-location="barrow-wastes"'), 'location mentions render through the established tooltip contract')
ok(QuestFeedCapture.descriptionHTML(richDescription).includes('class="quest-description-mention npc-link" data-npc="old-nan"'), 'NPC mentions render through the established tooltip contract')
ok(QuestFeedCapture.descriptionHTML('Plain <legacy> quest').includes('Plain &lt;legacy&gt; quest'), 'legacy quest prose stays readable and escaped')
const unsafeDescription = QuestFeedCapture.encodeDescription({ type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: '<img src=x onerror=alert(1)>' },
  { type: 'tokMention', attrs: { type: 'character', key: 'bad', label: 'Nope', resolved: true } },
] }] })
ok(!QuestFeedCapture.descriptionHTML(unsafeDescription).includes('<img') && !QuestFeedCapture.descriptionHTML(unsafeDescription).includes('@Nope'), 'description renderer strips unsupported nodes and escapes prose')

const payload = QuestFeedCapture.rpcPayload({
  requestId: '11111111-1111-4111-8111-111111111111',
  title: 'The Bell Beneath', description: 'A bell rings below.', objective: 'Find the bell',
  giverId: 'old-nan', giverLabel: 'Old Nan', locationId: 'barrow-wastes', locationLabel: 'Barrow Wastes',
  sourceFeedPostId: 77,
})
ok(payload.p_origin === 'chronicle' && payload.p_source_feed_post_id === 77, 'RPC payload links the real Chronicle source')
ok(payload.p_giver_label === 'Old Nan' && payload.p_location_label === 'Barrow Wastes', 'RPC payload keeps plain giver and location labels')
ok(payload.p_source_journal_page_id === null, 'Feed origin invents no Journal source')

ok(page.includes('quest-feed-capture.js?v=qfc3'), 'Chronicle loads the stamped capture helper')
ok(page.includes('Begin a quest<span class="inline-dropdown-hint">'), 'partial command has a visible person-facing suggestion')
ok(/source === 'user' && maybeOpenQuestCapture\(\)/.test(page), 'final command opens directly while typing')
ok(/getText\(\)\.trim\(\)\.toLowerCase\(\) === '\/quest'/.test(page), 'Submit Entry catches an exact command as fallback')
ok(/\.insert\(\{ channel: 'chronicle'[^]*?questCaptureState\.sourceFeedPostId = data\.id;[^]*?SB\.rpc\('create_quest'/.test(page), 'source Chronicle row is retained before quest creation')
ok(/if \(!questCaptureState\.sourceFeedPostId\)/.test(page), 'retry does not duplicate the source Chronicle row')
ok(page.includes('Your details are still here; try again.'), 'failed creation narrates safe retry')
ok(page.includes('Quest capture · ${step + 1} of ${QUEST_CAPTURE_STEPS.length}'), 'capture advances through one section at a time')
ok(page.includes('Quest Giver <em>optional</em>') && page.includes('Location <em>optional</em>'), 'giver and location stay optional')

console.log(`\nsmoke-quest-feed-capture: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`)
if (fail) process.exit(1)
