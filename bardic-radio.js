// ============================================================
// bardic-radio.js — Bardic broadcast: shared clock + Realtime
// The Trials of Kirtas (wave B, July 5)
// ============================================================
//
// Loaded by bardic-console.html (the engine relays) and radio.html
// (listeners consume). The rail never loads this — it only displays
// onAir/listeners from the engine's bus snapshots.
//
// THE SYNC MODEL (approved in the radio design discussion):
//   Nobody reacts to messages in real time — everybody schedules
//   against a SHARED CLOCK (/.netlify/functions/time). The engine
//   broadcasts ANCHORS: "channel X is at position P at shared-time T".
//   Each listener independently computes where the track is *now*,
//   seeks there, and holds lock with imperceptible playbackRate
//   nudges. Control messages are tiny; audio streams per-device
//   from Cloudinary.
//
// TRANSPORT: Supabase Realtime channel 'bardic-radio' (broadcast +
// presence), following the 'combat-characters' / 'rail-feed' naming
// convention. Presence key 'engine' is reserved for the console;
// every other key is a listener { name, syncMs }.
//
// ANCHOR MESSAGE (event 'anchors'):
//   { at: <sharedMs>, channels: { <chId>: {
//       url, title, label, accent,
//       pos: <seconds into the track at `at`>,
//       paused, volume, loop } } }
//   Sonus/YT channels are OMITTED — the IFrame player can't be
//   seeked or rate-nudged precisely enough to hold lock.
//
// Classic script; rides window.BardicClock + window.BardicRadio.
// The math helpers (positionAt / driftNudge / bestOffset) are pure
// so radio.html and the smoke harness run the SAME code.
// ============================================================

