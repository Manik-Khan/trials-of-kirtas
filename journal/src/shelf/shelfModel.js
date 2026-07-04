// shelfModel.js — the shelf's PURE model: chapters (bookModel output,
// freshest-first) → volumes (chronological, left → right). No imports, no
// DOM, headlessly testable (the match.js discipline).
//
// The accordion dissolved the stack-order problem: the shelf reads
// left → right like a real shelf, entries inside a volume stay in
// narrative order (bookModel already guarantees that), and the NEW tag
// marks the freshest volume. bookModel is NOT touched — this is a second
// reading layer over its output, exactly as the render swap demands.

const STRIP = html => String(html || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim()

export function clamp(text, max) {
  const t = String(text || '')
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + '…'
}

const entrySeat = e => e.seat || e.characterKey || 'narrator'

// One chapter → one volume. `titles` is the CANONICAL per-session title map
// (session_titles table, staff-curated); it overrides whatever
// meta.sessionTitle a stray row smuggled in. The row meta stays the fallback.
export function chapterToVolume(ch, { isNew = false, titles = {} } = {}) {
  const entries = ch.entries || []
  const num = ch.session === 0 ? 'Prologue' : `Session ${ch.session}`
  const canonical = titles && titles[ch.session] != null && String(titles[ch.session]).trim()
  const name = (canonical || ch.title || num)
  const first = entries[0]
  const firstNarr = entries.find(e => e.kind === 'narrator')
  const seats = []
  const seatNames = {}
  for (const e of entries) {
    const s = entrySeat(e)
    if (!seats.includes(s)) seats.push(s)
    if (!seatNames[s]) seatNames[s] = e.character || s
  }
  const tags = [ch.session === 0 ? 'Prologue' : 'Chronicle']
  if (isNew) tags.push('New')
  return {
    session: ch.session,
    num,
    name,
    // the SPINE is a fixed-width column: a long title must never wrap into a
    // second vertical column and bleed across its neighbors (the July 3
    // Session-1 overflow). The panel keeps the full name.
    spine: clamp(name, 44),
    // when the chapter is untitled the name IS the number — don't say it twice
    showNum: name !== num,
    date: ch.date || '',
    isNew,
    tags,
    seats,
    seatNames,
    excerpt: clamp(STRIP(first && first.html), 140),
    intro: clamp(STRIP((firstNarr || first) && (firstNarr || first).html), 200),
    entries,
  }
}

// bookModel chapters read freshest-first; the shelf reads chronologically,
// oldest at the left, the NEW tag on the freshest (rightmost) volume.
export function chaptersToVolumes(chapters, titles = {}) {
  const chrono = [...(chapters || [])].reverse()
  return chrono.map((ch, i) =>
    chapterToVolume(ch, { isNew: chrono.length > 0 && i === chrono.length - 1, titles }))
}

// The accordion, as a reducer: a single volume open at a time; clicking
// the open one closes it. null = shelf fully closed.
export function nextOpen(current, clicked) {
  return current === clicked ? null : clicked
}

// Keyboard: Esc closes; ←/→ walk volumes only while one is open, and
// stop at the shelf's ends.
export function keyOpen(current, key, count) {
  if (current === null) return null
  if (key === 'Escape') return null
  if (key === 'ArrowRight') return current + 1 < count ? current + 1 : current
  if (key === 'ArrowLeft') return current - 1 >= 0 ? current - 1 : current
  return current
}
