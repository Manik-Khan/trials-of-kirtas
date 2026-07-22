// The Chronicle as the SHELF — the approved mock-chronicle-shelf-2 built
// over real data. Sessions are vertical book spines, chronological left →
// right; the clicked spine expands IN PLACE (the Miranda accordion) to a
// reading panel that scrolls internally while the shelf stays standing on
// both sides. Reading layer ONLY: bookModel is untouched, writing stays in
// chronicle.html until increment 3.
//
// Seat paint resolves through accents.js at render — the mock's baked seat
// hexes were placeholders. Ink/paper come from the .sh-scope tokens App
// applies (per-reader, persisted via set_my_appearance).

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CHRONICLE } from './data/chronicleSample.js'
import { buildBook, buildFights, fightsBySession, facetCounts, filterBookEntries, indexActive } from './data/bookModel.js'
import { chaptersToVolumes, flattenVolumeEntries, nextOpen, keyOpen } from './shelf/shelfModel.js'
import { seatColor } from './comments/accents.js'

const fmtTime = ts => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const entrySeat = e => e.seat || e.characterKey || 'narrator'

// Seat portraits — the feed-render precedence: portrait art over the initial.
// (Same Cloudinary URLs feed-render.js uses; the initial shows if art 404s.)
const PORTRAIT = {
  cosmere: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833033/kirtas/characters/cosmere.png',
  caim: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833008/kirtas/characters/caim.png',
  liadan: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779732202/kirtas/portraits/liadan.png',
  vesperian: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833079/kirtas/characters/vesperian.png',
}

function Medallions({ vol, accents, row = false }) {
  return (
    <span className={`sh-medallions ${row ? 'is-row' : ''}`}>
      {vol.seats.map(s => (
        <span key={s} className="sh-medallion" title={vol.seatNames[s]}
          style={{ background: seatColor(s, accents) }}>
          {(vol.seatNames[s] || '?').charAt(0)}
        </span>
      ))}
    </span>
  )
}

function PanelEntry({ e, accents }) {
  const seat = entrySeat(e)
  const accent = seatColor(seat, accents)
  const isNarrator = seat === 'narrator'
  return (
    <article className={`sh-entry${isNarrator ? ' is-narrator' : ''}`}>
      <span className="sh-entry-med" style={{ background: accent, borderColor: accent }} title={`written by ${e.player}`}>
        {PORTRAIT[seat] && (
          <img className="sh-entry-portrait" src={PORTRAIT[seat]} alt=""
            onError={ev => { ev.currentTarget.style.display = 'none' }} />
        )}
        <span className="sh-entry-ini">{(e.character || '?').charAt(0)}</span>
      </span>
      <div className="sh-entry-main">
        <div className="sh-entry-head">
          <span className="sh-entry-who" style={{ color: accent }} title={`written by ${e.player}`}>
            {e.character}<span className="sh-player-reveal"> · {e.player}</span>
          </span>
          {e.fromJournal && (
            <span className="sh-entry-badge" title={`shared from the journal page “${e.fromJournal}”`}>from journal</span>
          )}
          {e.sharedLate && (
            <span className="sh-entry-badge is-late" title="published after the session, placed at its written-at time">shared later</span>
          )}
          <span className="sh-entry-when">{fmtTime(e.at)}</span>
        </div>
        <div className="sh-entry-body c-entry-text" dangerouslySetInnerHTML={{ __html: e.html }} />
      </div>
    </article>
  )
}

// merge a session's prose entries with its fights, in narrative time order,
// so a fight appears at the moment it broke out.
function mergeTimeline(entries, fights) {
  const items = (entries || []).map(e => ({ t: e.at, k: 'entry', e }))
  ;(fights || []).forEach(f => items.push({ t: f.startAt, k: 'fight', f }))
  items.sort((a, b) => a.t - b.t)
  return items
}

