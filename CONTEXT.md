# Trials of Kirtas — CONTEXT

State-carrying doc for picking up in a fresh conversation. Last updated end of the **auth-spinner + permissions-model + combat-schema session (2026-05-31, late night)** — schema now RUN + verified in Supabase, spinner committed.

> **Correction (this session):** a previous version of this doc described a "pending bundle" of files as built-but-not-committed. That was stale — a check against GitHub `main` confirmed the whole bundle (`nav.js`, `sheet.html`, `item-icons.js`, `character.js`, `world.html`) is already live. The "Pending commits" framing below has been corrected. Don't trust "pending/uncommitted" claims without checking `main` first.

---

## Working rules (read first)

These have been violated in past sessions — including this one (acted before getting an explicit go-ahead). Stay vigilant on #1 especially:

1. **Ask, don't assume.** When a choice or detail is ambiguous, ask rather than guessing. Asking a question is not the same as getting a "yes" — wait for the actual go-ahead before writing/editing.
2. **Simplest solution first.** Don't reach for the heavier option when a one-liner does it.
3. **Don't touch unrelated code.** Edits stay scoped to the task at hand.
4. **Flag uncertainty explicitly.** Say what you're sure of vs. guessing, especially for things that can't be verified from source (live site behavior, current deploy state, etc.).

Also: canonical source is the GitHub repo (`main`), not the live Netlify site. Don't scrape the live site. Pull from GitHub or work from uploaded files.

---

## Project at a glance

- **Repo:** https://github.com/Manik-Khan/trials-of-kirtas
- **Live:** https://trials-of-kirtas.netlify.app
- **Stack:** vanilla JS/HTML/CSS, no build step. Netlify hosting, GitHub-backed persistence via Netlify functions (chronicle + character data). Supabase for live, identity-scoped state (auth now; combat state next).
- **Party:** Cosmere Runestar (key `cosmere`), Caim, Líadan, Vesperian.

### Architecture split (decided 2026-05-31) — IMPORTANT
- **Durable character data** (sheets, inventory, abilities, max HP) → **GitHub/Netlify** (existing `character-store.js` → `character.js` function). Doesn't change mid-fight; versioned; durable.
- **Live combat state** (current HP, conditions, initiative, token position, fog) → **Supabase** combatant rows. Changes second-to-second, must be visible live to DM + players, RLS-controlled.
- **Sync point:** at the end of a fight, flush combat result → GitHub (durable record). The character sheet holds "resting" HP; the combatant row holds "in-fight" HP.

---

## Route protection — DONE, DEPLOYED + TESTED (2026-05-31)

Added a Supabase session gate to `nav.js`. Since `nav.js` loads on every page, every page is now gated. **Live in `main` and tested:** logged-in browser hitting `login.html` bounces to `index` ✓; fresh browser deep-linking to a protected page (`party.html`) is kicked to `login` ✓; no redirect loop ✓ (the previously-unverified risk is now cleared).

