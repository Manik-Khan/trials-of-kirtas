# Database migrations — Trials of Kirtas

## Project documentation

- [Project context](CONTEXT.md)
- [Forge context](CONTEXT_Forge.md)
- [Current Forge handoff](docs/handoffs/forge/README_NEW_SESSION_2026-07-16.md)
- [Durable guides](docs/README.md)
- [Historical records](archive/README.md)
- [Test map](tests/README.md)

This folder is the version-controlled home for **every schema / RLS / function /
data change applied to the live Supabase project**. The live database is the
source of truth today, but it is not reproducible from this repo unless the SQL
that built it lives here. This folder closes that gap.

## Convention

- One `.sql` file per change, applied via the Supabase SQL editor.
- Name them so they sort in apply-order, e.g. `0001_schema_v1.sql`,
  `0002_feed.sql`, … — or keep the existing descriptive names; just be
  consistent. Append-only: never rewrite an applied migration; add a new one.
- Each file starts with a one-line comment: what it does + the date applied.
- RLS policies and `SECURITY DEFINER` functions are part of the schema — capture
  them here too, not just table/column DDL. (The project intentionally runs some
  policies/triggers live-only; capturing them here is what makes a rebuild
  possible, so prefer committing them.)

## Status (from the 2026-06-25 repo audit)

**Already committed** (currently at repo root — move them in here when convenient;
left in place for now to avoid touching anything that might reference them):

`schema_v1.sql` · `migrate_chronicle.sql` · `schema_delta_appearance.sql` ·
`schema_delta_characters_key_open.sql` · `schema_delta_chronicle_unify.sql` ·
`schema_delta_feed.sql` · `schema_delta_members.sql` ·
`schema_delta_roster_layout.sql` · `schema_delta_scenes.sql` ·
`schema_delta_scenes_v2.sql`

**Applied live but NOT in the repo** — these were run against Supabase and
verified, but the SQL was never committed, so the DB can't be rebuilt without
them. Paste each from the Supabase dashboard's migration/history (or your local
copies) into a file here:

- `advance_turn.sql` — the `advance_turn()` turn/round engine (SECURITY DEFINER)
- `characters_party_edit.sql` — party-edit policy/path for `public.characters`
- `enable_characters_realtime.sql` — realtime publication for `characters`
- `grant_service_role.sql` — service-role grants
- `migrate_characters_data.sql` — the hardcoded-JS → `characters` table backfill
- `schema_delta_aura.sql` — aura column(s)
- `schema_delta_campaign_config.sql` — campaign config table/columns
- `schema_delta_characters.sql` — the `public.characters` table
- `schema_delta_characters_1b.sql` — characters follow-up delta
- `schema_delta_characters_fk.sql` — characters foreign-key(s)
- `schema_delta_saved_monsters.sql` — saved-monsters table
- `schema_delta_vitals_hp_sync.sql` — vitals/HP sync delta
- `update_liadan_portrait.sql` — one-off data fix (Líadan portrait)

Once these are in, a fresh Supabase project can be stood up by applying the
folder in order — and future audits stop flagging the schema as untracked.
