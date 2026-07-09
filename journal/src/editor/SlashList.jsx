// The "/" command dropdown. Deliberately mirrors MentionList: same keys
// (↑/↓/Enter), same section headers, same classes — so it inherits the
// existing .jm-dropdown styling and feels like one family of menus.

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

export const SlashList = forwardRef(function SlashList(props, ref) {
  const [selected, setSelected] = useState(0)
  const { items } = props

  useEffect(() => setSelected(0), [items])

  const choose = index => {
    const item = items[index]
    if (item) props.command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === 'ArrowUp') { setSelected(s => (s + items.length - 1) % items.length); return true }
      if (event.key === 'ArrowDown') { setSelected(s => (s + 1) % items.length); return true }
      if (event.key === 'Enter' || event.key === 'Tab') { choose(selected); return true }
      return false
    },
  }))

  if (!items.length) return null

  let lastSection = null
  const rows = []
  items.forEach((item, i) => {
    if (item.section !== lastSection) {
      lastSection = item.section
      rows.push(<div className="jm-dd-section" key={`sec-${item.section}-${i}`}>{item.section}</div>)
    }
    rows.push(
      <button
        type="button"
        className={`jm-dd-item ${i === selected ? 'is-selected' : ''}`}
        key={item.label}
        onMouseEnter={() => setSelected(i)}
        onMouseDown={e => e.preventDefault()}
        onClick={() => choose(i)}
      >
        <span className="jm-dd-icon jm-dd-cmd">{item.icon}</span>
        <span className="jm-dd-name">{item.label}</span>
        {item.hint && <span className="jm-dd-hint">{item.hint}</span>}
      </button>,
    )
  })

  return <div className="jm-dropdown">{rows}</div>
})
