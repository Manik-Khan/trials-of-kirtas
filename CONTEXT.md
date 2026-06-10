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

---

## Key facts

- **Party characters** (source_key): Cosmere Runestar (`cosmere`), Caim, Líadan Luchóg (`liadan`), Vesperian Vale (`vesperian`). *Tyros Darkstar → Cosmere Runestar rename done; cleanup of `tyros.json` → `cosmere` file rename + removing the `KEY_FILE` alias is still a loose end.*
- **User → role/character:** `thebraveruby@gmail.com` → overseer + Vesperian; `hagakuredisc@gmail.com` → DM, no character; `ianakira@gmail.com` → Cosmere; `jayvanmidde@gmail.com` → Caim; `nazanroseaktas@gmail.com` → Líadan.
- **Initiative modifiers** live in `characters.js` as `CHARACTERS[key].combat.initiative` (e.g. Vesperian +4). NPC init mod = `Math.floor((statblock.dex − 10) / 2)`.
- **Chronicle** (`chronicle.html`) is its own system: Quill rich-text entries, organized by session with authors/tags/@mentions/images, saved via a **Netlify function that writes `chronicle.json` and commits it** (git-backed, no realtime, no Supabase).

---

## Deltas to run on the live DB (verify status)

- `schema_delta_in_combat.sql` — believed run (not in repo).
- `schema_delta_feed.sql` — the `feed` table + RLS + grants + realtime. Must precede the two below.
- **NEW — `schema_delta_chronicle_unify.sql`** — feed columns (`author_id` uuid default auth.uid(), `tags text[]`, `meta jsonb`, `edited_at`); replaces the staff-only mutate policies with "authors edit/delete their OWN chronicle-channel rows, never hidden ones; staff anything; combat rolls immutable for players"; creates the one-row `campaign` table (`current_session`) + RLS + grant + realtime.
- **NEW — `migrate_chronicle.sql`** — one-time import of the 11 `chronicle.json` entries (guarded against re-run via `meta.legacy_id`; aborts if already run). 'Tyros' entries migrate as Cosmere with `meta.legacy_author` preserving the original; `author_id` recovered live via `profiles.character_key` subqueries; DM rows stay `author_id null` (staff edit via `is_staff()` regardless). Also seeds `campaign.current_session = 2` from the JSON config.
- **Netlify env: add `SUPABASE_SERVICE_ROLE_KEY`** — the new export function needs it (`GITHUB_TOKEN` already exists).
- **Open question:** confirm whether the `disposition` column was ever actually run on the live DB (it's reconciled into `schema_v1.sql` and ensured by the in_combat delta, but the disposition *feature code* is unbuilt).

---

## Current state (done this session — pending M's commit/deploy + SQL runs)

**Phase 2 — chronicle unification + durability. All built; nothing run yet.**

**1. Always-on feed (`combat.html`).** The feed no longer dies with the encounter: `IS_STAFF`, `loadCampaign()`, `buildFeed()`, and `initFeedRealtime()` are hoisted above the manifest/encounter bail-outs, so the game log lives over the "No active encounter" screen too. The feed moved off the per-encounter channel onto its own `feed-live` channel with INSERT/UPDATE/DELETE handlers (edits and deletions from the chronicle page now land live) plus a `campaign` UPDATE listener. Every `feedInsert` is stamped with `session: CAMPAIGN.current_session`.

**2. Schema (`schema_delta_chronicle_unify.sql`).** See deltas section. Key RLS decision (locked with M): authors mutate their own chronicle rows; combat channel stays immutable for players (replay integrity); `hidden` remains staff-only end to end (players can't insert, edit, or flip it).

**3. Migration (`migrate_chronicle.sql`).** Generated from the live JSON. Original entry ids preserved in `meta.legacy_id` so the export round-trips them.

**4. `chronicle.html` repointed at Supabase.** Data layer swapped wholesale; Quill, mentions, tags, filters, and all rendering untouched via a `rowToEntry()` adapter (feed row → legacy entry shape, with `_rowId`/`_authorId` riding along for writes). Load = feed select (chronicle channel) + campaign select; submit = insert (author_id defaults to auth.uid() server-side) or update with `edited_at`; delete = targeted delete; session bump = campaign update. **The chronicle page is now realtime** (`chronicle-live` channel — new capability). Edit/Delete buttons render from `canEditEntry()` (RLS truth: staff or `author_id === ME.userId`), not the localStorage identity. Identity modal is role-gated: non-staff see only their own character (auto-claimed silently if no identity saved); staff pick anyone. Stale/foreign localStorage identities are dropped at boot. Boot wrapped in combat.html's `whenReady` pattern (`nav:ready` fires post-auth with `__tok.sb` set).

**5. Export backstop (`netlify/functions/feed-export.js` — new).** POST with the caller's bearer token; the function verifies staff via Supabase auth + profiles (service-role key), reads public chronicle rows only (**the repo is public — hidden rows never leave Supabase; dice rolls aren't exported by design**), rebuilds the legacy `chronicle.json` shape (legacy_id round-trip), and commits via the GitHub contents API. Skips the commit when content is unchanged. Triggered from a new staff "Export archive" button in the chronicle's session control. Plain fetch, no npm deps. The legacy `chronicle.js` function is retired from the page but left in the repo for rollback.

**Deploy order:** run `schema_delta_chronicle_unify.sql` → run `migrate_chronicle.sql` → add `SUPABASE_SERVICE_ROLE_KEY` to Netlify env → commit/deploy the code. The repo's `CONTEXT.md` was stale (older than the handoff doc); this file supersedes it.

---

## The big vision (agreed direction)

A **"Discord server within the site"**: one append-only event log, surfaced two ways — a compact **live hub on the combat map** and a full **"server" browser on the chronicle page** (all sessions/channels, searchable, eventually replayable). Organized by **session → encounter**, with combat rolls, chronicle narration, loot, and story all in one consolidated record. The capstone is a **chess-match-style replay**: re-watch a fight move-by-move (token positions, attacks, damage, HP), with loot linked to the fight it came from.

**Storage strategy (locked):** Supabase is the live/realtime source; the **git-committed JSON stays the durable backstop** (an export job preserves it). Rationale: dice rolls are a high-frequency firehose that must NOT be git-committed (would spam the repo + be slow); chronicle entries are low-frequency/durable and suit the file archive. Realtime inherently means a live-service dependency *for live play*; data-loss is neutralized by the export backup. Full unification of the chronicle onto Supabase is wanted, done in phases.

---

## Next steps (phased)

**Phase 2 cleanup (small, optional):**
- Scheduled export (Netlify scheduled function calling the same path) so the archive refreshes nightly without the button.
- Retire `netlify/functions/chronicle.js` once the unified store has survived a few sessions.

**Phase 3 — the replay capstone + compartments.**
- Log ordered combat **events** (moves, attacks, damage, conditions, turn advances) into the feed event log.
- Build a **replay scrubber** that steps through an encounter's events and reconstructs the board move-by-move.
- **Loot-to-fight linking**; story/loot compartments (the `kind` column already reserves `loot`/`image`/`event`).
- The chronicle-page **"server" browser** (all sessions/channels incl. combat rolls, searchable) — the second surface of the Discord-server vision; the combat-page hub is the first.

**Older pending items (still open):**
- **Disposition (friend/foe) code** in `combat.html` — column is reconciled/ensured; the friend/foe UI + defaults (reading `disposition` with a `side` fallback) are unbuilt. Confirm the live DB has the column first.
- **Roster / encounter picker** — the rest of original roadmap item #1. `startCombat()` currently seats the whole board; the picker is the seam to choose participants, plus an out-of-turn confirm modal.
- **Initiative-chip redesign** to the `npcs.html` flag-card style (portrait-filled cards, `feTurbulence` grain, bottom fade). Chips already use the burnt-grain zone + fade, so this may be partly done — decide if a further redesign is wanted.
- **Tyros → Cosmere file cleanup** (`tyros.json` rename + `KEY_FILE` alias removal in `characters.js`).

---

## Earlier history (background)

- **Built across prior sessions:** the full site from scratch — shared nav (`nav.js`), `theme.css` var system ("Phantom" theme: cream/off-white + heavy black ink + red accent; Cinzel / Barlow Condensed / EB Garamond), NPC/location tooltips, character sheet engine (`sheet.html`) with dice roller + HP tracker, compendium (5etools GitHub mirror), drag-and-drop inventory with nested containers + pack auto-explode (`items2.js` Netlify fn), world map (`world.html`) pan/zoom with pins, the battle HUD (`battle.js`), the NPC page (`npcs.html`, flag-card style), the chronicle page, the site-wide identity/auth layer (Supabase OTP, `nav.js` whoami, route protection, seat-defaulting on `sheet.html`).
- **Shared feed Phase 1 (prior session):** the "Game feed" hub on combat.html — Combat/Chronicle/All tabs, /roll parser (NdM, kh/kl, flat mods), Discord-style rows with PORTRAITS/TOKENS avatars + side-colored rings, quick-dice, staff hidden toggle, HUD rolls via the logRoll seam, DM "Roll all" posts NPC init summary hidden. Same session: in_combat flag + initRoster/turnOrder, combat lifecycle right-side controls (Display / View as player / Combat dropdown), stateful HUD init roll honoring Adv/Dis.
- **Combat page features (prior):** token movement w/ Chebyshev overlay, fog-of-war (feathered SVG mask, reveal/hide brush, client-side tier OK for trusted group), per-token conditions (8 badges, context menu), token size (Tiny–Gargantuan), shared drawing layer (AoE templates), live cursors (Realtime Broadcast/Presence; staff cursors hidden from players), tabbed role-aware context menu, bestiary/monster system (DM picker from the 5etools CDN mirror, `ac` + `statblock jsonb`, statblock slide panel lifted from `compendium.html`, monster token art w/ letter-disc fallback), HP bridge between HUD and `combatants` (verified end-to-end).
- **Bardic Console:** React/JSX, Web Audio API, Cloudinary-hosted audio (migrated from Dropbox), mood pads, fader link groups, scene saving, Sonus Portals (YouTube IFrame API).
- **Other:** "The Apothecary's Craft" potion-crafting reframed as a ledger/reference. Began planning modernization of a large Indian classical music archive (currently FileMaker Pro) → Python/PostgreSQL local web server, raga-centric hierarchy, cross-raga linking, multi-user.

---

*Last updated: end of the session that shipped Phase 2 — chronicle unification (schema delta + migration, chronicle.html repointed at Supabase with realtime, always-on feed channel, session stamping, feed-export archive function + staff button). Pending: M runs the two SQL files, adds SUPABASE_SERVICE_ROLE_KEY to Netlify, commits/deploys. Phase 1 (in_combat, lifecycle controls, HUD init roll, the feed hub) shipped the session before and is summarized under Earlier history.*
