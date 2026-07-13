/* ── forge-unit-art.js ────────────────────────────────────────────────
   Battle Forge top-down token-art resolver and override store.

   Pure data only: no three.js, DOM, Supabase, or combat dependency.
   Browser: window.ForgeUnitArt. Node: module.exports.
   ─────────────────────────────────────────────────────────────────── */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeUnitArt = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var STORAGE_KEY = "tok-forge-token-art-v1";
  var FIVE_TOOLS_TOKEN_ROOT = "https://5e.tools/img/bestiary/tokens";

  function text(v) { return v == null ? "" : String(v).trim(); }
  function slug(v) {
    return text(v).toLowerCase().normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
  }
  function initials(name) {
    var bits = text(name).split(/\s+/).filter(Boolean);
    if (!bits.length) return "?";
    if (bits.length === 1) return bits[0].slice(0, 2).toUpperCase();
    return (bits[0][0] + bits[bits.length - 1][0]).toUpperCase();
  }
  function safeUrl(value) {
    var v = text(value);
    if (!v) return null;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v)) return v;
    if (/^blob:/i.test(v)) return v;
    if (/^https?:\/\//i.test(v)) return v;
    return null;
  }
  function unitId(unit) {
    unit = unit || {};
    return text(unit.unit || unit.id || unit.key || unit.name) || "unknown";
  }
  function kindIdentity(unit) {
    unit = unit || {};
    if (unit.side === "pc") return "pc:" + slug(unit.key || unit.sheet_ref || unit.unit || unit.name);
    var stat = unit.statblock || {};
    return "foe:" + slug(stat.source || unit.source || "custom") + ":" + slug(stat.name || unit.name || unit.key || unit.unit);
  }
  function overrideKey(unit, scope) {
    return (scope === "kind" ? "kind:" + kindIdentity(unit) : "unit:" + slug(unitId(unit)));
  }
  function blankStore() { return { version: 1, overrides: {} }; }
  function parseStore(raw) {
    if (!raw) return blankStore();
    try {
      var parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== "object") return blankStore();
      var out = blankStore();
      var src = parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {};
      Object.keys(src).forEach(function (key) {
        var url = safeUrl(src[key]);
        if (url) out.overrides[key] = url;
      });
      return out;
    } catch (_e) { return blankStore(); }
  }
  function loadOverrides(storage) {
    if (!storage || typeof storage.getItem !== "function") return blankStore();
    try { return parseStore(storage.getItem(STORAGE_KEY)); }
    catch (_e) { return blankStore(); }
  }
  function saveOverrides(storage, store) {
    if (!storage || typeof storage.setItem !== "function") return false;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(parseStore(store))); return true; }
    catch (_e) { return false; }
  }
  function getOverride(unit, storage) {
    var store = loadOverrides(storage);
    var unitUrl = safeUrl(store.overrides[overrideKey(unit, "unit")]);
    if (unitUrl) return { url: unitUrl, source: "local-unit", scope: "unit" };
    var kindUrl = safeUrl(store.overrides[overrideKey(unit, "kind")]);
    if (kindUrl) return { url: kindUrl, source: "local-kind", scope: "kind" };
    return null;
  }
  function setOverride(unit, scope, url, storage) {
    var clean = safeUrl(url);
    if (!clean) throw new Error("forge-unit-art: token art must use an http(s), blob, or image data URL");
    var store = loadOverrides(storage);
    store.overrides[overrideKey(unit, scope)] = clean;
    if (!saveOverrides(storage, store)) throw new Error("forge-unit-art: token art could not be saved on this device");
    return clean;
  }
  function clearOverride(unit, scope, storage) {
    var store = loadOverrides(storage), key = overrideKey(unit, scope);
    var existed = Object.prototype.hasOwnProperty.call(store.overrides, key);
    delete store.overrides[key];
    saveOverrides(storage, store);
    return existed;
  }
  function clearAllOverrides(unit, storage) {
    var store = loadOverrides(storage), changed = false;
    [overrideKey(unit, "unit"), overrideKey(unit, "kind")].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(store.overrides, key)) { delete store.overrides[key]; changed = true; }
    });
    saveOverrides(storage, store);
    return changed;
  }
  function explicitUrl(value) {
    if (!value) return null;
    if (typeof value === "string") return safeUrl(value);
    if (typeof value === "object") return safeUrl(value.url || value.href || value.src);
    return null;
  }
  function monsterExplicit(stat) {
    stat = stat || {};
    var candidates = [stat.tokenArt, stat.tokenUrl, stat.token, stat.image, stat.img, stat.portrait];
    for (var i = 0; i < candidates.length; i++) {
      var found = explicitUrl(candidates[i]);
      if (found) return found;
    }
    return null;
  }
  function fiveToolsTokenUrl(stat, unit) {
    stat = stat || {};
    var source = text(stat.source || (unit && unit.source));
    var name = text(stat.name || (unit && unit.name));
    if (!source || !name) return null;
    return FIVE_TOOLS_TOKEN_ROOT + "/" + encodeURIComponent(source) + "/" + encodeURIComponent(name) + ".webp";
  }
  function resolve(unit, options) {
    unit = unit || {}; options = options || {};
    var storage = options.storage;
    var authoritative = explicitUrl(unit.tokenArt || unit.tokenUrl);
    if (authoritative) return { url: authoritative, source: "unit-field", fallback: false };
    var local = getOverride(unit, storage);
    if (local) return { url: local.url, source: local.source, scope: local.scope, fallback: false };

    if (unit.side === "pc") {
      var portraits = options.portraits || {};
      var portrait = explicitUrl(unit.portrait || portraits[unit.key] || portraits[unit.sheet_ref] || portraits[unit.unit]);
      if (portrait) return { url: portrait, source: "pc-portrait", fallback: false };
    } else {
      var stat = unit.statblock || {};
      var explicit = monsterExplicit(stat);
      if (explicit) return { url: explicit, source: "statblock-art", fallback: false };
      var auto = fiveToolsTokenUrl(stat, unit);
      if (auto) return { url: auto, source: "5etools-token", fallback: false };
    }
    return { url: null, source: "initials", initials: initials(unit.name || unit.key || unit.unit), fallback: true };
  }

  return Object.freeze({
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    FIVE_TOOLS_TOKEN_ROOT: FIVE_TOOLS_TOKEN_ROOT,
    initials: initials,
    safeUrl: safeUrl,
    unitId: unitId,
    kindIdentity: kindIdentity,
    overrideKey: overrideKey,
    parseStore: parseStore,
    loadOverrides: loadOverrides,
    saveOverrides: saveOverrides,
    getOverride: getOverride,
    setOverride: setOverride,
    clearOverride: clearOverride,
    clearAllOverrides: clearAllOverrides,
    fiveToolsTokenUrl: fiveToolsTokenUrl,
    resolve: resolve
  });
});
