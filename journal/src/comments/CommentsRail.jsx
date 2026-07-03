// CommentsRail.jsx — the margin. Anchored cards, the "since edited" orphan
// log, the show/hide-others' toggle, the compose card (fed by the selection
// popover in JournalView), and owner actions. Colors come from --seat-* vars
// injected by JournalView — nothing here stores a color.
import React, { useState } from 'react'

export default function CommentsRail({
  anchored, orphaned,            // [{comment, at}], [comment]
  meUid, meSeat, meSeatName, isOwner,
  showOthers, onToggle,
  hotId, onJump,
  compose, onComposeSubmit, onComposeCancel,   // compose = {quote} | null
  onAccept, onDismiss, onWithdraw,
}) {
  const [editFor, setEditFor] = useState(null)  // comment id in edit-then-accept

  const mine = c => c.author_id === meUid
  const visible = list => list.filter(c => showOthers || mine(c))
  const cards = visible(anchored.map(a => a.comment))
  const orphans = visible(orphaned)

  return (
    <section className="j-comments">
      <div className="j-c-head">
        <div className="j-side-label">Comments</div>
        <button type="button" className="j-c-toggle" onClick={onToggle}>
          {showOthers ? 'hide others’' : 'show others’'}
        </button>
      </div>

      {compose && (
        <ComposeCard quote={compose.quote} seatName={meSeatName}
          onSubmit={onComposeSubmit} onCancel={onComposeCancel} />
      )}

      {!cards.length && !compose && <div className="j-c-empty">no open comments — select text to leave one</div>}

      <div className="j-c-list">
        {cards.map(c => (
          <article key={c.id}
            className={`j-c-card ${String(c.id) === String(hotId) ? 'is-hot' : ''}`}
            data-seat={c.seat || 'narrator'}
            onClick={() => onJump(c.id)}
          >
            <div className="j-c-by">{c.seatName || c.seat || 'Narrator'}</div>
            <blockquote className="j-c-quote">“{c.quote}”</blockquote>
            {editFor === c.id
              ? <EditAccept c={c}
                  onAccept={body => { setEditFor(null); onAccept(c, body) }}
                  onCancel={() => setEditFor(null)} />
              : <div className="j-c-body">{c.body_html}</div>}
            {editFor !== c.id && (
              <div className="j-c-acts" onClick={e => e.stopPropagation()}>
                {isOwner && <>
                  <button type="button" title="append to the page as YOU, with their attribution chip"
                    onClick={() => onAccept(c)}>✓ Accept</button>
                  <button type="button" title="rewrite what lands on the page (their row keeps the original)"
                    onClick={() => setEditFor(c.id)}>✎ Edit, then accept</button>
                  <button type="button" className="danger" title="close without touching the page"
                    onClick={() => onDismiss(c)}>Dismiss</button>
                </>}
                {!isOwner && mine(c) && (
                  <button type="button" className="danger" title="withdraw your comment"
                    onClick={() => onWithdraw(c)}>Withdraw</button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>

      {orphans.length > 0 && (
        <div className="j-c-orphans">
          <div className="j-side-label">Since edited</div>
          <div className="j-c-orphan-note">the quoted text no longer exists on the page — kept rather than guessed</div>
          <div className="j-c-list">
            {orphans.map(c => (
              <article key={c.id} className="j-c-card is-orphan" data-seat={c.seat || 'narrator'}>
                <div className="j-c-by">{c.seatName || c.seat || 'Narrator'}</div>
                <blockquote className="j-c-quote">“{c.quote}”</blockquote>
                <div className="j-c-body">{c.body_html}</div>
                <div className="j-c-acts">
                  {isOwner && <button type="button" className="danger" onClick={() => onDismiss(c)}>Dismiss</button>}
                  {!isOwner && mine(c) && <button type="button" className="danger" onClick={() => onWithdraw(c)}>Withdraw</button>}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ComposeCard({ quote, seatName, onSubmit, onCancel }) {
  const [body, setBody] = useState('')
  return (
    <article className="j-c-card j-c-compose">
      <div className="j-c-by">{seatName} — new comment</div>
      <blockquote className="j-c-quote">“{quote.length > 120 ? quote.slice(0, 120) + '…' : quote}”</blockquote>
      <textarea autoFocus value={body} placeholder="your comment…"
        onChange={e => setBody(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) onSubmit(body.trim())
          if (e.key === 'Escape') onCancel()
        }} />
      <div className="j-c-acts">
        <button type="button" disabled={!body.trim()} onClick={() => onSubmit(body.trim())}>Comment</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </article>
  )
}

function EditAccept({ c, onAccept, onCancel }) {
  const [body, setBody] = useState(c.body_html)
  return (
    <div onClick={e => e.stopPropagation()}>
      <textarea className="j-c-edit" value={body} autoFocus onChange={e => setBody(e.target.value)} />
      <div className="j-c-acts">
        <button type="button" disabled={!body.trim()} onClick={() => onAccept(body.trim())}>Accept edited</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
      <div className="j-c-edit-note">edits what lands on the page — their row keeps the original</div>
    </div>
  )
}
