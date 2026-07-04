# CONTEXT.md — Trials of Kirtas
Updated: July 4, 2026 (the finishes / re-plumb / badge session)
Replace the previous CONTEXT.md with this one. If the old doc carried
sections still in play that aren't here, keep them below the line or tell C.

────────────────────────────────────────────────────────────
## DEPLOY STATE
- **tok-finishes-v7.zip STAGED, not yet deployed** — the portrait-target fix
  (nav medallion was grey). Two files changed vs the deployed v6:
  character-badge.js, nav.js (SETTINGS_V 8 → 9). Deploy both, hard refresh.
- Deployed and eyeballed green through v6: look-derive.js,
  settings-flyout.js (finishes + Site look reorg + collapsible sections),
  character-badge.js, nav.js. No SQL anywhere in this arc.
- SETTINGS_V after v7: **9**. One constant stamps look-derive.js,
  settings-flyout.js, and character-badge.js (all injected by nav.js,
  `async = false` for guaranteed order).
- Validation bar: node --check clean ×4; smoke-look-derive 12/12;
  smoke-settings-flyout 62/62 (two harnesses: degrade path without TokLook,
  full path with it); smoke-character-badge 20/20 (three harnesses: player,
  DM, unbound seat).

## WHAT SHIPPED TODAY (July 4)
The whole arc ran mock → approve → build, four mocks deep:
1. **Re-plumb recon + mocks.** party.html slice under the real ink/paper
   catalog (3 strategies); factions.html slice adding the HARDCODED-vs-
   DERIVED wash toggle (exposed the Parchment-era fossil modal, live drift).
2. **The finishes vocabulary** (mock v3 → v4, approved): five named macros —
   Print / Manuscript / Ledger / Stage / Reversed — over three axes
   (page mode: follow · dark · invert; wells: inked · neutral;
   trim: auto · gold · accent). v4's redesign: finishes-first gallery with
   LIVE THUMBNAILS, raw axes demoted to a Fine-tune drawer of visual chips.
   Control case: **Sumi × Bone + Print ≈ Phantom, derived** — "the theme M
   tried to build by hand, produced by the machine so it can't rot."
