// journal.html — Phase 2.5 ORGANIZATION mock (standalone, fake persistence).
// The journal as a vault: pages in sections, markdown-style typing,
// [[wikilinks]] between pages, @ world-mentions, outline, backlinks.
// Layout: tree sidebar · editor · knowledge panels. Desktop-first.
// (The Phase 2 record/seat/cross-post flow is preserved in App.jsx.phase2.bak
// and returns as the chronicle redesign; this mock is the private vault.)

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Callout } from './editor/Callout.js'
import { TokMention, extractRefs } from './editor/MentionExtension.js'
import { makeEntitySuggestion } from './editor/suggestion.js'
import { PageLink } from './editor/PageLink.js'
import { makePageSuggestion } from './editor/pageSuggestion.js'
import { extractOutline } from './data/vault.js'
import { entityStore } from './data/entityStore.js'
import { Toolbar } from './editor/Toolbar.jsx'
import CurationQueue from './CurationQueue.jsx'

function RefChips({ refs }) {
  if (!refs.length) return <span className="j-refs-none">no world references</span>
  return refs.map(r => (
    <span key={`${r.type}:${r.id}`} className={`j-ref-chip is-${r.type}`}>
      {r.type === 'npc' ? '👤' : '📍'} {r.label}
      {r.count > 1 && <em className="j-ref-count">×{r.count}</em>}
    </span>
  ))
}

