import React, { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { questTitle } from './data/questModel.js'
import { descriptionDoc, descriptionHTML, descriptionText, encodeDescription } from './data/questDescription.js'
import { TokMention } from './editor/MentionExtension.js'
import { makeEntitySuggestion } from './editor/suggestion.js'

const STEPS = ['What happened?', 'Who and where?', 'What needs doing?', 'Share']

export default function QuestCaptureDialog({ open, initialDescription = '', npcs = [], locations = [], sourceLabel = '', onClose, onSubmit }) {
  const [step, setStep] = useState(0)
  const [descriptionRevision, setDescriptionRevision] = useState(0)
  const [giverId, setGiverId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [objective, setObjective] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previewRef = useRef(null)
  const suggestion = useMemo(() => makeEntitySuggestion({ includeCharacters: false }), [])
  const editor = useEditor({
    extensions: [StarterKit.configure({
      blockquote: false, bulletList: false, codeBlock: false, heading: false,
      horizontalRule: false, orderedList: false, listItem: false,
    }), TokMention.configure({ suggestion })],
    content: descriptionDoc(initialDescription),
    editorProps: { attributes: { class: 'j-quest-editor', 'aria-label': 'Quest description' } },
    onUpdate: () => setDescriptionRevision(value => value + 1),
  }, [suggestion])

  useEffect(() => {
    if (!open) return
    setStep(0); setGiverId(''); setLocationId('')
    setObjective(''); setTitle(''); setBusy(false); setError('')
    editor?.commands.setContent(descriptionDoc(initialDescription), { emitUpdate: false })
    setDescriptionRevision(value => value + 1)
  }, [open, initialDescription, editor])

  useEffect(() => {
    if (!open || step !== 0 || !editor) return
    const focus = setTimeout(() => editor.commands.focus('end'), 0)
    return () => clearTimeout(focus)
  }, [open, step, editor])

  useEffect(() => {
    if (!open || !window.attachTooltips) return
    const root = step === 0 ? editor?.view.dom : previewRef.current
    if (root) window.attachTooltips(root)
  }, [open, step, descriptionRevision, editor])

  useEffect(() => {
    if (!open) return
    const escape = e => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open, busy, onClose])

  const giver = useMemo(() => npcs.find(n => n.id === giverId) || null, [npcs, giverId])
  const location = useMemo(() => locations.find(n => n.id === locationId) || null, [locations, locationId])
  const finalTitle = questTitle(title, objective)
  const description = encodeDescription(editor?.getJSON() || descriptionDoc(initialDescription))
  const readableDescription = descriptionText(description).trim()
  const canContinue = step === 0 ? !!readableDescription && description.length <= 5000 : step === 2 ? !!objective.trim() : true

  const share = async () => {
    if (!readableDescription || description.length > 5000 || !objective.trim() || busy) return
    setBusy(true); setError('')
    try {
      await onSubmit({
        title: finalTitle, description, objective: objective.trim(),
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
            <div className="j-quest-editor-wrap">
              <EditorContent editor={editor} />
            </div>
            <small>{description.length > 5000 ? 'This description is a little too long. Shorten it before continuing.' : 'Type @ to link a person or place. Your Journal page remains the full story.'}</small>
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
          <div className="j-quest-preview" ref={previewRef}>
            <span className="j-quest-kicker">Quest begun</span>
            <h3>{finalTitle}</h3>
            <p className="j-quest-objective">{objective}</p>
            <p dangerouslySetInnerHTML={{ __html: descriptionHTML(description) }} />
            {(giver || location) && <dl>
              {giver && <><dt>Quest Giver</dt><dd className="npc-link" data-npc={giver.id} tabIndex="0">{giver.label}</dd></>}
              {location && <><dt>Location</dt><dd className="location-link" data-location={location.id} tabIndex="0">{location.label}</dd></>}
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
