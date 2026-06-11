# Trials of Kirtas — Context & Handoff

A working context doc for **M** (developer / DM / musician) and **C** (Claude, technical collaborator). Hand this to a fresh session to continue without re-explaining.

---

## Who / what

**Project:** *Trials of Kirtas* — a D&D 5e virtual tabletop. Stack: vanilla JS/HTML/CSS, Supabase (Postgres + Realtime), Netlify (incl. serverless functions), GitHub. M commits and deploys **manually**; C reads the codebase, proposes plans for approval, and writes incremental changes.

**M (personal):** sarod player in the Hindustani classical tradition (Maihar gharana), involved in preservation/transmission and archival work. Keeps a deep Obsidian vault ("The Codex"). Cares about thoughtful tool design. *Do not make confident assertions about Indian classical music terminology without appropriate uncertainty.*

---

## How C works on this project (working rules — carry forward)

- **Read the actual source from the repo before editing** anything. Clone/pull `main` first.
- **`node --check` before presenting** any JS/HTML (for HTML, extract the inline `<script>` and check it).
- **Never commit or push.** C hands files over; M commits and deploys manually.
- **Ask and get explicit approval before writing feature code.** Lock the design first.
- **Show a mockup before building any layout decision.**
- **Never change a theme var to fix a per-page problem** — hardcode page-specific overrides on the page itself. Reuse existing theme vars for *new* UI.
- **Any Supabase table created via raw SQL needs an explicit `GRANT`.** House style is `grant ... to authenticated` (an older note said `anon, authenticated` — the live tables only grant `authenticated`; match the live tables).
- **Realtime checklist:** table in the `supabase_realtime` publication + socket authenticated via `setAuth` (re-applied on token rotation) + `replica identity full`.
- **"nothing to commit" is a red flag** that a file never actually changed, not a success.
- Don't reverse a correct earlier refusal/decision under pressure; judge cumulative output.

---

## Architecture (locked)

