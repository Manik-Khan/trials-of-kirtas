// anchor.js — the comments arc's pure core. No imports, no DOM.
//
// A comment anchors by { quote, prefix, suffix } captured at write time.
// Matching at render is STRICT by design:
//   1. exact prefix+quote+suffix
//   2. the quote alone, but ONLY if it appears exactly once
//   3. otherwise → ORPHAN (the "since edited" log)
// A comment painted on the wrong sentence is worse than one honestly parked —
// never fuzzy-guess.
//
// Doc ↔ text mapping walks a TipTap/ProseMirror JSON doc with fixed rules so
// capture and render agree byte-for-byte:
//   • text nodes contribute their text
//   • atomic inline nodes (tokMention, pageLink, attribution) contribute ONE
//     placeholder char (\uFFFC) — they are opaque single "characters"
//   • every block close contributes '\n'
// The same walk yields the flat text AND the text-index → ProseMirror-pos map.

export const ATOM = '\uFFFC'
const ATOMIC_INLINE = new Set(['tokMention', 'pageLink', 'attribution'])

// Walk the JSON doc → { text, toPos: idx → pm position }.
// PM positions: entering a node costs 1; text chars cost 1 each; an atomic
// inline leaf costs 1. `map` records the pm pos for every text index.
export function docWalk(doc) {
  let text = ''
  const map = []              // map[i] = pm pos of text char i
  let pos = 0                 // pm position BEFORE the current node

  function walk(node) {
    pos += 1                  // enter the node
    if (node.content) {
      for (const child of node.content) {
        if (child.type === 'text') {
          const t = child.text || ''
          for (let i = 0; i < t.length; i++) { map.push(pos + i); text += t[i] }
          pos += t.length
        } else if (ATOMIC_INLINE.has(child.type)) {
          map.push(pos); text += ATOM
          pos += 1
        } else {
          walk(child)
        }
      }
    }
    pos += 1                  // leave the node
    map.push(pos - 1); text += '\n'   // block boundary
  }

  if (doc && doc.content) {
    for (const block of doc.content) walk(block)
  }
  return { text, map }
}

export function docText(doc) { return docWalk(doc).text }

// text index → ProseMirror pos (for decorations / insertions)
export function indexToPos(walk, idx) {
  if (idx <= 0) return walk.map.length ? walk.map[0] : 0
  if (idx >= walk.map.length) {
    const last = walk.map[walk.map.length - 1]
    return last === undefined ? 0 : last + 1
  }
  return walk.map[idx]
}

// Capture the anchor for a selection [from, to) over the walked text.
export function captureAnchor(text, from, to, ctx = 24) {
  return {
    quote: text.slice(from, to),
    prefix: text.slice(Math.max(0, from - ctx), from),
    suffix: text.slice(to, to + ctx),
  }
}

// Strict matcher → { start, end } text indices, or null (orphan).
export function findAnchor(text, c) {
  if (!c || !c.quote) return null
  const full = (c.prefix || '') + c.quote + (c.suffix || '')
  let i = text.indexOf(full)
  if (i !== -1) {
    const s = i + (c.prefix || '').length
    return { start: s, end: s + c.quote.length }
  }
  i = text.indexOf(c.quote)
  if (i !== -1 && text.indexOf(c.quote, i + 1) === -1) {
    return { start: i, end: i + c.quote.length }
  }
  return null
}

// Where accepted text lands: after the sentence containing the anchor —
// the next sentence-ending punctuation at or past the anchor end, else the
// anchor end itself. Returns a TEXT index.
export function insertionIndex(text, anchorEnd) {
  const m = /[.!?…]/.exec(text.slice(anchorEnd))
  if (!m) return anchorEnd
  let i = anchorEnd + m.index + 1
  while (text[i] === '”' || text[i] === '"' || text[i] === "'" || text[i] === '’') i++
  return i
}

// Split anchored vs orphaned for a comment list over the current doc text.
export function splitByAnchor(text, comments) {
  const anchored = [], orphaned = []
  for (const c of comments) {
    const a = findAnchor(text, c)
    if (a) anchored.push({ comment: c, at: a })
    else orphaned.push(c)
  }
  return { anchored, orphaned }
}
