// journal page — two surfaces, one system, one skin:
//   Journal   → the vault (Obsidian bones, shelf skin)
//   Chronicle → the shelf (spines + the Miranda accordion)
//
// App owns the READING LOOK: ink + paper, per-reader, persisted as keys in
// profiles.appearance via saveMyLook (replace-not-merge). The look paints
// as --sh-* vars on the .sh-scope wrapper BEFORE the surfaces render —
// backend resolves first, so there is no unstyled flash. The axes never
// cross: inkVars/paperVars are structurally independent (shelfTheme.js).
import React, { useEffect, useRef, useState } from 'react'
import JournalView from './JournalView.jsx'
import ChronicleView from './ChronicleView.jsx'
import RecordsModeSwitch from './RecordsModeSwitch.jsx'
import { bootJournal } from './data/backend.js'
import { clampDockWidth, DEFAULT_DOCK_WIDTH, recordsModeFromSearch, recordsSearch } from './recordsLayout.js'
import { INKS, PAPERS, DEFAULT_LOOK, lookVars, resolveInk, resolvePaper } from './shelf/shelfTheme.js'
import { questCaptureEnabled } from './data/questModel.js'

// nav.js mounts asynchronously (after the session gate) — the strip's
// ink/paper switcher stands down the moment site chrome exists, because the
// ◐ Settings flyout owns the look now. Standalone previews (no nav) keep
// the switcher so journal-preview.html stays drivable.
const navPresent = () =>
  typeof document !== 'undefined' && !!document.getElementById('site-nav')
const DOCK_WIDTH_KEY = 'kirtas-records-journal-width'

const initialDockWidth = () => {
  if (typeof window === 'undefined') return DEFAULT_DOCK_WIDTH
  try {
    const saved = window.localStorage.getItem(DOCK_WIDTH_KEY)
    return saved == null ? DEFAULT_DOCK_WIDTH : clampDockWidth(saved)
  } catch { return DEFAULT_DOCK_WIDTH }
}

