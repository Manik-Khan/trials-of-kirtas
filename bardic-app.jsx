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

// ── Shuffle bag ──────────────────────────────────────────────
// A "shuffle bag" plays every track in a playlist exactly once, in a
// random order, before any track repeats — the fix for the same few
// songs clustering on shuffle. We Fisher–Yates a list of track indices
// and walk it; when it's exhausted, a fresh bag is built. `avoidFirst`
// stops a freshly-built bag from opening on the track that just played,
// which prevents an adjacent repeat at the seam between two bags.
function makeBag(len, avoidFirst = null) {
  const bag = Array.from({ length: len }, (_, i) => i);
  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (avoidFirst != null && len > 1 && bag[0] === avoidFirst) {
    const k = 1 + Math.floor(Math.random() * (len - 1));
    [bag[0], bag[k]] = [bag[k], bag[0]];
  }
  return bag;
}

// Pick the next track index for a channel. Shuffle draws from the bag
// (rebuilding when empty or when the playlist size changed); every other
// mode steps forward. Returns the chosen index plus the bag state to
// persist back onto the channel.
function drawNext(cs, len) {
  if (cs.mode !== 'shuffle') {
    return { idx: ((cs.trackIdx ?? 0) + 1) % len, bag: cs.bag, bagPos: cs.bagPos };
  }
  let bag = cs.bag, bagPos = cs.bagPos ?? 0;
  if (!bag || bagPos >= bag.length || bag.length !== len) {
    bag = makeBag(len, cs.trackIdx);   // avoid repeating the current track across the seam
    bagPos = 0;
  }
  return { idx: bag[bagPos], bag, bagPos: bagPos + 1 };
}

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


  const channels = ALL_CHANNELS.slice(0, t.channelCount);
  const channelById = Object.fromEntries(ALL_CHANNELS.map(c => [c.id, c]));

  // ── Library state ──
  const [library, setLibrary]       = useState({ moods: [], scenes: [], sonus: [] });
  const [libLoading, setLibLoading] = useState(true);
  const [libError, setLibError]     = useState(null);
  const [libSaving, setLibSaving]   = useState(false);

  useEffect(() => {
    API.getTracks()
      .then(data => {
        // Ensure scenes array exists for older data files
        setLibrary({ moods: [], scenes: [], sonus: [], ...data });
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
      mode:     'shuffle',
      moodId:   null,
      trackIdx: null,
      track:    null,
      sourceType: null,  // 'mood' | 'sonus' | null
      bag:      null,    // shuffle bag: track indices in play order (null = build on next draw)
      bagPos:   0,       // how many of the bag have been consumed
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

  // ── YouTube IFrame API ──
  const ytPlayersRef = useRef({});  // { chId: YT.Player }

  useEffect(() => {
    if (window.YT) return; // already loaded
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
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
        let nextIdx, nextBag = cs.bag, nextBagPos = cs.bagPos;
        if (mode === 'sequence') {
          nextIdx = ((cs.trackIdx ?? 0) + 1) % mood.tracks.length;
        } else {
          const d = drawNext(cs, mood.tracks.length);  // shuffle: full pass before any repeat
          nextIdx = d.idx; nextBag = d.bag; nextBagPos = d.bagPos;
        }
        const nextTrack = mood.tracks[nextIdx];
        enginesRef.current[chId]?.playTrack(nextTrack, crossfadeRef.current, mode);
        setChStates(s => ({ ...s, [chId]: { ...s[chId], track: nextTrack, trackIdx: nextIdx, paused: false, bag: nextBag, bagPos: nextBagPos } }));
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
  const [trackPanel,   setTrackPanel]  = useState(null);
  const [moodEditor,   setMoodEditor]  = useState(null);
  const [sceneEditor,  setSceneEditor] = useState(null);
  const [sonusPanel,   setSonusPanel]  = useState(false);
  const [sonusEditor,  setSonusEditor] = useState(null); // null | { portal } (null portal = new)
  const [overlay,      setOverlay]     = useState(null);

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
    const mode = chStatesRef.current[chId].mode;
    // Use instant switch (0s fade) for manual track selection in the panel —
    // avoids voice stacking when the user clicks tracks quickly.
    enginesRef.current[chId]?.playTrack(track, 0, mode);
    // Manual pick: drop the bag so the next shuffle rebuilds around this track.
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track, trackIdx, moodId, paused: false, bag: null, bagPos: 0 } }));
    setActiveSceneId(null);
  }, []);

  const castMoodOnChannel = useCallback((moodId, chId) => {
    const mood = library.moods.find(m => m.id === moodId);
    if (!mood || !mood.tracks.length) return;
    const mode = chStates[chId].mode;
    let idx = 0, bag = null, bagPos = 0;
    if (mode === 'shuffle') {
      bag = makeBag(mood.tracks.length);   // fresh bag for this mood
      idx = bag[0];
      bagPos = 1;
    }
    const track = mood.tracks[idx];
    enginesRef.current[chId]?.playTrack(track, crossfadeRef.current, mode);
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track, trackIdx: idx, moodId, paused: false, bag, bagPos } }));
    setActiveSceneId(null);
  }, [library, chStates]);

  const stopChannel = useCallback((chId) => {
    enginesRef.current[chId]?.stopTrack(crossfadeRef.current);
    // Destroy any active YouTube player on this channel
    if (ytPlayersRef.current[chId]) {
      try { ytPlayersRef.current[chId].destroy(); } catch(e) {}
      delete ytPlayersRef.current[chId];
    }
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track: null, trackIdx: null, moodId: null, paused: false, sourceType: null } }));
    setActiveSceneId(null);
  }, []);

  // Cast a Sonus portal onto a channel — replaces any mood or YT player
  const castSonusOnChannel = useCallback((portalId, chId) => {
    const portal = libraryRef.current.sonus?.find(p => p.id === portalId);
    if (!portal) return;

    // Stop any Cloudinary track on this channel
    enginesRef.current[chId]?.stopTrack(0);

    // Destroy existing YT player on this channel if any.
    // After destroy(), YT leaves the iframe in the DOM — we reset the
    // container back to an empty div so the next YT.Player() call gets
    // a clean target (otherwise it may re-use the stale iframe).
    if (ytPlayersRef.current[chId]) {
      try { ytPlayersRef.current[chId].destroy(); } catch(e) {}
      delete ytPlayersRef.current[chId];
      const old = document.getElementById(`yt-player-${chId}`);
      if (old) {
        const fresh = document.createElement('div');
        fresh.id = `yt-player-${chId}`;
        fresh.style.cssText = 'width:100%;aspect-ratio:16/9;background:#000;pointer-events:auto;';
        old.parentNode.replaceChild(fresh, old);
      }
    }

    // Extract video ID
    function extractVideoId(raw) {
      try {
        const u = new URL(raw.trim());
        if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
        return u.searchParams.get('v') || '';
      } catch { return ''; }
    }
    const videoId = extractVideoId(portal.url);
    if (!videoId) return;

    // Target the permanent container rendered inside SonusPanel.
    // It's always in the DOM — we never create/move it here.
    // When the panel is open the iframe is visible with native controls
    // (including iOS volume). When closed the panel is off-screen.
    const containerId = `yt-player-${chId}`;

    const vol = chStatesRef.current[chId]?.volume ?? 0.5;

    const createPlayer = () => {
      ytPlayersRef.current[chId] = new window.YT.Player(containerId, {
        videoId,
        playerVars: { autoplay: 1, loop: 1, playlist: videoId, playsinline: 1, controls: 1 },
        events: {
          onReady: (e) => {
            e.target.setVolume(Math.round(vol * 100));
            e.target.playVideo();
          },
        },
      });
      // Call playVideo() synchronously — key iOS fix.
      // YT.Player queues commands before ready, so this fires
      // once initialised but is issued within the touch gesture.
      try { ytPlayersRef.current[chId].playVideo(); } catch(e) {}
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      // Queue until API is ready
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        createPlayer();
      };
    }

    setChStates(s => ({ ...s, [chId]: { ...s[chId], track: { title: portal.label, artist: 'YouTube' },
      trackIdx: null, moodId: portalId, paused: false, sourceType: 'sonus' } }));
    setActiveSceneId(null);
  }, []);

  // Toggle mood on its channel:
  //   - Not playing anywhere → cast onto channel
  //   - Playing and paused  → resume
  //   - Playing and active  → next track (double-press to skip)
  const toggleMoodOnChannel = useCallback((moodId, chId) => {
    const cs  = chStatesRef.current[chId];
    const eng = enginesRef.current[chId];
    if (cs.moodId === moodId && cs.sourceType !== 'sonus') {
      if (cs.paused) {
        eng?.resumeTrack();
        setChStates(s => ({ ...s, [chId]: { ...s[chId], paused: false } }));
      } else {
        // Double-press while playing → next track
        const mood = libraryRef.current.moods.find(m => m.id === moodId);
        if (!mood || !mood.tracks.length) return;
        const d = drawNext(cs, mood.tracks.length);
        const nextTrack = mood.tracks[d.idx];
        eng?.playTrack(nextTrack, crossfadeRef.current, cs.mode);
        setChStates(s => ({ ...s, [chId]: { ...s[chId], track: nextTrack, trackIdx: d.idx, paused: false, bag: d.bag, bagPos: d.bagPos } }));
      }
    } else {
      castMoodOnChannel(moodId, chId);
    }
  }, [castMoodOnChannel]);

  const setVolume = useCallback((chId, v) => {
    // Apply to the moved channel directly
    enginesRef.current[chId]?.setVolume(v);
    // Also push to YouTube player if one is active on this channel
    ytPlayersRef.current[chId]?.setVolume(Math.round(v * 100));

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
    // Any mode change clears the bag; a fresh shuffle bag builds lazily on the next advance.
    setChStates(s => ({ ...s, [chId]: { ...s[chId], mode, bag: null, bagPos: 0 } }));
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
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track: prevTrk, trackIdx: prevIdx, paused: false, bag: null, bagPos: 0 } }));
  }, [chStates, library]);

  // Next: advance to next track (respects shuffle mode)
  const nextTrack = useCallback((chId) => {
    const cs  = chStates[chId];
    const eng = enginesRef.current[chId];
    if (!cs.track || !eng) return;
    const mood = library.moods.find(m => m.id === cs.moodId);
    if (!mood || !mood.tracks.length) return;
    const d = drawNext(cs, mood.tracks.length);
    const nextTrk = mood.tracks[d.idx];
    eng.playTrack(nextTrk, crossfadeRef.current, cs.mode);
    setChStates(s => ({ ...s, [chId]: { ...s[chId], track: nextTrk, trackIdx: d.idx, paused: false, bag: d.bag, bagPos: d.bagPos } }));
  }, [chStates, library]);

  // Global pause/resume — pauses all playing channels, or resumes all paused ones.
  // Space bar and the mobile floating button both call this.
  const toggleGlobalPause = useCallback(() => {
    const anyPlaying = ALL_CHANNELS.some(c => chStates[c.id].track && !chStates[c.id].paused);
    if (anyPlaying) {
      ALL_CHANNELS.forEach(c => {
        if (chStates[c.id].track && !chStates[c.id].paused) {
          if (chStates[c.id].sourceType === 'sonus') {
            ytPlayersRef.current[c.id]?.pauseVideo();
          } else {
            enginesRef.current[c.id]?.pauseTrack();
          }
        }
      });
      setChStates(s => {
        const next = { ...s };
        ALL_CHANNELS.forEach(c => { if (s[c.id].track && !s[c.id].paused) next[c.id] = { ...s[c.id], paused: true }; });
        return next;
      });
    } else {
      ALL_CHANNELS.forEach(c => {
        if (chStates[c.id].track && chStates[c.id].paused) {
          if (chStates[c.id].sourceType === 'sonus') {
            ytPlayersRef.current[c.id]?.playVideo();
          } else {
            enginesRef.current[c.id]?.resumeTrack();
          }
        }
      });
      setChStates(s => {
        const next = { ...s };
        ALL_CHANNELS.forEach(c => { if (s[c.id].track && s[c.id].paused) next[c.id] = { ...s[c.id], paused: false }; });
        return next;
      });
    }
  }, [chStates]);

  // True if at least one channel has a track and is not paused
  const anyPlaying = ALL_CHANNELS.some(c => chStates[c.id].track && !chStates[c.id].paused);

  // Ref so the keydown handler always calls the latest toggleGlobalPause
  // without needing it in the useEffect dependency array.
  const toggleGlobalPauseRef = useRef(toggleGlobalPause);
  useEffect(() => { toggleGlobalPauseRef.current = toggleGlobalPause; }, [toggleGlobalPause]);

  // Per-channel pause/resume (July 5, wave A fix): the console only ever
  // had GLOBAL pause; toggleMoodOnChannel's active branch is documented
  // "double-press to skip". The rail's pause button needs a true
  // per-channel pause, so this mirrors toggleGlobalPause's per-channel
  // logic for one chId — both source types, same as the global path.
  const pauseChannel = useCallback((chId) => {
    const cs = chStatesRef.current[chId];
    if (!cs || !cs.track) return;
    if (cs.paused) {
      if (cs.sourceType === 'sonus') ytPlayersRef.current[chId]?.playVideo();
      else enginesRef.current[chId]?.resumeTrack();
      setChStates(s => ({ ...s, [chId]: { ...s[chId], paused: false } }));
    } else {
      if (cs.sourceType === 'sonus') ytPlayersRef.current[chId]?.pauseVideo();
      else enginesRef.current[chId]?.pauseTrack();
      setChStates(s => ({ ...s, [chId]: { ...s[chId], paused: true } }));
    }
  }, []);

  // ── Bardic radio (wave B, July 5): the engine relays clock-anchored
  // positions to 'bardic-radio' while on air. bardic-radio.js owns the
  // clock + transport; this block owns WHAT to anchor (it can reach
  // enginesRef). Sonus/YT channels are omitted — can't hold clock lock.
  const [onAir, setOnAir] = useState(false);
  const [radioListeners, setRadioListeners] = useState([]);
  const [airBlockedBy, setAirBlockedBy] = useState(null);  // another console holds the air
  const radioRef = useRef(null);
  // refs mirror the radio state so busSnapshot stays identity-stable —
  // a shifting busSnapshot re-ran the subscribe-once effect, tearing the
  // BroadcastChannel down (with an engine-bye) on every roster change
  // per-channel broadcast routing (July 5): ambience to the room's
  // devices, rhythmic music host-only — each channel opts in or out of
  // the anchors. Default: everything broadcasts.
  const [radioMask, setRadioMask] = useState(() => {
    const m = {}; ALL_CHANNELS.forEach(c => { m[c.id] = true; }); return m;
  });
  const radioMaskRef = useRef(radioMask);
  radioMaskRef.current = radioMask;
  const setChannelBroadcast = useCallback((chId, on) => {
    setRadioMask(m => ({ ...m, [chId]: !!on }));
  }, []);

  const radioStateRef = useRef({ onAir: false, listeners: [], blockedBy: null });
  radioStateRef.current = { onAir, listeners: radioListeners, blockedBy: airBlockedBy };

  const buildAnchors = useCallback(() => {
    const cs = chStatesRef.current;
    const at = window.BardicClock ? window.BardicClock.now() : Date.now();
    const channels = {};
    ALL_CHANNELS.forEach(c => {
      const s = cs[c.id];
      if (!s || !s.track || s.sourceType === 'sonus') return;
      if (!radioMaskRef.current[c.id]) return;   // host-only channel
      const audio = enginesRef.current[c.id]?._currentAudio();
      channels[c.id] = {
        url: s.track.url, title: s.track.title || null,
        label: c.label, accent: c.accent,
        pos: audio ? audio.currentTime : 0,
        paused: !!s.paused,
        volume: s.volume ?? 0.5,
        loop: (s.mode || 'loop') === 'loop',
      };
    });
    return { at, engineId: engineIdRef.current, channels };
  }, []);

  // the heartbeat row: sockets freeze on iOS, rows don't. The rail on
  // every OTHER device learns about this broadcast by reading bardic_air,
  // not by holding a Realtime connection open (July 5, B.6).
  const beatAir = useCallback((on) => {
    const sb = window.__tok && window.__tok.sb;
    if (!sb) return;
    sb.from('bardic_air').update({
      on_air: on,
      engine_name: 'the console',
      listener_count: on ? (radioStateRef.current.listeners || []).length : 0,
      updated_at: new Date().toISOString(),
    }).eq('id', 1).then((res) => {
      if (res && res.error) console.warn('[bardic] heartbeat write failed (did bardic-air.sql run?):', res.error.message);
    }, (e) => console.warn('[bardic] heartbeat write failed:', e));
  }, []);

  useEffect(() => {
    if (!onAir) {
      radioRef.current?.offAir();
      radioRef.current = null;
      setRadioListeners([]);
      beatAir(false);
      return;
    }
    const sb = window.__tok && window.__tok.sb;
    if (!sb || !window.BardicRadio || !window.BardicClock) { setOnAir(false); return; }
    let alive = true;
    let interval = null;
    window.BardicClock.sync().catch(() => {}).then(() => {
      if (!alive) return;
      setAirBlockedBy(null);
      radioRef.current = window.BardicRadio.broadcast(sb, {
        name: 'the console',
        onSyncRequest: () => radioRef.current?.sendAnchors(buildAnchors()),
        onListeners: (l) => { if (alive) setRadioListeners(l); },
        onConflict: (name) => {
          // never two engines on air — the incumbent keeps it (July 5)
          if (alive) { setAirBlockedBy(name); setOnAir(false); }
        },
      });
      radioRef.current.sendAnchors(buildAnchors());
      beatAir(true);
      // periodic re-anchor corrects engine-side drift; the heartbeat row
      // rides the same tick
      interval = setInterval(() => {
        radioRef.current?.sendAnchors(buildAnchors());
        beatAir(true);
      }, 10000);
    });
    return () => { alive = false; clearInterval(interval); radioRef.current?.offAir(); radioRef.current = null; };
  }, [onAir, buildAnchors, beatAir]);

  // every visible state change re-anchors immediately (cast/pause/next/vol),
  // and so does a routing change — a channel pulled host-only falls silent
  // on the room's devices within one anchor
  useEffect(() => {
    if (onAir) radioRef.current?.sendAnchors(buildAnchors());
  }, [chStates, radioMask, onAir, buildAnchors]);

  // ============================================================
  // BARDIC BUS — engine adapter (increment 1, July 5)
  // ============================================================
  // This tab is the ENGINE: it owns all audio and answers the bus.
  // Riders (the rail's Bardic tab; radio.html in wave B) send verbs
  // and render snapshots. Protocol lives in bardic-bus.js's header —
  // that header is the contract, this adapter just maps verbs onto
  // the callbacks that already exist.
  const busRef = useRef(null);
  const engineIdRef = useRef('eng-' + Math.random().toString(36).slice(2, 10));
  // the build tag travels in every snapshot: the console tab is long-lived
  // BY DESIGN, which means it keeps running pre-deploy code until someone
  // refreshes it (July 5 — the heartbeat "didn't work" because the engine
  // tab predated the heartbeat). The rail shows this tag; a missing or
  // old tag means "refresh the console tab."
  const BARDIC_BUILD = 'B6';

  // latest callbacks without re-subscribing (the toggleGlobalPauseRef pattern)
  const busVerbsRef = useRef({});
  busVerbsRef.current = {
    cast:   castMoodOnChannel,
    toggle: toggleMoodOnChannel,
    stop:   stopChannel,
    pause:  pauseChannel,
    next:   nextTrack,
    prev:   prevTrack,
    vol:    setVolume,
    globalPause: toggleGlobalPause,
    air:    setOnAir,
    radiomask: setChannelBroadcast,
  };

  // one full snapshot — never a diff; the latest snapshot is the truth
  const busSnapshot = useCallback(() => {
    const lib = libraryRef.current;
    const cs  = chStatesRef.current;
    const channelsOut = {};
    ALL_CHANNELS.forEach(c => {
      const s = cs[c.id] || {};
      const mood = s.sourceType === 'sonus' ? null : lib.moods.find(m => m.id === s.moodId);
      channelsOut[c.id] = {
        label: c.label, accent: c.accent,
        moodId: s.moodId ?? null,
        moodName: mood ? mood.label : (s.sourceType === 'sonus' ? 'Sonus portal' : null),
        trackTitle: s.track ? (s.track.title || null) : null,
        paused: !!s.paused,
        volume: s.volume ?? 0.5,
        sourceType: s.sourceType ?? null,
      };
    });
    return {
      t: 'state',
      build: BARDIC_BUILD,
      engineId: engineIdRef.current,
      ts: Date.now(),
      onAir: radioStateRef.current.onAir,
      listeners: radioStateRef.current.listeners,
      airBlockedBy: radioStateRef.current.blockedBy,
      radioMask: radioMaskRef.current,
      // protocol field stays 'name'; the console's mood field is 'label'
      moods: lib.moods.map(m => ({ id: m.id, name: m.label, color: m.color, sigil: m.sigil })),
      channels: channelsOut,
    };
  }, []);   // identity-stable: radio state rides radioStateRef

  // subscribe once; dispatch through the refs
  useEffect(() => {
    if (!window.BardicBus) return;
    const bus = window.BardicBus.connect('engine');
    busRef.current = bus;
    const off = bus.onMessage((msg) => {
      const verbs = busVerbsRef.current;
      switch (msg.t) {
        case 'hello':  bus.send(busSnapshot()); break;
        case 'cast':   verbs.cast(msg.moodId, msg.chId); break;
        case 'toggle': verbs.toggle(msg.moodId, msg.chId); break;
        case 'stop':   verbs.stop(msg.chId); break;
        case 'pause':  verbs.pause(msg.chId); break;
        case 'next':   verbs.next(msg.chId); break;
        case 'prev':   verbs.prev(msg.chId); break;
        case 'vol':    verbs.vol(msg.chId, msg.val); break;
        case 'globalPause': verbs.globalPause(); break;
        case 'air':    verbs.air(!!msg.on); break;
        case 'radiomask': verbs.radiomask(msg.chId, !!msg.on); break;
        default: break; // unknown verbs: ignore, never throw
      }
    });
    const bye = () => bus.send({ t: 'engine-bye', engineId: engineIdRef.current });
    window.addEventListener('beforeunload', bye);
    return () => { off(); window.removeEventListener('beforeunload', bye); bye(); bus.close(); };
  }, [busSnapshot]);

  // publish on every state change the riders can see
  // (busSnapshot's identity shifts with onAir/listeners, so those ride too)
  useEffect(() => {
    busRef.current?.send(busSnapshot());
  }, [chStates, library, onAir, radioListeners, airBlockedBy, radioMask, busSnapshot]);

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
        // Check if this slot is a sonus portal or a mood
        const sonusPortals = libraryRef.current.sonus || [];
        const isPortal = sonusPortals.some(p => p.id === moodId);
        if (isPortal) {
          castSonusOnChannel(moodId, chId);
        } else {
          castMoodOnChannel(moodId, chId);
        }
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

  const updateTrack = useCallback((moodId, trackId, fields) => {
    updateLibrary({
      ...library,
      moods: library.moods.map(m => m.id === moodId
        ? { ...m, tracks: m.tracks.map(t => t.id === trackId ? { ...t, ...fields } : t) }
        : m),
    });
  }, [library]);

  // ── Sonus CRUD ──
  const addSonus = useCallback((portal) => {
    const sonus = [...(library.sonus || []), { ...portal, id: uid() }];
    updateLibrary({ ...library, sonus });
  }, [library]);

  const updateSonus = useCallback((portalId, patch) => {
    const sonus = (library.sonus || []).map(p => p.id === portalId ? { ...p, ...patch } : p);
    updateLibrary({ ...library, sonus });
  }, [library]);

  const deleteSonus = useCallback((portalId) => {
    const sonus = (library.sonus || []).filter(p => p.id !== portalId);
    updateLibrary({ ...library, sonus });
    ALL_CHANNELS.forEach(c => {
      if (chStates[c.id].sourceType === 'sonus' && chStates[c.id].moodId === portalId) {
        stopChannel(c.id);
      }
    });
  }, [library, chStates, stopChannel]);

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
      if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); toggleGlobalPauseRef.current(); return; }
      if (e.key === 'Escape') { setTrackPanel(null); setMoodEditor(null); setSceneEditor(null); setSonusPanel(false); setSonusEditor(null); setOverlay(null); return; }
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9) {
        const mood = library.moods[n - 1];
        if (!mood) return;
        // Selected-channel-first (July 5): only toggle if the mood is on the
        // SELECTED channel; otherwise cast onto it — even if the mood is
        // already playing elsewhere. One mood may ride multiple channels
        // (each keeps its own shuffle bag), matching what scenes always
        // allowed; the old any-channel gate ate the cast.
        const selState = chStates[selectedCh];
        if (selState.moodId === mood.id && selState.sourceType !== 'sonus') {
          toggleMoodOnChannel(mood.id, selectedCh);
        } else {
          castMoodOnChannel(mood.id, selectedCh);
        }
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
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
                // a mood may be live on several channels (July 5)
                const activeChs = channels.filter(c => chStates[c.id].moodId === m.id && chStates[c.id].sourceType !== 'sonus');
                const activeCh = activeChs[0];
                const isPaused = activeChs.length > 0 && activeChs.every(c => chStates[c.id].paused);
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
                        // selected-channel-first (July 5): toggle only when the
                        // mood rides the selected channel; else cast onto it,
                        // even if it's already live on another channel.
                        const selState = chStates[selectedCh];
                        if (selState.moodId === m.id && selState.sourceType !== 'sonus') toggleMoodOnChannel(m.id, selectedCh);
                        else castMoodOnChannel(m.id, selectedCh);
                      }}
                      onOpenPanel={() => setTrackPanel({ moodId: m.id, fromChannel: activeCh?.id || selectedCh })}
                      onEdit={()      => setMoodEditor({ mood: m })}
                    />
                    {i < 9 && <div className="codex__keycap">{i + 1}</div>}
                    {!isPaused && activeChs.filter(c => !chStates[c.id].paused).map((c, di) => (
                      <div key={c.id} className="codex__active-dot" style={{ background: c.accent, right: `${-2 + di * 10}px` }}/>
                    ))}
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

      {/* BOTTOM ROW: Sonus + Scenes */}
      <section className="bottom-row">
        <div className="bottom-row__sfx">
          <div className="bench__section-head">
            <i className="ti ti-ripple"/>
            <span>Sonus Portals</span>
            <div className="bench__section-sub">
              Cast onto <strong style={{ color: channelById[selectedCh]?.accent }}>
                {channelById[selectedCh]?.label}
              </strong>
            </div>
            <button className="head-add" onClick={() => setSonusPanel(true)}>
              <i className="ti ti-player-play"/> Open Sonus
            </button>
          </div>
          <div className="sfx-grid">
            {(library.sonus || []).map(portal => {
              const activeCh = channels.find(c =>
                chStates[c.id].sourceType === 'sonus' && chStates[c.id].moodId === portal.id
              );
              return (
                <button key={portal.id}
                        className={`sfx-stone ${activeCh ? 'is-active' : ''}`}
                        style={{ '--mood-color': portal.color || '#3a6a8a' }}
                        onClick={() => castSonusOnChannel(portal.id, selectedCh)}
                        onTouchEnd={e => {
                          e.preventDefault();
                          window.BardicAudio.resumeAll();
                          castSonusOnChannel(portal.id, selectedCh);
                        }}
                        title={activeCh ? `Playing on ${activeCh.label}` : `Cast onto ${channelById[selectedCh]?.label}`}>
                  <div className="sfx-stone__inner">
                    <i className={`ti ${portal.sigil || 'ti-ripple'}`}
                       style={{ color: activeCh ? (portal.color || '#3a6a8a') : undefined }}/>
                    <span>{portal.label}</span>
                  </div>
                  {activeCh && (
                    <div style={{ position: 'absolute', top: 4, right: 4,
                                  width: 6, height: 6, borderRadius: '50%',
                                  background: activeCh.accent }}/>
                  )}
                </button>
              );
            })}
            {(library.sonus || []).length === 0 && (
              <div className="codex__empty" style={{ gridColumn: '1/-1', padding: '1rem' }}>
                <div className="codex__empty-sub">
                  No portals yet — hit <strong>Open Sonus</strong> to add one.
                </div>
              </div>
            )}
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
          <kbd>Space</kbd> pause/resume all ·
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
        onUpdateTrack={(trackId, fields) => { if (trackPanel) updateTrack(trackPanel.moodId, trackId, fields); }}
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

      {/* SONUS PANEL */}
      <SonusPanel
        open={sonusPanel}
        portals={library.sonus || []}
        chStates={chStates}
        channels={channels}
        selectedCh={selectedCh}
        channelById={channelById}
        onClose={() => setSonusPanel(false)}
        onCast={(portalId, chId) => { castSonusOnChannel(portalId, chId); setSonusPanel(false); }}
        onAdd={() => { setSonusPanel(false); setSonusEditor({ portal: null }); }}
        onEdit={(portal) => { setSonusPanel(false); setSonusEditor({ portal }); }}
      />

      {/* SONUS EDITOR */}
      <SonusEditorOverlay
        open={!!sonusEditor}
        portal={sonusEditor?.portal}
        onSave={data => {
          if (sonusEditor?.portal) updateSonus(sonusEditor.portal.id, data);
          else addSonus(data);
          setSonusEditor(null);
          setSonusPanel(true);
        }}
        onDelete={() => { if (sonusEditor?.portal) deleteSonus(sonusEditor.portal.id); setSonusEditor(null); }}
        onClose={() => { setSonusEditor(null); setSonusPanel(true); }}
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
      {/* GLOBAL PAUSE — mobile floating button */}
      <GlobalPauseButton anyPlaying={anyPlaying} onToggle={toggleGlobalPause}/>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app-root')).render(<App/>);
