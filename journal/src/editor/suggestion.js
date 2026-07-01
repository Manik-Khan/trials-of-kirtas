// Suggestion wiring for TokMention: builds the candidate list and
// mounts/positions the MentionList popup with floating-ui.
//
// Matching mirrors chronicle.html's inline dropdown: case-insensitive
// substring over name OR key, NPCs first then Locations (5 each), and
// when the query matches nothing, offer "create as unresolved" rows.

import { ReactRenderer } from '@tiptap/react'
import { computePosition, flip, shift, offset } from '@floating-ui/dom'
import { MentionList } from './MentionList.jsx'
import { NPCS, LOCATIONS } from '../data/sample.js'
import { buildItems } from './match.js'

export const suggestion = {
  char: '@',
  allowSpaces: true, // multi-word queries: "@Lord Rey…"

  items: ({ query }) => buildItems(query, NPCS, LOCATIONS),

  render: () => {
    let component
    let popupEl

    const place = clientRect => {
      if (!popupEl || !clientRect) return
      const virtualEl = { getBoundingClientRect: clientRect }
      computePosition(virtualEl, popupEl, {
        placement: 'bottom-start',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        Object.assign(popupEl.style, { left: `${x}px`, top: `${y}px` })
      })
    }

    return {
      onStart: props => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        })
        popupEl = document.createElement('div')
        popupEl.className = 'jm-popup'
        popupEl.appendChild(component.element)
        document.body.appendChild(popupEl)
        place(props.clientRect)
      },

      onUpdate: props => {
        component?.updateProps(props)
        place(props.clientRect)
      },

      onKeyDown: props => {
        if (props.event.key === 'Escape') {
          popupEl?.remove()
          return true
        }
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
}
