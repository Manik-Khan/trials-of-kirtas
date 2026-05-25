// ============================================================
// bardic-components.jsx — UI components for The Bardic Console
// ============================================================

const { useState, useEffect, useRef, useCallback } = React;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

const MOOD_EMOJI = {
  tavern:'🍺', travel:'🧭', forest:'🌲', cave:'🪨', combat:'⚔️', boss:'💀',
  tension:'🔥', mystery:'👁️', sad:'💧', victory:'👑', sea:'⚓', storm:'⚡',
  city:'🏰', horror:'👻', sacred:'☀️',
};

// ============================================================
// MoodPad — single mood tile
//
// Interaction model diverges by input type:
//   Desktop (mouse): single click plays, hover reveals list/edit buttons.
//   Mobile (touch):  single tap plays, 500ms long press opens track panel.
//                    Hover-reveal action buttons are suppressed on touch.
//
// Touch detection is done inside the component via useRef so it
// runs at render time — module-level detection via `ontouchstart`
// is unreliable on iOS Safari when Babel evaluates the script.
// ============================================================
function MoodPad({ mood, shape, iconStyle, active, paused, channelAccent, onClick, onOpenPanel, onEdit, size = 92 }) {
  const fontSize = size < 78 ? 9 : 10;
  const iconSize = size < 78 ? 18 : 24;
  const longPressTimer = useRef(null);
  const didLongPress   = useRef(false);

  // Detect at render time, not module parse time.
  const isTouch = useRef(
    typeof window !== 'undefined' &&
    (('ontouchstart' in window) || (navigator.maxTouchPoints > 0))
  );

  const clip = shape === 'hex'
    ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
    : shape === 'circle' ? 'circle(50% at 50% 50%)'
    : 'inset(0 round 4px)';

  // ── Touch handlers ───────────────────────────────────────────
  // Always attached — they no-op on desktop because touchstart
  // never fires there, so there's no branching risk.
  function handleTouchStart(e) {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onOpenPanel();
    }, 500);
  }

  function handleTouchEnd(e) {
    clearTimeout(longPressTimer.current);
    if (!didLongPress.current) {
      // Short tap → play.
      // Call resumeAll() HERE, synchronously, before onClick() hands off
      // to React. iOS only permits audio.play() within the native gesture
      // call stack — React's synthetic event dispatch is too late.
      window.BardicAudio.resumeAll();
      // e.preventDefault() stops Safari's synthetic mouse click (~300ms later).
      e.preventDefault();
      onClick();
    }
  }

  function handleTouchMove() {
    // Finger drifted — user is scrolling, cancel long press.
    clearTimeout(longPressTimer.current);
  }

  // ── Mouse click (desktop only) ───────────────────────────────
  // On touch devices the synthetic click fires after touchend;
  // since we call e.preventDefault() in handleTouchEnd it never
  // reaches here — but we guard anyway for safety.
  function handleClick(e) {
    if (isTouch.current) return;
    onClick();
  }

  return (
    <div className={`mood-pad mood-pad--${shape} ${active ? 'is-active' : ''} ${paused ? 'is-paused' : ''} ${isTouch.current ? 'is-touch' : ''}`}
         style={{ width: size, height: size, '--mood-color': mood.color, '--accent': channelAccent }}
         title={mood.label + (paused ? ' · Paused' : '')}>
      <div className="mood-pad__click-area"
           onClick={handleClick}
           onTouchStart={handleTouchStart}
           onTouchEnd={handleTouchEnd}
           onTouchMove={handleTouchMove}>
        <div className="mood-pad__bg"   style={{ clipPath: clip }}/>
        <div className="mood-pad__glow" style={{ clipPath: clip }}/>
        <div className="mood-pad__inner">
          {iconStyle === 'tabler' && <i className={`ti ${mood.sigil || 'ti-music'} mood-pad__icon`} style={{ fontSize: iconSize }}/>}
          {iconStyle === 'emoji'  && <span className="mood-pad__icon" style={{ fontSize: iconSize }}>{MOOD_EMOJI[mood.id] || '✦'}</span>}
          {iconStyle === 'typo'   && <span className="mood-pad__typo" style={{ fontSize: iconSize * 0.7 }}>{mood.label[0]}</span>}
          <div className="mood-pad__label" style={{ fontSize }}>{mood.label}</div>
          {mood.tracks?.length > 0 && (
            <div className="mood-pad__count">{mood.tracks.length}</div>
          )}
        </div>
        {shape === 'hex' && (
          <svg className="mood-pad__stroke" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <polygon points={`${size/2},0 ${size},${size*.25} ${size},${size*.75} ${size/2},${size} 0,${size*.75} 0,${size*.25}`}
                     fill="none" stroke="rgba(0,0,0,0.85)" strokeWidth="6"/>
            <polygon points={`${size/2},0 ${size},${size*.25} ${size},${size*.75} ${size/2},${size} 0,${size*.75} 0,${size*.25}`}
                     fill="none" stroke="rgba(201,168,76,0.55)" strokeWidth="1.5"/>
          </svg>
        )}
      </div>
      {/* Action buttons: desktop hover only — not rendered on touch */}
      {!isTouch.current && (
        <div className="mood-pad__actions">
          <button className="mood-pad__action-btn" onClick={onOpenPanel} title="View tracks">
            <i className="ti ti-list"/>
          </button>
          <button className="mood-pad__action-btn" onClick={onEdit} title="Edit mood">
            <i className="ti ti-pencil"/>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// VerticalFader
// ============================================================
function VerticalFader({ value, onChange, accent, muted }) {
  const ref = useRef(null);
  const v = clamp(value, 0, 1);

  // Shared position → value calculator
  function posToValue(clientY) {
    if (!ref.current) return;
    const r  = ref.current.getBoundingClientRect();
    const y  = clientY - r.top;
    const nv = 1 - clamp(y / r.height, 0, 1);
    onChange(nv);
  }

  // ── Desktop: pointer events ──────────────────────────────────
  function onPointerDown(e) {
    if (e.pointerType === 'touch') return; // handled by touch branch
    e.preventDefault();
    posToValue(e.clientY);
    const move = ev => posToValue(ev.clientY);
    const up   = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup',   up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup',   up);
  }

  // ── Mobile: native touch events attached via ref ──────────────
  // Attached imperatively because iOS Safari has unreliable pointer
  // events on vertical drag targets — same pattern as MoodPad.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onTouchStart(e) {
      e.preventDefault(); // prevent scroll while dragging fader
      if (e.touches[0]) posToValue(e.touches[0].clientY);
    }
    function onTouchMove(e) {
      e.preventDefault();
      if (e.touches[0]) posToValue(e.touches[0].clientY);
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
    };
  }); // re-attach on every render so posToValue closure is always fresh

  return (
    <div className={`fader ${muted ? 'is-muted' : ''}`} ref={ref} onPointerDown={onPointerDown}>
      <div className="fader__track">
        {[0,1,2,3,4,5,6,7,8].map(i => (
          <div key={i} className="fader__tick" style={{ bottom: `${i * 12}%` }}/>
        ))}
        <div className="fader__fill" style={{ height: `${v * 100}%`, background: accent, opacity: 0.25 + v * 0.6 }}/>
      </div>
      <div className="fader__knob" style={{ bottom: `calc(${v * 100}% - 12px)`, borderColor: accent }}>
        <div className="fader__knob-rune" style={{ color: accent }}>⚜</div>
      </div>
      <div className="fader__readout">{Math.round(v * 100)}</div>
    </div>
  );
}

