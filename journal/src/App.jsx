// journal page — two surfaces, one system, one skin:
//   Journal   → the vault (Obsidian bones, shelf skin)
//   Chronicle → the shelf (spines + the Miranda accordion)
//
// App owns the READING LOOK: ink + paper, per-reader, persisted as keys in
// profiles.appearance via saveMyLook (replace-not-merge). The look paints
// as --sh-* vars on the .sh-scope wrapper BEFORE the surfaces render —
// backend resolves first, so there is no unstyled flash. The axes never
// cross: inkVars/paperVars are structurally independent (shelfTheme.js).
import React, { useEffect, useState } from 'react'
import JournalView from './JournalView.jsx'
import ChronicleView from './ChronicleView.jsx'
import { bootJournal } from './data/backend.js'
import { INKS, PAPERS, DEFAULT_LOOK, lookVars, resolveInk, resolvePaper } from './shelf/shelfTheme.js'

// nav.js mounts asynchronously (after the session gate) — the strip's
// ink/paper switcher stands down the moment site chrome exists, because the
// ◐ Settings flyout owns the look now. Standalone previews (no nav) keep
// the switcher so journal-preview.html stays drivable.
const navPresent = () =>
  typeof document !== 'undefined' && !!document.getElementById('site-nav')

export default function App() {
  const [view, setView] = useState('journal')
  const [backend, setBackend] = useState(null)
  const [look, setLook] = useState(DEFAULT_LOOK)
  const [hasNav, setHasNav] = useState(navPresent)

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

      <nav className="sh-strip">
        <div className="sh-tabs">
          <button
            type="button"
            className={`sh-tab ${view === 'journal' ? 'is-on' : ''}`}
            onClick={() => setView('journal')}
          >Journal</button>
          <button
            type="button"
            className={`sh-tab ${view === 'chronicle' ? 'is-on' : ''}`}
            onClick={() => setView('chronicle')}
          >Chronicle</button>
        </div>
        {!hasNav && (
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
        )}
      </nav>

      <div className="sh-view">
        {view === 'journal'
          ? <JournalView
              vault={backend.vault} banner={backend.banner}
              isStaff={!!backend.isStaff} store={backend.store || null}
              comments={backend.comments || null} accents={backend.accents || {}}
              me={backend.me || null}
              viewSeatKey={backend.viewSeatKey !== undefined ? backend.viewSeatKey : null}
              live={backend.mode === 'live'}
              commentCounts={backend.commentCounts || {}} />
          : <ChronicleView live={backend.mode === 'live'} store={backend.store || null}
              accents={backend.accents || {}} isStaff={!!backend.isStaff} />}
      </div>
    </div>
  )
}
