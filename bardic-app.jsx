// ============================================================
// bardic-app.jsx — The Bardic Console
// ============================================================

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Channel definitions (static) ──
const ALL_CHANNELS = [
  { id:'music',    label:'Music',    role:'Score · the soul of the scene',    sigil:'ti-music',      accent:'#c9a84c' },
  { id:'ambience', label:'Ambience', role:'Place · what the room sounds like', sigil:'ti-wind',       accent:'#6a8a4a' },
  { id:'sfx',      label:'SFX',      role:'Moment · one-shots and stings',    sigil:'ti-bolt',       accent:'#a76a2a' },
  { id:'weather',  label:'Weather',  role:'Sky · rain, wind, distant thunder', sigil:'ti-cloud-rain', accent:'#5a8aaa' },
];

// ── Tweak defaults ──
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density":      "comfortable",
  "padShape":     "hex",
  "showViz":      true,
  "showParticles":true,
  "channelCount": 4,
  "iconStyle":    "tabler",
  "accent":       "#c9a84c",
  "crossfade":    2
}/*EDITMODE-END*/;

// ── API helpers ──
const API = {
  async getTracks() {
    const res = await fetch('/.netlify/functions/tracks');
    if (!res.ok) throw new Error('Failed to load library');
    return res.json();
  },
  async saveTracks(library) {
    const res = await fetch('/.netlify/functions/tracks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(library),
    });
    if (!res.ok) throw new Error('Failed to save library');
    return res.json();
  },
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Audio URL proxy helper ──
// Routes Dropbox shared links through our Netlify function, which
// resolves the redirect chain server-side and returns a 302 to the
// final dropboxusercontent.com URL with CORS headers added.
// This allows createMediaElementSource → Web Audio graph routing,
// giving us real GainNode volume control that works on iOS.
// Non-Dropbox URLs (Cloudinary, etc.) are passed through unchanged.
function proxyAudioUrl(url) {
  if (!url) return url;
  if (url.includes('dropbox.com') || url.includes('dropboxusercontent.com')) {
    return `/.netlify/functions/audio-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// ============================================================
// App
// ============================================================
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const { SFX_PADS } = window.BardicData;

  const channels = ALL_CHANNELS.slice(0, t.channelCount);
  const channelById = Object.fromEntries(ALL_CHANNELS.map(c => [c.id, c]));

  // ── Library state ──
  const [library, setLibrary]       = useState({ moods: [], scenes: [] });
  const [libLoading, setLibLoading] = useState(true);
  const [libError, setLibError]     = useState(null);
  const [libSaving, setLibSaving]   = useState(false);

  useEffect(() => {
    API.getTracks()
      .then(data => {
        // Ensure scenes array exists for older data files
        setLibrary({ moods: [], scenes: [], ...data });
        setLibLoading(false);
      })
      .catch(e => { setLibError(e.message); setLibLoading(false); });
  }, []);

  const saveTimer      = useRef(null);
  const pendingLibrary = useRef(null);

  function scheduleLibrarySave(lib) {
    pendingLibrary.current = lib;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setLibSaving(true);
      try { await API.saveTracks(pendingLibrary.current); }
      catch (e) { console.error('Library save failed:', e); }
      finally { setLibSaving(false); }
    }, 1200);
  }

  function updateLibrary(newLib) {
    setLibrary(newLib);
    scheduleLibrarySave(newLib);
  }

  // ── Channel state ──
  const [chStates, setChStates] = useState(() => Object.fromEntries(
    ALL_CHANNELS.map(c => [c.id, {
      volume:   c.id === 'music' ? 0.7 : c.id === 'ambience' ? 0.5 : 0.45,
      muted:    false,
      paused:   false,
      mode:     'loop',
      moodId:   null,
      trackIdx: null,
      track:    null,
    }])
  ));

  // ── Audio engines ──
  const enginesRef = useRef({});
  useEffect(() => {
    ALL_CHANNELS.forEach(c => {
      if (!enginesRef.current[c.id]) {
        const eng = window.BardicAudio.makeChannel(c.id);
        eng.setVolume(c.id === 'music' ? 0.7 : c.id === 'ambience' ? 0.5 : 0.45);
        enginesRef.current[c.id] = eng;
      }
    });
  }, []);

  // ── Auto-advance refs ──
  const chStatesRef = useRef(chStates);
  useEffect(() => { chStatesRef.current = chStates; }, [chStates]);
  const libraryRef = useRef(library);
  useEffect(() => { libraryRef.current = library; }, [library]);

  useEffect(() => {
    ALL_CHANNELS.forEach(c => {
      const eng = enginesRef.current[c.id];
      if (!eng) return;
      eng.onTrackEnd((chId, endedTrack, mode) => {
        const cs   = chStatesRef.current[chId];
        const lib  = libraryRef.current;
        const mood = lib.moods.find(m => m.id === cs.moodId);
        if (!mood || !mood.tracks.length) return;
        if (mode === 'single') {
          setChStates(s => ({ ...s, [chId]: { ...s[chId], track: null, trackIdx: null, paused: false } }));
          return;
        }
        let nextIdx;
        if (mode === 'sequence') {
          nextIdx = ((cs.trackIdx ?? 0) + 1) % mood.tracks.length;
        } else {
          const others = mood.tracks.map((_,i) => i).filter(i => i !== cs.trackIdx);
          nextIdx = others.length ? others[Math.floor(Math.random() * others.length)] : 0;
        }
        const nextTrack = mood.tracks[nextIdx];
        enginesRef.current[chId]?.playTrack(nextTrack, crossfadeRef.current, mode);
        setChStates(s => ({ ...s, [chId]: { ...s[chId], track: nextTrack, trackIdx: nextIdx, paused: false } }));
      });
    });
  }, []); // eslint-disable-line

  const crossfade = t.crossfade ?? 2;
  const crossfadeRef = useRef(crossfade);
  useEffect(() => { crossfadeRef.current = crossfade; }, [crossfade]);

  // ── Selected channel ──
  const [selectedCh, setSelectedCh] = useState('music');

  // ── Active scene ──
  const [activeSceneId, setActiveSceneId] = useState(null);

  // ── Panel / overlay state ──
  const [trackPanel,  setTrackPanel]  = useState(null);
  const [moodEditor,  setMoodEditor]  = useState(null);
  const [sceneEditor, setSceneEditor] = useState(null); // null | { scene } (null scene = save current)
  const [overlay,     setOverlay]     = useState(null);

  // ── Master volume ──
  const [masterVol,   setMasterVol]   = useState(0.85);
  const [masterMuted, setMasterMuted] = useState(false);
  useEffect(() => {
    window.BardicAudio.setMasterVolume(masterMuted ? 0 : masterVol);
  }, [masterVol, masterMuted]);

  // ── Fader link groups (session-only, not auto-saved) ──
  // { music: { group: 1, mode: 'inverse' }, ambience: { group: 1, mode: 'inverse' }, ... }
  // group: null = unlinked. mode: 'parallel' | 'inverse'
  const [linkGroups, setLinkGroups] = useState(() =>
    Object.fromEntries(ALL_CHANNELS.map(c => [c.id, { group: null, mode: 'inverse' }]))
  );

  function setChannelGroup(chId, group) {
    setLinkGroups(prev => ({ ...prev, [chId]: { ...prev[chId], group } }));
  }

  function setChannelLinkMode(chId, mode) {
    setLinkGroups(prev => ({ ...prev, [chId]: { ...prev[chId], mode } }));
  }

  // ============================================================
  // CHANNEL ACTIONS
  // ============================================================
  const playTrackOnChannel = useCallback((track, trackIdx, moodId, chId) => {
    const mode = chStates[chId].mode;
    enginesRef.current[chId]?.playTrack(track, crossfadeRef.current, mode);
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track, trackIdx, moodId, paused: false } }));
    setActiveSceneId(null);
  }, [chStates]);

  const castMoodOnChannel = useCallback((moodId, chId) => {
    const mood = library.moods.find(m => m.id === moodId);
    if (!mood || !mood.tracks.length) return;
    const mode = chStates[chId].mode;
    let idx = 0;
    if (mode === 'shuffle') idx = Math.floor(Math.random() * mood.tracks.length);
    const track = mood.tracks[idx];
    enginesRef.current[chId]?.playTrack(track, crossfadeRef.current, mode);
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track, trackIdx: idx, moodId, paused: false } }));
    setActiveSceneId(null);
  }, [library, chStates]);

  const stopChannel = useCallback((chId) => {
    enginesRef.current[chId]?.stopTrack(crossfadeRef.current);
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track: null, trackIdx: null, moodId: null, paused: false } }));
    setActiveSceneId(null);
  }, []);

  // Toggle mood on its channel — pause if playing, resume if paused, start if not playing
  const toggleMoodOnChannel = useCallback((moodId, chId) => {
    const cs  = chStates[chId];
    const eng = enginesRef.current[chId];
    if (cs.moodId === moodId) {
      // This mood is on this channel
      if (cs.paused) {
        eng?.resumeTrack();
        setChStates(s => ({ ...s, [chId]: { ...s[chId], paused: false } }));
      } else {
        eng?.pauseTrack();
        setChStates(s => ({ ...s, [chId]: { ...s[chId], paused: true } }));
      }
    } else {
      castMoodOnChannel(moodId, chId);
    }
  }, [chStates, castMoodOnChannel]);

  const setVolume = useCallback((chId, v) => {
    // Apply to the moved channel directly
    enginesRef.current[chId]?.setVolume(v);

    // Check if this channel belongs to a link group
    const link = linkGroups[chId];
    if (!link?.group) {
      setChStates(s => ({ ...s, [chId]: { ...s[chId], volume: v } }));
      return;
    }

    // Find all other channels in the same group
    const peers = ALL_CHANNELS.filter(c =>
      c.id !== chId && linkGroups[c.id]?.group === link.group
    );

    setChStates(s => {
      const delta = v - s[chId].volume;
      const next = { ...s, [chId]: { ...s[chId], volume: v } };
      peers.forEach(peer => {
        const peerLink = linkGroups[peer.id];
        const peerVol  = s[peer.id].volume;
        const newVol   = peerLink.mode === 'inverse'
          ? Math.max(0, Math.min(1, peerVol - delta))
          : Math.max(0, Math.min(1, peerVol + delta));
        next[peer.id] = { ...s[peer.id], volume: newVol };
        enginesRef.current[peer.id]?.setVolume(newVol);
      });
      return next;
    });
  }, [linkGroups]);

  const setMute = useCallback((chId) => {
    setChStates(s => {
      const next = !s[chId].muted;
      enginesRef.current[chId]?.setMuted(next);
      return { ...s, [chId]: { ...s[chId], muted: next } };
    });
  }, []);

  const setMode = useCallback((chId, mode) => {
    setChStates(s => ({ ...s, [chId]: { ...s[chId], mode } }));
    const cs = chStates[chId];
    if (cs.track) enginesRef.current[chId]?.playTrack(cs.track, 0.5, mode);
  }, [chStates]);

  // Prev: restart if >3s elapsed, else go to previous track in playlist
  const prevTrack = useCallback((chId) => {
    const cs  = chStates[chId];
    const eng = enginesRef.current[chId];
    if (!cs.track || !eng) return;
    const audio = eng._currentAudio();
    const elapsed = audio ? audio.currentTime : 0;
    if (elapsed > 3) {
      if (audio) audio.currentTime = 0;
      return;
    }
    const mood = library.moods.find(m => m.id === cs.moodId);
    if (!mood || !mood.tracks.length) return;
    const prevIdx = ((cs.trackIdx ?? 0) - 1 + mood.tracks.length) % mood.tracks.length;
    const prevTrk = mood.tracks[prevIdx];
    eng.playTrack(prevTrk, crossfadeRef.current, cs.mode);
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track: prevTrk, trackIdx: prevIdx, paused: false } }));
  }, [chStates, library]);

  // Next: advance to next track (respects shuffle mode)
  const nextTrack = useCallback((chId) => {
    const cs  = chStates[chId];
    const eng = enginesRef.current[chId];
    if (!cs.track || !eng) return;
    const mood = library.moods.find(m => m.id === cs.moodId);
    if (!mood || !mood.tracks.length) return;
    let nextIdx;
    if (cs.mode === 'shuffle') {
      const others = mood.tracks.map((_,i) => i).filter(i => i !== cs.trackIdx);
      nextIdx = others.length ? others[Math.floor(Math.random() * others.length)] : 0;
    } else {
      nextIdx = ((cs.trackIdx ?? 0) + 1) % mood.tracks.length;
    }
    const nextTrk = mood.tracks[nextIdx];
    eng.playTrack(nextTrk, crossfadeRef.current, cs.mode);
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track: nextTrk, trackIdx: nextIdx, paused: false } }));
  }, [chStates, library]);

  // ============================================================
  // SCENE ACTIONS
  // ============================================================
  const applyScene = useCallback((scene) => {
    setActiveSceneId(scene.id);
    Object.entries(scene.slots).forEach(([chId, moodId]) => {
      if (!channels.find(c => c.id === chId)) return;
      if (!moodId) {
        stopChannel(chId);
      } else {
        castMoodOnChannel(moodId, chId);
      }
    });
    // Restore group assignments if the scene has them
    if (scene.groups) {
      setLinkGroups(prev => {
        const next = { ...prev };
        Object.entries(scene.groups).forEach(([chId, g]) => {
          next[chId] = { ...prev[chId], ...g };
        });
        return next;
      });
    }
  }, [channels, castMoodOnChannel, stopChannel]);

  const saveCurrentAsScene = useCallback((label, desc) => {
    const slots  = Object.fromEntries(ALL_CHANNELS.map(c => [c.id, chStates[c.id].moodId || null]));
    // Only persist group assignments that are actually set
    const groups = Object.fromEntries(
      ALL_CHANNELS
        .filter(c => linkGroups[c.id]?.group !== null)
        .map(c => [c.id, { group: linkGroups[c.id].group, mode: linkGroups[c.id].mode }])
    );
    const scene = {
      id: uid(), label, desc, slots,
      ...(Object.keys(groups).length > 0 ? { groups } : {}),
      sealColor: '#c9a84c',
    };
    const newLib = { ...library, scenes: [...(library.scenes || []), scene] };
    updateLibrary(newLib);
    setActiveSceneId(scene.id);
    setSceneEditor(null);
  }, [chStates, linkGroups, library]);

  const deleteScene = useCallback((sceneId) => {
    const newLib = { ...library, scenes: (library.scenes || []).filter(s => s.id !== sceneId) };
    updateLibrary(newLib);
    if (activeSceneId === sceneId) setActiveSceneId(null);
  }, [library, activeSceneId]);

  // ============================================================
  // LIBRARY MUTATIONS
  // ============================================================
  const addMood = useCallback((mood) => {
    updateLibrary({ ...library, moods: [...library.moods, { ...mood, id: uid(), tracks: [] }] });
  }, [library]);

  const updateMood = useCallback((moodId, patch) => {
    updateLibrary({ ...library, moods: library.moods.map(m => m.id === moodId ? { ...m, ...patch } : m) });
  }, [library]);

  const deleteMood = useCallback((moodId) => {
    updateLibrary({ ...library, moods: library.moods.filter(m => m.id !== moodId) });
    ALL_CHANNELS.forEach(c => { if (chStates[c.id].moodId === moodId) stopChannel(c.id); });
  }, [library, chStates, stopChannel]);

  const addTrack = useCallback((moodId, track) => {
    updateLibrary({
      ...library,
      moods: library.moods.map(m => m.id === moodId ? { ...m, tracks: [...m.tracks, { ...track, id: uid() }] } : m),
    });
  }, [library]);

  const deleteTrack = useCallback((moodId, trackId) => {
    updateLibrary({
      ...library,
      moods: library.moods.map(m => m.id === moodId ? { ...m, tracks: m.tracks.filter(t => t.id !== trackId) } : m),
    });
  }, [library]);

  const moveTrack = useCallback((moodId, fromIdx, toIdx) => {
    const mood = library.moods.find(m => m.id === moodId);
    if (!mood) return;
    const tracks = [...mood.tracks];
    const [moved] = tracks.splice(fromIdx, 1);
    tracks.splice(toIdx, 0, moved);
    updateLibrary({ ...library, moods: library.moods.map(m => m.id === moodId ? { ...m, tracks } : m) });
  }, [library]);

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================
  // Number keys toggle the mood at that index on whichever channel it's playing.
  // If not playing anywhere, cast onto selected channel.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setMasterMuted(m => !m); return; }
      if (e.key === 'Escape') { setTrackPanel(null); setMoodEditor(null); setSceneEditor(null); setOverlay(null); return; }
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9) {
        const mood = library.moods[n - 1];
        if (!mood) return;
        // Find which channel this mood is on (if any)
        const playingCh = ALL_CHANNELS.find(c => chStates[c.id].moodId === mood.id);
        if (playingCh) {
          // Mood is active — toggle pause/resume on that channel
          toggleMoodOnChannel(mood.id, playingCh.id);
        } else {
          // Mood is not playing anywhere — cast onto selected channel
          castMoodOnChannel(mood.id, selectedCh);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [library, selectedCh, chStates, toggleMoodOnChannel, castMoodOnChannel]);

  // ============================================================
  // RENDER
  // ============================================================
  const panelMood  = trackPanel ? library.moods.find(m => m.id === trackPanel.moodId) : null;
  const allScenes  = library.scenes || [];

  return (
    <div className={`bardic density-${t.density}`}>
      <ParticleBg visible={t.showParticles}/>

      {/* HEADER */}
      <header className="bardic-header">
        <div className="bardic-header__left">
          <div className="bardic-header__title">The Bardic Console</div>
          <div className="bardic-header__sub">Trials of Kirtas · Sound Engine</div>
        </div>
        <div className="bardic-header__center">
          <div className="now-scene">
            <div className="now-scene__label">
              {activeSceneId
                ? (allScenes.find(s => s.id === activeSceneId)?.label ? 'Scene' : 'Now Casting')
                : 'Now Casting'}
            </div>
            <div className="now-scene__name">
              {activeSceneId
                ? (allScenes.find(s => s.id === activeSceneId)?.label || '—')
                : chStates[selectedCh]?.moodId
                  ? (library.moods.find(m => m.id === chStates[selectedCh].moodId)?.label || '—')
                  : '— Silence —'}
            </div>
          </div>
        </div>
        <div className="bardic-header__right">
          <div className="master-vol">
            <button className="header-btn" onClick={() => setMasterMuted(m => !m)}
                    title={masterMuted ? 'Unmute' : 'Mute all'}>
              <i className={`ti ${masterMuted ? 'ti-volume-off' : 'ti-volume'}`}/>
            </button>
            <input type="range" className="master-vol__slider" min={0} max={1} step={0.01}
                   value={masterMuted ? 0 : masterVol}
                   onChange={e => { setMasterMuted(false); setMasterVol(+e.target.value); }}/>
            <div className="master-vol__readout">{Math.round((masterMuted ? 0 : masterVol) * 100)}</div>
          </div>
          <button className="header-btn" onClick={() => setOverlay('timer')} title="Hourglass">
            <i className="ti ti-hourglass"/>
          </button>
          <button className="header-btn" onClick={() => setMoodEditor({ mood: null })} title="New mood">
            <i className="ti ti-plus"/>
          </button>
          {libSaving && <span className="save-indicator"><i className="ti ti-loader-2 spin"/> Saving…</span>}
          {libError  && <span className="save-indicator error" title={libError}><i className="ti ti-alert-circle"/> Error</span>}
        </div>
      </header>

      {/* MAIN: Channels + Codex */}
      <main className="bench">
        {/* LEFT: Channel strips */}
        <section className="bench__console">
          <div className="bench__section-head">
            <i className="ti ti-sliders"/>
            <span>Channels</span>
            <div className="bench__section-sub">
              Selected: <strong style={{ color: channelById[selectedCh]?.accent }}>
                {channelById[selectedCh]?.label}
              </strong>
              <span className="hint"> · click strip to select</span>
            </div>
          </div>
          <div className="bench__strips" style={{ '--strip-cols': channels.length }}>
            {channels.map(ch => (
              <div key={ch.id}
                   className={`bench__strip-wrap ${selectedCh === ch.id ? 'is-selected' : ''}`}
                   onClick={() => setSelectedCh(ch.id)}>
                <ChannelStrip
                  ch={ch}
                  state={chStates[ch.id]}
                  accent={ch.accent}
                  density={t.density}
                  moodLabel={chStates[ch.id].moodId
                    ? library.moods.find(m => m.id === chStates[ch.id].moodId)?.label
                    : null}
                  linkGroup={linkGroups[ch.id]}
                  onGroupChange={group => setChannelGroup(ch.id, group)}
                  onLinkModeChange={mode => setChannelLinkMode(ch.id, mode)}
                  onVol={v    => setVolume(ch.id, v)}
                  onMute={()  => setMute(ch.id)}
                  onStop={()  => stopChannel(ch.id)}
                  onMode={m   => setMode(ch.id, m)}
                  onPrev={()  => prevTrack(ch.id)}
                  onNext={()  => nextTrack(ch.id)}
                  onOpenPanel={() => {
                    if (chStates[ch.id].moodId)
                      setTrackPanel({ moodId: chStates[ch.id].moodId, fromChannel: ch.id });
                  }}
                />
                <div className="bench__select-marker"/>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: Mood Codex */}
        <section className="bench__codex">
          <div className="bench__section-head">
            <i className="ti ti-playlist"/>
            <span>Mood Codex</span>
            <div className="bench__section-sub">
              Cast onto <strong style={{ color: channelById[selectedCh]?.accent }}>
                {channelById[selectedCh]?.label}
              </strong>
              <span className="hint"> · keys 1–9 toggle</span>
            </div>
            <button className="head-add" onClick={() => setMoodEditor({ mood: null })}>
              <i className="ti ti-plus"/> New mood
            </button>
          </div>

          {libLoading && (
            <div className="codex__empty">
              <i className="ti ti-loader-2 spin"/> Loading library…
            </div>
          )}

          {!libLoading && library.moods.length === 0 && (
            <div className="codex__empty">
              <div className="codex__empty-icon"><i className="ti ti-music-off"/></div>
              <div className="codex__empty-text">No moods yet.</div>
              <div className="codex__empty-sub">Hit <strong>New mood</strong> to create your first playlist.</div>
            </div>
          )}

          {!libLoading && library.moods.length > 0 && (
            <div className="codex__grid">
              <RuneVisualizer visible={t.showViz}/>
              {library.moods.map((m, i) => {
                const activeCh = channels.find(c => chStates[c.id].moodId === m.id);
                const isPaused = activeCh ? chStates[activeCh.id].paused : false;
                return (
                  <div key={m.id} className="codex__pad-wrap" style={{ '--idx': i }}>
                    <MoodPad
                      mood={m}
                      shape={t.padShape}
                      iconStyle={t.iconStyle}
                      active={!!activeCh && !isPaused}
                      paused={isPaused}
                      channelAccent={activeCh?.accent || channelById[selectedCh]?.accent}
                      size={t.density === 'compact' ? 78 : t.density === 'cozy' ? 110 : 92}
                      onClick={() => {
                        const playingCh = ALL_CHANNELS.find(c => chStates[c.id].moodId === m.id);
                        if (playingCh) toggleMoodOnChannel(m.id, playingCh.id);
                        else castMoodOnChannel(m.id, selectedCh);
                      }}
                      onOpenPanel={() => setTrackPanel({ moodId: m.id, fromChannel: activeCh?.id || selectedCh })}
                      onEdit={()      => setMoodEditor({ mood: m })}
                    />
                    {i < 9 && <div className="codex__keycap">{i + 1}</div>}
                    {activeCh && !isPaused && (
                      <div className="codex__active-dot" style={{ background: activeCh.accent }}/>
                    )}
                    {isPaused && (
                      <div className="codex__active-dot codex__active-dot--paused"/>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* BOTTOM ROW: SFX + Scenes */}
      <section className="bottom-row">
        <div className="bottom-row__sfx">
          <div className="bench__section-head">
            <i className="ti ti-music"/>
            <span>SFX Runestones</span>
            <div className="bench__section-sub">Tap to strike · one-shots</div>
          </div>
          <div className="sfx-grid">
            {SFX_PADS.map(s => (
              <button key={s.id} className="sfx-stone"
                      onClick={() => window.BardicAudio.playSfx(s.id)} title={s.desc}>
                <div className="sfx-stone__inner">
                  <i className={`ti ${s.icon}`}/>
                  <span>{s.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* SCENES */}
        <div className="bottom-row__scenes">
          <div className="bench__section-head">
            <i className="ti ti-scroll"/>
            <span>Scene Scrolls</span>
            <div className="bench__section-sub">One click · full scene recall</div>
            <button className="head-add" onClick={() => setSceneEditor({ scene: null })}>
              <i className="ti ti-stamp"/> Seal current
            </button>
          </div>
          {allScenes.length === 0 && (
            <div className="scenes__empty">
              No scenes sealed yet. Set your channels and hit <strong>Seal current</strong>.
            </div>
          )}
          <div className="scenes__grid">
            {allScenes.map(scene => {
              const isActive = activeSceneId === scene.id;
              return (
                <div key={scene.id} className={`scroll-card ${isActive ? 'is-active' : ''}`}>
                  <button className="scroll-card__main" onClick={() => applyScene(scene)}
                          style={{ '--seal': scene.sealColor || '#c9a84c' }}>
                    <div className="scroll-card__seal" style={{ background: scene.sealColor || '#c9a84c' }}>
                      <div className="scroll-card__seal-inner"><i className="ti ti-flame"/></div>
                    </div>
                    <div className="scroll-card__text">
                      <div className="scroll-card__label">{scene.label}</div>
                      <div className="scroll-card__desc">{scene.desc || '—'}</div>
                      <div className="scroll-card__slots">
                        {Object.entries(scene.slots).map(([chId, moodId]) => {
                          if (!moodId) return null;
                          const mood = library.moods.find(x => x.id === moodId);
                          if (!mood) return null;
                          return (
                            <span key={chId} className="scroll-card__slot">
                              <i className={`ti ${mood.sigil || 'ti-music'}`}/>
                              <span>{mood.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </button>
                  <button className="scroll-card__del" onClick={() => deleteScene(scene.id)} title="Delete">
                    <i className="ti ti-x"/>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="bardic-foot">
        <div className="bardic-foot__hint">
          <kbd>Space</kbd> mute all ·
          <kbd>1–9</kbd> toggle mood (pause/resume/start) ·
          <kbd>Esc</kbd> close panels
        </div>
      </footer>

      {/* TRACK PANEL */}
      <TrackPanel
        open={!!trackPanel}
        mood={panelMood}
        chState={trackPanel ? chStates[trackPanel.fromChannel] : null}
        chAccent={trackPanel ? channelById[trackPanel.fromChannel]?.accent : null}
        onClose={() => setTrackPanel(null)}
        onPlayTrack={(track, idx) => {
          if (trackPanel) playTrackOnChannel(track, idx, panelMood.id, trackPanel.fromChannel);
        }}
        onAddTrack={track      => { if (trackPanel) addTrack(trackPanel.moodId, track); }}
        onDeleteTrack={trackId => { if (trackPanel) deleteTrack(trackPanel.moodId, trackId); }}
        onMoveTrack={(fi, ti)  => { if (trackPanel) moveTrack(trackPanel.moodId, fi, ti); }}
      />

      {/* MOOD EDITOR */}
      <MoodEditorOverlay
        open={!!moodEditor}
        mood={moodEditor?.mood}
        onSave={data => {
          if (moodEditor?.mood) updateMood(moodEditor.mood.id, data);
          else addMood(data);
          setMoodEditor(null);
        }}
        onDelete={() => { if (moodEditor?.mood) deleteMood(moodEditor.mood.id); setMoodEditor(null); }}
        onClose={() => setMoodEditor(null)}
      />

      {/* SCENE EDITOR */}
      <SaveSceneOverlay
        open={!!sceneEditor}
        onSave={saveCurrentAsScene}
        onClose={() => setSceneEditor(null)}
      />

      {/* TIMER */}
      <TimerOverlay open={overlay === 'timer'} onClose={() => setOverlay(null)}/>

      {/* TWEAKS */}
      <TweaksPanel>
        <TweakSection label="Layout"/>
        <TweakRadio label="Density"   value={t.density}      options={['compact','comfortable','cozy']} onChange={v => setTweak('density', v)}/>
        <TweakRadio label="Channels"  value={t.channelCount} options={[2,3,4]}                          onChange={v => setTweak('channelCount', v)}/>
        <TweakSection label="Mood pads"/>
        <TweakRadio label="Shape"     value={t.padShape}     options={['hex','square','circle']}         onChange={v => setTweak('padShape', v)}/>
        <TweakRadio label="Icons"     value={t.iconStyle}    options={['tabler','emoji','typo']}         onChange={v => setTweak('iconStyle', v)}/>
        <TweakSection label="Atmosphere"/>
        <TweakToggle label="Rune visualizer" value={t.showViz}       onChange={v => setTweak('showViz', v)}/>
        <TweakToggle label="Candle motes"    value={t.showParticles} onChange={v => setTweak('showParticles', v)}/>
        <TweakSection label="Audio"/>
        <TweakSlider label="Crossfade" value={t.crossfade} min={0} max={15} step={1} unit="s" onChange={v => setTweak('crossfade', v)}/>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app-root')).render(<App/>);
