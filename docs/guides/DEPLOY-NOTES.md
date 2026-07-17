# tok-finishes-v7.zip — the Look finishes + the re-plumb switch
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

## v3 patch (July 4, after M's click-through report)
- settings-flyout.js: FIXED the close-on-every-pick bug — render() rebuilds
  rows via innerHTML, detaching the clicked dot mid-bubble, so the
  outside-click handler's contains() saw a detached target and closed.
  composedPath() (captured at dispatch) is immune. Rapid click-through and
  in-flyout previewing now work.
- settings-flyout.js: the four sections (Look / Presets / Seat accent /
  Sheet) are now collapsible — all closed on open, header click expands,
  arrangement remembered in localStorage (furniture, not identity — never
  a profile key).
- nav.js: SETTINGS_V 4 → 5.
- smoke: 58 assertions (detach-close regression, rapid click-through,
  genuine outside click still closes, sections closed/remembered).

## v4 patch (July 4, M's reorganization)
- The Look section is now "Site look": the site-wide switch moved to the
  TOP of the section AND defaults ON (absent key = on; only an explicit
  Off is off) — a reader never has to discover a switch to make presets
  and finishes do anything. Untouched seats still see ≈Phantom because
  the default look's derivation reproduces it.
- Presets (yours / save-as / house / archives) folded into Site look;
  the standalone Presets section retired. All element IDs kept.
- Seat accent stays in ◐ for now — it relocates into the character badge
  (next arc) once that exists; controls don't strand.
- nav.js: SETTINGS_V 5 → 6.
- smoke: 59 assertions (default-ON boot, switch-on-top, folded presets,
  explicit-Off rollback + hint, explicit-On persistence).

DEPLOY-DAY NOTE, v4 specifically: because the default flips ON, any player
who already saved a non-default look will see it dress the whole site on
their next visit. That is the feature keeping its promise — but it IS a
visible change for those seats. Untouched seats see no change.

## v5 — THE CHARACTER BADGE (July 4, mock approved → built)
New file: character-badge.js (upload with the rest). nav.js: SETTINGS_V
6 → 7, injects the badge after the flyout (async=false chain).

- Portrait medallion beside KIRTAS (structural.portrait; initial-on-dark
  fallback), player-color ring + presence dot. Menu: identity header,
  vitals glance (hp / hpMax+bonus, temp + concentration chips, refreshed
  on every open), Character sheet (?character=key), Journal, Player color,
  DM tools (role-gated: Combat table, Members & access), Your characters
  (pinned single; switcher slot ready for the multi-character future),
  seat chip + Sign out.
- OWNERSHIP CONTRACT: the flyout owns profiles.appearance. The badge
  dispatches tok:accent; the flyout adopts, persists (replace-not-merge),
  and re-announces tok:look (which now carries appearance.accent). The
  badge repaints from tok:look. One writer, no clobbers.
- The ◐ Seat accent section is now a Player-color pointer to the badge
  (never an empty hole). TokSettings exports ACCENTS as the catalog.
- V1 simplifications, deliberate: "My mentions" deferred pending journal
  routing recon; DM row links to real destinations (deep links to combat
  tabs come with the panel-consolidation arc).

## Eyeball after deploy (hard refresh, v=7)
1. The medallion appears beside Kirtas with your ring color; your
   Vesperian portrait if structural.portrait is set, initial otherwise.
2. Open it: vitals match the sheet; the sheet link opens Vesperian.
3. Pick a Player color: menu stays open, ring/dot repaint, and the ◐
   flyout's copy agrees (open ◐ — no stale accent).
4. As DM you should see the DM tools row; ask a player to confirm they
   do NOT.
5. Sign out from the badge foot returns to login.

## Validation
node --check: all four JS files clean.
smoke-look-derive.mjs 12/12 · smoke-settings-flyout.mjs 62/62 (incl. the
tok:accent ownership loop) · smoke-character-badge.mjs 18/18 (three
harnesses: player, DM, unbound seat).

## v6 patch (July 4, deploy eyeball)
- character-badge.js: the badge no longer drifts to the nav's center —
  #site-nav is justify-content:space-between, so a bare sibling became its
  own distributed group; brand + badge now share one wrapped flex child
  (#tok-brand-wrap). LESSON: injected chrome entering a space-between /
  space-around flex row must wrap with its anchor, never sit as a bare
  sibling.
- character-badge.js: all three medallions (nav badge, menu header, char
  row) crop `top center/cover` — the site's face convention (party.html's
  portraits do the same). center/cover was beheading Vesperian.
- nav.js: SETTINGS_V 7 → 8.
- smokes: 12 / 62 / 19, all green.

## v7 patch (July 4, final)
- character-badge.js: the nav medallion was grey because the portrait was
  painted onto the zero-size inner text span instead of the 32px badge
  button (the element carrying the background styling). Image now lands on
  the sized element; the initial rides the span; the presence dot survives.
- nav.js: SETTINGS_V 8 -> 9.
- smokes: 12 / 62 / 20, all green.
