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

  // Group consecutive items by section for headers
  let lastSection = null
  const rows = []
  items.forEach((item, i) => {
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
        className={`jm-dd-item ${i === selected ? 'is-selected' : ''} ${item.resolved ? '' : 'is-unresolved'}`}
        key={`${item.type}:${item.id}`}
        onMouseEnter={() => setSelected(i)}
        onClick={() => choose(i)}
      >
        <span className="jm-dd-icon">{item.type === 'npc' ? '👤' : item.type === 'location' ? '📍' : '📄'}</span>
        <span className="jm-dd-name">
          {item.label}
          {!item.resolved && <em className="jm-dd-new"> — new {item.type === 'npc' ? 'NPC' : item.type === 'location' ? 'location' : 'page'}</em>}
        </span>
        {item.hint && <span className="jm-dd-hint">{item.hint}</span>}
      </button>,
    )
  })

  return <div className="jm-dropdown">{rows}</div>
})
