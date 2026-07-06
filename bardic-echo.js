/* bardic-echo.js — ECHO LOCK: mic-based auto-trim for the Bardic radio.
 *
 * THE CONTRACT (BardicEcho.measure):
 *   One ~3.2s mic capture answers two questions in the same timebase:
 *     1. ROOM  — correlate the capture against the playing track's PCM at
 *        the shared-clock position → how late the room SOUNDS vs true time.
 *     2. SELF  — this device chirps a known burst pattern during the
 *        capture → how late this device's output chain is.
 *   trim = self − room. Both peaks live in the SAME capture, so the
 *   capture-start mapping error (chunk-arrival jitter) cancels in the
 *   subtraction — that cancellation is the design; do not "improve" one
 *   half's timebase without the other.
 *
 *   Feasibility proven July 6 on M's iPhone: 73/74/73ms, peak 0.99,
 *   conf ×2.3–2.5 — iOS honored echoCancellation:false.
 *
 * Local channels are DUCKED during capture (the local mix would correlate
 * against the same track and forge a second room peak). The chirp overlaps
 * the room's music by design — each is structured noise to the other's
 * correlation; the confidence gates arbitrate. If field confidence runs
 * weak on busy tracks, the refinement is masked correlation (exclude the
 * chirp span from the room pass), not louder chirps.
 *
 * Pure DSP (makeChirp/envelope/xcorr/trimFrom) is exported and the smoke
 * harness extracts it FROM THIS FILE — test the shipped code (the `label`
 * scar). Every wave bumps BUILD.
 */
