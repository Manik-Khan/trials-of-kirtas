// journal.html — Phase 0/1 walled corner.
// Composer (TipTap + TokMention) → in-memory entries (Phase 2 = Supabase)
// → each entry displays its extracted structured refs, proving the
// queryable-backlinks payoff.

import React, { useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TokMention, extractRefs } from './editor/MentionExtension.js'
import { suggestion } from './editor/suggestion.js'

function fmtWhen(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function RefChips({ refs }) {
  if (!refs.length) return <span className="j-refs-none">no references</span>
  return refs.map(r => (
    <span
      key={`${r.type}:${r.id}`}
      className={`j-ref-chip is-${r.type} ${r.resolved ? '' : 'is-unresolved'}`}
      title={r.resolved ? `${r.type} · ${r.id}` : `unresolved ${r.type} — Phase 2: stub-create`}
    >
      {r.type === 'npc' ? '👤' : '📍'} {r.label}
      {r.count > 1 && <em className="j-ref-count">×{r.count}</em>}
    </span>
  ))
}

function Entry({ entry }) {
  const [showJSON, setShowJSON] = useState(false)
  return (
    <article className="j-entry">
      <header className="j-entry-head">
        <span className="j-entry-when">{fmtWhen(entry.at)}</span>
        <button type="button" className="j-entry-json" onClick={() => setShowJSON(v => !v)}>
          {showJSON ? 'hide structure' : 'structure'}
        </button>
      </header>
      <div className="j-entry-body c-entry-text" dangerouslySetInnerHTML={{ __html: entry.html }} />
      <footer className="j-entry-refs"><RefChips refs={entry.refs} /></footer>
      {showJSON && (
        <pre className="j-entry-dump">{JSON.stringify(entry.refs, null, 2)}</pre>
      )}
    </article>
  )
}

export default function App() {
  const [entries, setEntries] = useState([])

  const [isEmpty, setIsEmpty] = useState(true)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TokMention.configure({ suggestion }),
    ],
    content: '',
    editorProps: {
      attributes: { class: 'j-editor-content' },
    },
    onCreate: ({ editor }) => setIsEmpty(editor.isEmpty),
    onUpdate: ({ editor }) => setIsEmpty(editor.isEmpty),
  })

  const save = () => {
    if (!editor || editor.isEmpty) return
    const json = editor.getJSON()
    setEntries(es => [{
      at: Date.now(),
      html: editor.getHTML(),
      refs: extractRefs(json),
    }, ...es])
    editor.commands.clearContent(true)
    editor.commands.focus()
  }

  // Session-level rollup: every ref across all entries (the backlink teaser)
  const rollup = useMemo(() => {
    const m = new Map()
    entries.forEach(e => e.refs.forEach(r => {
      const k = `${r.type}:${r.id}`
      const cur = m.get(k)
      if (cur) cur.count += r.count
      else m.set(k, { ...r })
    }))
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [entries])

  return (
    <div className="j-page">
      <header className="j-header">
        <div className="j-eyebrow">The Trials of Kirtas</div>
        <h1 className="j-title">Journal</h1>
        <p className="j-sub">
          Phase 0/1 preview — TipTap walled corner · typed <code>@</code> mentions as
          structured nodes · sample data baked in, nothing persists
        </p>
      </header>

      <section className="j-composer">
        <div className="j-editor-wrap">
          {isEmpty && (
            <div className="j-placeholder" aria-hidden="true">
              <p>The Chronicle awaits…</p>
              <p>
                Record a <span className="tok-mention npc-link">@example person</span> or{' '}
                <span className="tok-mention location-link">@example place</span> by writing @.
              </p>
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
        <div className="j-composer-bar">
          <span className="j-composer-hint">
            <code>@</code> to mention an NPC or location — a mention is one atomic
            token (backspace removes it whole). Unknown names offer “new NPC / new location.”
          </span>
          <button type="button" className="j-save" onClick={save}>Record entry</button>
        </div>
      </section>

      {rollup.length > 0 && (
        <section className="j-rollup">
          <h2 className="j-rollup-title">References across this journal</h2>
          <div className="j-rollup-chips"><RefChips refs={rollup} /></div>
          <p className="j-rollup-note">
            ↑ assembled by walking the structured doc — this is the query that becomes
            backlinks (“every entry that mentions X”) in Phase 2.
          </p>
        </section>
      )}

      <section className="j-entries">
        {entries.length === 0 && (
          <p className="j-empty">No entries yet — write one above and record it.</p>
        )}
        {entries.map(e => <Entry key={e.at} entry={e} />)}
      </section>
    </div>
  )
}
