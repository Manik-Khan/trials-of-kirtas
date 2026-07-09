// The "/" command menu. Same machinery as the @-mention and [[-pagelink
// dropdowns (@tiptap/suggestion), only the trigger char and the action differ:
// choosing an item deletes the typed "/query" range and runs a command.
//
// Adding a command = one entry in COMMANDS. Keep `keys` generous — that's what
// the fuzzy-ish substring match searches, so "/pic" and "/photo" both find image.

import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { computePosition, flip, shift, offset } from '@floating-ui/dom'
import { SlashList } from './SlashList.jsx'

// A command clears its own trigger text first, then acts. `chain` arrives
// already focused and with the "/query" range deleted.
export const COMMANDS = [
  {
    section: 'Insert', icon: '🖼', label: 'Image from URL', hint: 'no upload',
    keys: 'image img picture photo pic url embed',
    run: chain => {
      const url = (window.prompt('Image URL (https://…):') || '').trim()
      if (url) chain.setImage({ src: url }).run(); else chain.run()
    },
  },
  { section: 'Insert', icon: '—', label: 'Divider', keys: 'divider rule hr horizontal line separator', run: c => c.setHorizontalRule().run() },
  { section: 'Insert', icon: '@', label: 'Mention an NPC or location', keys: 'mention npc location person place at', run: c => c.insertContent('@').run() },
  { section: 'Insert', icon: '[[', label: 'Link a journal page', keys: 'page link journal wiki backlink', run: c => c.insertContent('[[').run() },

  { section: 'Blocks', icon: 'H1', label: 'Heading 1', keys: 'h1 heading title big', run: c => c.toggleHeading({ level: 1 }).run() },
  { section: 'Blocks', icon: 'H2', label: 'Heading 2', keys: 'h2 heading subtitle', run: c => c.toggleHeading({ level: 2 }).run() },
  { section: 'Blocks', icon: 'H3', label: 'Heading 3', keys: 'h3 heading small', run: c => c.toggleHeading({ level: 3 }).run() },
  { section: 'Blocks', icon: '❝', label: 'Quote', keys: 'quote blockquote citation', run: c => c.toggleBlockquote().run() },
  { section: 'Blocks', icon: '❐', label: 'Callout', hint: 'note / quest / warning / lore', keys: 'callout note warning lore quest admonition box', run: c => c.toggleCallout().run() },
  { section: 'Blocks', icon: '‹›', label: 'Code', keys: 'code mono inline', run: c => c.toggleCode().run() },

  { section: 'Lists', icon: '•', label: 'Bullet list', keys: 'bullet list unordered ul dot', run: c => c.toggleBulletList().run() },
  { section: 'Lists', icon: '1.', label: 'Numbered list', keys: 'numbered ordered list ol', run: c => c.toggleOrderedList().run() },
  { section: 'Lists', icon: '☑', label: 'Task list', keys: 'task todo check checkbox', run: c => c.toggleTaskList().run() },
]

export function slashItems(query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return COMMANDS
  return COMMANDS.filter(c =>
    c.label.toLowerCase().includes(q) || c.keys.split(/\s+/).some(k => k.startsWith(q)),
  )
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        // only at the start of a line or after whitespace, so "and/or" never triggers
        allowSpaces: false,
        startOfLine: false,
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          const before = $from.nodeBefore
          const text = before && before.isText ? before.text : ''
          return text === '' || /\s$/.test(text) || range.from === $from.start()
        },

        items: ({ query }) => slashItems(query),

        command: ({ editor, range, props }) => {
          // delete the "/query" text, then let the item act on the clean chain
          const chain = editor.chain().focus().deleteRange(range)
          props.run(chain)
        },

        render: () => {
          let component
          let popupEl

          const place = clientRect => {
            if (!popupEl || !clientRect) return
            computePosition({ getBoundingClientRect: clientRect }, popupEl, {
              placement: 'bottom-start',
              middleware: [offset(6), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => {
              Object.assign(popupEl.style, { left: `${x}px`, top: `${y}px` })
            })
          }

          return {
            onStart: props => {
              component = new ReactRenderer(SlashList, { props, editor: props.editor })
              popupEl = document.createElement('div')
              popupEl.className = 'jm-popup'
              popupEl.appendChild(component.element)
              document.body.appendChild(popupEl)
              place(props.clientRect)
            },
            onUpdate: props => { component?.updateProps(props); place(props.clientRect) },
            onKeyDown: props => {
              if (props.event.key === 'Escape') { popupEl?.remove(); return true }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              popupEl?.remove()
              component?.destroy()
              component = null
              popupEl = null
            },
          }
        },
      }),
    ]
  },
})