3. **look-derive.js** — `window.TokLook`: the one `deriveLook(ink, paper,
   style)` (v4 math verbatim: well-polarity guard, converging trim guard,
   gold-trim constants #c9b48a dark / #8a6d1e light), FINISHES, and
   `applyToRoot()` mapping derived surfaces onto theme.css token names as
   inline props on <html> + `data-look-polarity`. Fixed semantics
   (--hp-*, --prof/crit/half, fonts) never written. NO catalog inside —
   the ink/paper catalog stays a two-party sync
   (settings-flyout.js ↔ shelfTheme.js), never a third mirror.
4. **The flyout, extended and reorganized.** "Site look" section: the
   site-wide switch at the TOP and **DEFAULT ON** (`replumb !== false`;
   only an explicit Off is off), ink/paper rows, finish gallery, presets
   folded in (save-as captures the finish axes; presets apply them),
   Fine-tune drawer, per-page scope unchanged. All sections (Site look /
   Player color pointer / Sheet) are collapsible — closed on open, header
   expands, arrangement remembered in localStorage ('tok-flyout-open';
   furniture, not identity — never a profile key). Once-per-session hint
   toast when picking while the switch is explicitly Off.
5. **The character badge** (character-badge.js): portrait medallion beside
   KIRTAS (brand + badge wrapped in #tok-brand-wrap), player-color ring +
   presence dot. Menu: identity header (structural.portrait / classLabel /
   background|race), vitals glance (vitals.hp / combat.hpMax + hpBonus,
   temp + concentration chips, refreshed each open), Character sheet
   (?character=key), Journal, Player color row, DM tools (role-gated:
   Combat table → combat.html, Members & access → admin.html), Your
   characters (pinned single; switcher slot in code for the multi-character
   future), seat chip + Sign out. Escape + composedPath outside-close.
6. **Accent relocated.** ◐'s Seat accent section is now a Player-color
   pointer to the badge. `TokSettings.ACCENTS` exported as the catalog.

## ARCHITECTURE PINS (new this session)
- **Identity-left, preferences-right**: the badge owns who-you-are; ◐ owns
  how-things-look. Anything character/player-identity migrates badge-ward.
- **One writer for profiles.appearance**: settings-flyout.js. Satellites
  (the badge) dispatch CustomEvents — `tok:accent` {accent} — the flyout
  adopts, persists (replace-not-merge, unknown keys survive), re-announces.
- **tok:look detail grew (additive)**: effective {ink, paper, mode, wells,
  trim}; appearance now also carries accent. Journal consumers unaffected.
- Appearance keys now: ink, paper, accent, pageLooks (entries may carry
  pageMode/wells/trim per page), lookPresets (entries may carry the axes),
  pageMode, wells, trim, replumb, background(+sheet keys), …unknowns kept.
- ROOT_MAP (token names applyToRoot writes): --ink/-deep/--smoke (grounds),
  --parchment/2/--aged/--muted (text ramp), --gold family (accent),
  --nav-bg/-border, --section-bg/-border, --bubble-bg/-right,
  --noise-opacity, + data-look-polarity attribute.
- **Phantom inverted token SEMANTICS**: under Phantom --ink is the cream
  GROUND, --parchment the near-black TEXT. Token names are ROLES. party.html
  is a light page today (it was dark in the Parchment era).

## LESSONS PINNED (July 4)
1. **WCAG contrast is symmetric** — every floor-legal ink×paper pair
   survives inversion; a dark page's failure mode is IDENTITY (ground
   luminance < 0.35), not legibility. Assert ground darkness, not ratios.
2. **jsdom asserts the DOM, not the paint** — occlusion, z-index, stray
   fixed-position overlays pass DOM smokes invisibly. Smoke green +
   screenshot is the handover bar. (Caught by M: a stray `.stage`-classed
   spacer covered the whole preview at 17/17 green.)
3. **Taste notes become derivation constants, not preserved literals** —
   "I like the gold font" → Trim: Gold (#c9b48a); never keep the hardcode.
4. **Dynamically injected scripts IGNORE `defer`** (async race). Use
   `script.async = false` for insertion-order execution.
5. **innerHTML re-renders detach mid-bubble targets** — outside-click
   handlers must use `e.composedPath()` (frozen at dispatch), never
   `contains(e.target)`. This closed the flyout on every pick.
6. **Injected chrome entering a space-between flex row must wrap with its
   anchor** — a bare sibling becomes its own distributed group and drifts
   (the badge parked mid-nav).
7. **Portraits crop `top center/cover`** (faces live in the top of the art;
   party.html's convention) and the image goes on the SIZED element, not a
   zero-size inner span (the grey-medallion bug).
8. **Defaults are discoverability**: a feature behind an un-flipped switch
   reads as broken ("nothing changes on any page"). Ship the default that
   makes the visible thing true; keep the switch as opt-out; make picks
   explain themselves at the moment of confusion (the hint toast).

## KNOWN-AND-ACCEPTED / OPEN
- **The fossils stand** (increment 2 pending): hardcoded washes don't read
  tokens — factions cards #1a1a1a, heraldry wells #111009, the Parchment-
  brown modal (#2a1e10→#140f08), and cousins on other pages. They camouflage
  on dark looks and hold still on light ones. The re-plumb built the
  plumbing; these surfaces aren't connected to it yet.
- shards.html and sheet-v2.html locally shadow core tokens — own visual
  languages, effectively opted out. Deliberate for now; revisit per page.
- Badge v1 trims: "My mentions" deferred (needs journal routing recon so
  the link is honest); DM deep links (Scenes / Bestiary tabs) come with the
  combat panel consolidation; per-character portrait crop offset in
  structural if any portrait frames badly under top-center.
- Repo hygiene: `smoke-nav-cog-flyout.mjs` still in root — git rm (retired
  with the cog). Schema deltas for characters / saved_monsters / drawings
  remain uncommitted to version control (live-DB only).
- 'Always dark' and 'Swapped' truthfully coincide for dark inks on light
  papers; the thumbnails show it. Accepted as honest, revisit only if it
  confuses players in practice.

## THE MAP (revised July 4)
1. **Wash migration — factions first** (increment 2 of the re-plumb):
   rewire hardcoded surfaces to TokLook's derived values — cards → cardBg/
   cardT/trim, wells → well, the modal → modalG family (derive from cardBg
   + accent tint), borders → cardBorder. Then the sweep: lore, npcs, world,
   compendium, index. Recon each page's literals before cutting; the
   Sumi×Bone control case must keep reading as Phantom after each page.
2. **Combat panel consolidation**: old right panel's sections into the
   tabbed float, old one retired. RULE ONE: read combat.html first — plan
   nothing from memory. Rides the re-plumb's combat dark-page decisions;
   defines the tab anchors the badge's DM deep links want.
3. **Threads + composer into the shelf panel** (mock first; donor organs:
   docToFeedBody, the journal composer).
4. **Quill retirement** — only after one real session writes through the
   panel composer. Session titles then write canon; meta fallback fades.
5. **Medallion portraits** (spine feet, entry bylines, vault seat dots) —
   reuse the badge's portrait pattern (structural.portrait, top-center
   crop, initial fallback). Front-run done by the badge.
6. Small standalones: rail alias wiring; badge growth (My mentions, DM deep
   links, character switcher when profiles carry >1); flyout re-org polish
   if anything still feels off in the hand.

## STANDING RULES (unchanged, restated for the new doc)
mock → approve → build for all UX. node --check + jsdom smokes before every
handover; smoke green + screenshot = done. C preps zips; M deploys (SQL
first when present); C never commits or pushes. Injected chrome: ID-prefixed
selectors, JS-mixed rgb()/rgba() literals (no color-mix or modern CSS
expressions in shorthand), cache-stamp every injected script with
SETTINGS_V. scrollIntoView banned in scoped containers; overflow:clip is not
programmatically scrollable. GitHub web upload drops hidden dotfiles. Stub
the publisher's contract in smoke harnesses, not your own assumption.
