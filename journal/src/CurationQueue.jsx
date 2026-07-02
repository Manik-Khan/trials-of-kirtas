// CurationQueue.jsx — "New to the world", grown up. Staff-only panel at the
// bottom of the journal: entities seeded from play (curated=false) with
// Canonize / Edit / Merge / Discard, per the approved organization mock.
//
// Live mode gets the real store (RPCs); sample mode gets a tiny in-memory
// stand-in so the standalone preview stays interactive.
import React, { useEffect, useMemo, useState } from 'react'
import { entityStore } from './data/entityStore.js'

export default function CurationQueue({ store, isStaff }) {
  const [queue, setQueue] = useState([])
  const [editing, setEditing] = useState(null)     // `${type}:${id}` being edited
  const [merging, setMerging] = useState(null)     // entity object in the dialog
  const [mergeInto, setMergeInto] = useState('')
  const [fixFeed, setFixFeed] = useState(false)
  const [footprint, setFootprint] = useState(null)
  const [note, setNote] = useState('')

  const live = !!(store && store.loadCurationQueue)

  const refresh = () => {
    if (live) {
      store.loadCurationQueue()
        .then(rows => setQueue(rows.map(r => ({ type: r.type, id: r.id, name: r.name, descr: r.descr || '' }))))
        .catch(e => console.error('[journal] curation load failed:', e))
    } else {
      setQueue(entityStore.createdStubs().map(e => ({ type: e.type, id: e.id, name: e.label, descr: '' })))
    }
  }
  useEffect(refresh, [])              // eslint-disable-line react-hooks/exhaustive-deps

  // canon candidates for the merge picker: the full pool minus the stub itself
  const canonFor = ent => [...entityStore.npcs(), ...entityStore.locations()]
    .filter(e => e.type === ent.type && e.id !== ent.id)

  const toast = msg => { setNote(msg); setTimeout(() => setNote(''), 3500) }

  const canonize = async ent => {
    try {
      const r = live ? await store.canonizeEntity(ent.type, ent.id) : { pages: 0, feed: 0 }
      toast(`@${ent.name} canonized — chips flip solid everywhere (${r.pages} pages, ${r.feed} chat)`)
      refresh()
    } catch (e) { toast(`canonize failed: ${e.message}`) }
  }

  const saveEdit = async (ent, name, descr) => {
    try {
      if (live) await store.updateEntity(ent.type, ent.id, { name: name.trim() || ent.name, descr })
      setEditing(null)
      toast('entity updated — canonize when ready')
      refresh()
    } catch (e) { toast(`update failed: ${e.message}`) }
  }

  const discard = async ent => {
    if (!window.confirm(`Discard @${ent.name}? Existing chips stay dashed (unresolved); nothing is rewritten.`)) return
    try {
      if (live) await store.discardEntity(ent.type, ent.id)
      toast('discarded')
      refresh()
    } catch (e) { toast(`discard failed: ${e.message}`) }
  }

  const openMerge = async ent => {
    setMerging(ent)
    setFixFeed(false)
    const first = canonFor(ent)[0]
    setMergeInto(first ? first.id : '')
    setFootprint(null)
    if (live && store.entityFootprint) {
      try { setFootprint(await store.entityFootprint(ent.type, ent.id)) } catch (e) { /* preview only */ }
    }
  }

  const doMerge = async () => {
    const ent = merging
    const target = canonFor(ent).find(c => c.id === mergeInto)
    if (!target) return
    try {
      const r = live
        ? await store.mergeEntity(ent.type, ent.id, target.id, target.label, fixFeed)
        : { pages: 0, refs: 0, feed: 0 }
      toast(`merged @${ent.name} → @${target.label}`
        + (fixFeed ? ` · ${r.feed} chat corrected` : ' · chat left verbatim (alias covers the future)'))
      setMerging(null)
      refresh()
    } catch (e) { toast(`merge failed: ${e.message}`) }
  }

  const target = merging ? canonFor(merging).find(c => c.id === mergeInto) : null

  if (!isStaff) return null

  return (
    <section className="j-curation">
      <div className="j-side-label">
        New to the world <span className="j-cq-staff">staff</span>
      </div>
      <div className="j-cq-hint">
        Seeded from play. Canonize = the resolve-flip — every dashed chip lights up solid,
        everywhere. Merge rewrites chip <em>nodes</em> (never prose) and leaves an alias.
      </div>

      {queue.length === 0 && <div className="j-cq-empty">nothing awaiting curation — the world is tidy</div>}

      <ul className="j-cq-list">
        {queue.map(ent => {
          const k = `${ent.type}:${ent.id}`
          if (editing === k) {
            return <EditRow key={k} ent={ent} onSave={saveEdit} onCancel={() => setEditing(null)} />
          }
          return (
            <li key={k} className={`j-cq-row is-${ent.type}`}>
              <span className="j-cq-name">{ent.type === 'npc' ? '👤' : '📍'} @{ent.name}</span>
              <span className="j-cq-meta">{ent.id}</span>
              <span className="j-cq-actions">
                <button type="button" title="resolve-flip: every dashed chip lights up solid"
                  onClick={() => canonize(ent)}>✓ Canonize</button>
                <button type="button" title="edit name / description"
                  onClick={() => setEditing(k)}>✎</button>
                <button type="button" title="fold into an existing entity"
                  onClick={() => openMerge(ent)}>⇄ Merge</button>
                <button type="button" className="danger" title="discard the stub (chips stay dashed)"
                  onClick={() => discard(ent)}>🗑</button>
              </span>
            </li>
          )
        })}
      </ul>

      {merging && (
        <div className="j-cq-veil" onClick={e => { if (e.target === e.currentTarget) setMerging(null) }}>
          <div className="j-cq-dlg">
            <h3>Merge entity</h3>
            <p>Fold <span className="j-cq-from">@{merging.name}</span> into an existing canonical entity:</p>
            <label>merge into</label>
            <select value={mergeInto} onChange={e => setMergeInto(e.target.value)}>
              {canonFor(merging).map(c => (
                <option key={c.id} value={c.id}>@{c.label} ({c.origin === 'canon' ? 'canon' : 'journal'})</option>
              ))}
            </select>
            <div className="j-cq-preview">
              <b>merge_entity('{merging.id}' → '{mergeInto || '?'}')</b> rewrites chip nodes
              {footprint ? <> across <b>{footprint.refs} ref{footprint.refs === 1 ? '' : 's'}</b>{footprint.feed ? <> and touches <b>{footprint.feed} chat message{footprint.feed === 1 ? '' : 's'}</b> (only if asked)</> : null},</> : null}{' '}
              repaints html caches, and leaves <b>'{merging.id}'</b> as an alias so future typing matches canon.
              Prose is never touched.
            </div>
            <label className="j-cq-check">
              <input type="checkbox" checked={fixFeed} onChange={e => setFixFeed(e.target.checked)} />
              <span>
                also correct chat messages that used this chip
                <em>chat is a record of what was said — leave unchecked to preserve it verbatim</em>
              </span>
            </label>
            <div className="j-cq-btns">
              <button type="button" className="no" onClick={() => setMerging(null)}>Cancel</button>
              <button type="button" className="go" disabled={!target} onClick={doMerge}>Merge</button>
            </div>
          </div>
        </div>
      )}

      {note && <div className="j-cq-toast">{note}</div>}
    </section>
  )
}

function EditRow({ ent, onSave, onCancel }) {
  const [name, setName] = useState(ent.name)
  const [descr, setDescr] = useState(ent.descr || '')
  return (
    <li className={`j-cq-row is-${ent.type} j-cq-editing`}>
      <span className="j-cq-fields">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="name"
          onKeyDown={e => { if (e.key === 'Enter') onSave(ent, name, descr); if (e.key === 'Escape') onCancel() }} />
        <input value={descr} onChange={e => setDescr(e.target.value)} placeholder="short description (optional)"
          onKeyDown={e => { if (e.key === 'Enter') onSave(ent, name, descr); if (e.key === 'Escape') onCancel() }} />
      </span>
      <span className="j-cq-actions">
        <button type="button" onClick={() => onSave(ent, name, descr)}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </span>
    </li>
  )
}