function FightRoll({ r, accents }) {
  const nameColor = r.side === 'party' ? seatColor(r.seat, accents) : r.side === 'enemy' ? '#b06a5a' : 'var(--sh-accent)'
  const ring = r.side === 'party' ? '#4a6aa0' : r.side === 'enemy' ? '#a05a6a' : 'var(--sh-accent)'
  const art = r.seat ? PORTRAIT[r.seat] : ''
  return (
    <div className="feed-row">
      <div className="feed-av" style={{ borderColor: ring }}>
        {art && <img className="feed-av-img" src={art} alt="" onError={ev => { ev.currentTarget.style.display = 'none' }} />}
        {r.side === 'dm' ? <span className="feed-av-dm">◆</span> : <span className="feed-av-i">{(r.name || '?').charAt(0)}</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="feed-meta"><span className="feed-name" style={{ color: nameColor }}>{r.name}</span> · roll · {fmtTime(r.at)}</div>
        <div className="feed-text" dangerouslySetInnerHTML={{ __html: r.body }} />
      </div>
    </div>
  )
}

// a fight, inline where it happened: collapsed by default; opens to rounds
// (all rolls in full), each round independently collapsible.
function FightBlock({ f, accents }) {
  const [open, setOpen] = useState(false)
  const [closedRounds, setClosedRounds] = useState(() => new Set())   // rounds open by default
  const toggleRound = n => setClosedRounds(prev => {
    const next = new Set(prev); next.has(n) ? next.delete(n) : next.add(n); return next
  })
  return (
    <div className="sh-fight">
      <div className="sh-fight-lead">combat breaks out</div>
      <button type="button" className={`sh-fight-head${open ? ' is-open' : ''}`}
        aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="sh-fight-caret">▶</span>
        <span className="sh-fight-title">Combat — <b>{f.encounter}</b></span>
        <span className="sh-fight-sum">{f.rollCount} roll{f.rollCount === 1 ? '' : 's'} · {f.roundCount} round{f.roundCount === 1 ? '' : 's'}</span>
      </button>
      {open && (
        <div className="sh-fight-rows">
          {f.rounds.map(rd => {
            const rOpen = !closedRounds.has(rd.round)
            return (
              <div key={rd.round} className={`sh-round${rOpen ? ' is-open' : ''}`}>
                <button type="button" className="sh-round-head" aria-expanded={rOpen}
                  onClick={() => toggleRound(rd.round)}>
                  <span className="sh-round-caret">▶</span>Round {rd.round}
                  <span className="sh-round-count">{rd.rolls.length} roll{rd.rolls.length === 1 ? '' : 's'}</span>
                </button>
                {rOpen && (
                  <div className="sh-round-rows">
                    <div className="sh-fight-pad">
                      {rd.rolls.map(r => <FightRoll key={r.id} r={r} accents={accents} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const snippet = html => {
  const t = String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > 96 ? t.slice(0, 96) + '…' : t
}
const shortName = n => String(n || '').split(' ')[0]

function Facet({ label, children }) {
  return (
    <div className="idx-facet">
      <label>{label}</label>
      <div className="idx-chips">{children}</div>
    </div>
  )
}

// The Index — the intro spine, now a slim overlay off the left edge. Sticky, so
// it stays at the head of the book; opening it leaves the reader's session put.
function IndexOverlay({ open, fs, facets, seatNames, volumes, results, accents, onToggle, onClose, onQ, onAuthor, onTag, onNpc, onClear, onJump }) {
  const active = indexActive(fs)
  const chips = []
  if (fs.author) chips.push({ k: 'author', label: shortName(seatNames[fs.author] || fs.author) })
  Object.keys(fs.tags).forEach(t => chips.push({ k: 'tag:' + t, label: '#' + t }))
  Object.keys(fs.npcs).forEach(n => chips.push({ k: 'npc:' + n, label: n }))
  if (fs.q) chips.push({ k: 'q', label: '“' + fs.q + '”' })
  return (
    <div className="sh-index">
      <button type="button" className={`sh-spine idx-spine${open ? ' is-open' : ''}`} onClick={onToggle} aria-expanded={open}>
        <span className="idx-mark">‖</span>
        <span className="idx-vtitle">Index · The Chronicle</span>
        <span className="idx-loc">Kirtas</span>
      </button>
      <aside className={`idx-panel${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div className="idx-inner">
          <header className="idx-head">
            <button type="button" className="idx-close" onClick={onClose}>Close ✕</button>
            <h2 className="idx-title">Index</h2>
            <p className="idx-sub">The whole record — search it, or narrow by who, what, or when.</p>
          </header>
          <div className="idx-body">
            <div className="idx-search">
              <input type="text" value={fs.q} placeholder="Search the record…" onChange={e => onQ(e.target.value)} />
            </div>
            <Facet label="Sessions">
              {volumes.map((v, i) => (
                <button key={v.session} type="button" className="idx-chip" onClick={() => onJump(i)}>{v.num} · {v.name}</button>
              ))}
            </Facet>
            <Facet label="Authors">
              {Object.keys(facets.authors).map(k => (
                <button key={k} type="button" className={`idx-chip${fs.author === k ? ' is-on' : ''}`} onClick={() => onAuthor(k)}>
                  <span className="idx-dot" style={{ background: seatColor(k, accents) }} />{shortName(seatNames[k] || k)} <span className="idx-ct">{facets.authors[k]}</span>
                </button>
              ))}
            </Facet>
            {Object.keys(facets.tags).length > 0 && (
              <Facet label="Tags">
                {Object.keys(facets.tags).map(t => (
                  <button key={t} type="button" className={`idx-chip${fs.tags[t] ? ' is-on' : ''}`} onClick={() => onTag(t)}>#{t} <span className="idx-ct">{facets.tags[t]}</span></button>
                ))}
              </Facet>
            )}
            {Object.keys(facets.npcs).length > 0 && (
              <Facet label="NPCs mentioned">
                {Object.keys(facets.npcs).map(n => (
                  <button key={n} type="button" className={`idx-chip${fs.npcs[n] ? ' is-on' : ''}`} onClick={() => onNpc(n)}>{n} <span className="idx-ct">{facets.npcs[n]}</span></button>
                ))}
              </Facet>
            )}
            <div className="idx-results">
              {!active ? (
                <p className="idx-prompt">Search the record above, or choose an author, tag, or NPC — a result takes you to it in the book.</p>
              ) : (
                <>
                  <div className="idx-active">
                    <span className="idx-lbl">Filtering</span>
                    {chips.map(c => <button key={c.k} type="button" className="idx-achip" onClick={() => onClear(c.k)}>{c.label} ✕</button>)}
                    <button type="button" className="idx-clearall" onClick={() => onClear('*')}>Clear</button>
                  </div>
                  {results.length === 0
                    ? <p className="idx-prompt">No entries match — try fewer filters.</p>
                    : results.map(e => (
                        <button key={e.id} type="button" className="idx-res" onClick={() => onJump(e._vol)}>
                          <span className="idx-res-top">
                            <span className="idx-dot" style={{ background: seatColor(e.seat, accents) }} />
                            <span className="idx-res-name" style={{ color: seatColor(e.seat, accents) }}>{e.character}</span>
                            <span className="idx-res-sess">S{e.session}</span>
                          </span>
                          <span className="idx-res-snip">{snippet(e.html)}</span>
                        </button>
                      ))}
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

// keystrokes typed into a field belong to the field, not the shelf
const inField = t => !!(t && (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')))

export default function ChronicleView({ live = false, store = null, accents = {}, isStaff = false }) {
  const [rows, setRows] = useState(null)
  const [combatRows, setCombatRows] = useState([])   // channel:'combat' feed rows
  const [encMap, setEncMap] = useState({})           // encounter id → name
  const [titles, setTitles] = useState({})       // canonical session → title
  const [err, setErr] = useState(null)
  const [openIdx, setOpenIdx] = useState(null)
  const [peek, setPeek] = useState(null)         // {i, x, y} | null
  const [lightbox, setLightbox] = useState(null) // image src | null
  const [editing, setEditing] = useState(null)   // {session, draft} | null
  const volRefs = useRef([])
  const panelRefs = useRef([])
  const shelfRef = useRef(null)

  useEffect(() => {
    if (!live || !store) return
    let stale = false
    Promise.all([
      store.loadChronicleBook(),
      store.loadSessionTitles ? store.loadSessionTitles() : Promise.resolve({}),
      store.loadChronicleCombat ? store.loadChronicleCombat() : Promise.resolve({ rows: [], encounters: {} }),
    ])
      .then(([r, t, c]) => {
        if (stale) return
        setRows(r); setTitles(t || {})
        setCombatRows((c && c.rows) || []); setEncMap((c && c.encounters) || {})
      })
      .catch(e => { if (!stale) setErr(e.message) })
    return () => { stale = true }
  }, [live, store])

  // live: fold realtime changes into the book — chronicle prose AND combat
  // rolls emerge at the table (edits/deletes reflect) with no refresh. Additive;
  // when not live this never runs, so the load-once path is untouched.
  useEffect(() => {
    if (!live || !store || !store.subscribeChronicle) return
    const upsert = (list, row) => {
      if (!list) return list
      const i = list.findIndex(r => r.id === row.id)
      if (i >= 0) { const next = list.slice(); next[i] = row; return next }
      return [...list, row]
    }
    const unsub = store.subscribeChronicle({
      onInsert: row => setRows(cur => (cur ? upsert(cur, row) : cur)),
      onUpdate: row => setRows(cur => (cur ? upsert(cur, row) : cur)),
      onCombatInsert: row => setCombatRows(cur => upsert(cur || [], row)),
      onCombatUpdate: row => setCombatRows(cur => upsert(cur || [], row)),
      onDelete: id => {
        setRows(cur => (cur ? cur.filter(r => r.id !== id) : cur))
        setCombatRows(cur => (cur ? cur.filter(r => r.id !== id) : cur))
      },
    })
    return unsub
  }, [live, store])

  const chapters = useMemo(
    () => (live && rows ? buildBook(rows) : (live ? [] : CHRONICLE)),
    [live, rows],
  )
  const fightsBySess = useMemo(
    () => (live ? fightsBySession(buildFights(combatRows, encMap)) : {}),
    [live, combatRows, encMap],
  )
  const volumes = useMemo(() => chaptersToVolumes(chapters, titles), [chapters, titles])

  // ── Index: flat entry pool + facets + filtered results ──
  const [ixOpen, setIxOpen] = useState(false)
  const [fs, setFs] = useState({ author: null, tags: {}, npcs: {}, q: '' })
  const [scrolled, setScrolled] = useState(false)
  const flat = useMemo(() => flattenVolumeEntries(volumes), [volumes])
  const facets = useMemo(() => facetCounts(flat), [flat])
  const seatNames = useMemo(() => {
    const m = {}
    flat.forEach(e => { if (e.seat && !m[e.seat]) m[e.seat] = e.character })
    return m
  }, [flat])
  const results = useMemo(() => filterBookEntries(flat, fs), [flat, fs])
  const clearIndex = () => setFs({ author: null, tags: {}, npcs: {}, q: '' })
  const removeChip = key => {
    if (key === '*') return clearIndex()
    setFs(s => {
      if (key === 'author') return { ...s, author: null }
      if (key === 'q') return { ...s, q: '' }
      if (key.startsWith('tag:')) { const tags = { ...s.tags }; delete tags[key.slice(4)]; return { ...s, tags } }
      if (key.startsWith('npc:')) { const npcs = { ...s.npcs }; delete npcs[key.slice(4)]; return { ...s, npcs } }
      return s
    })
  }
  const openVolume = i => {
    setPeek(null); setEditing(null); setOpenIdx(i)
    setTimeout(() => { const p = panelRefs.current[i]; if (p) p.scrollTop = 0; bringIntoView(i) }, 80)
  }
  const jumpTo = i => { clearIndex(); setIxOpen(false); openVolume(i) }
  // outline → scroll the open panel to a section/fight (scrollIntoView is banned
  // here; move the panel's own scrollTop by the element's offset within it)
  const scrollToId = (i, id) => {
    const cont = panelRefs.current[i]
    if (!cont) return
    const el = cont.querySelector('[id="' + id + '"]')
    if (!el) return
    const top = el.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 12
    if (cont.scrollTo) cont.scrollTo({ top, behavior: 'smooth' }); else cont.scrollTop = top
  }

  // Contained scroll: move ONLY .sh-shelf. scrollIntoView is banned here —
  // it walks every clipping ancestor, and an overflow:hidden ancestor
  // scrolls programmatically with no way for the user to scroll back
  // (the July 3 "left edge amputated on both tabs" bug).
  const bringIntoView = i => {
    const shelf = shelfRef.current, v = volRefs.current[i]
    if (!shelf || !v) return
    const left = Math.max(0, shelf.scrollLeft + v.getBoundingClientRect().left - shelf.getBoundingClientRect().left)
    // jsdom has no Element.scrollTo (lesson 11's cousin) — scrollLeft always works
    if (typeof shelf.scrollTo === 'function') shelf.scrollTo({ left, behavior: 'smooth' })
    else shelf.scrollLeft = left
  }

  const toggle = i => {
    setPeek(null)
    setEditing(null)
    setOpenIdx(cur => {
      const next = nextOpen(cur, i)
      if (next !== null) {
        // let the width animation start, then keep the volume in view
        setTimeout(() => {
          const p = panelRefs.current[next]
          if (p) p.scrollTop = 0
          bringIntoView(next)
        }, 80)
      }
      return next
    })
  }

  useEffect(() => {
    const onKey = e => {
      if (inField(e.target)) return
      if (e.key === 'Escape' && lightbox) { setLightbox(null); return }
      if (!['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      if (openIdx === null && e.key !== 'Escape') {
        // shelf closed: arrows travel the shelf itself (three spines a step)
        const shelf = shelfRef.current
        if (shelf) {
          const step = Math.max(shelf.clientWidth * 0.3, 240) * (e.key === 'ArrowRight' ? 1 : -1)
          if (typeof shelf.scrollBy === 'function') shelf.scrollBy({ left: step, behavior: 'smooth' })
          else shelf.scrollLeft += step
          e.preventDefault()
        }
        return
      }
      setOpenIdx(cur => {
        const next = keyOpen(cur, e.key, volumes.length)
        if (next !== cur && next !== null) setTimeout(() => {
          const p = panelRefs.current[next]
          if (p) p.scrollTop = 0
          bringIntoView(next)
        }, 80)
        if (next !== cur) setEditing(null)
        return next
      })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [volumes.length, lightbox, openIdx])

  // A mouse wheel is vertical; the shelf is horizontal. Translate the wheel
  // into shelf travel — except over an open panel that can still consume the
  // scroll itself. Native listener: React root-attaches wheel as passive,
  // so preventDefault must go through addEventListener({passive:false}).
  useEffect(() => {
    const shelf = shelfRef.current
    if (!shelf) return
    const onWheel = e => {
      const panel = e.target && e.target.closest && e.target.closest('.sh-panel-inner')
      if (panel) {
        const canDown = panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1
        const canUp = panel.scrollTop > 0
        if ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp)) return // the panel takes it
      }
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!delta) return
      e.preventDefault()
      shelf.scrollLeft += delta
    }
    shelf.addEventListener('wheel', onWheel, { passive: false })
    const onScroll = () => setScrolled(shelf.scrollLeft > 6)
    shelf.addEventListener('scroll', onScroll)
    return () => { shelf.removeEventListener('wheel', onWheel); shelf.removeEventListener('scroll', onScroll) }
  }, [volumes.length])

  const beginRename = vol => setEditing({ session: vol.session, draft: vol.name })
  const commitRename = async () => {
    if (!editing) return
    const { session, draft } = editing
    setEditing(null)
    const prev = titles
    const t = String(draft || '').trim()
    // optimistic: the UI flips first, persistence follows (house idiom)
    setTitles(cur => {
      const next = { ...cur }
      if (t) next[session] = t; else delete next[session]
      return next
    })
    try {
      if (store && store.saveSessionTitle) await store.saveSessionTitle(session, t)
    } catch (e2) {
      console.error('[shelf] title save failed:', e2)
      setTitles(prev)
      alert(`Could not save the session title: ${e2.message}`)
    }
  }

  // hover peek — closed spines only, mouse pointers only (CSS hides it coarse)
  const spineMove = (e, i) => {
    if (openIdx === i) { setPeek(null); return }
    const pad = 22, W = 300, H = 170
    let x = e.clientX + pad, y = e.clientY + pad
    if (typeof window !== 'undefined') {
      if (x + W > window.innerWidth) x = e.clientX - W - pad
      if (y + H > window.innerHeight) y = e.clientY - H - pad
    }
    setPeek({ i, x, y })
  }

  const bodyClick = e => {
    if (e.target.tagName === 'IMG' && e.target.closest('.c-entry-text')) {
      setLightbox(e.target.currentSrc || e.target.src)
    }
  }

  if (live && !rows && !err) return <p className="sh-state">opening the book…</p>
  if (live && err) return <p className="sh-state">The book could not open ({err}). Try a refresh.</p>
  if (volumes.length === 0) return (
    <p className="sh-state">the book is empty — share a journal page or write in the <a href="chronicle.html">chronicle</a></p>
  )

  return (
    <div className="sh-book">
      <div className="sh-shelf" ref={shelfRef} onMouseLeave={() => setPeek(null)}>
        <IndexOverlay
          open={ixOpen} fs={fs} facets={facets} seatNames={seatNames}
          volumes={volumes} results={results} accents={accents}
          onToggle={() => setIxOpen(o => !o)} onClose={() => setIxOpen(false)}
          onQ={v => setFs(s => ({ ...s, q: v }))}
          onAuthor={k => setFs(s => ({ ...s, author: s.author === k ? null : k }))}
          onTag={t => setFs(s => { const tags = { ...s.tags }; tags[t] ? delete tags[t] : (tags[t] = 1); return { ...s, tags } })}
          onNpc={n => setFs(s => { const npcs = { ...s.npcs }; npcs[n] ? delete npcs[n] : (npcs[n] = 1); return { ...s, npcs } })}
          onClear={removeChip} onJump={jumpTo}
        />

        {volumes.map((vol, i) => {
          const older = volumes[i - 1], newer = volumes[i + 1]
          const open = openIdx === i
          return (
            <section className={`sh-vol ${open ? 'is-open' : ''}`} key={`${vol.session}-${i}`}
              ref={el => { volRefs.current[i] = el }}>
              <button type="button" className="sh-spine" aria-expanded={open}
                aria-label={`${vol.num}: ${vol.name}`}
                onClick={() => toggle(i)}
                onMouseMove={e => spineMove(e, i)}
                onMouseLeave={() => setPeek(p => (p && p.i === i ? null : p))}>
                {vol.showNum && <span className="sh-snum">{vol.num}</span>}
                <span className="sh-sname">{vol.spine}</span>
                <span className="sh-sfoot">
                  {vol.isNew && <span className="sh-tag-new">New</span>}
                  <Medallions vol={vol} accents={accents} />
                  <span className="sh-sdate">{vol.date}</span>
                </span>
              </button>

              <div className="sh-panel">
                <div className="sh-panel-inner" tabIndex={-1} ref={el => { panelRefs.current[i] = el }}>
                  <header className="sh-p-head">
                    <button type="button" className="sh-p-close" onClick={() => toggle(i)}>Close&nbsp;×</button>
                    <div className="sh-p-tags">
                      {vol.tags.map(t => <span className="sh-p-tag" key={t}>{t}</span>)}
                    </div>
                    {editing && editing.session === vol.session ? (
                      <input
                        className="sh-p-title-edit"
                        value={editing.draft}
                        autoFocus
                        placeholder={vol.num}
                        aria-label="Session title"
                        onChange={e => setEditing(ed => ({ ...ed, draft: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        onBlur={commitRename}
                      />
                    ) : (
                      <h2 className="sh-p-title">
                        {vol.name}
                        {live && isStaff && (
                          <button type="button" className="sh-p-rename" title="Rename this session (staff)"
                            aria-label={`Rename ${vol.num}`}
                            onClick={() => beginRename(vol)}>✎</button>
                        )}
                      </h2>
                    )}
                    {vol.intro && <p className="sh-p-intro">{vol.intro}</p>}
                    <div className="sh-p-meta">
                      <span>{vol.num}</span><span>·</span><span>{vol.date}</span><span>·</span>
                      <Medallions vol={vol} accents={accents} row />
                    </div>
                  </header>

                  {(() => {
                    const marks = mergeTimeline(vol.entries, fightsBySess[vol.session])
                      .filter(it => it.k === 'fight' || it.e.kind === 'section')
                    if (marks.length < 2) return null
                    return (
                      <nav className="sh-outline" aria-label="In this session">
                        {marks.map((it, oi) => {
                          const id = it.k === 'fight' ? `fight-${it.f.id}` : `sec-${it.e.id}`
                          const label = it.k === 'fight' ? `⚔ ${it.f.encounter}` : it.e.section
                          return (
                            <button key={oi} type="button" className={`sh-ol-item${it.k === 'fight' ? ' is-fight' : ''}`}
                              onClick={() => scrollToId(i, id)}>{label}</button>
                          )
                        })}
                      </nav>
                    )
                  })()}

                  <div className="sh-p-entries" onClick={bodyClick}>
                    {mergeTimeline(vol.entries, fightsBySess[vol.session]).map(it => {
                      if (it.k === 'fight') return <FightBlock key={`fight-${it.f.id}`} f={it.f} accents={accents} />
                      if (it.e.kind === 'section') return <h3 className="sh-section" id={`sec-${it.e.id}`} key={it.e.id}>{it.e.section}</h3>
                      return <PanelEntry key={it.e.id} e={it.e} accents={accents} />
                    })}
                  </div>

                  <nav className="sh-p-turn" aria-label="Volume navigation">
                    <button type="button" className="sh-turn-prev" disabled={!older}
                      onClick={() => older && toggle(i - 1)}>
                      <span className="sh-t-label">← Previous volume</span>
                      {older
                        ? <span className="sh-t-title">{older.name}</span>
                        : <span className="sh-t-empty">This is where it begins.</span>}
                    </button>
                    <button type="button" className="sh-turn-next" disabled={!newer}
                      onClick={() => newer && toggle(i + 1)}>
                      <span className="sh-t-label">Next volume →</span>
                      {newer
                        ? <span className="sh-t-title">{newer.name}</span>
                        : <span className="sh-t-empty">The story continues at the table.</span>}
                    </button>
                  </nav>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <div className="sh-frame" aria-hidden="true">
        <span className="sh-frame-bl">Kirtas, the Frontier</span>
        <span className="sh-frame-br">The Chronicle · {live ? 'the living record' : 'sample data'}</span>
      </div>

      <button type="button" className={`sh-tostart${scrolled ? ' is-on' : ''}`}
        onClick={() => { const sh = shelfRef.current; if (sh) { if (sh.scrollTo) sh.scrollTo({ left: 0, behavior: 'smooth' }); else sh.scrollLeft = 0 } }}>
        ⟵ Start
      </button>

      {peek && volumes[peek.i] && (
        <div className="sh-peek is-on" style={{ left: peek.x, top: peek.y }} aria-hidden="true">
          <div className="sh-pk-label">{volumes[peek.i].num} · {volumes[peek.i].date}</div>
          <div className="sh-pk-excerpt">“{volumes[peek.i].excerpt}”</div>
        </div>
      )}

      {lightbox && (
        <div className="jc-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="image — click anywhere to close">
          <img src={lightbox} alt="" />
          <button type="button" className="jc-lightbox-x" onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