(function () {
  'use strict';

  var TIME_URL = '/.netlify/functions/time';
  var RT_CHANNEL = 'bardic-radio';
  // Engines carry UNIQUE presence keys with { engine:true } meta — a fixed
  // shared key let two consoles silently coexist, both 'on air', anchors
  // interleaving from two clocks (July 5, M's two-consoles report).
  var ENGINE_PREFIX = 'engine-';
  function isEngineMeta(metas) { return !!(metas && metas[0] && metas[0].engine); }
  function findEngine(state, exceptKey) {
    for (var key in state) {
      if (key === exceptKey) continue;
      if (isEngineMeta(state[key])) return { key: key, name: state[key][0].name || 'another console' };
    }
    return null;
  }

  // ── pure math (shared by the page and the harness) ──────────────

  // NTP's trick: many samples, trust only the fastest round trip.
  // samples: [{ server, t0, t1 }] → { offset, rtt } of the best sample.
  // offset is what to ADD to Date.now() to get shared time.
  function bestOffset(samples) {
    var best = null;
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var rtt = s.t1 - s.t0;
      if (best === null || rtt < best.rtt) {
        best = { rtt: rtt, offset: s.server + rtt / 2 - s.t1 };
      }
    }
    return best; // null when no samples
  }

  // Where is the track now? anchor { pos, at, paused }, nowShared in ms.
  function positionAt(anchor, nowShared) {
    if (anchor.paused) return anchor.pos;
    return anchor.pos + Math.max(0, (nowShared - anchor.at) / 1000);
  }

  // Drift correction: err = expected - actual (seconds).
  //   |err| <= dead  → rate 1 (locked)
  //   |err| >  hard  → { seek: true } (hard resync)
  //   else           → gentle rate nudge, capped ±2% (imperceptible)
  // hard default 0.35s (July 5 field fix): a ±2% nudge closes ~20ms/s —
  // the old 1.5s threshold let a 1.1s seek-latency error crawl for a
  // minute. Above a third of a second, just jump.
  function driftNudge(errSec, dead, hard) {
    dead = dead == null ? 0.03 : dead;
    hard = hard == null ? 0.35 : hard;
    if (Math.abs(errSec) > hard) return { seek: true, rate: 1 };
    if (Math.abs(errSec) <= dead) return { seek: false, rate: 1 };
    var rate = 1 + Math.max(-0.02, Math.min(0.02, errSec * 0.04));
    return { seek: false, rate: rate };
  }

  // ── the shared clock ─────────────────────────────────────────────
  var clock = {
    offset: 0,
    rtt: null,          // quality: best round trip seen (ms)
    synced: false,
    now: function () { return Date.now() + clock.offset; },
    // n pings, min-RTT filter; resolves { offset, rtt } or rejects.
    sync: function (n) {
      n = n || 6;
      var samples = [];
      function ping() {
        var t0 = Date.now();
        return fetch(TIME_URL, { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (j) { samples.push({ server: j.now, t0: t0, t1: Date.now() }); });
      }
      var chain = Promise.resolve();
      for (var i = 0; i < n; i++) chain = chain.then(ping);
      return chain.then(function () {
        var best = bestOffset(samples);
        if (!best) throw new Error('no clock samples');
        clock.offset = best.offset;
        clock.rtt = best.rtt;
        clock.synced = true;
        return best;
      });
    },
  };

  // ── the Realtime transport ───────────────────────────────────────

  // ENGINE side: relay anchors, watch the listener roster.
  // sb: the authenticated Supabase client (window.__tok.sb).
  // Preflight: if ANOTHER engine already holds the air, this one does not
  // track or anchor — handlers.onConflict(name) fires instead.
  function broadcast(sb, handlers) {
    handlers = handlers || {};
    var myKey = ENGINE_PREFIX + Math.random().toString(36).slice(2, 10);
    var ch = sb.channel(RT_CHANNEL, { config: { presence: { key: myKey }, broadcast: { self: false } } });
    var active = false;
    var pendingAnchors = null;   // last anchors sent pre-SUBSCRIBED — flushed on join
    function roster() {
      var state = ch.presenceState();
      var out = [];
      for (var key in state) {
        var metas = state[key];
        if (!metas || !metas[0] || isEngineMeta(metas)) continue;
        out.push({ key: key, name: metas[0].name || key, syncMs: metas[0].syncMs != null ? metas[0].syncMs : null });
      }
      return out;
    }
    ch.on('presence', { event: 'sync' }, function () {
      if (handlers.onListeners) handlers.onListeners(roster());
    });
    // convergence: any listener can ASK for anchors (join, staleness) —
    // the system never depends on catching a change broadcast (July 5)
    ch.on('broadcast', { event: 'sync-request' }, function () {
      if (active && handlers.onSyncRequest) handlers.onSyncRequest();
    });
    ch.subscribe(function (status) {
      if (status !== 'SUBSCRIBED') return;
      var other = findEngine(ch.presenceState(), myKey);
      if (other) {
        if (handlers.onConflict) handlers.onConflict(other.name);
        return;   // never two engines on air — the incumbent keeps it
      }
      active = true;
      ch.track({ engine: true, name: handlers.name || 'the console' });
      if (pendingAnchors) {   // the immediate pre-join send is never dropped
        ch.send({ type: 'broadcast', event: 'anchors', payload: pendingAnchors });
        pendingAnchors = null;
      }
    });
    return {
      engineKey: myKey,
      isActive: function () { return active; },
      sendAnchors: function (anchors) {
        if (active) ch.send({ type: 'broadcast', event: 'anchors', payload: anchors });
        else pendingAnchors = anchors;
      },
      offAir: function () { active = false; try { sb.removeChannel(ch); } catch (e) {} },
    };
  }

  // WATCHER: a passive, presence-only peek — the rail on OTHER devices uses
  // this to learn a broadcast exists at all (BroadcastChannel never crosses
  // devices). Subscribes without tracking; costs one Realtime connection,
  // same as the rail's feed channel.
  function watch(sb, handlers) {
    handlers = handlers || {};
    // presence lives on the shared topic, so the watcher joins IT.
    // supabase-js throws on a second join of an already-held topic name —
    // callers guard for that (engine and radio pages never watch).
    // The presence KEY is required even for a passive reader — without it
    // presenceState() can stay empty forever (July 5, the phone's blind
    // rail). The watcher still never track()s, so it stays invisible.
    var ch = sb.channel(RT_CHANNEL, { config: { presence: { key: 'w-' + Math.random().toString(36).slice(2, 8) } } });
    var lastAnchorAt = 0;
    function report() {
      var state = ch.presenceState();
      var eng = findEngine(state, null);
      var count = 0;
      for (var key in state) { if (!isEngineMeta(state[key])) count++; }
      // belt + braces: flowing anchors are proof of a broadcast even if
      // presence is being coy on this platform
      var anchorsFresh = (Date.now() - lastAnchorAt) < 35000;
      if (handlers.onAir) handlers.onAir(!!eng || anchorsFresh, eng ? eng.name : (anchorsFresh ? 'the console' : null), count);
    }
    ch.on('presence', { event: 'sync' }, report);
    ch.on('broadcast', { event: 'anchors' }, function () { lastAnchorAt = Date.now(); report(); });
    ch.subscribe(function (status) { if (status === 'SUBSCRIBED') report(); });
    return { close: function () { try { sb.removeChannel(ch); } catch (e) {} } };
  }

  // LISTENER side: consume anchors, report presence.
  // identity: { key, name } (key must be unique per device).
  function listen(sb, identity, handlers) {
    handlers = handlers || {};
    var ch = sb.channel(RT_CHANNEL, { config: { presence: { key: identity.key } } });
    ch.on('broadcast', { event: 'anchors' }, function (msg) {
      if (handlers.onAnchors && msg && msg.payload) handlers.onAnchors(msg.payload);
    });
    ch.on('presence', { event: 'sync' }, function () {
      var eng = findEngine(ch.presenceState(), null);
      if (handlers.onEngine) handlers.onEngine(!!eng);
    });
    var meta = { name: identity.name, syncMs: null };
    ch.subscribe(function (status) {
      if (status === 'SUBSCRIBED') ch.track(meta);
    });
    return {
      updateSync: function (syncMs) { meta.syncMs = syncMs; try { ch.track(meta); } catch (e) {} },
      requestSync: function () { try { ch.send({ type: 'broadcast', event: 'sync-request', payload: {} }); } catch (e) {} },
      close: function () { try { sb.removeChannel(ch); } catch (e) {} },
    };
  }

  window.BardicClock = clock;
  window.BardicRadio = {
    CHANNEL: RT_CHANNEL,
    ENGINE_PREFIX: ENGINE_PREFIX,
    broadcast: broadcast,
    listen: listen,
    watch: watch,
    // pure helpers (harness-shared)
    bestOffset: bestOffset,
    positionAt: positionAt,
    driftNudge: driftNudge,
  };
})();
