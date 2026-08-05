import React from 'react'
import { RECORDS_MODES } from './recordsLayout.js'

export default function RecordsModeSwitch({ mode, onChange }) {
  return (
    <div className="records-mode" role="group" aria-label="Open records view">
      <span className="records-mode-label">Open</span>
      <div className="records-mode-buttons">
        {RECORDS_MODES.map(key => (
          <button key={key} type="button"
            className={mode === key ? 'is-on' : ''}
            aria-pressed={mode === key}
            onClick={() => onChange(key)}>
            {key === 'both' ? 'Both' : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