**Auth-gate spinner (this session) — COMMITTED + live in `main`** (verified: `nav-auth-spinner` / `authVeil` / `dropVeil` present in `nav.js`). The fresh-browser test had shown a brief flash of the protected page before the redirect (page paints, then the async session check runs and yanks it). Fixed with a themed full-screen "veil" + spinner in `nav.js`: on gated pages it covers the already-rendered content while the session check runs, fades out on success, stays up on the redirect path. The check is wrapped in a try/catch that **fails closed** (redirects to login if the Supabase client can't load, rather than hanging on a spinner). Veil uses theme vars (`--ink`, `--gold`). Real-device feel (fade timing 200ms, spinner size) not yet eyeballed live — tweak if it bugs you.

**How it works:**
- Theme applies immediately (no colour flicker).
- An async IIFE (`initNav`) then checks `sb.auth.getSession()`.
- No session → redirect to `login.html` before the nav mounts (no flash-then-kick).
- `login.html` is bypassed so it runs its own auth flow.
- Supabase JS client is dynamically injected on pages that don't already load it.
- The three Supabase constants (`SUPABASE_URL`, `SUPABASE_KEY`, `LOGIN_PAGE`) are **scoped inside the IIFE** so they can't collide with constants future pages (e.g. the combat page) will declare.

**Verified (was flag #4):** the redirect-loop risk did NOT materialize — Supabase persists the session to localStorage during `verifyOtp` before `index.html`'s gate reads it, as hoped. Confirmed by live test. No retry/delay needed.

**Deploy coupling (resolved):** the `cosmere` switcher key and the rest of the former bundle are all already in `main`, so the only thing left to push is the spinner edit to `nav.js`. No coupling concern remains.

---

## Character key — RESOLVED (2026-05-31)

Canonical key is **`cosmere`** everywhere.

- `characters.js` — `cosmere:` ✓ (live in `main`)
- `nav.js` — `{ key: 'cosmere', label: 'Cosmere' }` ✓ (live in `main`)
- `sheet.html` — default + switcher key `'cosmere'` ✓ (live in `main`)
- `world.html` — token id `'cosmere'` ✓ (live in `main`)
- `character.js` — `VALID_KEYS = ['cosmere', 'caim', 'liadan', 'vesperian']` + `KEY_FILE = { cosmere: 'tyros' }` alias so `cosmere` transparently reads/writes `data/characters/tyros.json` ✓ (live in `main`)
- `chronicle.html` — uses `cosmere` internally + back-compat shim for old `tyros` entries. Self-consistent; leave alone.

**Pending cleanup (not urgent):** rename `data/characters/tyros.json` → `cosmere.json`, then remove the `KEY_FILE` alias line. App works fine without this.

---

## Visual inventory system (LIVE in `main`)

Reworked the Equipment tab in `sheet.html` into a full visual inventory. **Two files**: `sheet.html` (edited) + `item-icons.js` (new, repo root). Must be committed together — page breaks if one lands without the other.

- List/grid toggle; containers with arbitrary nesting; drag to move between levels; auto-detect containers; packs auto-explode from 5etools `packContents`; per-item icon picker (257 game-icons glyphs, CC BY 3.0); item locking + bag sealing; weight rollup with extradimensional support.
- **Mobile touch:** long-press (~450ms) to drag, tap to open; whole row/tile is the touch target; iOS double-tap fixed via `@media (hover: hover)` gating; scroll-cancel if finger travels >10px before pickup; post-drag click suppressed.
- **Status:** LIVE in `main` (`sheet.html` + `item-icons.js` both present). Touch-drag still wants a real-device pass to confirm long-press/scroll-cancel behavior — verify when convenient.
- New per-item fields (additive; old inventories load unchanged): `icon`, `isContainer`, `extradimensional`, `locked`, `id`, `containerId`.
- `items2.js` (`netlify/functions/items2.js`) is **read-only** — 5etools search proxy, no write path. Saves go through `character-store.js` → `character.js` → GitHub.

---

## Commit status — corrected this session

Verified against GitHub `main`: the entire former "pending bundle" is **already live**. Confirmed present in `main`:

| File | What's in it | Status |
|---|---|---|
| `nav.js` | Route protection + cosmere switcher key + overscroll shield | ✓ in `main` |
| `sheet.html` | Visual inventory UI + iOS hover fix + mobile touch drag + cosmere charKey default | ✓ in `main` |
| `item-icons.js` | 257 SVG glyphs (repo root) | ✓ in `main` |
| `character.js` | cosmere `VALID_KEYS` + `KEY_FILE` alias | ✓ in `main` |
| `world.html` | cosmere token id | ✓ in `main` |
| `characters.js` | `cosmere:` key | ✓ in `main` |

**All pushed.** The former bundle plus this session's spinner edit to `nav.js` are all in `main`. `schema_v1.sql` is also committed to the repo (16.8 KB, repo root) as the durable record of the DB structure. Nothing outstanding to push.

---

## Combat / battle map — DESIGN SETTLED (2026-05-31)

### Combat lives on its OWN page — NOT world.html
`world.html` is the **campaign-world navigation map** (cities, hubs, travel links). Combat is separate. Page name not finalized — leaning **`combat.html`** (the page is the activity; the `encounters` table is the record). `encounters.html` also fine. Earlier doc text saying the map "lights up world.html's dormant fields" is **WRONG** and superseded by this.

### The five decisions — RESOLVED
1. **Grid type:** square. (Hex avoided — offset coords, neighbor logic, render complexity, no flavor need.)
2. **Map source:** pre-uploaded static images, DM picks from a library. Drop images in a `maps/` folder in the repo; `mapRef` is just a filename string. Zero new infra. Upload can be added later.
3. **Fog of war:** DM-toggled per-cell reveal (static), NOT dynamic line-of-sight / visibility radius. DM clicks a cell to reveal; revealed cells stored as a **JSON array of coords on the `encounters` row**. Players' view filters to revealed cells only. ~30% more work than no fog, not 300%. Visibility-radius / walls / light = the Foundry rabbit hole; explicitly out.
4. **Token representation:** character **portraits** with colored-dot-with-initials fallback. Portraits via a `tokens/` folder in the repo, named by character key (`tokens/cosmere.png`), DM (user) uploads them. Token display does `tokens/${key}.png` with dot fallback if missing.
5. **Multiple active maps:** one active encounter/map at a time. Previous encounters marked `ended`.

### Player upload of own token images — DEFERRED (Option 1 chosen)
For now the DM uploads four static images to `tokens/`. Swapping to per-player upload later = Supabase Storage (has bucket + RLS, auth already wired) — a clean additive upgrade, one-line change to where the token URL comes from. Not painting into a corner.

### Character access during combat — the HUD is the bridge
A player on the combat page sees: (1) the **map** (Supabase, live), and (2) their own **battle HUD** — live current HP/conditions from their Supabase combatant row, with actions/spells/dice pulled from their GitHub character sheet. The persistent battle HUD already built is exactly this bridge: it lets a player act from their character without leaving the map. During a fight the HUD reads/writes the combatant row's HP; at rest it talks to GitHub as today.

### Known HUD bug — PARKED (fold into combat HUD work)
On `sheet.html` specifically: editing HP **via the sheet** updates the HUD ✓, but editing HP **via the HUD** does NOT write back to the sheet ✗ (likely the sheet's stale in-memory copy clobbers the HUD write on its own debounced save — UNVERIFIED, haven't seen the HUD source / `character-store.js` / sheet HP wiring). On other pages the HUD write lands fine and the sheet reads it fresh on next load. HUD works well everywhere else. **Decision: do not fix now.** Fold into the combat HUD work, since that reworks the HUD's HP-source logic anyway (in-fight = Supabase, at rest = GitHub). Revisit sooner only if it bites someone.

---

## Supabase (session 2026-05-29)

- **Project name:** Trials of Kirtas
- **Project ID:** `cfthwspwpcfamgbfqzuq`
- **Project URL:** `https://cfthwspwpcfamgbfqzuq.supabase.co`
- **Region:** us-west-1 (West US / North California)
- **DB engine:** plain **Postgres** (NOT OrioleDB — deliberately avoided)
- **Publishable key (safe, public by design — RLS is the real guard):**
  `sb_publishable_12KUwzDbVvcar0zjh2KE6g_6IRBfmMJ`
- **Secret / service_role key:** NOT recorded here. Server-side only, never in client code or chat.
- **Only client-side Supabase consumer so far:** `login.html` (and now `nav.js` for the session gate). Nothing else touches the DB yet — confirmed 2026-05-31.

### Data API settings
- Enable Data API: **ON**
- Automatically expose new tables: **OFF** (opt-in per table)
- **Plan: enable RLS explicitly with SQL on each new table.**

### Auth config
- New signups: **DISABLED**
- Login method: **email OTP (8-digit code)**
- **Site URL:** `https://trials-of-kirtas.netlify.app` — SET and confirmed.

### Users
- `thebraveruby@gmail.com` (overseer / owner) — in Auth, login confirmed end-to-end, AND seeded into `profiles` as `role = 'overseer'` (2026-05-31).
- The four players: **NOT yet added to Auth**, NOT yet seeded into `profiles`. Each needs Authentication → Users → Add user, then a profile row (player block in `schema_v1.sql`).

---

## Email sending (Resend, session 2026-05-29)

- Native Resend↔Supabase integration (OAuth, org-level).
- **Sending domain:** `tok.manikkhan.com` — VERIFIED.
- **Sender:** `noreply@tok.manikkhan.com`, display name "Kirtas"
- DNS (DKIM, MX, SPF, DMARC) confirmed in Squarespace.

---

## Login page (session 2026-05-29)

- **File:** `login.html` — built, pushed, live.
- Two stages: email → 8-digit OTP → redirect to `index.html`. `shouldCreateUser: false` (only pre-provisioned users).
- Already-signed-in users skip straight through.
- **WORKS end to end.** Previously a "ribbon" feature only — site was reachable without login until route protection (above) lands.

---

## Open / next steps

In order:

1. ~~Deploy + test route protection~~ ✓ DONE + verified live. ~~Commit spinner edit~~ ✓ committed to `main`.
2. ~~Run `schema_v1.sql`~~ ✓ DONE + verified (RLS true on all 3 tables). ~~Seed overseer row~~ ✓ done.
3. **← NEXT: add the four player accounts** in Supabase Auth (Authentication → Users → Add user), then **seed their `profiles`** (uncomment the player block at the bottom of `schema_v1.sql`, fill real emails, run it). That finishes the identity layer.
4. **Client wiring for roles/views** (first app code on the new schema) — read the logged-in user's profile (role + character_key); default players into their character's seat; add the overseer/dm "view-as" switch (client lens, no schema).
5. Read sync (staff writes, players watch live via Supabase Realtime).
6. Write sync (players move own token; HUD writes own hp/conditions — column guard already allows this).
7. Flush combat result → GitHub (durable record).
8. Combat/map view (the `combat.html` page — renders map image + square grid + tokens + fog).
9. (Later) Overseer settings UI for role assignment. (Later/if needed) multi-campaign migration — see upgrade path above.

**Future-proofing principle:** identity and security-bearing columns can't be cheaply retrofitted — get them right in v1. Position fields (`x`/`y`/`map_ref`) are NOT security-bearing; per this session's decision they're **included now** (cheap, saves a migration) but stay loose/nullable until the map layer wires them up.

### Schema + RLS v1 — RUN + VERIFIED in Supabase (2026-05-31)

`schema_v1.sql` was run in the Supabase SQL editor — "Success, no rows returned" (correct for a DDL script). **Verified live:** `select tablename, rowsecurity from pg_tables where schemaname='public'` returned all three tables with `rowsecurity = true`. The file is committed to the repo (root) as the source of truth. Re-runnable (idempotent), so safe to run again if ever needed.

**Seeded so far:** ONLY the overseer row — `thebraveruby@gmail.com` → `role = 'overseer'` (upserted; the auth user already existed). `profiles` has exactly one row. The four players are NOT yet in Auth and NOT seeded. Tables are otherwise empty.

**Permissions model — RESOLVED (2026-05-31).** Three concepts, kept separate:
- **Authority (who CAN do what)** — three global roles on `profiles.role`: **`overseer`** (site owner / admin — full DB visibility so it can fix things; the ONLY role that can assign roles), **`dm`** (runs combat, sees all combatants + fog), **`player`** (plays one character; sees only non-hidden tokens + their own).
- **Perspective (what you're LOOKING AT)** — a **client-side "view-as" switch** for overseer + dm to flip between the DM view and a player view. NOT a permission, needs no schema. The blindfold is "real enough": in a player lens the client doesn't *fetch* hidden rows, so nothing spoils unless you switch back. Overseer can always escalate to see-all (the door it keeps, by design). Players don't get the switch.
- **Login → identity** — each auth login maps to one `profiles` row carrying role + (for players) `character_key`. `thebraveruby@gmail.com` = overseer. A player logs in "as their character": site defaults them into that character's sheet/HUD/seat; editing scoped to their own sheet; party still visible.
- **Role assignment is overseer-only** (admin task; a DM cannot hand out privileges). Default provisioning: overseer assigns role + character when adding the account. Optional alt: players self-claim their character on first login (role stays overseer-set) — not built, just an option.

**Tables (as built):**
- **`profiles`** — `user_id` (→ auth.users), `role` (`overseer`/`dm`/`player`), `character_key` (4 keys or null). Identity. Partial-unique on `character_key` (one person per character).
- **`encounters`** — `name`, `status` (`active`/`ended`), `round`, `active_combatant_id` (loose), `map_ref`, `revealed_cells` (JSON `[x,y]` fog array). Partial-unique enforces **one active encounter at a time**.
- **`combatants`** — one row per token (party AND enemies, distinguished by `side`). `owner` (→ profile, null for enemies), `name` (added — enemies need a label; doc's original list omitted it), `side`, `hidden`, `hp`/`max_hp`, `initiative`, `conditions` (jsonb), `x`/`y` (loose). `name` is non-security additive, same logic as x/y.

**RLS as built:**
- Helpers `is_overseer()`, `is_staff()` (overseer OR dm), `my_profile_id()` — all SECURITY DEFINER to avoid recursion in `profiles` policies.
- `profiles`: read = all authenticated (needed to resolve token owner→character_key; holds no secrets); write = overseer only.
- `encounters`: read = all authenticated; write = staff.
- `combatants`: staff = everything; player SELECT = `hidden=false OR owner=mine`; player UPDATE = own rows only.
- **Column-level player writes** done by a BEFORE UPDATE **trigger** (`combatants_guard_columns`), not RLS — because every logged-in user shares the single `authenticated` role, so column GRANTs can't tell staff from player. Players may change only `hp`, `conditions`, `x`, `y`; protected columns are silently coerced back. Staff bypass.
- Realtime: `encounters` + `combatants` added to `supabase_realtime`. `profiles` is not (static).
- `anon` gets nothing (site is gated).

**Multi-campaign upgrade path (deferred — decision 2026-05-31).** Single campaign for now. When a 2nd campaign appears, `role` + `character_key` move off `profiles` into a per-(login, campaign) **membership** row (so one email can be overseer in one campaign, player in another — exactly the future Manik described), `encounters` gain a `campaign_id`, and the helpers become campaign-scoped. It touches the whole security layer but the data is tiny, so it's a bounded, deliberate migration — not a rewrite. Building single-campaign now does NOT corner us.

**Open sub-decisions to confirm before/after first run:** (1) safe player-writable columns = `hp`/`conditions`/`x`/`y` — `hp` directly writable (matches HUD), `initiative` left DM-only; (2) `profiles` world-readable to authenticated (alt: denormalize `character_key` onto combatant + restrict); (3) one-active-encounter hard-enforced (must `end` before a new `active`). All flagged in `schema_v1.sql` comments.

---

## Parked (untouched, low-risk)

- **Known HUD bug** (HUD→sheet write on the sheet page) — see Combat section. Folded into combat HUD work.
- `sheet-prototype.html` — orphaned/stale (old "Tyros Darkstar", nonexistent `tyros.png`). Nothing links to it. Candidate for deletion — **awaiting user confirm.**
- Safari elastic-overscroll "bleed" — try `overscroll-behavior: none` in nav.js's injected styles. Its own careful pass.
- `data/chronicle.json` ~line 96 — a historical entry has `"author": "Tyros"`. Authored content — rename only if user wants.

---

## Key distinctions worth remembering

- **`world.html` = world navigation map, NOT combat.** Combat gets its own page (`combat.html`/`encounters.html`).
- **Durable character → GitHub. Live combat state → Supabase.** Flush back to GitHub at fight's end.
- **Publishable Supabase key = public, safe.** Service_role key = never share. RLS guards data, not key secrecy.
- **`items2.js` is read-only** (5etools search proxy). All saves go through `character.js` → GitHub.
- `cosmere` is the character key everywhere. The data file is still `tyros.json` (the `KEY_FILE` alias handles this) until manually renamed.
- Three separate GitHub relationships: (1) Supabase dashboard login — cosmetic; (2) Supabase↔GitHub branching — intentionally NOT used; (3) Netlify↔GitHub for persistence — working, untouched.
- DNS subdomains are free and independent. `tok.manikkhan.com` (email) does nothing to `manikkhan.com` (the website).
