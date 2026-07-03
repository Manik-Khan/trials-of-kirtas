// journal preview / page — two surfaces, one system:
//   Journal   → the vault (per character; live on-site, sample standalone)
//   Chronicle → the shared book (redesign mock)
import React, { useEffect, useState } from 'react'
import JournalView from './JournalView.jsx'
import ChronicleView from './ChronicleView.jsx'
import { bootJournal } from './data/backend.js'

export default function App() {
  const [view, setView] = useState('journal')
  const [backend, setBackend] = useState(null)

  useEffect(() => {
    bootJournal()
      .then(setBackend)
      .catch(e => {
        console.error('[journal] boot failed:', e)
        setBackend({ mode: 'error', error: String(e?.message || e) })
      })
  }, [])

  if (!backend) {
    return <p className="j-empty" style={{ marginTop: '4rem' }}>Opening the journal…</p>
  }
  if (backend.mode === 'error') {
    return (
      <p className="j-empty" style={{ marginTop: '4rem' }}>
        The journal could not open ({backend.error}). Try a refresh, or check that the schema delta has been run.
      </p>
    )
  }

  return (
    <div>
      <nav className="j-viewnav">
        <button
          type="button"
          className={`j-viewtab ${view === 'journal' ? 'is-on' : ''}`}
          onClick={() => setView('journal')}
        >
          Journal <em>{backend.mode === 'live' ? `${backend.vault.character}’s vault` : 'private vault'}</em>
        </button>
        <button
          type="button"
          className={`j-viewtab ${view === 'chronicle' ? 'is-on' : ''}`}
          onClick={() => setView('chronicle')}
        >
          Chronicle <em>{backend.mode === 'live' ? 'redesign preview' : 'the shared book'}</em>
        </button>
      </nav>
      {view === 'journal'
        ? <JournalView vault={backend.vault} banner={backend.banner} isStaff={!!backend.isStaff} store={backend.store || null} comments={backend.comments || null} accents={backend.accents || {}} me={backend.me || null} />
        : <ChronicleView live={backend.mode === 'live'} store={backend.store || null} accents={backend.accents || {}} />}
    </div>
  )
}
