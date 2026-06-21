// sheet-actions.js
// ---------------------------------------------------------------------------
// Live write-affordances for the at-a-glance sheet (sheet-v2.html). Phase 2.
//
// Wired this pass: INSPIRATION — the centre control of the Hit-Dice cluster.
// A one-field play-state write that mirrors party.html's HP save exactly: read
// the WHOLE vitals object, set the single key, write it back. Never a partial
// column (CharacterData.save does a full-column .update, so a partial would
// wipe hp / conditions / etc.).
//
// Self-contained on purpose — it does its own CharacterData.loadCharacter to
// learn the current state and hold a vitals baseline for the merge, paints the
// cluster diamond + portrait halo, and gates on CharacterData.canEdit. The
// render boot inside sheet-v2.html is left untouched (its applyExtras also sets
// the initial portrait glow; that's a harmless duplicate of the initial paint).
//
// The two rest moons in the cluster are PLACEHOLDERS this pass — a brief
// "coming soon" note on tap. Short/long-rest recovery is a later step.
//
// Testable: wireInspiration() takes its dependencies (root / characterData /
// key) so the jsdom smoke can drive it without a browser. The page bootstrap at
// the bottom is skipped under Node.
// ---------------------------------------------------------------------------

export function wireInspiration({ root, characterData, key } = {}) {
  root = root || (typeof document !== 'undefined' ? document : null);
  if (!root || !characterData) return null;

  const toggle   = root.querySelector('#insp-toggle');
  if (!toggle) return null;
  const portrait = root.querySelector('.portrait');
  const statEl   = root.querySelector('#insp-stat');

  let vitals = {};        // baseline; kept reconciled with the server-confirmed row
  let saving = false;
  let statTimer = null;

  function paint(on) {
    toggle.classList.toggle('on', !!on);
    toggle.setAttribute('aria-pressed', String(!!on));
    if (portrait) portrait.classList.toggle('inspired', !!on);
  }
  function busy(b) {
    saving = b;
    toggle.classList.toggle('saving', b);
    toggle.setAttribute('aria-busy', String(b));
  }
  function showStat(kind, text, autohide) {
    if (!statEl) return;
    clearTimeout(statTimer);
    statEl.className = 'insp-stat show ' + kind;
    statEl.textContent = text;
    if (autohide) statTimer = setTimeout(() => statEl.classList.remove('show'), 1300);
  }

  async function onActivate() {
    if (saving) return;                                   // ignore taps mid-write
    const prev = !!vitals.inspiration;
    const next = !prev;
    paint(next); busy(true); showStat('saving', 'saving\u2026', false);   // 1. optimistic
    try {
      const merged = Object.assign({}, vitals, { inspiration: next });    // WHOLE vitals + the one key
      const saved = await characterData.save(key, { vitals: merged });
      vitals = (saved && saved.vitals) ? saved.vitals : merged;           // 2a. reconcile to server truth
      paint(!!vitals.inspiration);
      showStat('saved', next ? 'inspired \u2713' : 'cleared \u2713', true);
    } catch (e) {
      paint(prev);                                                        // 2b. revert — nothing lost
      showStat('error', "couldn't save \u00B7 tap to retry", false);
    } finally {
      busy(false);
    }
  }

  // load current state + merge baseline, then gate + bind
  const ready = (async () => {
    let editable = false;
    try { editable = await characterData.canEdit(key); } catch (_) { editable = false; }
    try {
      const cd = await characterData.loadCharacter(key);
      vitals = (cd && cd.vitals) ? cd.vitals : {};
    } catch (_) { vitals = {}; }
    paint(!!vitals.inspiration);                          // reflect state regardless of edit rights
    if (editable) {
      toggle.addEventListener('click', onActivate);       // <button> → Enter/Space handled natively
    } else {
      toggle.classList.add('view-only');
      toggle.setAttribute('aria-disabled', 'true');
    }
  })();

  // Rest moons — present but not wired yet.
  root.querySelectorAll('[data-rest]').forEach((b) => {
    b.addEventListener('click', () => {
      const which = b.getAttribute('data-rest') === 'short' ? 'Short' : 'Long';
      showStat('hint', which + ' rest \u2014 coming soon', true);
    });
  });

  return { ready };
}

// Page bootstrap removed: sheet-mount.js's mountSheet owns the wiring
// lifecycle now and calls wireInspiration scoped to its container. Self-booting
// here too would double-bind the toggle (double-write). The smoke imports
// wireInspiration and drives it directly, so it is unaffected.
