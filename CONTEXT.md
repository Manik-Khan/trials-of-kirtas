# CONTEXT.md — Trials of Kirtas
Updated: July 4, 2026 (night — the dock retires into the rail)
Replace the previous CONTEXT.md with this one.

────────────────────────────────────────────────────────────
## DEPLOY STATE
- **tok-rail-dock: v1/v2 verified live** (M's screenshot: Battle tab up,
  five sections, eye in the strip corner). **v3 staged, pending deploy** —
  combat.html only; adds the rail-size restyle for Bestiary / Tracker /
  Tokens / dock-act buttons on top of v2's Display restyle. No SQL,
  **rail.js untouched**, no SETTINGS_V bump. The zip also carries
  _edits/smoke-rail-dock.mjs — repo housekeeping, not deploy.
- **⚠ tok-finishes-v7 STILL not deployed** — carried from the evening doc.
  Live character-badge.js is v6; the grey-medallion portrait fix is not
  live. Deploy character-badge.js alone or fold into the next zip.
- Validation bar this arc: node --check clean on combat.html's inline
  script (all edits); smoke-rail-dock **22/22** (publisher's contract
  parsed from rail.js itself, adapter registration, deferred
  tok-rail:ready path, sub-strip switching, staff gating, ticker gating).

## WHAT SHIPPED TONIGHT (July 4, night)
**The combat dock retired into the rail** — the map's "panel
consolidation" item, finally read correctly (see LESSONS):
1. combat.html registers ONE contextual rail tab — `battle`, order 20 —
   through rail.js's shipped `registerTab` seam (the seam's own comment
   named the combat tabs as its intended riders; the rail header called
   this "phase 3"). rail.js needed zero changes.
2. Inside the pane: a segmented sub-strip (the rail Feed's
   Combat|Chronicle chrome) — **Display · Bestiary · Tracker · Tokens ·
   Scenes**. Staff gating carries via the shipped `staff` class; the eye
   lives in the strip corner and now also flips `.hide-staff` on the
   strip (the old CSS hide relied on the dock living inside .stage).
3. **The adapter keeps the DOCK object shape** ({panes:{id:{btn,pane,
   onOpen}}, open, last, corner, ticker}) so paintCombatMenu,
   tokensPaneOpen, and the view-toggle fallback run unmodified. Pane
   contents keep `.dock-pane`/`.dock-body` — zero content-CSS churn.
   Builders run in shipped order against a DETACHED host; registration
   lands now or on `tok-rail:ready`.
4. **The rail owns the feed.** buildFeed() is no longer called: writers
   (feedInsert / feedLogRoll / logEvent) and the always-on channel stay,
   purely driving the roll ticker; renderFeed no-ops on its null-element
   guard. Bonus: retiring buildFeed removed a hard `onRSChange`
   OVERWRITE that clobbered the rail's chained listener.
5. Ticker survives: gated on `__tokRail.open && tab==='feed'`, offset
   396px past the open rail / 36px past the collapsed handle, click →
   `TokRail.show('feed')`. Outside-click guards re-pointed from
   `.dock-panel, .dock-handle` to `#tok-rail, .tr-handle` (without this,
   every rail click deselected the token).
6. **Rail-size restyle** (v2+v3): one `#tok-rail`-scoped override block —
   Display's gc-rows, Bestiary, Tracker/Tokens rows, dock-act buttons all
   upsized for the 384px rail. Base .gc-*/.bst-*/.roster-* rules
   untouched; Scenes deliberately skipped (already rem-comfortable).

