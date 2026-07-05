// ============================================================
// bardic-bus.js — the Bardic Console's message bus
// The Trials of Kirtas
// ============================================================
//
// One bus, three riders (July 5 plan, approved via mock-rail-bardic):
//   ENGINE — bardic-console.html / bardic-app.jsx. Owns all audio.
//   REMOTE — the rail's Bardic tab (bardic-tab.js). Sends verbs,
//            renders state. Never touches audio.
//   RADIO  — radio.html listeners (wave B). Consume state + the
//            broadcast clock; play their own synced copies.
//
// TRANSPORT (increment 1): BroadcastChannel('tok-bardic-bus') —
// same-origin tabs in the same browser. Wave B adds a second
// transport (Supabase Realtime channel 'bardic-radio', following the
// 'combat-characters' / 'rail-feed' naming convention) behind the
// same connect() seam; riders never know which carried a message.
//
// PROTOCOL v1 — every envelope: { v:1, from:<role>, t:<type>, ... }
//
//   remote → engine (verbs; engine maps them onto its callbacks):
//     { t:'hello' }                     announce; engine replies with state
//     { t:'cast',   moodId, chId }      cast a mood onto a channel
//     { t:'toggle', moodId, chId }      pause/resume that mood on that channel
//     { t:'stop',   chId }              clear the channel
//     { t:'pause',  chId }              per-channel pause/resume
//     { t:'next',   chId }              advance (respects shuffle bag)
//     { t:'prev',   chId }              restart >3s in, else previous
//     { t:'vol',    chId, val }         0..1
//     { t:'globalPause' }               space-bar semantics, every channel
//
//   engine → everyone (a full snapshot, never a diff):
//     { t:'state', engineId, ts, onAir,
//       moods:    [{ id, name, color, sigil }],
//       channels: { <chId>: { label, accent, moodId, moodName,
//                             trackTitle, paused, volume, sourceType } } }
//     Sent on every engine state change and in reply to 'hello'.
//     Snapshots make riders stateless: the latest one is the truth,
//     and a missed message costs nothing.
//
//   engine → everyone: { t:'engine-bye', engineId }  on tab close.
//
// CONTRACT, pinned:
//   • The bus never interprets. Transport + envelope only.
//   • Riders parse THIS header for the protocol; harnesses stub the
//     platform (BroadcastChannel), never this contract.
//   • Classic script; rides window.BardicBus. No React, no DOM.
// ============================================================

(function () {
  'use strict';

  var CHANNEL = 'tok-bardic-bus';
  var V = 1;

  function supported() {
    return typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function';
  }

  // connect(role) → { send, onMessage, close, supported }
  // role: 'engine' | 'remote' | 'radio' — stamped on every envelope.
  function connect(role) {
    if (!supported()) {
      // graceful no-op handle: the console works alone, the rail shows
      // its engine-offline state, nothing throws.
      return {
        supported: false,
        send: function () {},
        onMessage: function () { return function () {}; },
        close: function () {},
      };
    }
    var bc = new BroadcastChannel(CHANNEL);
    var listeners = [];
    bc.onmessage = function (ev) {
      var msg = ev && ev.data;
      if (!msg || msg.v !== V || !msg.t) return;      // future-versions: ignore, never throw
      if (msg.from === role) return;                   // never echo your own role back
      for (var i = 0; i < listeners.length; i++) listeners[i](msg);
    };
    return {
      supported: true,
      send: function (msg) {
        var env = { v: V, from: role };
        for (var k in msg) env[k] = msg[k];
        try { bc.postMessage(env); } catch (e) { /* tab teardown race — drop */ }
      },
      onMessage: function (fn) {
        listeners.push(fn);
        return function () {
          var i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      close: function () { try { bc.close(); } catch (e) {} listeners.length = 0; },
    };
  }

  window.BardicBus = {
    VERSION: V,
    CHANNEL: CHANNEL,
    connect: connect,
    supported: supported,
  };
})();
