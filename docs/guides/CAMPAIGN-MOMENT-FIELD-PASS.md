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

## 3. Preserve the two resolved facts

Run `CAMPAIGN-MOMENT-IDENTITY-RESOLVER.sql`. Confirm that the reviewed identities
still match the two separate facts below. Do not merge them merely because they
share Session 8 and Veren's Watch.

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
| item event | `item_events.id` | may join through the separately approved additive association |

Canon World keys live in `world.html` / `tooltips.js` and therefore cannot all
appear in the SQL resolver. If the chosen place is canon, verify the exact key
in source. A curated database location may be top-level, nested, mapped, or
unmapped; do not add coordinates merely to make the field test look complete.

The unopened satchel owns feed 449, encounter
`84b36678-21b3-4a64-baf5-96a3d1c3475f`, scene
`ce811962-031d-431d-bc2d-ebcdb83693d1`, and `veren-s-watch`. It has no item or
Journal identity. Skyblinder's recovery owns item event
`itemev_4b983df8-a75c-4601-aefe-73849ec8d759` and `veren-s-watch`. It has no
feed, Journal, encounter, scene, or Forge identity.

`item_events` are append-only. Never UPDATE an old event to attach the moment.
`schema_delta_campaign_moment_item_links.sql` adds a separate association row;
the source Skyblinder event must still return `moment_id = null` afterward.

## 4. Apply and review the additive link delta

Run `schema_delta_campaign_moment_item_links.sql` once in the Supabase SQL
Editor. Its prerequisite assertions must pass and its final evidence cell must
return `status = installed_review_two_facts`. Review both moment rows, the one
association row, and the complete source event included in that result. Require:

- the satchel row has feed/encounter/scene identities and no item association;
- the Skyblinder row has the item association and no feed/Journal/encounter/map;
- the source item event still has `moment_id = null`;
- both rows use `veren-s-watch` and therefore form one two-moment map cluster;
- at most one of `scene_id` and `forge_session_id` is set; and
- no personal `data/map-pins.json` mark becomes permanent history.

If any identity disagrees, stop before client deployment. Correct through a new
delta; do not rewrite either applied migration or the linked append-only event.

## 5. Authenticated browser matrix

Deploy the guarded client files, then test both facts:

| view | player desktop/mobile | staff desktop/mobile |
|---|---|---|
| `world.html?path=1&moment=moment-s8-unopened-satchel` | shared cluster; Chronicle and Encounter enabled; Item unavailable | same public fact; no invented item |
| `chronicle.html?campaignLinks=1&moment=moment-s8-unopened-satchel` | focuses feed 449 and exposes permitted connections | same focus and permitted connections |
| `world.html?path=1&moment=moment-s8-skyblinder-recovered` | shared cluster; Item enabled; Chronicle and Encounter unavailable | same public fact; no invented links |
| `sheet-v2.html?character=<current-bearer-key>&campaignLinks=1&item=item_876939c0-74c5-4cd2-9c45-35308cec409b` | legacy receipt and safe World link | same receipt plus existing staff item controls |

Prove every narrated missing link. Check browser warnings/errors, keyboard
and touch targets, horizontal overflow, nested-parent projection, and that a
player request never reads `campaign_moment_secrets`.

Keep the readers guarded if any cell fails. Promotion is a separate decision
after the saved SQL evidence and all six authenticated browser views agree.
