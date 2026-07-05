// ============================================================
// bardic-audio.js — The Bardic Console audio engine
// ============================================================
// 4 channels, each owning A/B voices for seamless crossfade.
// Tracks are { kind:'url', url, title, artist } objects.
// Procedural tracks removed — library comes from tracks.json.
//
// Playback modes (per channel):
//   loop     — current track loops forever (default)
//   sequence — plays through playlist in order, auto-advances
//   shuffle  — random next track from playlist on end
//   single   — plays once and stops
//
// Channel exposes onTrackEnd(fn) so the app can drive
// auto-advance for sequence/shuffle modes.
// ============================================================

(function () {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0.8;

  // Master compressor so layered channels don't clip
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value      = 20;
  comp.ratio.value     = 4;
  comp.attack.value    = 0.01;
  comp.release.value   = 0.2;

  master.connect(comp);
  comp.connect(ctx.destination);

  // Analyser for visualizer
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.85;
  comp.connect(analyser);
  const _vizData = new Uint8Array(analyser.frequencyBinCount);

  // Resume AudioContext on first interaction (browser policy)
  function resume() {
    if (ctx.state === 'suspended') ctx.resume();
    window.removeEventListener('touchstart', resume);
    window.removeEventListener('keydown', resume);
  }
  window.addEventListener('touchstart', resume);
  window.addEventListener('keydown', resume);

  // ── iOS audio session unlock ─────────────────────────────────
  // iOS starts <audio> in the "ambient" session category, which
  // respects the hardware silent switch and pauses on screen lock.
  // Playing any <audio> element from a direct user gesture upgrades
  // the session to "media" category, bypassing the silent switch.
  // This silent MP3 (base64, ~70 bytes decoded) does exactly that.
  // One-shot: fires on first pointerdown anywhere, then removes itself.
  const _silentMp3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAAnHvBMgAAAAAAAAAAAAAAAAAAAAA//tQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

  function _iosAudioUnlock() {
    const sil = new Audio(_silentMp3);
    sil.volume = 0.001;
    sil.play().catch(() => {});
    window.removeEventListener('touchstart', _iosAudioUnlock, true);
  }
  window.addEventListener('touchstart', _iosAudioUnlock, true);

  // ============================================================
  // URL TRACK (HTML5 Audio → Web Audio)
  // ============================================================
  // URLs routed through our audio-proxy function carry CORS headers,
  // allowing createMediaElementSource → real Web Audio GainNode.
  // This is the only volume-control path that works on iOS Safari,
  // which ignores audio.volume set via JavaScript.
  //
  // For non-proxied URLs that already send CORS (e.g. Cloudinary),
  // crossOrigin='anonymous' + createMediaElementSource also works.
  //
  // If CORS is unavailable (createMediaElementSource throws), we fall
  // back to the fakeGain shim — volume still works on desktop where
  // audio.volume IS respected; iOS will get system volume only.
  // ============================================================
  // isProxied: true only when the URL is routed through our Netlify CORS proxy.
  // Only then is it safe to set crossOrigin and use createMediaElementSource.
  // Setting crossOrigin on a non-CORS URL causes iOS Safari to block the
  // element entirely — not just Web Audio, but playback too.
  function makeUrlTrack(url, loop, onEnd, chId, isProxied) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop    = !!loop;
    audio.volume  = 0;
    if (isProxied) audio.crossOrigin = 'anonymous';
    audio.src     = url;
    if (chId) audio.dataset.ch = chId;

    // iOS Safari discards or refuses to play Audio objects that aren't
    // attached to the DOM. Appending hidden keeps them alive and playable.
    audio.style.display = 'none';
    document.body.appendChild(audio);

    if (onEnd) audio.addEventListener('ended', onEnd, { once: false });

    // ── Real Web Audio GainNode (proxied URLs only) ──────────────
    // createMediaElementSource requires crossOrigin='anonymous' AND a
    // CORS response. Both are guaranteed only when isProxied is true.
    // On iOS this is the only working per-channel volume control path.
    let realGain = null;
    if (isProxied) {
      try {
        const source = ctx.createMediaElementSource(audio);
        realGain = ctx.createGain();
        realGain.gain.value = 0;
        source.connect(realGain);
      } catch (e) {
        realGain = null;
      }
    }

    // ── fakeGain shim (non-proxied URLs, desktop fallback) ───────
    // Controls audio.volume directly. Works on desktop; iOS ignores it.
    let _rampTimer = null;
    let _retryIds = [];
    const fakeGain = {
      gain: {
        value: 0,
        cancelScheduledValues() {
          if (_rampTimer) { clearInterval(_rampTimer); _rampTimer = null; }
        },
        setValueAtTime(v) {
          if (_rampTimer) { clearInterval(_rampTimer); _rampTimer = null; }
          const clamped = Math.max(0, Math.min(1, v));
          audio.volume = clamped;
          this.value = clamped;
        },
        linearRampToValueAtTime(v) {
          if (_rampTimer) { clearInterval(_rampTimer); _rampTimer = null; }
          const target = Math.max(0, Math.min(1, v));
          this.value = target;
          const start = audio.volume;
          const diff  = target - start;
          const steps = 20;
          let step = 0;
          _rampTimer = setInterval(() => {
            step++;
            audio.volume = Math.max(0, Math.min(1, start + diff * (step / steps)));
            if (step >= steps) { clearInterval(_rampTimer); _rampTimer = null; }
          }, 50);
        },
      },
      setImmediate(v) {
        if (_rampTimer) { clearInterval(_rampTimer); _rampTimer = null; }
        const clamped = Math.max(0, Math.min(1, v));
        audio.volume = clamped;
        this.gain.value = clamped;
      },
      connect() {},
      disconnect() {},
    };

    const activeGain = realGain || fakeGain;

    return {
      gain:  activeGain,
      audio,
      start: () => {
        // play() is called directly by playTrack() synchronously within the
        // user gesture stack. This start() call handles the crossfade timing
        // only — play() retries here catch cases where the session wasn't
        // ready yet (iOS mainly). Retries are cancellable: a deliberate
        // pauseTrack() must win against this watchdog (July 5 — the retry
        // was resurrecting paused audio within its 600ms window).
        const attempt = () => audio.play().catch(() => {});
        _retryIds = [100, 300, 600].map(ms => setTimeout(() => {
          if (audio.paused && audio.src) attempt();
        }, ms));
      },
      cancelRetries: () => { _retryIds.forEach(clearTimeout); _retryIds = []; },
      stop:  (when = 0) => {
        _retryIds.forEach(clearTimeout); _retryIds = [];
        setTimeout(() => {
          try {
            audio.pause();
            audio.src = '';
            if (audio.parentNode) audio.parentNode.removeChild(audio);
          } catch (e) {}
        }, (when + 0.4) * 1000);
      },
    };
  }

  // ============================================================
  // CHANNEL — owns A/B voices, crossfades between them
  // ============================================================
  function makeChannel(id, getMasterVol) {
    getMasterVol = getMasterVol || (() => 1);
    const out = ctx.createGain();
    out.gain.value = 0; // set correctly by first eng.setVolume() call from app
    out.connect(master);

    let current     = null;
    let pendingFade = null;
    let _volume     = 0.7;
    let _muted      = false;
    let _track      = null;      // current track object { title, url, artist }
    let _onTrackEnd = null;      // callback → app drives sequence/shuffle

    // ── Internal: build a voice and crossfade to it ──────────
    function _crossfadeTo(voice, fadeSec) {
      voice.gain.connect(out);

      if (current) {
        const prev = current;
        const t = ctx.currentTime;
        prev.gain.gain.cancelScheduledValues(t);
        prev.gain.gain.setValueAtTime(prev.gain.gain.value, t);
        prev.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.05, fadeSec));
        clearTimeout(pendingFade);
        pendingFade = setTimeout(() => prev.stop(), fadeSec * 1000 + 60);

        setTimeout(() => {
          const now = ctx.currentTime;
          const ramp = Math.max(0.05, Math.min(fadeSec, 1.5));
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setValueAtTime(0, now);
          voice.gain.gain.linearRampToValueAtTime(1, now + ramp);
          setVolume(_volume);
        }, fadeSec * 1000);
      } else {
        voice.start();
        const t = ctx.currentTime;
        const ramp = Math.max(0.05, Math.min(fadeSec, 1.5));
        voice.gain.gain.cancelScheduledValues(t);
        voice.gain.gain.setValueAtTime(0, t);
        voice.gain.gain.linearRampToValueAtTime(1, t + ramp);
        setVolume(_volume);
      }

      current = voice;
    }

    // ── Public: play a track object ──────────────────────────
    // mode: 'loop' | 'sequence' | 'shuffle' | 'single'
    function playTrack(track, fadeSec = 2, mode = 'loop') {
      if (!track?.url) return;

      const proxiedUrl = _proxyUrl(track.url);
      const isProxied  = proxiedUrl !== track.url
        || track.url.includes('res.cloudinary.com');

      const loops = mode === 'loop';
      const onEnd = (mode !== 'loop' && _onTrackEnd)
        ? () => _onTrackEnd(id, track, mode)
        : null;

      const voice = makeUrlTrack(proxiedUrl, loops, onEnd, id, isProxied);
      _track = track;
      _paused = false;   // a fresh voice is playing — never inherit a stale latch

      // audio.play() MUST be called synchronously within the user gesture call
      // stack — browsers block it if called after an async gap (e.g. inside
      // ctx.resume().then(...)). So we call play() immediately here, then
      // separately await ctx.resume() before scheduling GainNode ramps.
      // Set volume before play so it's audible immediately (not silent during
      // the async ctx.resume() gap).
      voice.audio.volume = Math.max(0, Math.min(1, _volume * getMasterVol()));
      voice.audio.play().catch(() => {});

      if (ctx.state === 'suspended') {
        ctx.resume()
          .then(() => _crossfadeTo(voice, fadeSec))
          .catch(() => _crossfadeTo(voice, fadeSec));
      } else {
        _crossfadeTo(voice, fadeSec);
      }
    }

    function stopTrack(fadeSec = 2) {
      if (!current) return;
      const t = ctx.currentTime;
      current.gain.gain.cancelScheduledValues(t);
      current.gain.gain.linearRampToValueAtTime(0, t + fadeSec);
      const c = current;
      setTimeout(() => c.stop(), fadeSec * 1000 + 60);
      current = null;
      _track  = null;
      _paused = false;
    }

    let _paused = false;

    function pauseTrack() {
      if (!current) return;
      if (current.cancelRetries) current.cancelRetries();   // the watchdog must not resurrect us
      const a = _currentAudio();
      if (a && !a.paused) a.pause();
      _paused = true;
    }

    function resumeTrack() {
      if (!current) return;
      const a = _currentAudio();
      if (a && a.paused && a.src) a.play().catch(() => {});
      _paused = false;
    }

    // Get the active audio element if current voice is a URL track
    function _currentAudio() {
      return (current && current.audio) ? current.audio : null;
    }

    function setVolume(v) {
      _volume = v;
      if (!_muted) {
        const effective = v * getMasterVol();
        // Set directly first (safe regardless of AudioContext clock state),
        // then schedule a short ramp for smooth fader movement during playback.
        out.gain.value = effective;
        out.gain.linearRampToValueAtTime(effective, ctx.currentTime + 0.05);
        const a = _currentAudio();
        if (a) a.volume = Math.max(0, Math.min(1, effective));
      }
    }

    function setMuted(m) {
      _muted = m;
      const effective = m ? 0 : _volume * getMasterVol();
      out.gain.value = effective;
      out.gain.linearRampToValueAtTime(effective, ctx.currentTime + 0.05);
      const a = _currentAudio();
      if (a) a.volume = Math.max(0, Math.min(1, effective));
    }

    // Register the app-level callback for track-end events
    function onTrackEnd(fn) { _onTrackEnd = fn; }

    return {
      id,
      out,
      playTrack,
      stopTrack,
      pauseTrack,
      resumeTrack,
      setVolume,
      setMuted,
      onTrackEnd,
      _currentAudio,
      get track()    { return _track; },
      get volume()   { return _volume; },
      get muted()    { return _muted; },
      get paused()   { return _paused; },
      get isPlaying(){ return !!current && !_paused; },
    };
  }

  // ============================================================
  // SFX one-shots — unchanged from prototype
  // ============================================================
  function makeNoise(type, duration) {
    const sr     = ctx.sampleRate;
    const length = Math.floor(sr * duration);
    const buf    = ctx.createBuffer(2, length, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,lastBrown=0;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') {
          data[i] = w;
        } else if (type === 'pink') {
          b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
          b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
          b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5  - w*0.0168980;
          data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
          b6 = w * 0.115926;
        } else {
          lastBrown = (lastBrown + (0.02*w)) / 1.02;
          data[i]  = lastBrown * 3.5;
        }
      }
    }
    return buf;
  }
  const _noiseCache = {};
  function getNoise(type) {
    if (!_noiseCache[type]) _noiseCache[type] = makeNoise(type, 8);
    return _noiseCache[type];
  }

  function playSfx(kind) {
    const t   = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(master);

    if (kind === 'door') {
      const n=ctx.createBufferSource(); n.buffer=getNoise('brown');
      const f=ctx.createBiquadFilter(); f.type='lowpass';
      f.frequency.setValueAtTime(800,t); f.frequency.exponentialRampToValueAtTime(80,t+0.4);
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(1,t+0.01); g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
      n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t+0.7);
    } else if (kind === 'sword') {
      const n=ctx.createBufferSource(); n.buffer=getNoise('white');
      const f=ctx.createBiquadFilter(); f.type='bandpass'; f.Q.value=12;
      f.frequency.setValueAtTime(4000,t); f.frequency.exponentialRampToValueAtTime(1200,t+0.25);
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.8,t+0.01); g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
      n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t+0.4);
    } else if (kind === 'roar') {
      const o=ctx.createOscillator(); o.type='sawtooth';
      o.frequency.setValueAtTime(70,t); o.frequency.linearRampToValueAtTime(45,t+0.9);
      const n=ctx.createBufferSource(); n.buffer=getNoise('brown');
      const f=ctx.createBiquadFilter(); f.type='lowpass';
      f.frequency.setValueAtTime(600,t); f.frequency.linearRampToValueAtTime(1200,t+0.4); f.frequency.linearRampToValueAtTime(400,t+1.0);
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(1,t+0.1); g.gain.setValueAtTime(1,t+0.6); g.gain.exponentialRampToValueAtTime(0.001,t+1.2);
      o.connect(f); n.connect(f); f.connect(g); g.connect(out);
      o.start(t); o.stop(t+1.2); n.start(t); n.stop(t+1.2);
    } else if (kind === 'bell') {
      [880,1320,1760,2640].forEach((hz,i) => {
        const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=hz;
        const g=ctx.createGain();
        g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.3/(i+1),t+0.005); g.gain.exponentialRampToValueAtTime(0.001,t+2+i*0.3);
        o.connect(g); g.connect(out); o.start(t); o.stop(t+2.5+i*0.3);
      });
    } else if (kind === 'thunder') {
      const n=ctx.createBufferSource(); n.buffer=getNoise('brown');
      const f=ctx.createBiquadFilter(); f.type='lowpass';
      f.frequency.setValueAtTime(200,t); f.frequency.linearRampToValueAtTime(80,t+1.5);
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(1.5,t+0.05); g.gain.linearRampToValueAtTime(0.8,t+0.6); g.gain.exponentialRampToValueAtTime(0.001,t+2.0);
      n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t+2.1);
    } else if (kind === 'coin') {
      [2400,3200,2800,3600].forEach((hz,i) => {
        const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=hz;
        const g=ctx.createGain(); const s=t+i*0.04;
        g.gain.setValueAtTime(0.001,s); g.gain.exponentialRampToValueAtTime(0.4,s+0.005); g.gain.exponentialRampToValueAtTime(0.001,s+0.15);
        o.connect(g); g.connect(out); o.start(s); o.stop(s+0.18);
      });
    } else if (kind === 'horn') {
      const o=ctx.createOscillator(); o.type='sawtooth';
      o.frequency.setValueAtTime(160,t); o.frequency.linearRampToValueAtTime(200,t+0.1);
      const o2=ctx.createOscillator(); o2.type='sawtooth'; o2.frequency.value=300;
      const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1500;
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.5,t+0.04); g.gain.setValueAtTime(0.5,t+1.0); g.gain.exponentialRampToValueAtTime(0.001,t+1.5);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(out);
      o.start(t); o.stop(t+1.5); o2.start(t); o2.stop(t+1.5);
    } else if (kind === 'chime') {
      [1320,1980,2640,3960].forEach((hz,i) => {
        const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=hz;
        const s=t+i*0.08; const g=ctx.createGain();
        g.gain.setValueAtTime(0.001,s); g.gain.exponentialRampToValueAtTime(0.25,s+0.01); g.gain.exponentialRampToValueAtTime(0.001,s+1.5);
        o.connect(g); g.connect(out); o.start(s); o.stop(s+1.6);
      });
    } else if (kind === 'crackle') {
      for (let i=0;i<8;i++) {
        const s=t+Math.random()*0.6;
        const n=ctx.createBufferSource(); n.buffer=getNoise('white');
        const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=2000;
        const g=ctx.createGain();
        g.gain.setValueAtTime(0.001,s); g.gain.exponentialRampToValueAtTime(0.3,s+0.005); g.gain.exponentialRampToValueAtTime(0.001,s+0.06);
        n.connect(f); f.connect(g); g.connect(out); n.start(s); n.stop(s+0.08);
      }
    }
    setTimeout(() => { try { out.disconnect(); } catch(e){} }, 4000);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  let _masterVol = 0.8;
  const _allChannels = [];

  // Proxy helper — exposed so bardic-app.jsx can rewrite URLs for
  // the ProgressBar's audio element lookup (which searches by data-ch).
  function _proxyUrl(url) {
    if (!url) return url;
    if (url.includes('dropbox.com') || url.includes('dropboxusercontent.com')) {
      return `/.netlify/functions/audio-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  window.BardicAudio = {
    ctx,
    master,
    _proxyUrl,
    setMasterVolume: (v) => {
      _masterVol = v;
      master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.05);
      // Push new master volume to all URL track audio elements
      _allChannels.forEach(ch => { if (!ch.muted) ch.setVolume(ch.volume); });
    },
    makeChannel: (id) => {
      const ch = makeChannel(id, () => _masterVol);
      _allChannels.push(ch);
      return ch;
    },
    playSfx,
    analyser,
    getVizData() { analyser.getByteFrequencyData(_vizData); return _vizData; },

    // iOS requires audio.play() to be called synchronously within a native
    // user gesture event stack. React's synthetic events dispatch too late.
    // Call this at the top of a native touchend handler (before React's
    // onClick fires) to ensure play() runs inside the gesture window.
    resumeAll() {
      const doPlay = () => {
        _allChannels.forEach(ch => {
          const a = ch._currentAudio();
          if (a && a.src && a.paused) a.play().catch(() => {});
        });
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(doPlay).catch(() => {});
      } else {
        doPlay();
      }
    },
  };
})();
