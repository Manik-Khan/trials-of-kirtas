# CONTEXT.md — Trials of Kirtas
Updated: July 4, 2026 (evening — the factions wash / override-landmine session)
Replace the previous CONTEXT.md with this one.

────────────────────────────────────────────────────────────
## DEPLOY STATE
- **tok-wash-factions-v1 DEPLOYED and verified green** (after the override
  incident below): look-derive.js (well-surface family), factions.html
  (24 fossil rewires), nav.js (SETTINGS_V 9 → **10**), smoke-look-derive.mjs
  (extended), smoke-factions-wash.mjs (new). No SQL.
- **⚠ tok-finishes-v7 was NEVER deployed** — the session doc said staged
  and it stayed staged. Live character-badge.js is still v6: the grey-
  medallion portrait fix is NOT live. Repo carries v7's badge; deploy
  character-badge.js alone (nav.js is already past it at V10) or fold it
  into the next zip. Don't let a repo version constant stand in for
  deploy state again — verify live before building on it.
- Validation bar this arc: node --check clean ×2; smoke-look-derive
  **17/17** (12 prior + 5 new); smoke-factions-wash **22/22** (new);
  smoke-settings-flyout **62/62** regression against the extended module.

## WHAT SHIPPED TODAY (July 4, evening)
Increment 2 of the re-plumb — **the wash migration, factions first**
(mock → approve → build; the mock: card grid + modal, HARDCODED⟷DERIVED
prop-swap on identical markup, live readout, control-case exact badge):
1. **The well-surface family in look-derive.js** — new derivations off
   cardBg + accent + ground: modal gradient (modalG1 = cardBg warmed by
   accent; modalG2 driven to the pole), scrim, heraldry band, header
   ember, halftone-dot color (softens to 0.08 on light wells), cardMuted,
   accStrong (0.35 hover voice), accOnModal with a legibility push loop.
   Sweep-asserted: modal text + accent-on-modal clear the 2.0 floor over
   BOTH gradient stops on every legal combo.
2. **ROOT_MAP grew 16 `--look-*` tokens** (card-bg/-text/-muted/-border,
   well, trim, accent-strong, modal-g1/-g2/-text2/-muted,
   accent-on-modal, scrim, band, header-ember, dots). New names — these
   surfaces have no theme.css legacy to reuse. Pages own geometry
   (gradients compose in the page CSS); tokens carry complete colors only.
3. **factions.html rewired** — every fossil is now
   `var(--look-*, <original literal>)`. Old-gold hairlines ride live
   --gold-dim/--gold-mid. Switch-Off degrades to the hand-painted page —
   with ONE deliberate exception: **the drift fix**. The modal's text read
   var(--parchment)/var(--parchment2) — Parchment-era paint that
   Phantom's inverted semantics turned near-black-on-brown (the modal was
   quietly illegible live). Modal text now reads well-polarity tokens
   with the PAINTER'S cream literals (#f0e6ce / #e8d9b8) as fallbacks, so
   even Off is legible.
4. **smoke-factions-wash.mjs** — the page-side contract: parses ROOT_MAP
   out of look-derive.js itself (publisher's contract, never a local
   copy), asserts every --look-* read is published, every fallback is the
   painter's literal, zero orphan literals, drift gone.

## THE INCIDENT (post-deploy) — read this before the next wash page
Deploy went up and factions "broke": presets did nothing, most ink dots
floored ("too faint on Bone"), other pages fine. Root cause: **a dormant
per-page override** — profiles.appearance carried
`pageLooks.factions = {ink:'sumi', paper:'bone'}`, set sometime during v6
scope testing and INVISIBLE while factions' surfaces were fossils. The
wash connected the surfaces to the look system, which activated the
override: presets (base-look writes) were outranked by it, and the flyout
floors inks against the EFFECTIVE paper — Bone on factions vs Slate
everywhere else. Cleared the chip; all solid. Diagnostic path that
worked, in order: verify shipped bytes → fingerprint the live module in
M's console (`deriveLook(...).modalG1` — new returns rgb(40,29,27), old
returns undefined) → full interactive session-walk harness in jsdom
(green) → therefore state, not code → read the state.

## LESSONS PINNED (July 4, evening)
1. **Recon the saved state, not just the code.** Connecting dormant
   surfaces to a live system activates every latent override/key in
   profiles.appearance + localStorage. Before each wash page: check
   pageLooks for that page's key.
2. **Per-page overrides are silent locks.** They outrank presets and
   re-floor the ink row, with no UI saying why. Follow-up queued (map #1).
3. **Repo version constants are not deploy state.** SETTINGS_V 9 in the
   repo read as "v7 deployed"; it wasn't. Ask, or fingerprint live.
4. **Fingerprint modules by behavior, not shape.** `window.TokLook`
   prints identically old vs new; one derived value (modalG1) told the
   truth in ten seconds.
5. **Fossil fallbacks are the painter's literals** — except where the
   painter's tokens later flipped meaning under a theme (the drift): then
   fall back to the painter's RESOLVED colors, and say so in the smoke.

## KNOWN-AND-ACCEPTED / OPEN
- v7 character-badge.js deploy pending (see DEPLOY STATE).
- Remaining fossil pages: lore, npcs, world, compendium, index.
  **npcs: the corner allegiance color-fades are a KEEPER — derive them
  (accent-tint math), never flatten them.** M called them out by name.
- shards.html / sheet-v2.html still deliberately opted out (own visual
  languages).
- Repo hygiene: smoke-nav-cog-flyout.mjs still awaiting git rm; schema
  deltas for characters / saved_monsters / drawings still live-DB only.
- walk-live-session.mjs (the incident's interactive harness) was
  disposable and not shipped; the pattern (click every control, assert
  re-dress + zero throws) is worth rebuilding if a UI arc breaks live.

## THE MAP (revised July 4 evening)
1. **Override visibility in ◐** (small, mock first): when the current
   page carries a pageLooks override, lead the flyout with a banner —
   "Factions wears its own look — Sumi on Bone · Clear" — and toast the
   reason when a preset click lands on an overridden page. Lesson 8 from
   the morning (picks explain themselves at the moment of confusion),
   now with a live casualty to prove it.
2. **Deploy the v7 badge fix** (character-badge.js alone, or ride the
   next zip).
3. **Wash sweep, next page: lore** (then npcs → world → compendium →
   index). Per page: recon literals + CHECK pageLooks state first; the
   Sumi×Bone control case must keep reading as Phantom after each page;
   npcs preserves the allegiance fades as derivations.
4. **Combat panel consolidation** — old right panel's sections into the
   tabbed float. RULE ONE unchanged: read combat.html first, plan
   nothing from memory.
5. Threads + composer into the shelf panel (mock first; donor organs:
   docToFeedBody, the journal composer). Then Quill retirement after one
   real session writes through it.
6. Small standalones: medallion portraits rollout, rail alias wiring,
   badge growth, flyout polish.

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
