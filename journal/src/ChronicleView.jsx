// The Chronicle as the shared book — the redesign mock.
// Sessions are chapters. Entries from every character weave in
// chronological order, each carrying character · player, per-character
// accent, and provenance (from a journal / shared after the fact).
// Each chapter indexes who and where appears; clicking a thread dims
// everything that doesn't touch it — the backlink query at book scale.

import React, { useMemo, useState } from 'react'
import { CHRONICLE, CHARACTER_ACCENTS, parseRefsFromHTML } from './data/chronicleSample.js'

const fmtTime = ts => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function ThreadChips({ refs, selected, onPick }) {
  return refs.map(r => {
    const k = `${r.type}:${r.id}`
    return (
      <button
        type="button" key={k}
        className={`j-ref-chip is-${r.type} ${selected === k ? 'is-active' : ''}`}
        title={`follow this thread — dim entries that don't mention ${r.label}`}
        onClick={() => onPick(selected === k ? null : k)}
      >
        {r.type === 'npc' ? '👤' : '📍'} {r.label}
      </button>
    )
  })
}

function ChronicleEntry({ e, dimmed }) {
  const accent = CHARACTER_ACCENTS[e.characterKey] || CHARACTER_ACCENTS.narrator
  if (e.kind === 'narrator') {
    return (
      <div className={`jc-narr ${dimmed ? 'is-dim' : ''}`}>
        <div className="jc-narr-rule" />
        <div className="jc-narr-body c-entry-text" dangerouslySetInnerHTML={{ __html: e.html }} />
        <div className="jc-narr-meta" title={`written by ${e.player}`}>
          Narrator<span className="jc-player-reveal"> · {e.player}</span> · {fmtTime(e.at)}
        </div>
      </div>
    )
  }
  return (
    <article className={`jc-entry ${dimmed ? 'is-dim' : ''}`} style={{ '--accent': accent }}>
      <header className="jc-entry-head">
        <span className="jc-entry-who" title={`written by ${e.player}`}>
          {e.character}<span className="jc-player-reveal"> · {e.player}</span>
        </span>
        <span className="jc-entry-meta">
          {e.fromJournal && <span className="jc-badge" title={`shared from the journal page “${e.fromJournal}”`}>📄 from journal</span>}
          {e.sharedLate && <span className="jc-badge is-late" title="published after the session, placed at its written-at time">⏱ {e.sharedLate}</span>}
          <span className="j-entry-when">{fmtTime(e.at)}</span>
        </span>
      </header>
      <div className="jc-entry-body c-entry-text" dangerouslySetInnerHTML={{ __html: e.html }} />
    </article>
  )
}

export default function ChronicleView({ live = false }) {
  const [thread, setThread] = useState(null) // `${type}:${id}` or null

  // per-entry refs, computed once
  const withRefs = useMemo(
    () => CHRONICLE.map(ch => ({
      ...ch,
      entries: ch.entries.map(e => ({ ...e, refs: parseRefsFromHTML(e.html) })),
    })),
    [],
  )

  const chapterThreads = ch => {
    const m = new Map()
    ch.entries.forEach(e => e.refs.forEach(r => m.set(`${r.type}:${r.id}`, r)))
    return [...m.values()]
  }

  const touches = (e, key) => !key || e.refs.some(r => `${r.type}:${r.id}` === key)

  return (
    <div className="jc-book">
      <header className="jc-book-head">
        <div className="j-eyebrow">The Trials of Kirtas</div>
        <h1 className="j-title">The Chronicle</h1>
        <p className="j-sub">the shared book — every voice, one record · redesign mock, sample data</p>
        {live && (
          <p className="j-banner" style={{ maxWidth: '560px', margin: '0.8rem auto 0' }}>
            This tab is the redesign preview (sample entries). The live chronicle is still{' '}
            <a href="chronicle.html" style={{ color: 'var(--gold-light, #d4ac3a)' }}>chronicle.html</a> —
            shared journal pages land there.
          </p>
        )}
        <nav className="jc-toc">
          {withRefs.map(ch => (
            <a key={ch.session} className="jc-toc-item" href={`#session-${ch.session}`}>
              <span className="jc-toc-num">{ch.session}</span> {ch.title}
            </a>
          ))}
        </nav>
      </header>

      {withRefs.map(ch => (
        <section className="jc-chapter" key={ch.session} id={`session-${ch.session}`}>
          <header className="jc-chapter-head">
            <div className="jc-chapter-eyebrow">Session {ch.session} · {ch.date}</div>
            <h2 className="jc-chapter-title">{ch.title}</h2>
            <div className="jc-chapter-threads">
              <span className="jc-threads-label">threads</span>
              <ThreadChips refs={chapterThreads(ch)} selected={thread} onPick={setThread} />
            </div>
          </header>

          <div className="jc-weave">
            {ch.entries.map(e => (
              <ChronicleEntry key={e.id} e={e} dimmed={!touches(e, thread)} />
            ))}
          </div>
        </section>
      ))}

      <footer className="jc-book-foot">
        <p>
          Entries arrive here by <strong>sharing from a character's journal</strong> (📄) or by
          writing in the chronicle directly. Late shares (⏱) take their place in the timeline by
          written-at time. Sessions stay the spine.
        </p>
      </footer>
    </div>
  )
}