- **Three-role model:** `overseer` / `dm` / `player`, enforced via Supabase RLS + a column-guard trigger (`combatants_guard_columns`) and `public.is_staff()`.
- **`combatants` table is truth during combat**, with `source_key` binding to character data. Column guard pins staff-only fields from players (owner, name, side, hidden, max_hp, **disposition**, **in_combat**); players may change hp, conditions, x, y, **initiative**.
- **`combat.html`** is the dedicated live battle-map page.
- **`battle.js`** is the cross-page HUD; it's backend-agnostic and shares state through a **pluggable backend seam** (`window.__battle.useBackend({...})`). `combat.html` hands it a Supabase `combatants`-backed backend (`load`, `save`, `saveConditions`, `setInitiative`, `advanceTurn`, `logRoll`, `subscribe`). The turn/round bridge (`setTurn`/`advanceTurn`/`pushTurnToHud`/`activeSourceKey`) is on `main`.
- **One active encounter at a time** (`encounters`, uuid PK).
- **Right dock on `combat.html`:** every right-side surface is a registered pane on a slim icon rail (`buildDock`/`dockRegister`/`dockOpen`) — Feed (all), Display, Bestiary, Combat (staff). View-as-player is a rail toggle, not a pane. Minimized = rail only. Statblock stays a slide-out at `right:44px` with a visibility gate (its closed `translateX(100%)` state would otherwise park over the rail and eat clicks — that bug shipped once; don't reintroduce).
- **Roll-modifier seam (battle.js, public):** `RS` state (adv/dis/bless/guidance) drives all HUD rolls; `window.__battle.toggleRS(key)` / `getRS()` / `onRSChange(cb)` let a page host its own toggle surface. On `combat.html` the feed's mods row IS that surface and the roller popup is hidden (page-specific CSS); every other page keeps the roller.
- **Cross-page roll logging:** `feed-bridge.js` (loaded after `battle.js` on all 8 non-combat pages) sets `window.__battle.onLogRoll`, the fallback battle.js uses when the backend lacks `logRoll`. It posts HUD rolls to the feed with session + active-encounter stamps (30s-TTL context cache). `combat.html` never loads it; its full backend wins regardless.

---

## Key facts

- **Party characters** (source_key): Cosmere Runestar (`cosmere`), Caim, Líadan Luchóg (`liadan`), Vesperian Vale (`vesperian`). *Tyros → Cosmere rename is FULLY complete (verified in-repo): `data/characters/cosmere.json` exists, the `KEY_FILE` alias was removed 2026-06-01. Remaining "tyros" mentions are deliberate or inert — chronicle.html's legacy portrait mapping (old entries authored as Tyros resolve to the cosmere portrait — keep), historical archive data in `chronicle.json`, and the dead `sheet-prototype.html` (delete-someday candidate, M's call).*
- **User → role/character:** `thebraveruby@gmail.com` → overseer + Vesperian; `hagakuredisc@gmail.com` → DM, no character; `ianakira@gmail.com` → Cosmere; `jayvanmidde@gmail.com` → Caim; `nazanroseaktas@gmail.com` → Líadan.
- **Initiative modifiers** live in `characters.js` as `CHARACTERS[key].combat.initiative` (e.g. Vesperian +4). NPC init mod = `Math.floor((statblock.dex − 10) / 2)`.
- **Chronicle** (`chronicle.html`) is the **server browser** (Phase 3A): a Discord-style channel tree (sessions → #chronicle / ⚔ per-encounter / 🎲 table-talk, plus staff-pinned TAG channels), the original long-form reading view as the default "All Entries" landing, paginated combat channels with round dividers + encounter banner, server-side cross-channel search, and staff drag-ordered channels — all over the unified Supabase feed. Quill entries/authors/tags/@mentions/images unchanged. The git-committed `chronicle.json` remains the durable export backstop (nightly + button).

---

## Live DB / env state

- `schema_delta_feed.sql`, `schema_delta_chronicle_unify.sql`, and `migrate_chronicle.sql` are **run and verified live** (feed streams, migrated chronicle entries with images render in the combat feed).
- `SUPABASE_SERVICE_ROLE_KEY` should be in Netlify env — **verify the Export archive button has been pressed once successfully** (round-trips `chronicle.json` through the feed-export function).
- **Open question (still):** confirm the `disposition` column exists on the live DB before building the disposition feature code.


## Current state (Phase 3A: chronicle server browser — BUILT, awaiting deploy + verification)

This session built the **chronicle-page server browser** (design locked via interactive mockup, M approved). Files changed: **`schema_delta_campaign_config.sql`** (new), **`feed-render.js`** (new), **`combat.html`** (extraction only), **`chronicle.html`** (the feature). Deploy markers: `FEED-RENDER-V1` (feed-render.js), `SERVER-BROWSER-V1` (chronicle.html).

**1. `feed-render.js` extraction** — the Discord-style feed row renderer (escapeHtml/stripTags/side/nameColor/time/avatarHtml/rowHtml) was lifted out of combat.html into a shared module both pages load. The module **owns the feed avatar art** (single source of truth for the feed look); combat.html's `PORTRAITS`/`TOKENS` remain authoritative for **map tokens** — a separate concern. combat.html keeps `escapeHtml`/`stripTags` as hoisted thin wrappers (used in 31 places) and `renderFeed` uses `FR.rowHtml`. Pages provide the CSS (`feed-row` family); chronicle carries a copy scoped under `#sv-combat`.

**2. Channel tree** (chronicle sidebar, replaces the flat session list): 📖 All Entries (the untouched original reading view, default landing) → TAGS category (staff-pinned tags as channels, e.g. `#loot`) → session categories (collapsible; newest seeded open) each holding `#chronicle`, one `⚔ <encounter-slug>` channel per encounter with feed rows, and `🎲 table-talk` (combat rolls with no encounter_id, via feed-bridge). Counts exclude `kind:'event'`. Built from a **lightweight feed index** (`select id,session,encounter_id,channel,kind,hidden,created_at` — no bodies; cheap at thousands of rows) + an `encounters` fetch for names. Authors/Tags filters + staff session controls unchanged below.

**3. Combat channel pane** — encounter banner (name, date, rounds from `encounters.round`; staff additionally sees combatant count from the hidden `combat_start` snapshot — RLS keeps that staff-only by itself), **ROUND N dividers** woven from visible `turn` events (players get them too: turn events are hidden:false), paginated newest-100 with "↑ LOAD OLDER" (cursor `.lt('created_at', oldest)`, anchor-scroll preserved), hover-✕ delete mirroring RLS, feed images → the chronicle's lightbox. ▶ REPLAY button stubbed disabled — Phase 3B plugs in there.

**4. Server-side search** — debounced 300ms, `ilike` on body (`%`/`_` escaped), events excluded, 50-hit cap, stale-response guard. Scope pills: ALL CHANNELS / THIS CHANNEL (current combat channel, or current session's chronicle, or all chronicle). Hits show session/channel/date + highlighted snippet; clicking a chronicle hit opens that session's entries, a combat hit opens the channel and scroll-highlights the row if it's in the loaded page (deeper rows: channel opens at newest — accepted v1 simplification). The old client-side entry search is superseded; `activeFilters.search` machinery left dormant/harmless.

**5. Shared config (`campaign.config jsonb`, new delta)** — `{ channelOrder: {session: [ids]}, pinnedTags: [] }`. Staff-only by the existing campaign update policy; streams live via the existing campaign realtime membership. **Staff drag-reorders channels** within a session (⋮⋮ grips, HTML5 DnD; non-staff never see grips); unordered channels keep the chronological default (chronicle, encounters by start, table-talk). **Staff pins/unpins tags** via 📌/📍 toggles on the sidebar tag list. `bumpSessionTo` writes only `current_session` so config never clobbers (and vice versa).

**6. Realtime extensions** (same `chronicle-live` channel): combat-channel feed INSERTs update the index/counts and append live to an open channel (events feed the dividers); feed DELETEs prune index + open channel; `encounters` INSERT/UPDATE refresh channel names/rounds live; campaign UPDATE now also syncs `config` (pin/reorder propagate to everyone).

**Verified:** `node --check` on all JS (inline extracted), FeedRender smoke tests (party/DM/enemy/hidden rows, escaping), channel-ordering unit tests (default chronology, config override, event-excluded counts, slugs), round-divider weave test. **NOT yet verified live** — see deploy checklist in Next steps.

### Previous round (roster picker + events + nightly export — all shipped & verified)

Phase 2 (chronicle unification) is **live and verified**, the combat-page UX round before that too (right dock, dice tray, feed roll-modifier row, feed-bridge.js, feed delete + lightbox — details below). The latest session shipped, deployed, and **M verified working**:

**1. The roster/encounter picker** — the Combat dock pane is now the roster. Out of combat: Party/Others groups with all·none links, everyone checked by default; `PICK_OFF` (a Set of DESELECTED ids, page-local) means new bestiary drops default to checked and the bench persists across fights. Two start modes (locked design): **Start — players roll** (NPCs auto-roll, PCs pend for the one HUD prompt) and **Start — auto-roll everyone** (no prompts; also posts a public party-init feed summary mirroring the hidden NPC one). During combat the same pane shows the fight in initiative order plus an "on the board — check to join" bench: **only the checkbox** seats/unseats (a name click selects the token — anti-misclick); mid-fight joins roll NPCs instantly / seat PCs pending without touching round or turn; unseating the active combatant advances the turn first (note: if they were last in the order, the round ticks via advanceTurn's wrap — accepted side effect). `startCombat(mode)` + `seatOne`/`unseatOne` are the new lifecycle verbs. **`rollAllInitiative` is now seated-only** (re-seating the whole board would undo the picker) — strip + pane both.

**2. Off-turn End Turn confirm (battle.js)** — the hard block is now a `b-modal-box` confirm ("It's **X**'s turn — advance the shared tracker anyway?"; generic wording when the tracker is on an NPC/null). Confirming calls `backend.advanceTurn()` directly, deliberately skipping the own-economy modal. `confirmOffTurn`/`cancelOffTurn` on the public API.

**3. Phase 3 event logging is LIVE** — `kind:'event'` rows, zero schema changes (the check constraint and `result jsonb` were built for this). Conventions: `result` = machine payload `{type, ...}`, `body` = human line, actor = `System`, session + encounter stamped by `feedInsert`. Events: `combat_start`/`combat_end` (full roster snapshots — the replay's opening/closing positions; **hidden:true**, they can contain unrevealed foes), `turn` (public, hidden-foe names mask to `???` in the body — players trigger this via HUD End Turn so the row must be hidden:false under RLS), `move` (in-combat only; hidden foes → hidden:true, always staff-initiated), `hp` (HUD save seam — the only HP write surface today; future NPC HP tools should call `logEvent` the same way), `condition` (full-array snapshots, not deltas — scrub-friendly), `initiative`, `join`/`leave`. The feed UI **skips** events (load query `.neq('kind','event')` + `onFeedInsert` early-return; no unread-dot spam) — recorded, not displayed. Player-visible replay will need hidden snapshot rows handled staff-side (players never receive them under RLS — correct for live play).

**4. Nightly scheduled export** — `netlify/functions/feed-export-nightly.js`, `exports.config = { schedule: '0 10 * * *' }` (≈4am Mountain). The export core was factored into `netlify/functions/lib/export-core.js`, shared by the button (`feed-export.js`, HTTP contract unchanged: CORS/POST/staff-gate/response shapes) and the schedule — no drift. Scheduled fns aren't HTTP-routable, so the nightly path has no auth gate by design. The `unchanged` short-circuit means quiet nights commit nothing. Nightly covers the **chronicle channel only** — `kind:'event'` replay rows stay Supabase-only like dice rolls (a replay-data backstop would be a separate private artifact; repo is public).

**Known minor:** the roster pane fully repaints on every `renderInitStrip` (scroll position resets each turn advance) — fine at party scale, make repaints targeted if fights get huge.

### Previous round (combat-page UX, all live)

**1. Right dock** (see Architecture). Feed opens by default; unread dot on 💬 when rolls land while minimized; entering player view hides staff icons and falls back to the feed pane. Combat dropdown became proper pane buttons. Zoom bar moved to `right:56px` to clear the rail; dock panel stops 88px short of the bottom to clear the HUD.

**2. Dice tray** on the left tool rail: ⚄ expands a 1–8 count row + d4–d100. Count persists per die, resets to 1 on die switch. Tray + feed quick dice route through `feedRollWithMods`.

**3. Roll modifiers moved into the feed.** ADV/DIS/BLESS/GUIDE row in the feed drives battle.js `RS` via the seam — one state for HUD attacks/init AND feed button dice. d20s only; adv/dis applies to single-d20 rolls (`2d20kh1/kl1`, dropped die dimmed); bless 🙏 / guidance ✦ append annotated d4s; stored `formula` carries the `+1d4`s. **Typed `/roll` stays verbatim** (deliberate deviation — flagged and accepted). Roller popup hidden on combat page only; toast parked at `left:476px` beside the HUD.

**4. Cross-page rolls** via `feed-bridge.js` (see Architecture) — roll from sheet/world/etc. and it lands in the live feed.

**5. Feed curation + images.** Hover ✕ delete per row (renders only where RLS will allow it: staff anything; authors own non-hidden chronicle rows; combat rolls immutable for players). Realtime DELETE propagates. Chronicle images in the feed constrained (max-height 120px, `!important` to beat Quill inline widths) with the chronicle's exact lightbox.

**Fixes:** feed scroll trap (`.feed-wrap` missing from the wheel-exemption list), wheel zoom 1.1 → 1.07 (~30% gentler; pinch + buttons untouched), statblock visibility gate (the dock-rail click-eating bug).


## The big vision (agreed direction)

A **"Discord server within the site"**: one append-only event log, surfaced two ways — a compact **live hub on the combat map** and a full **"server" browser on the chronicle page** (all sessions/channels, searchable, eventually replayable). Organized by **session → encounter**, with combat rolls, chronicle narration, loot, and story all in one consolidated record. The capstone is a **chess-match-style replay**: re-watch a fight move-by-move (token positions, attacks, damage, HP), with loot linked to the fight it came from.

**Storage strategy (locked):** Supabase is the live/realtime source; the **git-committed JSON stays the durable backstop** (an export job preserves it). Rationale: dice rolls are a high-frequency firehose that must NOT be git-committed (would spam the repo + be slow); chronicle entries are low-frequency/durable and suit the file archive. Realtime inherently means a live-service dependency *for live play*; data-loss is neutralized by the export backup. Full unification of the chronicle onto Supabase is wanted, done in phases.

---

## Next steps (phased)

**Server browser (3A): BUILT — deploy + verify next.** Deploy checklist:
1. Run `schema_delta_campaign_config.sql` in the Supabase SQL editor (idempotent).
2. Commit + deploy `feed-render.js` (new), `combat.html`, `chronicle.html`.
3. Verify deployed files contain markers: `FEED-RENDER-V1` (feed-render.js, and the comment referencing it in combat.html), `SERVER-BROWSER-V1` (chronicle.html).
4. Smoke: combat.html feed still renders rolls identically (extraction regression check); chronicle shows the channel tree; open an encounter channel (rows + dividers + banner); search from both scopes; staff: pin a tag, drag-reorder a session's channels, confirm a second browser sees both live.

**Then Phase 3B: the replay scrubber** (M's chosen order: A → B → cleanup). Consumes `kind:'event'` rows + the `combat_start` snapshot; the disabled ▶ REPLAY button on the encounter banner is its mount point. The more fights run before building, the more test data.

**Then cleanup:** retire `netlify/functions/chronicle.js` after a few stable sessions; optionally delete the dead `sheet-prototype.html`; `mockup-server-browser.html` (this session's approved mockup) can be deleted from the repo or kept as a design record — M's call.

**`#quests` page** — M flagged it: pinned-tag channels proved the idea; quests graduate to a dedicated page later.

**Phase 2 cleanup (small, whenever):** verify post-deploy that the Functions tab shows `feed-export-nightly` with the schedule badge and that one manual test-run logs success (requires `SUPABASE_SERVICE_ROLE_KEY` in Netlify env).

**Older pending items:** disposition (friend/foe) feature code (confirm the live `disposition` column first); initiative-chip flag-card redesign (maybe partly done — decide); possible nice-to-have: plain-text editing of chat messages from the combat feed panel (full editing lives on chronicle.html).


## Earlier history (background)

- **Built across prior sessions:** the full site from scratch — shared nav (`nav.js`), `theme.css` var system ("Phantom" theme: cream/off-white + heavy black ink + red accent; Cinzel / Barlow Condensed / EB Garamond), NPC/location tooltips, character sheet engine (`sheet.html`) with dice roller + HP tracker, compendium (5etools GitHub mirror), drag-and-drop inventory with nested containers + pack auto-explode (`items2.js` Netlify fn), world map (`world.html`) pan/zoom with pins, the battle HUD (`battle.js`), the NPC page (`npcs.html`, flag-card style), the chronicle page, the site-wide identity/auth layer (Supabase OTP, `nav.js` whoami, route protection, seat-defaulting on `sheet.html`).
- **Shared feed Phase 1 (prior session):** the "Game feed" hub on combat.html — Combat/Chronicle/All tabs, /roll parser (NdM, kh/kl, flat mods), Discord-style rows with PORTRAITS/TOKENS avatars + side-colored rings, quick-dice, staff hidden toggle, HUD rolls via the logRoll seam, DM "Roll all" posts NPC init summary hidden. Same session: in_combat flag + initRoster/turnOrder, combat lifecycle right-side controls (Display / View as player / Combat dropdown), stateful HUD init roll honoring Adv/Dis.
- **Combat page features (prior):** token movement w/ Chebyshev overlay, fog-of-war (feathered SVG mask, reveal/hide brush, client-side tier OK for trusted group), per-token conditions (8 badges, context menu), token size (Tiny–Gargantuan), shared drawing layer (AoE templates), live cursors (Realtime Broadcast/Presence; staff cursors hidden from players), tabbed role-aware context menu, bestiary/monster system (DM picker from the 5etools CDN mirror, `ac` + `statblock jsonb`, statblock slide panel lifted from `compendium.html`, monster token art w/ letter-disc fallback), HP bridge between HUD and `combatants` (verified end-to-end).
- **Bardic Console:** React/JSX, Web Audio API, Cloudinary-hosted audio (migrated from Dropbox), mood pads, fader link groups, scene saving, Sonus Portals (YouTube IFrame API).
- **Other:** "The Apothecary's Craft" potion-crafting reframed as a ledger/reference. Began planning modernization of a large Indian classical music archive (currently FileMaker Pro) → Python/PostgreSQL local web server, raga-centric hierarchy, cross-raga linking, multi-user.

---

*Last updated: end of the session that built Phase 3A — the chronicle server browser (channel tree, per-encounter combat channels with round dividers + pagination, pinned tag channels, server-side cross-channel search, staff drag-order + tag pinning via the new `campaign.config`, and the `feed-render.js` extraction shared with combat.html). Awaiting deploy + live verification (checklist in Next steps). Then Phase 3B: the replay scrubber.*