## LESSONS PINNED (July 4, night)
1. **"The panel" needs a pointer.** Two right-side surfaces existed
   (combat's dock AND the site rail); C designed against the wrong one
   twice before a screenshot settled it. When a map item says "panel" /
   "float" / "shelf", name the FILE in the doc — and when picking work
   up, confirm the referent against a screenshot before mocking.
2. **Write map items with file names.** "Old right panel's sections into
   the tabbed float" read as three different migrations. rail.js's own
   comments held the true reading the whole time.
3. **Mocks must never render blank.** Bake a backdrop (CSS/SVG map, no
   network); an empty stage behind a mock reads as broken.
4. **Adapter over excision.** Keeping the DOCK shape and re-homing its
   DOM cost ~100 lines and preserved every downstream reference;
   ripping it out would have touched thirty call sites.
5. **A dead builder can hide a live hazard** — buildFeed's onRSChange
   overwrite. When retiring a function, read what it CLOBBERS, not just
   what it builds.

## KNOWN-AND-ACCEPTED / OPEN
- Players' Battle strip = **Display only** (Tracker pane is staff in the
  shipped page; players read turns from the init strip). Flip the
  `tab:'Tracker'` registration to non-staff if players should get it.
- The eye sits in the strip corner, not the rail header — the seam
  offers no header icons; extending rail.js was out of scope.
- **Mobile bug trio (new map item, from M's live report):** token drag
  doesn't work on mobile; the CombatSheets float overflows the top of
  the screen (✕ barely reachable); the sf-reopen edge tab eats space on
  mobile. All combat-sheet-float.js / board issues, NOT rail work.
- Dead feed-reader code in combat.html (renderFeed, feedTab, buildFeed,
  the FEED array churn) awaits the feed-core extraction.
- The statblock drawer stays deliberate ("DM info, not a fixture").
- ◐ override banner: a standalone mock exists from tonight's detour
  (mock-override-banner.html — banner + silent-lock toast, 16/16 smoke)
  but was never reviewed on its merits; the map item stands.
- v7 character-badge.js deploy pending. Remaining fossil pages: lore,
  npcs (allegiance fades are a KEEPER), world, compendium, index.
  smoke-nav-cog-flyout.mjs still awaiting git rm; schema deltas for
  characters / saved_monsters / drawings still live-DB only.

## THE MAP (revised July 4 night)
1. **Deploy v3** (combat.html) + **the v7 badge fix** (character-badge.js)
   — both single-file, ride one push.
2. **Wash sweep, next page: lore** (then npcs → world → compendium →
   index). Per page: recon literals + CHECK pageLooks state first; the
   Sumi×Bone control case must keep reading as Phantom; npcs preserves
   the allegiance fades as derivations. Combat.html joins the sweep
   eventually — same solution as factions, M confirmed.
3. **◐ override banner** — mock exists (see OPEN); review it, then build
   into settings-flyout.js (SETTINGS_V bump when it lands).
4. **Feed-core extraction** (rail-dock increment 3): one shared feed
   module the rail and chronicle consume; sweep combat.html's dead
   reader code in the same pass.
5. **Mobile trio** (token drag / sheet-float overflow / sf-reopen tab) —
   its own arc; recon combat-sheet-float.js + the board's pointer
   handlers first.
6. Threads + composer into the shelf panel (mock first; donor organs:
   docToFeedBody, the journal composer). Then Quill retirement after one
   real session writes through it.
7. Small standalones: medallion portraits rollout, rail alias wiring,
   badge growth, flyout polish, rail-size pass for Scenes if it reads
   small live.

## STANDING RULES (unchanged, restated for the new doc)
mock → approve → build for all UX. node --check + jsdom smokes before
every handover; smoke green + screenshot = done. C preps zips; M deploys
(SQL first when present); C never commits or pushes. Injected chrome:
ID-prefixed selectors, JS-mixed rgb()/rgba() literals (no color-mix or
modern CSS expressions in shorthand), cache-stamp every injected script
with SETTINGS_V. scrollIntoView banned in scoped containers;
overflow:clip is not programmatically scrollable. GitHub web upload drops
hidden dotfiles. Stub the publisher's contract in smoke harnesses, not
your own assumption. Recon saved state before connecting dormant
surfaces. Verify deploy state; never infer it from repo constants.
Map items name FILES, not furniture — "the panel" cost half a session.
