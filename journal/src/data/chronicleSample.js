// Baked chronicle sample — the shared book. Entries carry BOTH identities
// (character · player), a kind (narrator scene-setting vs. character entry),
// and provenance flags: fromJournal (shared from a private vault page) and
// sharedLate (published after the fact, placed at its written-at time).
// Real version: journal pages shared into chronicle rows; sessions kept.

// HTML-side ref extraction (entries arrive as rendered HTML rows).
// Browser + jsdom both provide DOMParser.
export function parseRefsFromHTML(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  const refs = new Map()
  doc.querySelectorAll('[data-mention-type]').forEach(el => {
    const type = (el.getAttribute('data-mention-type') || 'npc').replace('-unresolved', '')
    const id = el.getAttribute('data-mention-key')
    const label = (el.textContent || '').replace(/^@/, '')
    const k = `${type}:${id}`
    const cur = refs.get(k)
    if (cur) cur.count += 1
    else refs.set(k, { id, type, label, count: 1 })
  })
  return [...refs.values()]
}

export const CHARACTER_ACCENTS = {
  liadan:    '#7fb069',
  cosmere:   '#9b7ec8',
  caim:      '#c96f6f',
  vesperian: '#7f9ec9',
  narrator:  'var(--gold, #b8952a)',
}

const D = (m, d, h, min) => new Date(2026, m - 1, d, h, min).getTime()

export const CHRONICLE = [
  {
    session: 12,
    title: 'The Toll Road',
    date: 'June 14',
    entries: [
      {
        id: 's12-narr-1',
        kind: 'narrator',
        characterKey: 'narrator',
        character: 'Narrator',
        player: 'Bloomdao',
        at: D(6, 14, 19, 5),
        html: `<p>The eastern road out of <span data-mention-type="location" data-mention-key="tiersgard">@Tiersgard</span> runs through toll country — old stone markers, older grudges. The party set out at dawn with <span data-mention-type="npc" data-mention-key="darius">@Darius</span>'s warning still hanging in the air.</p>`,
      },
      {
        id: 's12-liadan-1',
        kind: 'entry',
        characterKey: 'liadan',
        character: 'Líadan Luchóg',
        player: 'nazanroseaktas',
        fromJournal: 'Session 12 — The Ambush',
        at: D(6, 14, 19, 40),
        html: `<h2>The road east</h2><p>We left <span data-mention-type="location" data-mention-key="tiersgard">@Tiersgard</span> at dawn. <span data-mention-type="npc" data-mention-key="darius">@Darius</span> warned us the toll road was watched — he was right.</p><blockquote><p>“Coin buys silence. Silence buys arrows.” — the toll keeper, moments before it all went wrong</p></blockquote>`,
      },
      {
        id: 's12-cosmere-1',
        kind: 'entry',
        characterKey: 'cosmere',
        character: 'Cosmere Runestar',
        player: 'ianakira',
        at: D(6, 14, 20, 10),
        html: `<p>The blade sang before I saw them. Six, no colors, crossbows in the rocks. Whoever paid for this paid <strong>well</strong> — and paid in <span data-mention-type="location" data-mention-key="capital">@The Capital</span>'s coin, if the fletching tells true.</p>`,
      },
      {
        id: 's12-caim-1',
        kind: 'entry',
        characterKey: 'caim',
        character: 'Caim',
        player: 'jayvanmidde',
        sharedLate: 'shared 3 days later',
        at: D(6, 14, 20, 30),
        html: `<p>I keep thinking about the one who ran. He wasn't afraid of us. He was afraid of <em>reporting back</em>.</p>`,
      },
      {
        id: 's12-narr-2',
        kind: 'narrator',
        characterKey: 'narrator',
        character: 'Narrator',
        player: 'Bloomdao',
        at: D(6, 14, 21, 0),
        html: `<p>Among the fallen: a torn ledger page, a clerk's neat hand, and a cargo manifest that should not exist. The road behind them stayed quiet. Too quiet to be luck.</p>`,
      },
    ],
  },
  {
    session: 13,
    title: 'The Docks',
    date: 'June 21',
    entries: [
      {
        id: 's13-narr-1',
        kind: 'narrator',
        characterKey: 'narrator',
        character: 'Narrator',
        player: 'Bloomdao',
        at: D(6, 21, 19, 10),
        html: `<p>Back within <span data-mention-type="location" data-mention-key="tiersgard">@Tiersgard</span>'s walls, the harbor fog came in early. The harbormaster's office kept its lamps low and its ledgers lower.</p>`,
      },
      {
        id: 's13-vesp-1',
        kind: 'entry',
        characterKey: 'vesperian',
        character: 'Vesperian',
        player: 'thebraveruby',
        at: D(6, 21, 19, 55),
        html: `<p>The harbormaster stalls. Someone paid him to. His clerk's hand matches the ledger page from the road — <span data-mention-type="npc" data-mention-key="darius">@Darius</span> insures half these routes and swears he's never seen it.</p><ul><li><p>Manifests for three nights are simply <em>missing</em></p></li><li><p>Warehouse nine is guarded like a vault</p></li></ul><div data-callout="quest"><p>Next: get inside warehouse nine before the next tide.</p></div>`,
      },
      {
        id: 's13-liadan-1',
        kind: 'entry',
        characterKey: 'liadan',
        character: 'Líadan Luchóg',
        player: 'nazanroseaktas',
        fromJournal: 'Session 13 — The Docks',
        at: D(6, 21, 20, 40),
        html: `<p><em>Threads to pull next session:</em> the ledger hand, the missing manifests, and why <span data-mention-type="npc" data-mention-key="darius">@Darius</span> gave us that first warning for free.</p>`,
      },
    ],
  },
]
