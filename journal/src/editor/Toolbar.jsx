// The toolbar — TipTap is headless, so this is entirely ours.
// Every markdown input rule has a clickable twin; active states track
// the cursor. Extend freely (this is where an image button lands later).

import React, { useEffect, useReducer } from 'react'

const BTNS = [
  { label: 'B',  title: 'bold', style: { fontWeight: 700 }, is: e => e.isActive('bold'), run: e => e.chain().focus().toggleBold().run() },
  { label: 'I',  title: 'italic', style: { fontStyle: 'italic' }, is: e => e.isActive('italic'), run: e => e.chain().focus().toggleItalic().run() },
  { label: 'S',  title: 'strikethrough', style: { textDecoration: 'line-through' }, is: e => e.isActive('strike'), run: e => e.chain().focus().toggleStrike().run() },
  { sep: true },
  { label: 'H1', title: 'heading 1', is: e => e.isActive('heading', { level: 1 }), run: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'H2', title: 'heading 2', is: e => e.isActive('heading', { level: 2 }), run: e => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'H3', title: 'heading 3', is: e => e.isActive('heading', { level: 3 }), run: e => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { sep: true },
  { label: '❝',  title: 'quote', is: e => e.isActive('blockquote'), run: e => e.chain().focus().toggleBlockquote().run() },
  { label: '•',  title: 'bullet list', is: e => e.isActive('bulletList'), run: e => e.chain().focus().toggleBulletList().run() },
  { label: '1.', title: 'numbered list', is: e => e.isActive('orderedList'), run: e => e.chain().focus().toggleOrderedList().run() },
  { label: '☑',  title: 'task list', is: e => e.isActive('taskList'), run: e => e.chain().focus().toggleTaskList().run() },
  { sep: true },
  { label: '‹›', title: 'code', is: e => e.isActive('code'), run: e => e.chain().focus().toggleCode().run() },
  { label: '—',  title: 'divider', is: () => false, run: e => e.chain().focus().setHorizontalRule().run() },
  { label: '❐',  title: 'callout (toggle)', is: e => e.isActive('callout'), run: e => e.chain().focus().toggleCallout().run() },
  { label: '❐↻', title: 'callout style (note → quest → warning → lore)', is: () => false, run: e => e.chain().focus().cycleCalloutVariant().run() },
  { sep: true },
  { label: '@',  title: 'mention an NPC or location', is: () => false, run: e => e.chain().focus().insertContent('@').run() },
  { label: '[[', title: 'link a journal page', is: () => false, run: e => e.chain().focus().insertContent('[[').run() },
]

export function Toolbar({ editor }) {
  const [, force] = useReducer(x => x + 1, 0)
  useEffect(() => {
    if (!editor) return undefined
    editor.on('transaction', force)
    return () => editor.off('transaction', force)
  }, [editor])

  if (!editor) return null
  return (
    <div className="j-toolbar" role="toolbar" aria-label="formatting">
      {BTNS.map((b, i) => b.sep
        ? <span className="j-tb-sep" key={`s${i}`} />
        : (
          <button
            type="button" key={b.title} title={b.title} style={b.style}
            className={`j-tb-btn ${b.is(editor) ? 'is-on' : ''}`}
            onMouseDown={e => e.preventDefault() /* keep editor focus */}
            onClick={() => b.run(editor)}
          >
            {b.label}
          </button>
        ))}
    </div>
  )
}
