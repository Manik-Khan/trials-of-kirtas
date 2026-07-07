// ============================================================
// bardic-player.js — Web Audio playback engine for the Bardic radio
// (WA1, July 7). Consumes the SAME anchors the console broadcasts
// (pos / at / paused / loop / url / volume) but schedules decoded
// AudioBufferSourceNodes against BardicClock, output-latency
// compensated. No HTMLAudioElement, no seeks, no drift-chase — the
// foundation the two-device proto proved. Tracks decode once and cache.
// ============================================================
(function () {
  'use strict';
  var BUILD = 'WA1';
  var LEAD = 0.12;              // schedule this far ahead of ctx time
  var DRIFT_RESYNC = 0.045;     // only reschedule a playing channel past 45ms

  var ctx = null, master = null;
  var buffers = {};             // url -> { buffer } | { pending: Promise }
  var channels = {};            // chId -> { src, gain, url, paused, startInfo, volume }

  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    }
    return ctx;
  }
  function outLat() { return (ctx && (ctx.outputLatency || ctx.baseLatency)) || 0; }
  function clockNow() { return window.BardicClock ? window.BardicClock.now() : Date.now(); }
  function positionAt(anchor, wallMs) {
    // reuse the shared math so phone + console agree exactly
    if (window.BardicRadio && window.BardicRadio.positionAt) return window.BardicRadio.positionAt(anchor, wallMs);
    return anchor.paused ? anchor.pos : anchor.pos + Math.max(0, (wallMs - anchor.at) / 1000);
  }

  function decode(url) {
    var slot = buffers[url];
    if (slot && slot.buffer) return Promise.resolve(slot.buffer);
    if (slot && slot.pending) return slot.pending;
    var c = getCtx();
    var p = fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (ab) {
        return new Promise(function (res, rej) {
          var d = c.decodeAudioData(ab, res, rej);   // callback form (iOS); promise if returned
          if (d && d.then) d.then(res, rej);
        });
      })
      .then(function (buf) { buffers[url] = { buffer: buf }; return buf; });
    buffers[url] = { pending: p };
    return p;
  }

  function stopSource(ch) {
    if (ch && ch.src) {
      try {
        var t = ctx.currentTime, g = ch.gain;
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.03);   // fade to avoid a click
        ch.src.stop(t + 0.05);
      } catch (e) {}
      ch.src = null; ch.gain = null; ch.startInfo = null;
    }
  }

  // (re)schedule a channel to its anchor, gaplessly
  function schedule(chId, anchor, buf, volume) {
    var c = getCtx();
    var ch = channels[chId] || (channels[chId] = {});
    stopSource(ch);
    ch.url = anchor.url; ch.paused = !!anchor.paused; ch.volume = volume;
    if (anchor.paused) { ch.startInfo = null; return; }

    var when = c.currentTime + LEAD;
    var audibleWall = clockNow() + (LEAD + outLat()) * 1000;
    var raw = positionAt(anchor, audibleWall);
    var dur = buf.duration, loop = !!anchor.loop;
    var offset = loop ? (((raw % dur) + dur) % dur) : raw;
    if (!loop && (offset < 0 || offset >= dur)) { ch.startInfo = null; return; }   // ended / not begun
    if (offset < 0) offset = 0;

    var src = c.createBufferSource();
    src.buffer = buf;
    if (loop) { src.loop = true; src.loopStart = 0; src.loopEnd = dur; }
    var g = c.createGain(); g.gain.value = 0; g.connect(master); src.connect(g);
    src.start(when, offset);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(volume, when + 0.03);
    ch.src = src; ch.gain = g;
    ch.startInfo = { when: when, offset: offset, dur: dur, loop: loop };
  }

  function projectedPos(ch) {
    if (!ch.startInfo) return null;
    var si = ch.startInfo, p = si.offset + (ctx.currentTime - si.when);
    return si.loop ? (((p % si.dur) + si.dur) % si.dur) : p;
  }

  // reconcile every channel to a fresh anchor payload
  function applyAnchors(payload, masterVol, trimMs) {
    if (!payload || !payload.channels) return;
    getCtx();
    var mv = (masterVol == null ? 1 : masterVol);
    var tr = (trimMs || 0) / 1000;
    var seen = {};

    Object.keys(payload.channels).forEach(function (chId) {
      seen[chId] = true;
      var a = payload.channels[chId];
      if (!a || !a.url) return;
      var anchor = { pos: a.pos + tr, at: payload.at, paused: !!a.paused, loop: !!a.loop, url: a.url };
      var volume = (a.volume != null ? a.volume : 0.5) * mv;

      decode(a.url).then(function (buf) {
        var cur = channels[chId];
        var fresh = !cur || cur.url !== a.url || cur.paused !== !!a.paused || !cur.src;
        if (fresh) { schedule(chId, anchor, buf, volume); return; }
        // same track already playing: ride volume, reschedule only on real drift
        if (cur.gain) cur.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
        cur.volume = volume;
        var want = positionAt(anchor, clockNow() + outLat() * 1000);
        if (anchor.loop) want = (((want % buf.duration) + buf.duration) % buf.duration);
        var have = projectedPos(cur);
        if (have != null) {
          var d = Math.abs(have - want);
          if (anchor.loop) d = Math.min(d, buf.duration - d);
          if (d > DRIFT_RESYNC) schedule(chId, anchor, buf, volume);
        }
      }).catch(function () { /* fetch/decode failed — channel stays silent */ });
    });

    Object.keys(channels).forEach(function (chId) {
      if (!seen[chId]) { stopSource(channels[chId]); delete channels[chId]; }
    });
  }

  function resume() { return getCtx().resume(); }
  function stopAll() { Object.keys(channels).forEach(function (id) { stopSource(channels[id]); }); channels = {}; }
  function status() {
    var out = {};
    Object.keys(channels).forEach(function (id) {
      var ch = channels[id];
      out[id] = { url: ch.url, paused: ch.paused, playing: !!ch.src, pos: projectedPos(ch) };
    });
    return { build: BUILD, outLatMs: Math.round(outLat() * 1000), sampleRate: ctx ? ctx.sampleRate : null, channels: out };
  }

  window.BardicPlayer = {
    BUILD: BUILD, resume: resume, applyAnchors: applyAnchors, stopAll: stopAll,
    status: status, outLat: outLat, ctx: function () { return ctx; },
  };
})();
