# Campaign moment — first authenticated field pass

This is the manual promotion gate for the guarded `tok-campaign-moment/v1`
reader. It does not authorize a client write path, an invented story row, or a
production deploy by Codex. M applies and deploys by hand.

## 1. Prove the live prerequisites

Run `CAMPAIGN-MOMENT-PREFLIGHT.sql` in the Supabase SQL Editor and save its one
JSON result. Before application, `status` must be `ready_to_apply`, every
required relation/helper must be present, and every required column must be
compatible.

If the result is `blocked_prerequisites`, stop. Apply or reconcile the missing
authority first. Do not loosen `schema_delta_campaign_moments.sql` to fit an
unknown live shape.

If the result is `blocked_partial_contract`, stop and inspect the existing
campaign table before applying anything. A half-created contract is not a safe
idempotent retry target.

## 2. Apply and verify the contract

Apply `schema_delta_campaign_moments.sql` once. Rerun the preflight and require:

- `status = installed_review_security`;
- both campaign tables present;
- `campaign_moments_select` and
  `campaign_moment_secrets_staff_select` present;
- authenticated has SELECT but no INSERT, UPDATE, or DELETE on either table;
- service role has the deliberate maintenance grants; and
- `campaign_moments` is in `supabase_realtime`.

If the migration has already been applied, treat it as append-only history.
Correct it with a new delta; never rewrite the applied file.

## 3. Resolve one real fact before writing

Run `CAMPAIGN-MOMENT-IDENTITY-RESOLVER.sql`. From its output, choose one safe
fact and record the exact identities in a scratch note:

| field | authority | required check |
|---|---|---|
| `id` | new durable moment slug | unique, stable, and not a display title |
| `occurred_at`, `session_id` | feed/Journal campaign time | tell the same chronology |
| `feed_post_id` | `feed.id` | party-readable Chronicle row for a party moment |
| `journal_page_id` | `journal_pages.id` | page is the source behind that shared feed row |
| `encounter_id` | `encounters.id` | the encounter behind the fact, not merely a similar name |
| `scene_id` | `scenes.id` | use only when `encounters.map_ref = scenes.key` |
| `forge_session_id` | `forge_sessions.id` | use instead of `scene_id`, never alongside it |
| `location_id` | Living Codex/canon key | exact existing key; nested places keep their parent |
| item event | `item_events.moment_id` | must already equal the new moment identity |

Canon World keys live in `world.html` / `tooltips.js` and therefore cannot all
appear in the SQL resolver. If the chosen place is canon, verify the exact key
in source. A curated database location may be top-level, nested, mapped, or
unmapped; do not add coordinates merely to make the field test look complete.

`item_events` are append-only. Never UPDATE an old event to attach the moment.
If no real event already carries the chosen `moment_id`, stop and either choose
a future natural item event or separately approve a new append-only event that
truthfully records what happened.

## 4. Insert only the reviewed row

Use the Supabase service-role/table-editor path. Insert one
`campaign_moments` row, then optionally one `campaign_moment_secrets` row with
the same `moment_id`. Keep these invariants:

- `visibility = party` only when every public field is party-safe;
- `map_precision = approximate` when party knowledge is approximate;
- exact coordinates exist only in `campaign_moment_secrets` and are entered as
  a complete x/y pair;
- at most one of `scene_id` and `forge_session_id` is set;
- `party_present` is true only when the party actually witnessed/travelled the
  fact; and
- no personal `data/map-pins.json` mark becomes permanent history.

Read the inserted public row and staff secret back in the SQL Editor before
opening the site. If any identity disagrees, remove the new campaign row before
field promotion; do not alter the linked append-only item event.

## 5. Authenticated browser matrix

Deploy the five client files from the guarded slice, then test the same moment:

| view | player desktop/mobile | staff desktop/mobile |
|---|---|---|
| `world.html?path=1&moment=<id>` | public/approximate pin, cluster, path | same public truth plus separate exact pin |
| `chronicle.html?campaignLinks=1&moment=<id>` | focuses the linked feed row | same focus and permitted connections |
| `sheet-v2.html?character=<bearer>&campaignLinks=1&item=<item-id>` | item receipt and safe links | same receipt plus existing staff item controls |

Also prove one narrated missing link. Check browser warnings/errors, keyboard
and touch targets, horizontal overflow, nested-parent projection, and that a
player request never reads `campaign_moment_secrets`.

Keep the readers guarded if any cell fails. Promotion is a separate decision
after the saved SQL evidence and all six authenticated browser views agree.
