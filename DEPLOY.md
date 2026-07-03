# Comments arc — deploy manifest

Contents mirror the repo root of `Manik-Khan/trials-of-kirtas` exactly —
upload each file to the same path.

## Order of operations
1. **SQL first** (Supabase SQL editor): `journal/sql/schema_delta_journal_comments.sql`
   — `journal_comments` table + RLS + the history-guard trigger. Idempotent.
   Validated on local Postgres 16: owner may flip status but is BLOCKED from
   editing the commenter's words; author may edit own; page delete cascades.
2. **Then the files:**
   Root:              journal.html (new ?v= stamps)
   journal-assets/:   journal.js · journal.css (rebuilt bundles)
   journal/:          smoke-comments.mjs (new)
   journal/sql/:      schema_delta_journal_comments.sql (new)
   journal/src/:      App.jsx · JournalView.jsx · styles.css
   journal/src/editor/:   Attribution.js (new)
   journal/src/comments/: anchor.js · CommentMarks.js · CommentsRail.jsx ·
                          sampleComments.js · accents.js (all new)
   journal/src/data/: supabase-adapter.js · backend.js
3. Hard-refresh.

## What shipped
- Quote-anchored comments on any journal page (yours or a friend's via
  ?character=): select text → ✎ popover → compose in the rail. Strict
  anchoring (exact context → unique quote → ORPHAN to the "since edited"
  log — never a guess). Highlights are ProseMirror DECORATIONS: view-only,
  never serialized into the doc.
- Owner actions: Accept (inserts the atomic `attribution` node after the
  anchored sentence — YOUR write, THEIR words, their color), Edit-then-accept
  (edits what lands on the page; the comment ROW keeps the original — the
  trigger enforces it server-side), Dismiss. Commenters may Withdraw.
- Show/hide-others' toggle. Colored backlinks (dot painted by the linking
  page's seat).
- Seat accents: content stores SEAT KEYS only; paint resolves at render from
  profiles.appearance.accent → fallback palette → stable hash. The color
  input next to Share to Chronicle (own vault) saves via set_my_appearance
  (full merged object — the RPC replaces). Changing it repaints every chip,
  underline, and dot, past and future, by construction.

## Verify-once flag
The repo's set_my_appearance body says `where id = auth.uid()`, but the
pinned RLS lesson from the appearance arc says profiles.user_id is the auth
UID. Appearance works live, so the DEPLOYED function likely differs from the
committed file. One glance in Supabase → Functions settles it; if the
deployed one also says `id`, accent saves will silently no-op (same 0-row
class as the session bug) and I'll patch it next session.

## Validation
smoke-comments.mjs 21/21 (anchor engine · Attribution round-trip ·
decorations paint/drop/never-serialize · adapter contracts incl. full-merge
accent save) · smoke-journal.mjs 81/81 · smoke-org.mjs 14/14 · SQL T1–T5 ·
vite build clean. Preview: journal-preview-comments.html (standalone; seeded
with one anchored comment and one deliberate orphan).
