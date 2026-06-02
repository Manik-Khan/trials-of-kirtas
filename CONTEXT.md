# Trials of Kirtas — CONTEXT

State-carrying doc for picking up in a fresh conversation. Last updated end of the **identity-wiring session (2026-06-01)** — identity layer now COMPLETE (all 5 accounts seeded + verified), client now reads identity (`window.__tok`), seat-defaulting + My Character menu live, and a mobile battle-mode regression fixed.

> **Correction (2026-05-31 session):** a previous version of this doc described a "pending bundle" of files as built-but-not-committed. That was stale — a check against GitHub `main` confirmed the whole bundle is already live. Don't trust "pending/uncommitted" claims without checking `main` first.
>
> **Lesson (2026-06-01 session):** nearly mis-fixed a "battle mode vanished on mobile" report by reasoning from one file (`nav.js`) instead of checking the actual mechanism in `battle.js`. Root cause was elsewhere. Reinforces rule #4 — check source / git history before claiming cause or applying a fix. `git clone` + `git blame`/`git log -S` is the rigorous way to answer "did this change / when / why."

---

## Working rules (read first)

These have been violated in past sessions. Stay vigilant:

1. **Ask, don't assume.** When a choice or detail is ambiguous, ask rather than guessing. Asking a question is not the same as getting a "yes" — wait for the actual go-ahead before writing/editing.
2. **Simplest solution first.** Don't reach for the heavier option when a one-liner does it.
3. **Don't touch unrelated code.** Edits stay scoped to the task at hand.
4. **Flag uncertainty explicitly.** Say what you're sure of vs. guessing, especially for things that can't be verified from source (live site behavior, deploy state). When diagnosing a regression, check the actual mechanism + git history before naming a cause.

Also: canonical source is the GitHub repo (`main`), not the live Netlify site. Don't scrape the live site. Pull from GitHub or work from uploaded files. "C" is the nickname for Claude. Approval-gate design decisions before implementation; prefer direct recommendations with honest tradeoffs.

---

## What changed this session (2026-06-01)

1. **Identity layer COMPLETE.** All five accounts created in Supabase Auth and seeded into `profiles`; verified with a join query. The four party characters are all claimed.
2. **Role mapping clarified (differs from earlier doc assumptions):** the owner also *plays* a character, and there's a **dedicated DM account** separate from the owner. Both fit the existing schema with no changes (role and character_key are independent columns).
3. **whoami helper (4a)** added to `nav.js` — exposes the signed-in user's identity as `window.__tok` for all pages. Non-blocking; veil timing unchanged.
4. **Seat-defaulting (4b, partial)** added to `sheet.html` — a bare `sheet.html` (no `?character=`) redirects you to your own character.
5. **`nav:ready` event** added to `nav.js` — a one-line lifecycle signal that nav-dependent scripts wait on (fixes a mobile battle regression, and powers the My Character menu).
6. **Battle-mode mobile regression FIXED** — the auth gate had made the nav mount async, which broke `battle.js`'s mobile injection. Now boots on `nav:ready`.
7. **My Character menu** added to `nav.js` — a caret on the Party nav item opens a dropdown to your own sheet.
8. **Edit-gating DEFERRED** to a future sheet redesign (see Open steps).
9. **Character-key migration FINALIZED** — found + fixed a live bug: the homepage wheel's Cosmere slice still pointed at the dead `?character=tyros` (→ "Character Not Found"); corrected to `cosmere`. Also removed the `KEY_FILE` alias in `character.js` and renamed the data file `tyros.json` → `cosmere.json`. No `tyros` references remain in the live path.

---

## Project at a glance

- **Repo:** https://github.com/Manik-Khan/trials-of-kirtas
- **Live:** https://trials-of-kirtas.netlify.app
- **Stack:** vanilla JS/HTML/CSS, no build step. Netlify hosting, GitHub-backed persistence via Netlify functions (chronicle + character data). Supabase for live, identity-scoped state (auth + identity now; combat state next).
- **Party (4 characters):** Cosmere Runestar (key `cosmere`), Caim (`caim`), Líadan Luchóg (`liadan`), Vesperian Vale (`vesperian`).

