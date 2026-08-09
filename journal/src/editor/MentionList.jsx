// The @-suggestion dropdown. Mirrors the chronicle's inline dropdown:
// NPCs section (👤, gold) · Locations section (📍, steel-blue) ·
// and when nothing matches, "create as unresolved" rows — a typed
// name becomes an unresolved mention (Phase 2 turns these into
// stub-create).

import React, {
  forwardRef, useEffect, useImperativeHandle, useState,
} from 'react'

export const MentionList = forwardRef(function MentionList(props, ref) {
  const [selected, setSelected] = useState(0)
  const { items, query } = props // items: flat list built in suggestion.js

  useEffect(() => setSelected(0), [items])

  const choose = index => {
    const item = items[index]
    if (!item) return
    props.command({
      id: item.id,
      type: item.type,
      label: item.label,
      resolved: item.resolved,
    })
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelected(s => (s + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected(s => (s + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        choose(selected)
        return true
      }
      return false
    },
  }))

  if (!items.length) return null

  const typeLabel = item => item.type === 'character' ? 'Player' : item.type === 'npc' ? 'NPC' : item.type === 'location' ? 'Location' : 'Page'
  const createHint = item => item.type === 'npc'
    ? 'Add this person to the confirmation queue'
    : 'Add this place to the confirmation queue'

  // Group consecutive items by section for headers
  let lastSection = null
  const rows = []
  items.forEach((item, i) => {
    const isCreate = item.section === 'Create'
    if (item.section !== lastSection) {
      lastSection = item.section
      rows.push(
        <div className="jm-dd-section" key={`sec-${item.section}-${i}`}>
          {item.section}
        </div>,
      )
    }
    rows.push(
      <button
        type="button"
        className={`jm-dd-item jm-dd-mention ${i === selected ? 'is-selected' : ''} ${item.resolved ? '' : 'is-unresolved'}`}
        key={`${item.type}:${item.id}`}
        onMouseEnter={() => setSelected(i)}
        onClick={() => choose(i)}
      >
        <span className="jm-dd-icon">{item.type === 'character' ? '◆' : item.type === 'npc' ? '👤' : item.type === 'location' ? '📍' : '📄'}</span>
        <span className="jm-dd-name">
          {isCreate ? `Create ${item.label}` : item.label}
          {(isCreate || item.hint) && <em className="jm-dd-hint">{isCreate ? createHint(item) : item.hint}</em>}
        </span>
        <span className={`jm-dd-type is-${item.type}`}>{isCreate ? 'New ' : ''}{typeLabel(item)}</span>
      </button>,
    )
  })

  return <div className="jm-dropdown">{rows}</div>
})
