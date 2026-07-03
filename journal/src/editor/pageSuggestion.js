// Suggestion wiring for the [[ trigger — separated from the PageLink
// node so the node stays JSX-free and headlessly testable.

import { ReactRenderer } from '@tiptap/react'
import { computePosition, flip, shift, offset } from '@floating-ui/dom'
import { MentionList } from './MentionList.jsx'

import { buildPageItems } from './pagelink-core.js'
export { resolvePageLinkClick } from './pagelink-core.js'

export function makePageSuggestion({ vault, onCreatePage } = {}) {
  if (!vault) throw new Error('makePageSuggestion needs the active vault')
  return {
    char: '[[',
    allowSpaces: true,

    items: ({ query }) => buildPageItems(vault, query),

    command: ({ editor, range, props }) => {
      let { id, label } = { id: props.id, label: props.label }
      if (!id) {
        const page = vault.addPage('Unsorted', label)
        id = page.id
        label = page.title
        onCreatePage?.(page)
      }
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'pageLink', attrs: { pageId: id, label } },
          { type: 'text', text: ' ' },
        ])
        .run()
    },

    render: () => {
      let component
      let popupEl

      const place = clientRect => {
        if (!popupEl || !clientRect) return
        computePosition({ getBoundingClientRect: clientRect }, popupEl, {
          placement: 'bottom-start',
          middleware: [offset(6), flip(), shift({ padding: 8 })],
        }).then(({ x, y }) => Object.assign(popupEl.style, { left: `${x}px`, top: `${y}px` }))
      }

      return {
        onStart: props => {
          component = new ReactRenderer(MentionList, { props, editor: props.editor })
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
          popupEl?.remove(); component?.destroy()
          component = null; popupEl = null
        },
      }
    },
  }
}