### Architecture split (decided 2026-05-31) — IMPORTANT
- **Durable character data** (sheets, inventory, abilities, max HP) → **GitHub/Netlify** (`character-store.js` → `character.js` function). Doesn't change mid-fight; versioned; durable. System of record.
- **Live combat state** (current HP, conditions, initiative, token position, fog) → **Supabase** combatant rows. Changes second-to-second, must be visible live, RLS-controlled. System of engagement.
- **Sync point:** at the end of a fight, flush combat result → GitHub (durable record). Sheet holds "resting" HP; combatant row holds "in-fight" HP.

---

## Identity layer — COMPLETE + VERIFIED (2026-06-01)

All five accounts are in Supabase Auth and seeded into `profiles`. Verified via:
```sql
select p.role, p.character_key, u.email
from public.profiles p join auth.users u on u.id = p.user_id
order by p.role nulls last, p.character_key;
```

**Role mapping (the source of truth for who is who):**

| Email | role | character_key | Character |
|---|---|---|---|
| `thebraveruby@gmail.com` | `overseer` | `vesperian` | Vesperian Vale — **owner also plays a character** |
| `hagakuredisc@gmail.com` | `dm` | (null) | dedicated DM, plays no character |
| `ianakira@gmail.com` | `player` | `cosmere` | Cosmere Runestar |
| `jayvanmidde@gmail.com` | `player` | `caim` | Caim |
| `nazanroseaktas@gmail.com` | `player` | `liadan` | Líadan Luchóg |

**Two things that differ from earlier doc assumptions (both fine, no schema change):**
- The **owner (overseer) also plays Vesperian** — `role` and `character_key` are independent columns, so `overseer` + a character_key is valid. The one-per-character unique index is satisfied (only this profile holds `vesperian`).
- There's a **separate `dm` account** (`hagakuredisc`), where earlier text implied the owner was the DM. `dm` role, null character_key.

