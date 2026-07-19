/* Forge render-power authority · version 1
   Pure profile selection + one-frame scheduler. The browser surface supplies
   requestAnimationFrame and the actual THREE render step; tests drive the same
   scheduler with a deterministic fake clock. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeRenderPower = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = 1;
  var PROFILES = Object.freeze({
    balanced: Object.freeze({ key: "balanced", pixelRatioCap: 1.25, shadowMapSize: 1024, ambientMotion: false, continuous: false }),
    high: Object.freeze({ key: "high", pixelRatioCap: 1.75, shadowMapSize: 2048, ambientMotion: true, continuous: true })
  });

  function normalizeProfile(value) {
    return String(value || "").toLowerCase() === "high" ? "high" : "balanced";
  }

  function settings(value, deviceRatio) {
    var profile = PROFILES[normalizeProfile(value)];
    var ratio = Number(deviceRatio);
    if (!Number.isFinite(ratio) || ratio <= 0) ratio = 1;
    return {
      key: profile.key,
      pixelRatio: Math.min(ratio, profile.pixelRatioCap),
      pixelRatioCap: profile.pixelRatioCap,
      shadowMapSize: profile.shadowMapSize,
      ambientMotion: profile.ambientMotion,
      continuous: profile.continuous
    };
  }

  function createScheduler(options) {
    options = options || {};
    var raf = options.raf;
    var cancel = options.cancel || function () {};
    var clock = options.clock || function () { return 0; };
    var step = options.step;
    var continuous = options.continuous || function () { return false; };
    if (typeof raf !== "function" || typeof step !== "function") throw new Error("forge-render-power: scheduler needs raf and step");

    var pending = false, paused = false, dirty = false, handle = null, forceUntil = 0, frames = 0;

    function queue() {
      if (paused || pending) return;
      pending = true;
      handle = raf(tick);
    }

    function request(durationMs) {
      dirty = true;
      var duration = Math.max(0, Number(durationMs) || 0);
      if (duration) forceUntil = Math.max(forceUntil, clock() + duration);
      queue();
    }

    function tick(timestamp) {
      pending = false;
      handle = null;
      if (paused) return;
      var wasDirty = dirty;
      dirty = false;
      frames++;
      var keep = !!step(timestamp, { dirty: wasDirty, forced: clock() < forceUntil, frames: frames });
      if (keep || continuous() || clock() < forceUntil || dirty) queue();
    }

    function setPaused(value) {
      var next = !!value;
      if (next === paused) return;
      paused = next;
      if (paused && pending) {
        cancel(handle);
        pending = false;
        handle = null;
      }
      if (!paused) request();
    }

    function state() {
      return { pending: pending, paused: paused, dirty: dirty, forceUntil: forceUntil, frames: frames };
    }

    return { request: request, setPaused: setPaused, state: state };
  }

  return { VERSION: VERSION, PROFILES: PROFILES, normalizeProfile: normalizeProfile, settings: settings, createScheduler: createScheduler };
});
