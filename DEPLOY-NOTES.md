# tok-finishes-v2.zip — the Look finishes + the re-plumb switch
July 4 · mock v4 approved → built

## Files (upload all five to the repo root)
1. `look-derive.js` — NEW shared module: `window.TokLook`, one `deriveLook()`
   for the whole site + the root applier. No catalog inside (sync contract
   stays two-party: settings-flyout.js ↔ shelfTheme.js).
2. `settings-flyout.js` — Look section gains the Finish gallery (5 live
   thumbnails), the Fine-tune drawer, and the "site-wide look" opt-in.
3. `nav.js` — SETTINGS_V 2 → 3; injects look-derive.js BEFORE the flyout,
   both stamped with the same version.
4. `smoke-look-derive.mjs` — NEW: 12 assertions incl. the 990-combo sweep.
5. `smoke-settings-flyout.mjs` — extended: 48 assertions, two harnesses
   (degrade path without TokLook, full path with it).

## No SQL. No schema change.
New appearance keys (pageMode, wells, trim, replumb, style-carrying
lookPresets/pageLooks) ride the existing blob through set_my_appearance.

## Deploy-day behavior — the safety story
The site-wide opt-in ships OFF. Deploy changes NOTHING visible for anyone
until a reader flips "Wear this look site-wide" in ◐. Flipping it off is a
clean rollback (every inline token removed). Journal/chronicle behavior is
unchanged (tok:look grew additive keys only).

## Eyeball after deploy (hard refresh first — v=3 should bust caches)
1. ◐ opens; Finish gallery shows five thumbnails under the Paper row.
2. Sumi × Bone + Print: neutral dark cards, the gold caption. The control
   case — this should read as "Phantom, working."
3. Flip site-wide ON on factions.html: tokens repaint; the faction CARDS and
   MODAL will show drift (hardcoded Parchment-era literals) — expected,
   that's arc increment 2. Flip OFF: clean return to Phantom.
4. Fine-tune: chips show mini previews; editing away from Print goes Custom;
   back re-lights it. Save-as captures the finish with the look.

## Known-and-accepted
- Hardcoded surfaces (factions cards/modal, heraldry wells, similar fossils
  on other pages) do not follow the look until increment 2 migrates them
  to derived values, page by page (factions first).
- 'Always dark' and 'Swapped' truthfully coincide for dark inks on light
  papers; the thumbnails show it.

## Validation
node --check: look-derive.js, settings-flyout.js, nav.js — clean.
smoke-look-derive.mjs: 12/12 (sweep: 990 legal combos, 0 floor violations,
Stage promise holds, control case exact, apply/clear round-trips).
smoke-settings-flyout.mjs: 48/48 (all 32 pre-existing green, incl. the
sync guard, replace-not-merge, stranding nudge, July 3 armor).

## v2 patch (July 4, after M's report)
- nav.js: SETTINGS_V 3 → 4; injected scripts use async=false (dynamic
  scripts IGNORE defer — they raced; insertion order now guaranteed).
- settings-flyout.js: picking a look while the site-wide toggle is OFF now
  toasts an explanation, once per session — the pages not changing is the
  shipped default, and the UI now says so at the moment of confusion.
- REMINDER for the eyeball: the toggle ships OFF, and Sumi × Bone + Print
  is engineered to look like Phantom. Test with a LOUD pairing: flip
  site-wide ON, pick Pine paper — the page should go dark instantly.
  Console check: document.documentElement.style.getPropertyValue('--ink')