**Account creation note:** accounts were created via Authentication → Users → **Create new user** (NOT "Send invitation" — invites push a set-a-password flow we don't use). The password field is a throwaway; login is passwordless (email → 8-digit OTP). "Auto Confirm User" ticked so they can request an OTP immediately. The seed SQL matches users by email and is idempotent (`on conflict … do update`); a non-matching email silently inserts zero rows (verify query catches it).

---

## whoami / identity exposure (4a) — DONE (2026-06-01), in `nav.js`

`nav.js` already authenticated on every page (the session gate); 4a reuses that session to expose identity. Right after the session check, it kicks off a **background** profile lookup and hangs the result on a global. The veil still drops the instant the session is confirmed — the profile fetch does NOT gate it — so load time is unchanged.

```js
const me = await window.__tok.ready;   // { userId, email, role, characterKey } | null
```
- `window.__tok.session` — the raw Supabase session.
- `window.__tok.ready` — promise → profile object, or `null`. **Never rejects** (so consumers can always `await` without try/catch).
- `window.__tok.profile` — `undefined` until ready resolves, then object|null.
- profile shape: `{ userId, email, role, characterKey }`; role ∈ overseer|dm|player; characterKey ∈ 4 keys | null.
- `null` profile = authenticated-but-no-profiles-row OR lookup failed. 4a deliberately does NOT distinguish these — consumers decide.
- No second Supabase client, no extra `getSession` — reuses nav's.

**Console check:** on a gated page, `await window.__tok.ready` returns your profile. (Note: `const me = await …` returns `undefined` in the console — that's the declaration's value, a console quirk, not the data. Use `me` or the bare expression.)

---

## Seat-defaulting (4b, partial) — DONE (2026-06-01), in `sheet.html`

If `sheet.html` is opened with **no `?character=`**, it redirects to the viewer's own seat once identity resolves: players → their character, overseer → Vesperian, DM (null key) → the `cosmere` fallback. Redirects *before* render (no flash of the wrong sheet; the `#loading` state covers the brief wait), polling briefly for `window.__tok` then halting via `throw` (same idiom as the existing `characters.js`-missing guard). **Role-agnostic** — it keys off `characterKey`, not role.

Every in-app link already carries `?character=`, so this fires only on a bare/typed/bookmarked URL. The **My Character menu** (below) is its proper front-door inside the nav.

---

## nav:ready lifecycle signal — DONE (2026-06-01), in `nav.js`

`mountNav()` dispatches `document.dispatchEvent(new CustomEvent('nav:ready'))` at the end (on both DOM mount paths). **Why:** the session gate makes the nav mount *async* (after `await getSession()`), so `#site-nav`/`#theme-dropdown` don't exist at `DOMContentLoaded`. Any script that depends on the nav must wait for this signal instead. Consumers: `battle.js` (mobile injection) and the My Character menu. Reusable for any future nav-dependent widget.

---

## Battle mode — mechanism + the 2026-06-01 mobile fix

**How battle mode is launched (important — easy to misread):**
- **Desktop (>600px):** a small ⚔ `#battle-btn` in the nav (left of the ◐ theme button), with an inline `onclick`. Rendered by `nav.js`.
- **Mobile (≤600px):** the ⚔ button is **intentionally hidden** by a media rule (`#battle-btn { display:none }`). Instead, `battle.js` **prepends a "Battle" section into the existing ◐ theme dropdown** (`#theme-dropdown`). So on a phone, battle mode lives *inside the theme menu*. Do NOT "fix" the hidden ⚔ button on mobile — that rule is correct.

**The regression + fix:** `battle.js` ran its injection at `DOMContentLoaded`, but after the auth gate landed (2026-05-31), the nav (and `#theme-dropdown`) mounts later, async — so the injection found no dropdown and bailed. The mobile battle section silently disappeared. **Fixed** by booting `battle.js` on `nav:ready` instead, with a one-time guard (`init()` binds a `CharacterStore` subscription + resize listener that must not double-fire). Desktop was unaffected (the ⚔ uses an inline onclick).

**Coupled commit:** the fix spans `nav.js` (dispatches `nav:ready`) + `battle.js` (listens). Commit together.

---

## My Character menu — DONE (2026-06-01), in `nav.js`

Per the agreed design: the **Party** nav item stays a link to `party.html` (the full hub). A small **caret (▾)** next to it opens a "Your Character" dropdown with one row → `sheet.html?character=<yourKey>`, showing the character's full name. Structured to grow into a multi-row personal hub later (when players have >1 character) with no rework.

- **DM-aware:** the caret only renders for users *with* a `character_key` (players + the overseer-as-Vesperian). The DM never sees it.
- **Identity-driven:** `populateCharMenu()` fills the menu + reveals the caret once `window.__tok.ready` resolves (so the caret pops in a beat after first paint — known, minor).
- **Mobile-safe positioning:** on phones, `.nav-links` is a horizontally-scrolling, mask-faded row that would *clip* a normal absolute dropdown. So the menu is `position: fixed`, JS-placed under the caret on open, and closes on any scroll (so it can't drift) or outside tap — mirroring the theme dropdown otherwise.
- **Caret tap target:** glyph stays visually subtle but has a generous invisible hit area (~36px, 40px on mobile) so it's easy to thumb.

---

## Permissions model — RESOLVED (2026-05-31), with 2026-06-01 notes

Three concepts, kept separate:
- **Authority (who CAN do what)** — global roles on `profiles.role`: **`overseer`** (owner/admin — full DB visibility; ONLY role that can assign roles), **`dm`** (runs combat, sees all + fog), **`player`** (one character; sees only non-hidden tokens + their own).
- **Perspective (what you're LOOKING AT)** — a planned **client-side "view-as" switch** for overseer + dm to flip between DM view and a player view. NOT a permission, no schema. Players don't get it. (Not built yet; belongs with the combat page.)
- **Login → identity** — each login maps to one `profiles` row (role + character_key). A player logs in "as their character": defaults into that character's seat; party still visible.

**Edit permissions for v1 (2026-06-01 decision):** "edit your own sheet; staff (overseer/dm) edit anyone." The "more knowledgeable player helps another" case is covered for v1 by routing through staff (who already have edit-anyone power). **Honest caveat:** all sheet edit-gating is **client-side UX, NOT server-enforced** — `character.js` writes to GitHub with a repo token and can't tell who's calling. Real per-user write security would mean teaching the Netlify function to verify identity (a bigger lift). Fine for four friends + a DM; revisit only if it bites. A finer-grained player-helps-player permission is cheap to add later precisely *because* gating is client-side.

---

## Route protection + auth-gate spinner — DONE, DEPLOYED + TESTED (2026-05-31)

Supabase session gate in `nav.js` (loads on every page → every page gated). Live + tested: logged-in browser on `login.html` bounces to `index` ✓; fresh browser deep-linking a protected page is kicked to `login` ✓; no redirect loop ✓. Themed full-screen "veil" + spinner covers content during the async check, fades on success, stays up on redirect; wrapped in try/catch that **fails closed** (redirect to login if the client can't load). Three Supabase constants scoped inside the IIFE so they can't collide with future pages' constants. (`nav.js` now also carries 4a whoami, `nav:ready`, and the My Character menu — all stacked on this.)

---

## Character key — RESOLVED (2026-05-31) + MIGRATION FINALIZED (2026-06-01)

Canonical key is **`cosmere`** everywhere (`characters.js`, `nav.js`, `sheet.html`, `world.html`, `character.js`, `chronicle.html`, and now `index.html`).

**Finalized 2026-06-01 (commit these together):**
- `index.html` — the homepage wheel's Cosmere slice was still `?character=tyros` (a dead key → "Character Not Found"); fixed to `?character=cosmere`.
- `character.js` — `KEY_FILE` alias removed (now `{}`), so `cosmere` reads/writes `cosmere.json`.
- Data file **renamed** `data/characters/tyros.json` → `data/characters/cosmere.json` (via GitHub; internal `"key"` field set to `cosmere`). **Coupled with the `character.js` change** — if the file is renamed while the alias still says `cosmere→tyros`, Cosmere's sheet loads blank/default and writes split. Safe order: land `character.js` (`KEY_FILE={}`) + `cosmere.json` together, then delete the old `tyros.json`.

**Intentionally left as-is** (not part of the migration): the `// end tyros` comment in `characters.js`; the chronicle back-compat shim in `chronicle.html` (maps old `tyros` chronicle entries → `cosmere` — by design); `"author": "Tyros"` in `chronicle.json` (authored content); `sheet-prototype.html` (dead, unlinked).

---

## Visual inventory system (LIVE in `main`)

Equipment tab in `sheet.html` is a full visual inventory. **Two files**: `sheet.html` + `item-icons.js` (repo root) — commit together. List/grid toggle; nested containers; drag-to-move; auto-detect containers; packs auto-explode from 5etools `packContents`; per-item icon picker (257 game-icons glyphs, CC BY 3.0); item locking + bag sealing; weight rollup with extradimensional support. Mobile touch: long-press (~450ms) to drag, tap to open; iOS double-tap fixed via `@media (hover: hover)`; scroll-cancel if finger travels >10px; post-drag click suppressed. Additive per-item fields: `icon`, `isContainer`, `extradimensional`, `locked`, `id`, `containerId`. `items2.js` is read-only (5etools search proxy).

---

## Combat / battle map — DESIGN SETTLED (2026-05-31)

Combat lives on its **OWN page** (leaning `combat.html`), NOT `world.html` (which is the world-navigation map). The five decisions: (1) **square** grid; (2) map source = pre-uploaded static images in a `maps/` folder, `mapRef` = filename; (3) fog = DM-toggled per-cell reveal, stored as a JSON coord array on the `encounters` row (no dynamic line-of-sight); (4) tokens = character **portraits** in a `tokens/` folder named by key (`tokens/cosmere.png`) with colored-dot-initials fallback; (5) one active encounter/map at a time. Player token-image upload deferred (Option 1: DM uploads four static images; later swap to Supabase Storage). The persistent battle HUD is the bridge: a player acts from their character (actions/spells/dice from GitHub sheet) while in-fight HP/conditions read/write the Supabase combatant row.

### Known HUD bug — PARKED (fold into combat HUD work)
On `sheet.html`: editing HP **via the sheet** updates the HUD ✓, but editing HP **via the HUD** does NOT write back to the sheet ✗ (suspected stale in-memory copy clobbering on debounced save — UNVERIFIED). HUD works fine elsewhere. Fix folded into combat HUD work (which reworks HP-source logic anyway: in-fight = Supabase, at rest = GitHub).

---

## Supabase (config)

- **Project:** Trials of Kirtas · **ID:** `cfthwspwpcfamgbfqzuq` · **URL:** `https://cfthwspwpcfamgbfqzuq.supabase.co` · **Region:** us-west-1 · plain Postgres.
- **Publishable key (safe, public by design — RLS is the guard):** `sb_publishable_12KUwzDbVvcar0zjh2KE6g_6IRBfmMJ`
- **Secret / service_role key:** NOT recorded here. Server-side only, never in client or chat.
- Data API ON; auto-expose new tables OFF (RLS enabled explicitly per table). New signups DISABLED; login = email OTP (8-digit). Site URL set.
- Client-side Supabase consumers: `login.html` + `nav.js` (session gate + 4a whoami). Nothing else touches the DB yet.

### Email (Resend)
Native Resend↔Supabase integration. Sending domain `tok.manikkhan.com` VERIFIED; sender `noreply@tok.manikkhan.com` ("Kirtas"); DNS confirmed. (No email is sent at account creation via "Create new user" — only when a user requests an OTP at `login.html`.)

### Login page
`login.html` — email → 8-digit OTP → redirect to `index.html`. `shouldCreateUser: false` (pre-provisioned only). Already-signed-in users skip through. Works end to end.

---

## Schema + RLS v1 — RUN + VERIFIED in Supabase (2026-05-31); `schema_v1.sql` in repo root

DDL run successfully; `rowsecurity = true` on all three tables. Idempotent / re-runnable.

**Tables:**
- **`profiles`** — `user_id` (→ auth.users), `role` (overseer/dm/player), `character_key` (4 keys or null). Partial-unique on `character_key` (one person per character). **Now holds all 5 rows** (see Identity layer).
- **`encounters`** — `name`, `status` (active/ended), `round`, `active_combatant_id`, `map_ref`, `revealed_cells` (JSON fog array). Partial-unique = one active encounter at a time.
- **`combatants`** — one row per token (party + enemies via `side`). `owner` (→ profile, null for enemies), `name`, `side`, `hidden`, `hp`/`max_hp`, `initiative`, `conditions` (jsonb), `x`/`y` (loose).

**RLS:** helpers `is_overseer()`, `is_staff()`, `my_profile_id()` (SECURITY DEFINER). `profiles`: read = all authenticated, write = overseer. `encounters`: read = all authenticated, write = staff. `combatants`: staff = all; player SELECT = `hidden=false OR owner=mine`; player UPDATE = own rows. **Column-level player writes** via BEFORE UPDATE trigger `combatants_guard_columns` (players may change only `hp`/`conditions`/`x`/`y`; protected columns coerced back; staff bypass) — because all logged-in users share the `authenticated` role so column GRANTs can't distinguish. Realtime: `encounters` + `combatants` only.

**Multi-campaign upgrade path (deferred).** Single campaign now. Later, `role` + `character_key` move off `profiles` into a per-(login, campaign) membership row; `encounters` gain `campaign_id`; helpers become campaign-scoped. Bounded migration, not a rewrite. Building single-campaign now does not corner us.

---

## Open / next steps

In order:

1. ~~Route protection + spinner~~ ✓ · ~~Run schema + seed overseer~~ ✓ (2026-05-31).
2. ~~Add the four player accounts + seed `profiles`~~ ✓ **DONE 2026-06-01** — identity layer complete, all 5 seeded + verified.
3. ~~Client wiring: read identity (4a whoami)~~ ✓ · ~~seat-defaulting~~ ✓ · ~~My Character menu~~ ✓ (2026-06-01).
4. **Sheet redesign (planned, parked).** A full visual redesign of the character sheet is on the roadmap. Seat-defaulting is redesign-proof; **edit-gating is deliberately deferred until this lands** (it attaches to the edit controls that will be rebuilt). Do edit-gating *after* the redesign so it's wired once.
5. **Edit-gating** (after the redesign): sheet editable only when the open character is yours, staff edit anyone (client-side UX per the permissions note).
6. **view-as switch** for overseer/dm (client lens; belongs with the combat page). *Partly covered:* combat.html already renders role-aware (DM sees all + concealment badges; players get RLS-filtered rows + ??? for teased). A full DM "preview as player X" toggle is still pending.
7. ~~**Read sync**~~ ✓ **DONE 2026-06-02** — players watch live via Supabase Realtime (`combatants` + `encounters` added to the `supabase_realtime` publication via `enable_realtime.sql`).
8. ~~**Write sync** (players move own token)~~ ✓ **DONE 2026-06-02** — drag-to-move + arrow-key nudge write `x`/`y`; optimistic with revert. HUD hp/conditions write still pending (the trigger already allows it).
9. **Flush combat result → GitHub** (durable record). Still pending.
10. ~~**Combat/map page** (`combat.html`)~~ ✓ **BUILT 2026-06-02** — map (Cloudinary, native-coord grid), square grid projected from `maps/manifest.json`, tokens (cutout/circle, per-character style, dot fallback), drag/pan/pinch-zoom, selection + click-to-name, three-state visibility live. **Fog still pending.**
11. (Later) Overseer settings UI for role assignment + **token-ownership assignment** (the "grant players access to tokens" idea — staff UI writing `combatants.owner`, retiring manual SQL). (Later/if needed) multi-campaign migration.

**Next up (agreed this session):**
- **Right-click / long-press context menu** — role-aware per-token menu. Player editing *their own* token = personal view options (token style; possibly base/ring colour). Staff = those plus authority (per-token size, ownership assignment, hidden/tease toggles). *Open decision before building:* is a token's base/ring **colour** and **size** personal (per-viewer, local) or shared (in the DB, everyone sees)? Leaning: style = personal; size + colour = shared/DM-owned. **Awaiting user call.**
- **Persistence for panel settings** — grid appearance → store on the `encounter` row (DM-owned, synced to all); per-character token style → persist per character so a player's choice sticks. Currently both are live-but-unsaved (reset on reload).
- **Measurement / ruler** (drag A→B, distance in ft, 5e diagonal) — local first, then broadcastable.
- **Auras** — radius + colour *attached to a combatant* (a small additive column; moves + syncs with the token for free).
- **Drawn shapes** (rect/circle/cone/freehand; movable, deletable) — biggest lift; own `drawings` table + realtime. Decision when we start: separate table vs JSON on encounter (leaning table).

**Future-proofing principle:** identity/security columns can't be cheaply retrofitted — got them right in v1. Position fields (`x`/`y`/`map_ref`) are not security-bearing; included now (cheap) but stay loose/nullable until the map layer wires them.

---

## Commit status (2026-06-02) — combat page build

New files (commit to `main`):
- **`combat.html`** — the combat/map page. Reads active encounter + combatants via the shared client (`window.__tok.sb`). Map from Cloudinary (`w_2048,q_auto,f_auto` transform — native-coord grid math, resolution-independent). Square grid projected from `maps/manifest.json` via SVG `<pattern>`. Tokens: dedicated art (`kirtas/tokens/<key>.png`) → portrait → dot-initial fallback; **per-character circle/cutout** via `TOKEN_STYLE`; selection (gold glow + name), click-to-name. **Drag-to-move + arrow-key nudge** (snap-to-cell, optimistic write to Supabase). **Zoom/pan** (wheel, pinch, +/−/FIT bar) — own transform model, not browser zoom. **Realtime**: moves sync to every client. Three-state visibility live (DM sees all + `∅`/`?` badges; players RLS-filtered + `???`). Startup steps wrapped in `safely()` so one failure can't blank the panel. Display panel (top-right): Grid (global) · per-character Token style · view size/ring.
- **`maps/manifest.json`** — grid calibration + cosmetics per `map_ref`. Bridgetown: 140px cell, 39×56, origin 0,0, `publicId: kirtas/maps/G_BridgeTown_Original_Day`. **Native numbers; renderer scales.**
- **`schema_delta_combat.sql`** — additive: `combatants.dex` (init tiebreak), `.source_key` (→ bestiary/character ref), `.tease` (cosmetic concealment); column-guard extended to pin the three for players. **Run in Supabase.** ✓ confirmed applied.
- **`enable_realtime.sql`** — adds `combatants` + `encounters` to the `supabase_realtime` publication (Realtime won't broadcast otherwise). ✓ confirmed applied.

Edited (commit):
- **`nav.js`** — two additive changes: (1) exposes the authenticated client as `window.__tok.sb` so combat reuses it (no 2nd GoTrueClient); (2) **profile fetch now selects `id`** and includes it in the profile object — `{ id, userId, email, role, characterKey }`. **This was the fix** for "players can't move their own token": `combat.html`'s `canMove()` compares `combatant.owner === ME.id`, and `id` was previously absent, so every player-move failed the check silently (staff passed via `is_staff`). DB ownership was correct all along.

Test scaffolding (SQL, not repo): `make_test_token.sql` (a throwaway `testdummy` combatant owned by a test profile — no real data touched; the robust way to test player moves), `diagnose_state.sql` (read-only state dump). Superseded/discarded: `attach_test_account.sql` v1–v3 (reassigning a real character collided with the one-per-character index + `character_key` check; abandoned for the dummy-token approach). The visibility/permission model verified end-to-end via a `thebraveruby+test@gmail.com` plus-alias account.

**The big lesson (for next session):** profiles are **not auto-created on sign-in** — they're seeded by hand. A signed-in user with no `profiles` row has a null `my_profile_id()` and all writes are denied. This + the missing `id` field were the two causes of the "can't move" saga. Both resolved.

---

## Commit status (2026-06-01)

This session's commits (all to `main`, single-step deploys):
- `nav.js` — 4a whoami (`window.__tok`), `nav:ready` dispatch, **My Character menu** + caret. Carries everything stacked: route gate, spinner, cosmere key, overscroll shield.
- `battle.js` — boots on `nav:ready` (mobile battle fix). **Coupled with `nav.js`** — commit together.
- `sheet.html` — seat-defaulting redirect (committed; confirmed present in the uploaded copy).
- `index.html` — Cosmere wheel slice key `tyros` → `cosmere` (fixes broken homepage link).
- `character.js` — `KEY_FILE` alias removed (`{}`). **Coupled** with the `tyros.json` → `cosmere.json` rename.
- `data/characters/cosmere.json` — renamed from `tyros.json` (via GitHub), internal `"key"` → `cosmere`. Delete old `tyros.json` after.
- Supabase: 4 new Auth users + 5 `profiles` rows seeded (dashboard + SQL editor, not repo).

Discarded mid-session: an early wrong fix that un-hid the ⚔ battle button on mobile — superseded; the mobile-hide rule is correct and stays.

---

## Parked (untouched, low-risk)

- **Known HUD bug** (HUD→sheet write on the sheet page) — folded into combat HUD work.
- **Sheet redesign** — planned; edit-gating waits on it.
- `sheet-prototype.html` — orphaned/stale; nothing links to it. Deletion candidate — **awaiting user confirm.**
- Safari elastic-overscroll "bleed" — try `overscroll-behavior: none` in nav.js styles. Its own pass.
- `data/chronicle.json` ~line 96 — historical entry `"author": "Tyros"`. Authored content — rename only if user wants.

---

## Key distinctions worth remembering

- **`world.html` = world navigation map, NOT combat.** Combat gets its own page (`combat.html`).
- **Durable character → GitHub. Live combat state → Supabase.** Flush back to GitHub at fight's end.
- **Publishable Supabase key = public, safe.** service_role = never share. RLS guards data, not key secrecy.
- **`items2.js` is read-only** (5etools proxy). All saves go through `character.js` → GitHub.
- `cosmere` is the character key everywhere; data file is `cosmere.json` (renamed from `tyros.json` 2026-06-01, alias removed).
- **Battle on mobile lives in the ◐ theme dropdown** (via `battle.js` injection); the ⚔ button is desktop-only by design.
- **`window.__tok`** is the front-end identity object (set by `nav.js`); **`nav:ready`** is the "nav is mounted" signal nav-dependent scripts wait on. Shape: `{ id, userId, email, role, characterKey }` + `.sb` (shared client), `.session`, `.ready` (promise).
- **Profiles are NOT auto-created on login** — seeded by hand. No `profiles` row → `my_profile_id()` is null → all writes denied. Provision a profile (and, for moving, set `combatants.owner` = that profile id) before expecting writes.
- **Token ownership = `combatants.owner` → `profiles.id`** (the PROFILE id, not the auth-user id). Player move allowed when `owner = my_profile_id()`; staff move anything via `is_staff()`.
- **Map grid is resolution-independent**: `maps/manifest.json` holds NATIVE numbers (cellPx/cols/rows/origin); `combat.html` scales by `renderedWidth/nativeWidth`, so one manifest works at any display size. Heavy map images live in Cloudinary, the tiny manifest in git.
- **Three-state token visibility**: `hidden` (RLS drops the row — server-secure surprise) vs `tease` (row sent, client draws `???` — lightweight, devtools-crackable by design) vs neither (visible). `hidden` = security; `tease` = cosmetic.
- **Owner (`thebraveruby`) is overseer AND plays Vesperian; `hagakuredisc` is the dedicated DM.**
- All sheet edit-gating is client-side UX, **not** server-enforced (the GitHub write path has no per-user auth).
- DNS subdomains are free/independent. `tok.manikkhan.com` (email) ≠ `manikkhan.com` (website).
