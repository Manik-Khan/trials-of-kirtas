import React, { useEffect, useMemo, useState } from 'react'
import { questTitle } from './data/questModel.js'

const STEPS = ['What happened?', 'Who and where?', 'What needs doing?', 'Share']

export default function QuestCaptureDialog({ open, initialDescription = '', npcs = [], locations = [], sourceLabel = '', onClose, onSubmit }) {
  const [step, setStep] = useState(0)
  const [description, setDescription] = useState('')
  const [giverId, setGiverId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [objective, setObjective] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setStep(0); setDescription(initialDescription); setGiverId(''); setLocationId('')
    setObjective(''); setTitle(''); setBusy(false); setError('')
  }, [open, initialDescription])

  useEffect(() => {
    if (!open) return
    const escape = e => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open, busy, onClose])

  const giver = useMemo(() => npcs.find(n => n.id === giverId) || null, [npcs, giverId])
  const location = useMemo(() => locations.find(n => n.id === locationId) || null, [locations, locationId])
  const finalTitle = questTitle(title, objective)
  const canContinue = step === 0 ? !!description.trim() : step === 2 ? !!objective.trim() : true

  const share = async () => {
    if (!description.trim() || !objective.trim() || busy) return
    setBusy(true); setError('')
    try {
      await onSubmit({
        title: finalTitle, description: description.trim(), objective: objective.trim(),
        giverId: giver?.id || null, giverLabel: giver?.label || null,
        locationId: location?.id || null, locationLabel: location?.label || null,
      })
    } catch (e) {
      setError(e?.message || 'The quest could not be shared. Your details are still here; try again.')
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <div className="j-quest-veil" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <section className="j-quest-dlg" role="dialog" aria-modal="true" aria-labelledby="j-quest-title">
        <header className="j-quest-head">
          <div>
            <span className="j-quest-kicker">Quest capture · {step + 1} of {STEPS.length}</span>
            <h2 id="j-quest-title">{STEPS[step]}</h2>
          </div>
          <button type="button" className="j-quest-x" onClick={onClose} disabled={busy} aria-label="Close quest capture">×</button>
        </header>
        <div className="j-quest-progress" aria-hidden="true">
          {STEPS.map((_, i) => <span key={i} className={i <= step ? 'is-on' : ''} />)}
        </div>

        {step === 0 && (
          <label className="j-quest-field">
            <span>Description</span>
            <textarea autoFocus rows="6" value={description} maxLength="5000"
              placeholder="The moment that made this a quest…" onChange={e => setDescription(e.target.value)} />
            <small>This stays with the quest; your Journal page remains the full story.</small>
          </label>
        )}
        {step === 1 && (
          <div className="j-quest-fields">
            <label className="j-quest-field">
              <span>Quest Giver <em>optional</em></span>
              <select autoFocus value={giverId} onChange={e => setGiverId(e.target.value)}>
                <option value="">No quest giver</option>
                {npcs.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </label>
            <label className="j-quest-field">
              <span>Location <em>optional</em></span>
              <select value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">No location yet</option>
                {locations.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </label>
            <p className="j-quest-note">These connect the quest to the same people and places used across the world.</p>
          </div>
        )}
        {step === 2 && (
          <div className="j-quest-fields">
            <label className="j-quest-field">
              <span>Objective</span>
              <textarea autoFocus rows="4" value={objective} maxLength="500"
                placeholder="What needs to be done?" onChange={e => setObjective(e.target.value)} />
            </label>
            <label className="j-quest-field">
              <span>Quest title <em>optional</em></span>
              <input value={title} maxLength="160" placeholder="We’ll use the objective if this is blank"
                onChange={e => setTitle(e.target.value)} />
            </label>
          </div>
        )}
        {step === 3 && (
          <div className="j-quest-preview">
            <span className="j-quest-kicker">Quest begun</span>
            <h3>{finalTitle}</h3>
            <p className="j-quest-objective">{objective}</p>
            <p>{description}</p>
            {(giver || location) && <dl>
              {giver && <><dt>Quest Giver</dt><dd>{giver.label}</dd></>}
              {location && <><dt>Location</dt><dd>{location.label}</dd></>}
            </dl>}
            <small>Begun from {sourceLabel || 'this Journal page'} · visible to the party</small>
          </div>
        )}

        {error && <p className="j-quest-error" role="alert">{error}</p>}
        <footer className="j-quest-actions">
          <button type="button" onClick={() => step ? setStep(step - 1) : onClose()} disabled={busy}>
            {step ? 'Back' : 'Cancel'}
          </button>
          {step < 3
            ? <button type="button" className="is-primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue</button>
            : <button type="button" className="is-primary" disabled={busy} onClick={share}>{busy ? 'Sharing…' : 'Begin quest'}</button>}
        </footer>
      </section>
    </div>
  )
}
