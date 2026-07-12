/* ── forge-kit-integration ───────────────────────────────────────────────
   Bite 2 wiring: replaces the SK-START/SK-END block in the topography mock.

   This code goes INSIDE the mock's type="module" <script> block, replacing
   the existing loadLiveStats/liveStatsFor/kitFor/GENERIC_PC_KIT.

   It imports:
     - ForgeKitDerive (from forge/forge-kit-derive.js, loaded via <script>)
     - assembleActions (from weapon-actions.js, ESM import in the module block)

   At boot (loadLiveStats), it:
     1. Loads all party characters via CharacterData.loadParty()
     2. For each PC, runs assembleActions(inventory, structural) to get the
        full weapon + cantrip + custom attack list
     3. Runs ForgeKitDerive.derive(charData, { assembledActions }) to produce
        a ForgeKit
     4. Caches the derived kit

   kitFor(key) returns the cached derived kit, falling back to STARTER_KITS
   then GENERIC_PC_KIT — the same fallback chain bite 1 established, but
   now the live path is a full derivation instead of a stat overlay.

   The existing pipeline (buildUnit/canUse/resolveStrike/reactReady) works
   unchanged — the derived kit has the same shape as STARTER_KITS entries.

   ────────────────────────────────────────────────────────────────────────
   INTEGRATION INSTRUCTIONS:

   1. Add to topography-test-mock.html's <head>, BEFORE the module block:
        <script src="forge/forge-kit-derive.js"></script>
        <script src="forge/forge-feed-render.js"></script>

   2. In the module block, add this import near the top:
        import { assembleActions } from './weapon-actions.js';

   3. Replace the SK-START to SK-END block with this file's contents
      (everything between the INTEGRATION-START and INTEGRATION-END markers).

   4. The existing window.CHAR / window.kitFor / window.liveStatsFor exports
      remain unchanged — they're re-exported at the bottom.
   ────────────────────────────────────────────────────────────────────────  */

// ── paste from INTEGRATION-START to INTEGRATION-END into the mock ────────
// /*INTEGRATION-START*/

/* Bite 2: derived kits replace the hand-tuned STARTER_KITS as the primary
   source. STARTER_KITS demote to fallback (a kit entry + liveStatsFor overlay);
   GENERIC_PC_KIT stays the last resort. The derive module produces the full
   shape buildUnit/canUse/reactReady already consume: actions, react, res,
   ac, speed, init, and extends it with tabs/pools for the new bar UI. */

var __derivedKits = null;       // null = never loaded; {} or populated once boot settles
var __deriveLoading = null;     // in-flight promise — concurrent callers share one load
var __liveStatsCache = null;    // kept for liveStatsFor backward compat
var __liveStatsLoading = null;
var __liveStatsWarned = {};
var __genericKitWarned = {};

/* loadLiveStats (boot call): loads all party characters and derives ForgeKits.
   The derive call runs assembleActions (imported from weapon-actions.js in the
   module block) to get the full weapon + cantrip + custom attack list.
   Settles once; concurrent callers share the same promise. */
function loadLiveStats() {
  if (__derivedKits) return Promise.resolve(__derivedKits);
  if (__deriveLoading) return __deriveLoading;
  if (!window.CharacterData) {
    __derivedKits = {};
    __liveStatsCache = {};
    return Promise.resolve(__derivedKits);
  }
  __deriveLoading = window.CharacterData.loadParty().then(function (party) {
    var byKey = {};
    var derived = {};
    (party || []).forEach(function (c) {
      byKey[c.key] = c;
      try {
        // assembleActions is imported in the module block (ESM import)
        // It's available here because this code lives INSIDE that module block.
        var actions = (typeof assembleActions === "function")
          ? assembleActions(c.inventory || [], c.structural || {})
          : (c.structural && c.structural.actions) || [];

        derived[c.key] = window.ForgeKitDerive.derive(c, {
          assembledActions: actions,
          starterKits: STARTER_KITS
        });
      } catch (e) {
        clog('<i>' + escapeHtml(c.name || c.key) + ': derivation failed ('
          + escapeHtml((e && e.message) || e) + ') — using kit fallback.</i>');
        derived[c.key] = null;  // kitFor falls through to STARTER_KITS
      }
    });
    __derivedKits = derived;
    __liveStatsCache = byKey;
    __deriveLoading = null;
    return __derivedKits;
  }).catch(function (e) {
    clog('<i>Sheet read failed (' + escapeHtml((e && e.message) || e) + ') — using kit numbers.</i>');
    __derivedKits = {};
    __liveStatsCache = {};
    __deriveLoading = null;
    return __derivedKits;
  });
  return __deriveLoading;
}

/* liveStatsFor(key): backward-compat overlay — returns {ac, speed, init}
   from the live sheet, same shape the existing unitFromRosterRow expects.
   With the derive module, the derived kit already carries these, so this
   is mainly for non-derived paths (e.g. STARTER_KITS fallback). */
function liveStatsFor(sheetRef) {
  if (!sheetRef) return null;
  // If we have a derived kit, its stats are already live — no overlay needed.
  if (__derivedKits && __derivedKits[sheetRef]) return null;
  // Fall through to the old overlay path for STARTER_KITS entries.
  var c = __liveStatsCache && __liveStatsCache[sheetRef];
  var cmb = (c && c.structural && c.structural.combat) || null;
  var out = null, missing = !cmb;
  if (cmb) {
    out = {};
    if (cmb.ac != null) out.ac = cmb.ac; else missing = true;
    if (cmb.speed != null) out.speed = cmb.speed; else missing = true;
    if (cmb.initiative != null) out.init = cmb.initiative; else missing = true;
  }
  if (missing && !__liveStatsWarned[sheetRef]) {
    __liveStatsWarned[sheetRef] = true;
    var label = (STARTER_KITS[sheetRef] && STARTER_KITS[sheetRef].name) || (c && c.name) || sheetRef;
    clog('<i>' + escapeHtml(label) + ': using kit numbers — sheet unavailable.</i>');
  }
  return out;
}

/* kitFor(key): the main entry point for the combat pipeline.
   Priority: derived kit → STARTER_KITS → GENERIC_PC_KIT → null.
   The derived kit carries the FULL shape (actions, react, res, tabs, pools)
   and sets derived:true so the bar UI can distinguish it from a fallback. */
var GENERIC_PC_KIT = { ac: 10, speed: 30, init: 0,
  react: null, res: {},
  actions: [{ label: "Improvised Strike", kind: "attack", rng: 1, hit: 2, dmg: "1d4+1" }]
};

function kitFor(key) {
  if (!key) return null;
  // 1. Derived kit (full live-data derivation)
  if (__derivedKits && __derivedKits[key]) return __derivedKits[key];
  // 2. STARTER_KITS fallback (hand-tuned)
  if (STARTER_KITS[key]) return STARTER_KITS[key];
  // 3. Generic kit for any sheet-having PC without a starter entry
  var c = __liveStatsCache && __liveStatsCache[key];
  if (!c) return null;
  if (!__genericKitWarned[key]) {
    __genericKitWarned[key] = true;
    clog('<i>' + escapeHtml(c.name || key) + ': starter kit — full actions come with the derivation layer.</i>');
  }
  return Object.assign({ name: c.name || key }, GENERIC_PC_KIT);
}

// /*INTEGRATION-END*/
