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
import { buildBook } from './data/bookModel.js'
import { chaptersToVolumes, nextOpen, keyOpen } from './shelf/shelfModel.js'
import { seatColor } from './comments/accents.js'

const fmtTime = ts => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const entrySeat = e => e.seat || e.characterKey || 'narrator'

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
  return (
    <article className="sh-entry">
      <span className="sh-entry-med" style={{ background: accent }} title={`written by ${e.player}`}>
        {(e.character || '?').charAt(0)}
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

export default function ChronicleView({ live = false, store = null, accents = {} }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [openIdx, setOpenIdx] = useState(null)
  const [peek, setPeek] = useState(null)         // {i, x, y} | null
  const [lightbox, setLightbox] = useState(null) // image src | null
  const volRefs = useRef([])
  const panelRefs = useRef([])

  useEffect(() => {
    if (!live || !store) return
    let stale = false
    store.loadChronicleBook()
      .then(r => { if (!stale) setRows(r) })
      .catch(e => { if (!stale) setErr(e.message) })
    return () => { stale = true }
  }, [live, store])

  const chapters = useMemo(
    () => (live && rows ? buildBook(rows) : (live ? [] : CHRONICLE)),
    [live, rows],
  )
  const volumes = useMemo(() => chaptersToVolumes(chapters), [chapters])

  const toggle = i => {
    setPeek(null)
    setOpenIdx(cur => {
      const next = nextOpen(cur, i)
      if (next !== null) {
        // let the width animation start, then keep the volume in view
        setTimeout(() => {
          const p = panelRefs.current[next]
          if (p) p.scrollTop = 0
          const v = volRefs.current[next]
          if (v && v.scrollIntoView) v.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
        }, 80)
      }
      return next
    })
  }

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && lightbox) { setLightbox(null); return }
      if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setOpenIdx(cur => {
          const next = keyOpen(cur, e.key, volumes.length)
          if (next !== cur && next !== null) setTimeout(() => {
            const p = panelRefs.current[next]
            if (p) p.scrollTop = 0
            const v = volRefs.current[next]
            if (v && v.scrollIntoView) v.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
          }, 80)
          return next
        })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [volumes.length, lightbox])

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
      <div className="sh-shelf" onMouseLeave={() => setPeek(null)}>
        <div className="sh-intro-spine" aria-hidden="true">
          <span className="sh-mark">‖</span>
          <span className="sh-vtext">The Chronicle of the Trials</span>
          <span className="sh-loc">Kirtas</span>
        </div>

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
                <span className="sh-sname">{vol.name}</span>
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
                    <h2 className="sh-p-title">{vol.name}</h2>
                    {vol.intro && <p className="sh-p-intro">{vol.intro}</p>}
                    <div className="sh-p-meta">
                      <span>{vol.num}</span><span>·</span><span>{vol.date}</span><span>·</span>
                      <Medallions vol={vol} accents={accents} row />
                    </div>
                  </header>

                  <div className="sh-p-entries" onClick={bodyClick}>
                    {vol.entries.map(e => <PanelEntry key={e.id} e={e} accents={accents} />)}
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