export default function JournalView({ vault, banner = null, isStaff = false, store = null }) {
  const first = vault.pages()[0]
  const [activeId, setActiveId] = useState(first?.id || null)
  const activeRef = useRef(activeId)
  const [tick, setTick] = useState(0)           // tree / entity pool changes
  const [docTick, setDocTick] = useState(0)     // active doc changed (outline/refs)
  const [newPageIn, setNewPageIn] = useState(null) // folder receiving a new page
  const [newSection, setNewSection] = useState(false)
  const [menuFor, setMenuFor] = useState(null)  // page id with the ⋯ menu open
  const [renaming, setRenaming] = useState(null) // page id being renamed inline
  const [dragId, setDragId] = useState(null)    // page id being dragged
  const [dropMark, setDropMark] = useState(null) // {id, before} | {folder}
  const bump = () => setTick(t => t + 1)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Callout,
      TokMention.configure({
        suggestion: makeEntitySuggestion({ onCreateEntity: bump }),
      }),
      PageLink.configure({
        suggestion: makePageSuggestion({ onCreatePage: bump }),
      }),
    ],
    content: first?.html || '',
    editorProps: { attributes: { class: 'j-editor-content' } },
    onUpdate: ({ editor }) => {
      vault.saveDoc(activeRef.current, { html: editor.getHTML(), json: editor.getJSON() })
      setDocTick(t => t + 1)
    },
  })

  // switch pages: current autosaves via onUpdate; load the new doc
  const openPage = id => {
    if (!editor || id === activeRef.current) return
    vault.saveDoc(activeRef.current, { html: editor.getHTML(), json: editor.getJSON() })
    activeRef.current = id
    setActiveId(id)
    const p = vault.get(id)
    editor.commands.setContent(p?.html || '')
    setDocTick(t => t + 1)
  }
  useEffect(() => { activeRef.current = activeId }, [activeId])
  useEffect(() => {
    const close = () => setMenuFor(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const active = vault.get(activeId)
  const canEditActive = vault.canEdit ? vault.canEdit(activeId) : true
  const canWriteHere = vault.canWrite ? vault.canWrite() : true

  useEffect(() => {
    if (editor) editor.setEditable(canEditActive)
  }, [editor, canEditActive])

  const outline = useMemo(
    () => (editor ? extractOutline(editor.getJSON()) : []),
    [editor, docTick],
  )
  const worldRefs = useMemo(
    () => (editor ? extractRefs(editor.getJSON()) : []),
    [editor, docTick],
  )
  const linkedFrom = useMemo(
    () => (activeId ? vault.backlinksTo(activeId) : []),
    [activeId, docTick, tick],
  )

  const renameActive = title => {
    if (!active) return
    active.title = title                          // live keystroke echo
    bump()
  }
  const commitActiveRename = () => {              // persist on blur/Enter —
    if (!active || !canEditActive) return         // title-only, slug stable
    if (vault.renamePage) vault.renamePage(active.id, active.title)
  }

  const commitTreeRename = (id, title) => {
    if (vault.renamePage && title.trim()) vault.renamePage(id, title)
    setRenaming(null)
    bump()
  }

  const canDeletePage = id =>
    vault.canDelete ? vault.canDelete(id) : (vault.canEdit ? vault.canEdit(id) : true)

  const deletePage = id => {
    const p = vault.get(id)
    if (!p || !canDeletePage(id)) return
    if (!window.confirm(`Delete “${p.title}”? Pages that link here keep a dashed dead link.`)) return
    if (vault.deletePage) vault.deletePage(id)
    setMenuFor(null)
    if (activeRef.current === id) {
      const next = vault.pages()[0]
      activeRef.current = next?.id || null
      setActiveId(next?.id || null)
      if (editor) editor.commands.setContent(next?.html || '')
    }
    bump()
  }

  // reorder: drop before/after a sibling, or onto a section name to append.
  const dropOnPage = (targetId, before) => {
    if (!dragId || dragId === targetId || !vault.reorder) return
    const tgt = vault.get(targetId)
    const ordered = vault.pagesIn(tgt.folder).map(p => p.id).filter(id => id !== dragId)
    const at = ordered.indexOf(targetId) + (before ? 0 : 1)
    ordered.splice(at, 0, dragId)
    vault.reorder(tgt.folder, ordered)
    bump()
  }
  const dropOnFolder = folder => {
    if (!dragId || !vault.reorder) return
    const ordered = vault.pagesIn(folder).map(p => p.id).filter(id => id !== dragId)
    ordered.push(dragId)
    vault.reorder(folder, ordered)
    bump()
  }

  const addPage = (folder, title) => {
    const p = vault.addPage(folder, title)
    setNewPageIn(null)
    if (p) { bump(); openPage(p.id) }
  }
  const addSection = name => {
    vault.addFolder(name)
    setNewSection(false)
    bump()
  }

  const shareActive = async () => {
    if (!active || !canEditActive) return
    try {
      if (vault.share) await vault.share(active.id)
      else active.shared = true
      bump()
    } catch (e) {
      console.error('[journal] share failed:', e)
    }
  }

  const stubs = entityStore.createdStubs()

  return (
    <div className="j-vault" data-tick={tick}>

      {/* ── sidebar: the vault tree ── */}
      <aside className="j-side">
        <div className="j-side-head">
          <div className="j-eyebrow">The Trials of Kirtas</div>
          <h1 className="j-side-title">{vault.character}’s Journal</h1>
        </div>

        <nav className="j-tree">
          {vault.folders().map(f => (
            <div className="j-tree-folder" key={f}>
              <div
                className={`j-tree-folder-row ${dropMark && dropMark.folder === f ? 'drop-target' : ''}`}
                onDragOver={e => { if (dragId) { e.preventDefault(); setDropMark({ folder: f }) } }}
                onDragLeave={() => setDropMark(m => (m && m.folder === f ? null : m))}
                onDrop={e => { e.preventDefault(); dropOnFolder(f); setDropMark(null) }}
              >
                <span className="j-tree-folder-name">{f}</span>
                {canWriteHere && (
                  <button type="button" className="j-tree-add" title={`new page in ${f}`}
                    onClick={() => setNewPageIn(newPageIn === f ? null : f)}>+</button>
                )}
              </div>
              {newPageIn === f && (
                <input
                  className="j-tree-input" autoFocus placeholder="page title…"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) addPage(f, e.target.value)
                    if (e.key === 'Escape') setNewPageIn(null)
                  }}
                />
              )}
              {vault.pagesIn(f).map(p => {
                const mine = vault.canEdit ? vault.canEdit(p.id) : true
                const mark = dropMark && dropMark.id === p.id ? (dropMark.before ? 'drop-before' : 'drop-after') : ''
                if (renaming === p.id) return (
                  <input
                    key={p.id} className="j-tree-input" autoFocus defaultValue={p.title}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitTreeRename(p.id, e.target.value)
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    onBlur={e => commitTreeRename(p.id, e.target.value)}
                  />
                )
                return (
                  <div
                    key={p.id}
                    className={`j-tree-row ${mark} ${dragId === p.id ? 'dragging' : ''} ${mine ? '' : 'foreign'}`}
                    draggable={mine}
                    onDragStart={e => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move' }}
                    onDragEnd={() => { setDragId(null); setDropMark(null) }}
                    onDragOver={e => {
                      if (!dragId || dragId === p.id) return
                      e.preventDefault()
                      const r = e.currentTarget.getBoundingClientRect()
                      setDropMark({ id: p.id, before: e.clientY < r.top + r.height / 2 })
                    }}
                    onDragLeave={() => setDropMark(m => (m && m.id === p.id ? null : m))}
                    onDrop={e => {
                      e.preventDefault()
                      dropOnPage(p.id, !!(dropMark && dropMark.id === p.id && dropMark.before))
                      setDropMark(null)
                    }}
                  >
                    {mine && <span className="j-tree-grip" title="drag to reorder / move">⋮⋮</span>}
                    <button
                      type="button"
                      className={`j-tree-page ${p.id === activeId ? 'is-active' : ''}`}
                      onClick={() => openPage(p.id)}
                    >
                      {p.title}{p.shared && <span className="j-tree-shared" title="shared to the Chronicle"> 📜</span>}
                    </button>
                    {(mine || canDeletePage(p.id)) && (
                      <button type="button" className="j-tree-dots"
                        onClick={e => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id) }}>⋯</button>
                    )}
                    {menuFor === p.id && (
                      <div className="j-tree-menu">
                        {mine && <>
                          <button type="button" onClick={() => { setMenuFor(null); setRenaming(p.id) }}>Rename</button>
                          <div className="j-tree-menu-note">rename keeps the slug — links won’t break</div>
                        </>}
                        {canDeletePage(p.id) && (
                          <button type="button" className="danger" onClick={() => deletePage(p.id)}>
                            {mine ? 'Delete' : 'Delete (staff)'}
                          </button>
                        )}
                        {!mine && <div className="j-tree-menu-note">another author’s page — words are theirs; staff keep delete for moderation</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {!canWriteHere ? null : newSection
            ? (
              <input
                className="j-tree-input" autoFocus placeholder="section name…"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) addSection(e.target.value)
                  if (e.key === 'Escape') setNewSection(false)
                }}
              />
            )
            : (
              <button type="button" className="j-tree-newsection" onClick={() => setNewSection(true)}>
                + new section
              </button>
            )}
        </nav>

        {outline.length > 0 && (
          <div className="j-outline">
            <div className="j-side-label">Outline</div>
            {outline.map((h, i) => (
              <div key={i} className={`j-outline-item lvl-${h.level}`}>{h.text}</div>
            ))}
          </div>
        )}
      </aside>

      {/* ── main: the page ── */}
      <main className="j-main">
        {banner && <div className="j-banner">{banner}</div>}
        {active && (
          <>
            <header className="j-page-head">
              <input
                className="j-page-title"
                value={active.title}
                readOnly={!canEditActive}
                onChange={e => canEditActive && renameActive(e.target.value)}
                onBlur={commitActiveRename}
                onKeyDown={e => { if (e.key === 'Enter') { e.target.blur() } }}
              />
              <div className="j-page-meta">
                <select
                  className="j-seat-select" value={active.folder}
                  onChange={e => { vault.movePage(active.id, e.target.value); bump() }}
                  title="move to section"
                >
                  {vault.folders().map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {canEditActive && (
                  <button type="button" className="j-save" onClick={shareActive} disabled={active.shared}>
                    {active.shared ? '📜 shared' : 'Share to Chronicle'}
                  </button>
                )}
              </div>
            </header>

            {canEditActive && <Toolbar editor={editor} />}
            <EditorContent editor={editor} />

            <div className="j-cheat">
              <code># heading</code> <code>**bold**</code> <code>*italic*</code>{' '}
              <code>&gt; quote</code> <code>- list</code> <code>[ ] task</code>{' '}
              <code>--- rule</code> <code>@ world</code> <code>[[ page</code>
            </div>

            <section className="j-know">
              <div className="j-know-col">
                <div className="j-side-label">Linked from</div>
                {linkedFrom.length === 0 && <span className="j-refs-none">no pages link here yet</span>}
                {linkedFrom.map(p => (
                  <button type="button" key={p.id} className="j-backlink-page" onClick={() => openPage(p.id)}>
                    📄 {p.title} <em className="j-backlink-folder">· {p.folder}</em>
                  </button>
                ))}
              </div>
              <div className="j-know-col">
                <div className="j-side-label">World references on this page</div>
                <div className="j-rollup-chips"><RefChips refs={worldRefs} /></div>
              </div>
            </section>

            {isStaff && <CurationQueue store={store} isStaff={isStaff} />}
            {!isStaff && stubs.length > 0 && (
              <section className="j-newents">
                <div className="j-side-label">New to the world</div>
                <ul className="j-newents-list">
                  {stubs.map(e => (
                    <li key={`${e.type}:${e.id}`} className={`j-newent is-${e.type}`}>
                      <span className="j-newent-name">{e.type === 'npc' ? '👤' : '📍'} {e.label}</span>
                      <span className="j-newent-dest">
                        {e.type === 'npc' ? '→ NPC page · pending curation' : '→ world map · unmapped, awaiting a pin'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