export default function App() {
  // journal.html remains the direct Journal address; Chronicle and the split
  // workspace deep-link through ?view= so bookmarks/back keep their meaning.
  const initialView = typeof window === 'undefined' ? 'journal' : recordsModeFromSearch(window.location.search)
  const questCapture = typeof window !== 'undefined' && questCaptureEnabled(window.location.search)
  const [view, setView] = useState(initialView)
  const [dockWidth, setDockWidth] = useState(initialDockWidth)
  const [backend, setBackend] = useState(null)
  const [look, setLook] = useState(DEFAULT_LOOK)
  const [hasNav, setHasNav] = useState(navPresent)
  const workspaceRef = useRef(null)

  useEffect(() => {
    bootJournal()
      .then(b => {
        setLook({
          ink: b.myLook && b.myLook.ink ? b.myLook.ink : DEFAULT_LOOK.ink,
          paper: b.myLook && b.myLook.paper ? b.myLook.paper : DEFAULT_LOOK.paper,
        })
        setBackend(b)
      })
      .catch(e => {
        console.error('[journal] boot failed:', e)
        setBackend({ mode: 'error', error: String(e?.message || e) })
      })
  }, [])

  useEffect(() => {
    const onPop = () => setView(recordsModeFromSearch(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(DOCK_WIDTH_KEY, String(dockWidth)) } catch {}
  }, [dockWidth])

  useEffect(() => {
    const label = view === 'journal' ? 'Journal' : view === 'both' ? 'Chronicle + Journal' : 'Chronicle'
    document.title = `${label} — The Trials of Kirtas`
  }, [view])

  // The ◐ Settings flyout is the look's writer now: it resolves this page's
  // effective look (default + journal override) and dispatches tok:look on
  // boot and on every change. The journal only paints what it's told.
  useEffect(() => {
    const onLook = e => {
      const eff = e.detail && e.detail.effective
      if (eff && eff.ink && eff.paper) setLook({ ink: eff.ink, paper: eff.paper })
    }
    const onNav = () => setHasNav(true)
    document.addEventListener('tok:look', onLook)
    document.addEventListener('nav:ready', onNav)
    if (navPresent()) setHasNav(true)
    return () => {
      document.removeEventListener('tok:look', onLook)
      document.removeEventListener('nav:ready', onNav)
    }
  }, [])

  // optimistic: the UI flips first, persistence follows (house idiom)
  const setInk = key => {
    setLook(l => ({ ...l, ink: key }))
    if (backend?.store?.saveMyLook) backend.store.saveMyLook({ ink: key })
      .catch(e => console.error('[journal] look save failed:', e))
  }
  const setPaper = key => {
    setLook(l => ({ ...l, paper: key }))
    if (backend?.store?.saveMyLook) backend.store.saveMyLook({ paper: key })
      .catch(e => console.error('[journal] look save failed:', e))
  }

  const setRecordsMode = next => {
    if (next === view) return
    setView(next)
    if (typeof window !== 'undefined') {
      const url = window.location.pathname + recordsSearch(next, window.location.search) + window.location.hash
      window.history.pushState({ recordsMode: next }, '', url)
    }
  }

  const resizeDock = clientX => {
    if (!workspaceRef.current || window.matchMedia('(max-width: 900px)').matches) return
    const rect = workspaceRef.current.getBoundingClientRect()
    setDockWidth(clampDockWidth(((rect.right - clientX) / rect.width) * 100))
  }

  const onDividerDown = e => {
    if (window.matchMedia('(max-width: 900px)').matches) return
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeDock(e.clientX)
  }
  const onDividerMove = e => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) resizeDock(e.clientX)
  }
  const onDividerUp = e => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const onDividerKey = e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault(); e.stopPropagation()
    setDockWidth(w => clampDockWidth(w + (e.key === 'ArrowLeft' ? 2 : -2)))
  }

  if (!backend) {
    return <p className="sh-boot">Opening the journal…</p>
  }
  if (backend.mode === 'error') {
    return (
      <p className="sh-boot">
        The journal could not open ({backend.error}). Try a refresh, or check that the schema delta has been run.
      </p>
    )
  }

  return (
    <div className="sh-scope" style={lookVars(look)} data-polarity={resolvePaper(look.paper).polarity}>
      <div className="sh-mottle" aria-hidden="true" />
      <div className="sh-grain" aria-hidden="true" />

      {!hasNav && (
      <nav className="sh-strip">
        <RecordsModeSwitch mode={view} onChange={setRecordsMode} />
        <div className="sh-switcher">
          <div className="sh-swrow" role="group" aria-label="Ink">
            <span>Ink</span>
            {INKS.map(p => (
              <button key={p.key} type="button"
                className={`sh-dot ${resolveInk(look.ink).key === p.key ? 'is-active' : ''}`}
                style={{ background: p.ink }}
                title={`Ink: ${p.name}`} aria-label={`Ink: ${p.name}`}
                onClick={() => setInk(p.key)} />
            ))}
          </div>
          <div className="sh-swrow" role="group" aria-label="Paper">
            <span>Paper</span>
            {PAPERS.map(p => (
              <button key={p.key} type="button"
                className={`sh-dot ${resolvePaper(look.paper).key === p.key ? 'is-active' : ''}`}
                style={{ background: p.paper }}
                title={`Paper: ${p.name}`} aria-label={`Paper: ${p.name}`}
                onClick={() => setPaper(p.key)} />
            ))}
          </div>
        </div>
      </nav>
      )}

      <div className="sh-view">
        <div className={`records-workspace is-${view}`} ref={workspaceRef}>
          {view !== 'journal' && (
            <section className="records-chronicle" aria-label="Chronicle">
              <ChronicleView live={backend.mode === 'live'} store={backend.store || null}
                accents={backend.accents || {}} isStaff={!!backend.isStaff}
                questCapture={questCapture}
                recordsMode={view} onRecordsModeChange={setRecordsMode} />
            </section>
          )}
          {view === 'both' && (
            <button type="button" className="records-divider" role="separator"
              aria-label="Resize Journal" aria-orientation="vertical"
              aria-valuemin="30" aria-valuemax="62" aria-valuenow={Math.round(dockWidth)}
              onPointerDown={onDividerDown} onPointerMove={onDividerMove}
              onPointerUp={onDividerUp} onPointerCancel={onDividerUp}
              onKeyDown={onDividerKey}>
              <span aria-hidden="true">‹<b />›</span>
            </button>
          )}
          {view !== 'chronicle' && (
            <section className="records-journal" aria-label="Journal"
              style={view === 'both' ? { width: `${dockWidth}%` } : undefined}>
              <JournalView
                vault={backend.vault} banner={backend.banner}
                isStaff={!!backend.isStaff} store={backend.store || null}
                comments={backend.comments || null} accents={backend.accents || {}}
                me={backend.me || null}
                viewSeatKey={backend.viewSeatKey !== undefined ? backend.viewSeatKey : null}
                live={backend.mode === 'live'}
                questCapture={questCapture}
                commentCounts={backend.commentCounts || {}}
                docked={view === 'both'} recordsMode={view}
                onRecordsModeChange={setRecordsMode}
                onCloseDock={() => setRecordsMode('chronicle')} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