(function () {
  'use strict';

  // Burst pattern: gaps all DISTINCT (170,120,230,140,240,130,260) — a
  // periodic pattern autocorrelates into a picket fence of equal peaks;
  // irregular spacing buys one unambiguous maximum.
  var BURSTS_MS = [0, 170, 290, 520, 660, 900, 1030, 1290];
  var CHIRP_S = 1.45;      // pattern length
  var CAP_S = 4.0;         // capture length (E3: was 3.2 — the room pass
                           // deserves ~2.5s of chirp-free material)
  var PAD_S = 1.5;         // room search half-window (±1.2s usable)
  var CHIRP_AT_S = 0.35;   // chirp schedule offset after capture start

  function makeChirp(sr) {
    var n = Math.round(CHIRP_S * sr), buf = new Float32Array(n);
    for (var b = 0; b < BURSTS_MS.length; b++) {
      var start = Math.round(BURSTS_MS[b] / 1000 * sr);
      var len = Math.round(0.03 * sr);
      for (var i = 0; i < len && start + i < n; i++) {
        var t = i / sr;
        var env = Math.exp(-t * 90);
        buf[start + i] += env * (Math.sin(2 * Math.PI * 1500 * t) * 0.6 +
                                 Math.sin(2 * Math.PI * 2600 * t) * 0.4);
      }
    }
    return buf;
  }

  // Onset envelope at ~1kHz frame rate (1 frame ≈ 1ms): rectify →
  // one-pole smooth (~4ms) → decimate.
  function envelope(x, sr) {
    var hop = Math.max(1, Math.round(sr / 1000));
    var out = new Float32Array(Math.floor(x.length / hop));
    var acc = 0, a = 1 - Math.exp(-1 / (0.004 * sr));
    for (var i = 0, j = 0; i < x.length; i++) {
      var v = x[i] < 0 ? -x[i] : x[i];
      acc += a * (v - acc);
      if (i % hop === 0 && j < out.length) out[j++] = acc;
    }
    return out;
  }

  // Normalized cross-correlation of envelopes over lag ∈ [loLag, hiLag).
  // Optional mask {lo, hi}: REF-side frame indices excluded from every
  // sum — E3's chirp exclusion (July 6 field: the phone's own chirp at
  // zero distance buried the room's music, peak 0.26 conf ×1.1; masking
  // the known chirp span restores the room pass).
  // confidence = peak vs best rival OUTSIDE ±25 frames of the peak.
  function xcorr(ref, rec, loLag, hiLag, mask) {
    var mLo = mask ? mask.lo : -1, mHi = mask ? mask.hi : -1;
    var mr = 0, nm = 0, i;
    for (i = 0; i < ref.length; i++) {
      if (i >= mLo && i < mHi) continue;
      mr += ref[i]; nm++;
    }
    mr /= (nm || 1);
    var er = 0;
    for (i = 0; i < ref.length; i++) {
      if (i >= mLo && i < mHi) continue;
      var d = ref[i] - mr; er += d * d;
    }
    var lo = Math.max(0, loLag | 0), hi = Math.max(lo + 1, hiLag | 0);
    var curve = new Float32Array(hi - lo), best = -1, bestLag = lo;
    for (var lag = lo; lag < hi; lag++) {
      var ms = 0, n = 0;
      for (i = 0; i < ref.length && lag + i < rec.length; i++) {
        if (i >= mLo && i < mHi) continue;
        ms += rec[lag + i]; n++;
      }
      if (n < nm * 0.8) break;
      ms /= n;
      var num = 0, es = 0;
      for (i = 0; i < ref.length && lag + i < rec.length; i++) {
        if (i >= mLo && i < mHi) continue;
        var dr = ref[i] - mr, ds = rec[lag + i] - ms;
        num += dr * ds; es += ds * ds;
      }
      var c = (er > 0 && es > 0) ? num / Math.sqrt(er * es) : 0;
      curve[lag - lo] = c;
      if (c > best) { best = c; bestLag = lag; }
    }
    var rival = 0;
    for (i = 0; i < curve.length; i++) {
      if (Math.abs(i + lo - bestLag) > 25 && curve[i] > rival) rival = curve[i];
    }
    return { lag: bestLag, peak: best, rival: rival,
             confidence: rival > 0 ? best / rival : (best > 0 ? 99 : 0), curve: curve };
  }

  // PURE trim arithmetic — the sign truth lives here and in its smoke.
  //   chirpLagMs   : capture-frame where the chirp was HEARD
  //   chirpSchedMs : capture-frame where the chirp was SCHEDULED
  //   roomLagMs    : xcorr(ref=captureEnv, rec=segmentEnv) winning lag,
  //                  where the segment starts PAD_S BEFORE the expected
  //                  track position at capture start
  //   → selfMs = heard − scheduled  (device output chain lateness)
  //   → roomMs = PAD − roomLag      (room lateness vs shared clock;
  //     room LATE by E ⇒ capture holds EARLIER content ⇒ alignment lag
  //     shrinks below PAD)
  //   → trimMs = self − room, clamped ±500 (positive trim plays earlier)
  function trimFrom(m) {
    var selfMs = m.chirpLagMs - m.chirpSchedMs;
    var roomMs = Math.round(PAD_S * 1000) - m.roomLagMs;
    var trimMs = Math.max(-500, Math.min(500, Math.round(selfMs - roomMs)));
    return { selfMs: Math.round(selfMs), roomMs: Math.round(roomMs), trimMs: trimMs };
  }

  // ── orchestration ────────────────────────────────────────────────────
  var ac = null, micStream = null;

  function getCtx() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    return ac.resume().then(function () { return ac; }).catch(function () { return ac; });
  }

  function getMic(onStage) {
    if (micStream && micStream.active) return Promise.resolve(micStream);
    return navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: false, noiseSuppression: false, autoGainControl: false
    } }).then(function (s) {
      micStream = s;
      try {
        var st = s.getAudioTracks()[0].getSettings();
        onStage('mic granted \u00b7 echoCancellation: ' + String(st.echoCancellation));
      } catch (e) {}
      return s;
    });
  }

  function decode(ctx, buf) {
    return new Promise(function (res, rej) { ctx.decodeAudioData(buf, res, rej); });
  }

  function monoSlice(audioBuf, fromS, toS) {
    var sr = audioBuf.sampleRate;
    var a = Math.max(0, Math.round(fromS * sr));
    var b = Math.min(audioBuf.length, Math.round(toS * sr));
    var out = new Float32Array(Math.max(0, b - a));
    for (var ch = 0; ch < audioBuf.numberOfChannels; ch++) {
      var d = audioBuf.getChannelData(ch);
      for (var i = 0; i < out.length; i++) out[i] += d[a + i] / audioBuf.numberOfChannels;
    }
    return out;
  }

  function capture(ctx, stream, onChirpScheduled) {
    return new Promise(function (resolve, reject) {
      var sr = ctx.sampleRate;
      var src = ctx.createMediaStreamSource(stream);
      var proc = ctx.createScriptProcessor(4096, 1, 1);
      var chunks = [], captured = 0, capTarget = Math.round(CAP_S * sr);
      var started = false, cap0 = null;
      var guard = setTimeout(function () {
        try { proc.disconnect(); src.disconnect(); } catch (e) {}
        reject(new Error('capture timeout \u2014 no mic frames arrived'));
      }, 9000);
      proc.onaudioprocess = function (e) {
        var d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d));
        captured += d.length;
        if (!started) {
          started = true;
          // rough capture-start marks — their shared error cancels in
          // trimFrom's subtraction (see header); do not chase precision here
          cap0 = { ac: ctx.currentTime, clockMs: onChirpScheduled.clockNow() };
          var when = ctx.currentTime + CHIRP_AT_S;
          var node = ctx.createBufferSource();
          var chirp = makeChirp(sr);
          var cb = ctx.createBuffer(1, chirp.length, sr);
          cb.getChannelData(0).set(chirp);
          node.buffer = cb;
          var g = ctx.createGain(); g.gain.value = 0.5;
          node.connect(g); g.connect(ctx.destination);
          node.start(when);
          cap0.chirpSchedMs = (when - cap0.ac) * 1000;
        }
        if (captured >= capTarget) {
          clearTimeout(guard);
          try { proc.disconnect(); src.disconnect(); } catch (e2) {}
          var rec = new Float32Array(captured), off = 0;
          for (var i = 0; i < chunks.length; i++) { rec.set(chunks[i], off); off += chunks[i].length; }
          resolve({ rec: rec, sr: sr, cap0: cap0 });
        }
      };
      src.connect(proc);
      proc.connect(ctx.destination);   // keep the graph alive; proc emits silence
    });
  }

  // measure({channels, positionAt, clockNow, duck, onStage}) →
  //   resolves {ok:true, trimMs, selfMs, roomMs, selfConf, roomConf,
  //             channelTitle, echoCancellation}
  //   or       {ok:false, reason, detail}
  //   rejects only on hard errors (mic denied, capture dead) — with
  //   NARRATED raw error text; no silent catches in this path.
  function measure(opts) {
    var stageEC = '';
    var onStage = function (t) { stageEC = t; if (opts.onStage) opts.onStage(t); };
    if (!opts.channels || !opts.channels.length) {
      return Promise.resolve({ ok: false, reason: 'idle',
        detail: 'nothing playing \u2014 tune in and light a channel first' });
    }
    var ctxRef = null;
    return getCtx().then(function (ctx) {
      ctxRef = ctx;
      return getMic(onStage);
    }).then(function (stream) {
      opts.duck(true);
      onStage('listening to the room\u2026');
      return capture(ctxRef, stream, { clockNow: opts.clockNow });
    }).then(function (cap) {
      opts.duck(false);
      onStage('correlating\u2026');
      var capEnv = envelope(cap.rec, cap.sr);

      // SELF: find the chirp
      var chirpEnv = envelope(makeChirp(cap.sr), cap.sr);
      var sched = Math.round(cap.cap0.chirpSchedMs);
      var cSelf = xcorr(chirpEnv, capEnv, Math.max(0, sched - 200), sched + 900);
      if (cSelf.peak < 0.25 || cSelf.confidence < 1.6) {
        return { ok: false, reason: 'chirp',
          detail: 'own chirp not heard (peak ' + cSelf.peak.toFixed(2) + ', conf \u00d7' +
                  cSelf.confidence.toFixed(1) + ') \u2014 volume down, or mic blocked/covered' };
      }

      // ROOM: try each playing channel until one correlates cleanly.
      // The capture REF is MASKED over the chirp span the self pass just
      // located (±ringing margin) — the phone's own chirp at zero
      // distance otherwise buries the room across the air (E3).
      var chirpMask = { lo: Math.max(0, cSelf.lag - 40),
                        hi: cSelf.lag + Math.round(CHIRP_S * 1000) + 80 };
      // Failures are CATEGORIZED — a blocked PCM fetch (CORS) must never
      // masquerade as "your music isn't rhythmic enough" (July 6 field:
      // big drums at point-blank read as a smoothness failure).
      var tries = [];
      var chain = Promise.resolve(null);
      opts.channels.forEach(function (chn) {
        chain = chain.then(function (found) {
          if (found) return found;
          return fetch(chn.url).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.arrayBuffer();
          }).then(function (ab) {
            return decode(ctxRef, ab);
          }).then(function (audioBuf) {
            var p0 = opts.positionAt(chn.anchor, cap.cap0.clockMs);   // seconds
            if (p0 < PAD_S || p0 + CAP_S + PAD_S > audioBuf.duration) {
              tries.push({ kind: 'edge', msg: chn.title + ': too close to track edge' });
              return null;
            }
            var seg = monoSlice(audioBuf, p0 - PAD_S, p0 + CAP_S + PAD_S);
            var segEnv = envelope(seg, audioBuf.sampleRate);
            var lo = Math.round((PAD_S - 1.2) * 1000), hi = Math.round((PAD_S + 1.2) * 1000);
            var cRoom = xcorr(capEnv, segEnv, lo, hi, chirpMask);
            if (cRoom.peak < 0.2 || cRoom.confidence < 1.5) {
              tries.push({ kind: 'weak', msg: chn.title + ': peak ' + cRoom.peak.toFixed(2) +
                           ', conf \u00d7' + cRoom.confidence.toFixed(1) });
              return null;
            }
            return { chn: chn, cRoom: cRoom };
          }).catch(function (e) {
            // CORS / decode failures NARRATE — this is the known unknown
            tries.push({ kind: 'fetch', msg: chn.title + ': ' + (e && e.message ? e.message : e) });
            return null;
          });
        });
      });
      return chain.then(function (found) {
        if (!found) {
          var s = summarize(tries);
          return { ok: false, reason: s.reason, detail: s.detail };
        }
        var t = trimFrom({ chirpLagMs: cSelf.lag, chirpSchedMs: cap.cap0.chirpSchedMs,
                           roomLagMs: found.cRoom.lag });
        return { ok: true, trimMs: t.trimMs, selfMs: t.selfMs, roomMs: t.roomMs,
                 selfConf: cSelf.confidence, roomConf: found.cRoom.confidence,
                 channelTitle: found.chn.title || found.chn.chId,
                 echoCancellation: stageEC };
      });
    }).catch(function (e) {
      opts.duck(false);
      throw e;
    });
  }

  // PURE failure taxonomy over the room tries — exported for the smoke.
  // 'pcm'  : every attempt died fetching/decoding (CORS, network, codec)
  // 'weak' : correlation RAN and peaked low (genuinely smooth material)
  // 'edge' : usable position too near a track boundary
  // Mixed bags report the most actionable kind: pcm > weak > edge.
  function summarize(tries) {
    if (!tries.length) return { reason: 'room', detail: 'no channel correlated' };
    var kinds = {};
    tries.forEach(function (t) { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
    var msgs = tries.map(function (t) { return t.msg; }).join(' \u00b7 ');
    if (kinds.fetch) return { reason: 'pcm', detail: msgs };
    if (kinds.weak) return { reason: 'weak', detail: msgs };
    return { reason: 'edge', detail: msgs };
  }

  window.BardicEcho = {
    BUILD: 'E3',
    BURSTS_MS: BURSTS_MS, PAD_S: PAD_S, CAP_S: CAP_S, CHIRP_AT_S: CHIRP_AT_S,
    makeChirp: makeChirp, envelope: envelope, xcorr: xcorr, trimFrom: trimFrom,
    summarize: summarize,
    measure: measure
  };
})();