// ============================================================
// MiniMeter
// ============================================================
function MiniMeter({ active, accent }) {
  const [bars, setBars] = useState([0,0,0,0,0]);
  useEffect(() => {
    let raf;
    const tick = () => {
      const data = window.BardicAudio.getVizData();
      const out  = [];
      for (let i = 0; i < 5; i++) {
        const start = Math.floor((i / 5) * data.length * 0.4);
        const end   = Math.floor(((i + 1) / 5) * data.length * 0.4);
        let s = 0;
        for (let j = start; j < end; j++) s += data[j];
        out.push(s / (end - start) / 255);
      }
      setBars(out.map(v => active ? v : v * 0.15));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="mini-meter">
      {bars.map((b, i) => (
        <div key={i} className="mini-meter__bar"
             style={{ height: `${5 + b * 95}%`, background: accent, opacity: 0.4 + b * 0.6 }}/>
      ))}
    </div>
  );
}

// ============================================================
// PlaybackModeBar — loop / sequence / shuffle / single
// ============================================================
function PlaybackModeBar({ mode, onChange, accent }) {
  const modes = [
    { id:'loop',     icon:'ti-repeat',        label:'Loop' },
    { id:'sequence', icon:'ti-arrow-right',    label:'Seq' },
    { id:'shuffle',  icon:'ti-arrows-shuffle', label:'Shuffle' },
    { id:'single',   icon:'ti-player-track-next', label:'Once' },
  ];
  return (
    <div className="mode-bar">
      {modes.map(m => (
        <button key={m.id}
                className={`mode-btn ${mode === m.id ? 'is-on' : ''}`}
                style={{ '--mode-accent': accent }}
                onClick={e => { e.stopPropagation(); onChange(m.id); }}
                title={m.label}>
          <i className={`ti ${m.icon}`}/>
        </button>
      ))}
    </div>
  );
}

// ============================================================
// ProgressBar — scrubable playback position for a channel
// ============================================================
function ProgressBar({ chId, accent, onPrev, onNext }) {
  const [pos,      setPos]      = useState(0);   // 0–1
  const [elapsed,  setElapsed]  = useState(0);   // seconds
  const [duration, setDuration] = useState(0);   // seconds
  const [dragging, setDragging] = useState(false);
  const barRef  = useRef(null);
  const rafRef  = useRef(null);

  // Poll the audio element for current time
  useEffect(() => {
    const tick = () => {
      if (dragging) { rafRef.current = requestAnimationFrame(tick); return; }
      // Find the audio element for this channel by src presence
      const audios = Array.from(document.querySelectorAll('audio'));
      // Pick the one that's playing or has a src (channels only have 1 at a time)
      // We identify by data-ch attribute set in makeUrlTrack
      const el = audios.find(a => a.dataset.ch === chId);
      if (el && el.duration && !isNaN(el.duration)) {
        const d = el.duration;
        const t = el.currentTime;
        setDuration(d);
        setElapsed(t);
        setPos(t / d);
      } else {
        setPos(0); setElapsed(0); setDuration(0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [chId, dragging]);

  function scrubTo(e) {
    if (!barRef.current) return;
    const r  = barRef.current.getBoundingClientRect();
    const x  = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    const p  = Math.max(0, Math.min(1, x / r.width));
    setPos(p);
    // Write to audio element
    const el = Array.from(document.querySelectorAll('audio')).find(a => a.dataset.ch === chId);
    if (el && el.duration && !isNaN(el.duration)) {
      el.currentTime = p * el.duration;
      setElapsed(el.currentTime);
    }
  }

  function onDown(e) {
    e.stopPropagation();
    setDragging(true);
    scrubTo(e);
    const move = ev => scrubTo(ev);
    const up   = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup',   up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup',   up);
  }

  function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }

  return (
    <div className="progress-bar">
      {onPrev && (
        <button className="progress-bar__skip" onClick={onPrev} title="Previous / Restart">
          <i className="ti ti-player-skip-back"/>
        </button>
      )}
      <span className="progress-bar__time">{fmt(elapsed)}</span>
      <div className="progress-bar__track" ref={barRef} onPointerDown={onDown}>
        <div className="progress-bar__fill" style={{ width: `${pos * 100}%`, background: accent }}/>
        <div className="progress-bar__thumb" style={{ left: `${pos * 100}%`, borderColor: accent }}/>
      </div>
      <span className="progress-bar__time progress-bar__time--right">{fmt(duration)}</span>
      {onNext && (
        <button className="progress-bar__skip" onClick={onNext} title="Next track">
          <i className="ti ti-player-skip-forward"/>
        </button>
      )}
    </div>
  );
}

// ============================================================
// GroupBadge — group assignment + mode toggle for a channel strip
// ============================================================
function GroupBadge({ linkGroup, accent, onGroupChange, onLinkModeChange }) {
  const { group, mode } = linkGroup;
  const groups = [null, 1, 2, 3, 4];

  function cycleGroup() {
    const idx  = groups.indexOf(group);
    const next = groups[(idx + 1) % groups.length];
    onGroupChange(next);
  }

  function toggleMode() {
    onLinkModeChange(mode === 'inverse' ? 'parallel' : 'inverse');
  }

  return (
    <div className="group-badge">
      <button
        className={`group-badge__btn ${group !== null ? 'is-linked' : ''}`}
        style={group !== null ? { '--gb-accent': accent } : {}}
        onClick={e => { e.stopPropagation(); cycleGroup(); }}
        title={group !== null ? `Group ${group} · click to change` : 'No group · click to assign'}>
        <i className="ti ti-link"/>
        <span>{group !== null ? group : '·'}</span>
      </button>
      {group !== null && (
        <button
          className="group-badge__mode"
          style={{ '--gb-accent': accent }}
          onClick={e => { e.stopPropagation(); toggleMode(); }}
          title={mode === 'inverse' ? 'Inverse (↕ one up, others down)' : 'Parallel (↕ all together)'}>
          {mode === 'inverse' ? '↕' : '⇕'}
        </button>
      )}
    </div>
  );
}

// ============================================================
// ChannelStrip
// ============================================================
function ChannelStrip({ ch, state, onVol, onMute, onStop, onMode, onOpenPanel, accent, density, moodLabel, linkGroup, onGroupChange, onLinkModeChange, onPrev, onNext }) {
  const isPlaying = !!state.track;

  return (
    <div className={`channel-strip channel-strip--${ch.id} ${isPlaying ? 'is-playing' : ''} density-${density}`}>

      {/* Top: channel label */}
      <div className="channel-strip__top">
        <div className="channel-strip__sigil" style={{ color: accent, borderColor: accent }}>
          <i className={`ti ${ch.sigil}`}/>
        </div>
        <div className="channel-strip__name" style={{ color: accent }}>{ch.label}</div>
        <div className="channel-strip__role">{ch.role}</div>
      </div>

      {/* Now-playing card */}
      <div className={`channel-strip__card ${isPlaying ? 'is-playing' : ''}`}
           onClick={isPlaying ? onOpenPanel : undefined}
           title={isPlaying ? 'View track list' : undefined}
           style={{ cursor: isPlaying ? 'pointer' : 'default' }}>
        {isPlaying ? (
          <>
            <div className="channel-strip__art" style={{ background: accent + '44' }}>
              <i className={`ti ti-music`} style={{ color: accent, fontSize: 28 }}/>
              <div className="channel-strip__art-pulse" style={{ borderColor: accent }}/>
            </div>
            <div className="channel-strip__meta">
              <div className="channel-strip__mood">{moodLabel || '—'}</div>
              <div className="channel-strip__title">{state.track.title || '—'}</div>
              <div className="channel-strip__artist">{state.track.artist || ''}</div>
            </div>
            <button className="channel-strip__list-btn" onClick={e => { e.stopPropagation(); onOpenPanel(); }} title="Track list">
              <i className="ti ti-list"/>
            </button>
          </>
        ) : (
          <div className="channel-strip__empty">
            <div className="channel-strip__empty-mark">∅</div>
            <div className="channel-strip__empty-text">No voice cast</div>
          </div>
        )}
      </div>

      {/* Progress bar — shown when playing */}
      {isPlaying && <ProgressBar chId={ch.id} accent={accent} onPrev={onPrev} onNext={onNext}/>}

      {/* Playback mode */}
      <PlaybackModeBar mode={state.mode} onChange={onMode} accent={accent}/>

      {/* Meter + Fader */}
      <div className="channel-strip__body">
        <MiniMeter active={isPlaying && !state.muted} accent={accent}/>
        <VerticalFader value={state.volume} onChange={onVol} accent={accent} muted={state.muted}/>
      </div>

      {/* Controls */}
      <div className="channel-strip__controls">
        <button className={`ch-btn ${state.muted ? 'is-on' : ''}`}
                style={{ '--ch-accent': accent }}
                onClick={e => { e.stopPropagation(); onMute(); }} title="Mute">
          <i className={`ti ${state.muted ? 'ti-volume-off' : 'ti-volume'}`}/>
        </button>
        <button className="ch-btn ch-btn--stop"
                onClick={e => { e.stopPropagation(); onStop(); }} title="Stop"
                disabled={!isPlaying}>
          <i className="ti ti-player-stop"/>
        </button>
        {/* Group link badge — spans remaining columns */}
        <div className="channel-strip__group-wrap" onClick={e => e.stopPropagation()}>
          {linkGroup && (
            <GroupBadge
              linkGroup={linkGroup}
              accent={accent}
              onGroupChange={onGroupChange}
              onLinkModeChange={onLinkModeChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TrackPanel — slide-in panel showing tracks for a mood
// ============================================================
function TrackPanel({ open, mood, chState, chAccent, onClose, onPlayTrack, onAddTrack, onDeleteTrack, onUpdateTrack, onMoveTrack }) {
  const [adding, setAdding]   = useState(false);
  const [newUrl, setNewUrl]   = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);

  // Reset add form when panel opens/closes
  useEffect(() => { if (!open) { setAdding(false); setNewUrl(''); setNewTitle(''); setNewArtist(''); } }, [open]);

  function submitAdd() {
    if (!newUrl.trim() || !newTitle.trim()) return;
    // Dropbox dl=1 links serve as attachments — iOS Safari won't stream them.
    // raw=1 serves inline and works on all platforms.
    const url = newUrl.trim().replace(/([?&])dl=1(&|$)/, '$1raw=1$2');
    onAddTrack({ url, title: newTitle.trim(), artist: newArtist.trim() });
    setNewUrl(''); setNewTitle(''); setNewArtist('');
    setAdding(false);
  }

function TrackRow({ track, index, isCurrent, isDropTarget, chAccent, onPlay, onDelete, onUpdate, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing,       setEditing]       = useState(false);
  const [editTitle,     setEditTitle]     = useState('');
  const [editArtist,    setEditArtist]    = useState('');
  const [editUrl,       setEditUrl]       = useState('');

  function startEdit() {
    setEditTitle(track.title);
    setEditArtist(track.artist || '');
    setEditUrl(track.url);
    setEditing(true);
    setConfirmDelete(false);
  }

  function submitEdit() {
    if (!editTitle.trim() || !editUrl.trim()) return;
    const url = editUrl.trim().replace(/([?&])dl=1(&|$)/, '$1raw=1$2');
    onUpdate({ title: editTitle.trim(), artist: editArtist.trim(), url });
    setEditing(false);
  }

  function cancelEdit() { setEditing(false); }

  if (editing) {
    return (
      <div className="track-row track-row--editing">
        <div className="track-row__edit-fields">
          <input className="track-panel__input" value={editTitle}
                 onChange={e => setEditTitle(e.target.value)}
                 placeholder="Title" autoFocus/>
          <input className="track-panel__input" value={editArtist}
                 onChange={e => setEditArtist(e.target.value)}
                 placeholder="Artist (optional)"/>
          <input className="track-panel__input" value={editUrl}
                 onChange={e => setEditUrl(e.target.value)}
                 placeholder="URL"/>
        </div>
        <div className="track-row__edit-actions">
          <button className="pill pill--primary pill--xs"
                  disabled={!editTitle.trim() || !editUrl.trim()}
                  onClick={submitEdit}>
            <i className="ti ti-check"/> Save
          </button>
          <button className="pill pill--xs" onClick={cancelEdit}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`track-row ${isCurrent ? 'is-current' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
         draggable
         onDragStart={onDragStart}
         onDragOver={onDragOver}
         onDrop={onDrop}
         onDragEnd={onDragEnd}>
      <div className="track-row__drag"><i className="ti ti-grip-vertical"/></div>
      <div className="track-row__num">{index + 1}</div>
      <div className="track-row__info" onClick={onPlay}>
        <div className="track-row__title">{track.title}</div>
        {track.artist && <div className="track-row__artist">{track.artist}</div>}
      </div>
      {isCurrent && (
        <div className="track-row__playing" style={{ color: chAccent }}>
          <i className="ti ti-volume"/>
        </div>
      )}
      <button className="track-row__play" onClick={onPlay} title="Play">
        <i className="ti ti-player-play"/>
      </button>
      <button className="track-row__edit" onClick={startEdit} title="Edit">
        <i className="ti ti-pencil"/>
      </button>
      {confirmDelete ? (
        <>
          <button className="track-row__confirm-del" onClick={onDelete} title="Confirm remove">
            <i className="ti ti-check"/>
          </button>
          <button className="track-row__cancel-del" onClick={() => setConfirmDelete(false)} title="Keep">
            <i className="ti ti-x"/>
          </button>
        </>
      ) : (
        <button className="track-row__del" onClick={() => setConfirmDelete(true)} title="Remove">
          <i className="ti ti-trash"/>
        </button>
      )}
    </div>
  );
}
  function onDragOver(e, i)  { e.preventDefault(); setDropIdx(i); }
  function onDrop(e, i) {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== i) onMoveTrack(dragIdx, i);
    setDragIdx(null); setDropIdx(null);
  }
  function onDragEnd() { setDragIdx(null); setDropIdx(null); }

  return (
    <div className={`track-panel ${open ? 'is-open' : ''}`}>
      <div className="track-panel__backdrop" onClick={onClose}/>
      <div className="track-panel__drawer">
        {/* Header */}
        <div className="track-panel__head" style={{ '--panel-accent': chAccent || '#c9a84c' }}>
          <div className="track-panel__mood-swatch" style={{ background: mood?.color || '#333' }}>
            <i className={`ti ${mood?.sigil || 'ti-music'}`}/>
          </div>
          <div className="track-panel__mood-info">
            <div className="track-panel__mood-name">{mood?.label || '—'}</div>
            <div className="track-panel__mood-count">
              {mood?.tracks?.length || 0} track{mood?.tracks?.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="track-panel__close" onClick={onClose}><i className="ti ti-x"/></button>
        </div>

        {/* Track list */}
        <div className="track-panel__list">
          {(!mood?.tracks || mood.tracks.length === 0) && !adding && (
            <div className="track-panel__empty">
              <i className="ti ti-music-off"/>
              <div>No tracks yet.</div>
              <button className="pill pill--primary" onClick={() => setAdding(true)}>
                <i className="ti ti-plus"/> Add first track
              </button>
            </div>
          )}

          {mood?.tracks?.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              isCurrent={chState?.track?.id === track.id}
              isDropTarget={dropIdx === i}
              chAccent={chAccent}
              onPlay={() => onPlayTrack(track, i)}
              onDelete={() => onDeleteTrack(track.id)}
              onUpdate={fields => onUpdateTrack(track.id, fields)}
              onDragStart={e => onDragStart(e, i)}
              onDragOver={e  => onDragOver(e, i)}
              onDrop={e      => onDrop(e, i)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>

        {/* Add track form */}
        {adding ? (
          <div className="track-panel__add-form">
            <div className="track-panel__add-title">Add Track</div>
            <input className="track-panel__input" placeholder="Title *" value={newTitle}
                   onChange={e => setNewTitle(e.target.value)} autoFocus/>
            <input className="track-panel__input" placeholder="URL * (Dropbox dl=1, Cloudinary, etc.)"
                   value={newUrl} onChange={e => setNewUrl(e.target.value)}/>
            <input className="track-panel__input" placeholder="Artist (optional)"
                   value={newArtist} onChange={e => setNewArtist(e.target.value)}/>
            <div className="track-panel__add-actions">
              <button className="pill pill--primary"
                      disabled={!newUrl.trim() || !newTitle.trim()}
                      onClick={submitAdd}>
                <i className="ti ti-check"/> Add
              </button>
              <button className="pill" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="track-panel__footer">
            <button className="pill pill--primary" onClick={() => setAdding(true)}>
              <i className="ti ti-plus"/> Add track
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MoodEditorOverlay — create or edit a mood/playlist
// ============================================================
function MoodEditorOverlay({ open, mood, onSave, onDelete, onClose }) {
  const { SIGIL_OPTIONS, COLOR_OPTIONS } = window.BardicData;
  const isNew = !mood;

  const [label,  setLabel]  = useState('');
  const [sigil,  setSigil]  = useState('ti-music');
  const [color,  setColor]  = useState('#a76a2a');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(mood?.label || '');
      setSigil(mood?.sigil || 'ti-music');
      setColor(mood?.color || '#a76a2a');
      setConfirmDelete(false);
    }
  }, [open, mood]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay__card" onClick={e => e.stopPropagation()}>
        <div className="overlay__title">{isNew ? 'New Mood' : 'Edit Mood'}</div>

        <div className="overlay__field">
          <label>Name</label>
          <input className="overlay__input" autoFocus value={label}
                 onChange={e => setLabel(e.target.value)} placeholder="e.g. Battle, Somber, Town Square"/>
        </div>

        <div className="overlay__field">
          <label>Icon</label>
          <div className="sigil-grid">
            {SIGIL_OPTIONS.map(s => (
              <button key={s} className={`sigil-btn ${sigil === s ? 'is-on' : ''}`} onClick={() => setSigil(s)}>
                <i className={`ti ${s}`}/>
              </button>
            ))}
          </div>
        </div>

        <div className="overlay__field">
          <label>Color</label>
          <div className="color-grid">
            {COLOR_OPTIONS.map(c => (
              <button key={c} className={`color-swatch ${color === c ? 'is-on' : ''}`}
                      style={{ background: c }} onClick={() => setColor(c)}/>
            ))}
          </div>
        </div>

        <div className="overlay__row">
          <button className="pill pill--primary" disabled={!label.trim()}
                  onClick={() => onSave({ label: label.trim(), sigil, color })}>
            <i className="ti ti-check"/> {isNew ? 'Create' : 'Save'}
          </button>
          <button className="pill" onClick={onClose}>Cancel</button>
          {!isNew && (
            confirmDelete ? (
              <>
                <button className="pill pill--danger" onClick={onDelete}>Confirm delete</button>
                <button className="pill" onClick={() => setConfirmDelete(false)}>Keep</button>
              </>
            ) : (
              <button className="pill pill--danger-ghost" onClick={() => setConfirmDelete(true)}>
                <i className="ti ti-trash"/> Delete
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RuneVisualizer (unchanged)
// ============================================================
function RuneVisualizer({ visible }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx2d  = canvas.getContext('2d');
    let raf;
    const draw = () => {
      const data = window.BardicAudio.getVizData();
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      ctx2d.clearRect(0, 0, W, H);
      const R = Math.min(cx, cy) - 10;
      const n = Math.min(data.length, 64);
      ctx2d.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = R * 0.3 + (data[i] / 255) * R * 0.7;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
      }
      ctx2d.closePath();
      ctx2d.strokeStyle = 'rgba(201,168,76,0.55)';
      ctx2d.lineWidth = 1.5;
      ctx2d.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [visible]);
  if (!visible) return null;
  return <canvas ref={canvasRef} className="rune-viz" width={220} height={220}/>;
}

// ============================================================
// ParticleBg (unchanged)
// ============================================================
function ParticleBg({ visible }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx2d  = canvas.getContext('2d');
    let raf;
    let W, H, particles = [];
    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      particles = Array.from({ length: 40 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.8 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -(0.1 + Math.random() * 0.25),
        alpha: 0.2 + Math.random() * 0.5,
        a: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      ctx2d.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx + Math.sin(p.a) * 0.1;
        p.y += p.vy;
        p.a += 0.02;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        const flicker = 0.7 + Math.sin(p.a * 3) * 0.3;
        ctx2d.fillStyle = `rgba(245,210,140,${p.alpha * flicker})`;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2d.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [visible]);
  if (!visible) return null;
  return <canvas ref={canvasRef} className="particle-bg"/>;
}

// ============================================================
// TimerOverlay (unchanged)
// ============================================================
function TimerOverlay({ open, onClose }) {
  const [mode,    setMode]    = useState('count-up');
  const [seconds, setSeconds] = useState(0);
  const [target,  setTarget]  = useState(60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => {
      setSeconds(s => {
        if (mode === 'count-down') { if (s <= 0) { setRunning(false); return 0; } return s - 1; }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [running, mode]);

  function switchMode(m) { setMode(m); setSeconds(m === 'count-down' ? target : 0); setRunning(false); }

  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay__card" onClick={e => e.stopPropagation()}>
        <div className="overlay__title">Hourglass</div>
        <div className="timer-display">{fmtTime(Math.max(0, seconds))}</div>
        <div className="timer-modes">
          <button className={`pill ${mode==='count-up'?'is-on':''}`}   onClick={() => switchMode('count-up')}>Count up</button>
          <button className={`pill ${mode==='count-down'?'is-on':''}`} onClick={() => switchMode('count-down')}>Count down</button>
        </div>
        {mode === 'count-down' && (
          <div className="timer-presets">
            {[30,60,120,300,600].map(s => (
              <button key={s} className="pill" onClick={() => { setTarget(s); setSeconds(s); }}>{fmtTime(s)}</button>
            ))}
          </div>
        )}
        <div className="timer-controls">
          <button className="pill pill--primary" onClick={() => setRunning(r => !r)}>
            {running ? <><i className="ti ti-player-pause"/> Pause</> : <><i className="ti ti-player-play"/> Start</>}
          </button>
          <button className="pill" onClick={() => { setSeconds(mode === 'count-down' ? target : 0); setRunning(false); }}>Reset</button>
          <button className="pill" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SaveSceneOverlay — seal current channel state as a scene
// ============================================================
function SaveSceneOverlay({ open, onSave, onClose }) {
  const [label, setLabel] = React.useState('');
  const [desc,  setDesc]  = React.useState('');

  React.useEffect(() => {
    if (open) { setLabel(''); setDesc(''); }
  }, [open]);

  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay__card" onClick={e => e.stopPropagation()}>
        <div className="overlay__title">Seal Scene</div>
        <p className="overlay__body">
          Save the current channel arrangement as a one-click scene recall.
        </p>
        <div className="overlay__field">
          <label>Scene name</label>
          <input className="overlay__input" autoFocus value={label}
                 onChange={e => setLabel(e.target.value)}
                 placeholder="e.g. Cave Battle, Wizard Tower, Last Stand"/>
        </div>
        <div className="overlay__field">
          <label>Flavour note (optional)</label>
          <input className="overlay__input" value={desc}
                 onChange={e => setDesc(e.target.value)}
                 placeholder="A line for your future self"/>
        </div>
        <div className="overlay__row">
          <button className="pill pill--primary"
                  disabled={!label.trim()}
                  onClick={() => { onSave(label.trim(), desc.trim()); }}>
            <i className="ti ti-stamp"/> Seal
          </button>
          <button className="pill" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Global Pause/Resume button (mobile floating action button) ──
// Shown only on mobile (CSS hides on desktop — desktop uses Space bar).
// anyPlaying: true if at least one channel is playing and not paused.
function GlobalPauseButton({ anyPlaying, onToggle }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onTouchEnd(e) {
      // Call resumeAll() synchronously here — same pattern as MoodPad.
      // iOS only permits audio.play() within the native gesture call stack;
      // React's onClick fires too late.
      e.preventDefault();
      window.BardicAudio.resumeAll();
      onToggle();
    }
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => el.removeEventListener('touchend', onTouchEnd);
  }, [onToggle]);

  return (
    <button
      ref={ref}
      className={`global-pause-btn ${anyPlaying ? 'global-pause-btn--playing' : 'global-pause-btn--paused'}`}
      onClick={onToggle}
      aria-label={anyPlaying ? 'Pause all' : 'Resume all'}
    >
      <i className={`ti ${anyPlaying ? 'ti-player-pause' : 'ti-player-play'}`}/>
    </button>
  );
}


// ============================================================
// SonusEditorOverlay — create or edit a sonus portal
// ============================================================
function SonusEditorOverlay({ open, portal, onSave, onDelete, onClose }) {
  const { SIGIL_OPTIONS, COLOR_OPTIONS } = window.BardicData;
  const isNew = !portal;

  const [label,  setLabel]  = useState('');
  const [url,    setUrl]    = useState('');
  const [sigil,  setSigil]  = useState('ti-ripple');
  const [color,  setColor]  = useState('#3a6a8a');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(portal?.label || '');
      setUrl(portal?.url || '');
      setSigil(portal?.sigil || 'ti-ripple');
      setColor(portal?.color || '#3a6a8a');
      setConfirmDelete(false);
    }
  }, [open, portal]);

  if (!open) return null;

  function extractVideoId(raw) {
    try {
      const u = new URL(raw.trim());
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
      return u.searchParams.get('v') || '';
    } catch { return ''; }
  }

  const videoId = extractVideoId(url);
  const valid = label.trim() && url.trim() && videoId;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay__card" onClick={e => e.stopPropagation()}>
        <div className="overlay__title">{isNew ? 'New Portal' : 'Edit Portal'}</div>

        <div className="overlay__field">
          <label>Name</label>
          <input className="overlay__input" autoFocus value={label}
                 onChange={e => setLabel(e.target.value)}
                 placeholder="e.g. Tavern Ambience, Rain on Stone"/>
        </div>

        <div className="overlay__field">
          <label>YouTube URL</label>
          <input className="overlay__input" value={url}
                 onChange={e => setUrl(e.target.value)}
                 placeholder="https://youtube.com/watch?v=..."/>
          {url && !videoId && (
            <div className="overlay__hint overlay__hint--warn">
              <i className="ti ti-alert-circle"/> Couldn't extract a video ID — check the URL
            </div>
          )}
          {videoId && (
            <div className="overlay__hint">
              <i className="ti ti-check"/> Video ID: {videoId}
            </div>
          )}
        </div>

        <div className="overlay__field">
          <label>Icon</label>
          <div className="sigil-grid">
            {SIGIL_OPTIONS.map(s => (
              <button key={s} className={`sigil-btn ${sigil === s ? 'is-on' : ''}`} onClick={() => setSigil(s)}>
                <i className={`ti ${s}`}/>
              </button>
            ))}
          </div>
        </div>

        <div className="overlay__field">
          <label>Color</label>
          <div className="color-grid">
            {COLOR_OPTIONS.map(c => (
              <button key={c} className={`color-swatch ${color === c ? 'is-on' : ''}`}
                      style={{ background: c }} onClick={() => setColor(c)}/>
            ))}
          </div>
        </div>

        <div className="overlay__row">
          <button className="pill pill--primary" disabled={!valid}
                  onClick={() => onSave({ label: label.trim(), url: url.trim(), sigil, color })}>
            <i className="ti ti-check"/> {isNew ? 'Create' : 'Save'}
          </button>
          <button className="pill" onClick={onClose}>Cancel</button>
          {!isNew && (
            confirmDelete ? (
              <>
                <button className="pill pill--danger" onClick={onDelete}>Confirm delete</button>
                <button className="pill" onClick={() => setConfirmDelete(false)}>Keep</button>
              </>
            ) : (
              <button className="pill pill--danger-ghost" onClick={() => setConfirmDelete(true)}>
                <i className="ti ti-trash"/> Delete
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SonusPanel — side drawer listing saved portals
// ============================================================
function SonusPanel({ open, portals, chStates, channels, selectedCh, channelById,
                      onClose, onCast, onAdd, onEdit }) {
  return (
    <div className={`track-panel ${open ? 'is-open' : ''}`}>
      <div className="track-panel__backdrop" onClick={onClose}/>
      <div className="track-panel__drawer">

        <div className="track-panel__head" style={{ '--panel-accent': '#3a6a8a' }}>
          <div className="track-panel__mood-swatch" style={{ background: '#3a6a8a' }}>
            <i className="ti ti-ripple"/>
          </div>
          <div className="track-panel__mood-info">
            <div className="track-panel__mood-name">Sonus Portals</div>
            <div className="track-panel__mood-count">
              Cast onto <strong style={{ color: channelById[selectedCh]?.accent }}>
                {channelById[selectedCh]?.label}
              </strong>
            </div>
          </div>
          <button className="track-panel__close" onClick={onClose}><i className="ti ti-x"/></button>
        </div>

        <div className="track-panel__list">
          {portals.length === 0 && (
            <div className="track-panel__empty">
              <i className="ti ti-ripple"/>
              <div>No portals yet.</div>
              <button className="pill pill--primary" onClick={onAdd}>
                <i className="ti ti-plus"/> Add first portal
              </button>
            </div>
          )}

          {portals.map(portal => {
            const activeCh = channels.find(c =>
              chStates[c.id].sourceType === 'sonus' && chStates[c.id].moodId === portal.id
            );
            const isActiveOnSelected = chStates[selectedCh]?.sourceType === 'sonus' &&
                                       chStates[selectedCh]?.moodId === portal.id;
            return (
              <div key={portal.id}
                   className={`track-row ${isActiveOnSelected ? 'is-current' : ''}`}>
                <div style={{ background: portal.color || '#3a6a8a', flexShrink: 0,
                              width: 32, height: 32, borderRadius: 6,
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${portal.sigil || 'ti-ripple'}`}
                     style={{ color: '#fff', fontSize: 14 }}/>
                </div>
                <div className="track-row__info" style={{ flex: 1 }}
                     onClick={() => onCast(portal.id, selectedCh)}
                     onTouchEnd={e => { e.preventDefault(); window.BardicAudio.resumeAll(); onCast(portal.id, selectedCh); }}>
                  <div className="track-row__title">{portal.label}</div>
                  {activeCh && (
                    <div className="track-row__artist" style={{ color: activeCh.accent }}>
                      Playing on {activeCh.label}
                    </div>
                  )}
                </div>
                {isActiveOnSelected && (
                  <div className="track-row__playing" style={{ color: channelById[selectedCh]?.accent }}>
                    <i className="ti ti-volume"/>
                  </div>
                )}
                <button className="track-row__play"
                        onClick={() => onCast(portal.id, selectedCh)}
                        onTouchEnd={e => { e.preventDefault(); window.BardicAudio.resumeAll(); onCast(portal.id, selectedCh); }}
                        title="Cast onto selected channel">
                  <i className="ti ti-player-play"/>
                </button>
                <button className="track-row__edit" onClick={() => onEdit(portal)} title="Edit">
                  <i className="ti ti-pencil"/>
                </button>
              </div>
            );
          })}
        </div>

        <div className="track-panel__footer">
          <button className="pill pill--primary" onClick={onAdd}>
            <i className="ti ti-plus"/> Add portal
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  MoodPad, VerticalFader, MiniMeter, PlaybackModeBar,
  ChannelStrip, TrackPanel, MoodEditorOverlay,
  SaveSceneOverlay, RuneVisualizer, ParticleBg, TimerOverlay,
  GlobalPauseButton, SonusPanel, SonusEditorOverlay, fmtTime, clamp,
});
