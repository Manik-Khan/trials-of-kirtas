# Book + editor fixes — deploy manifest

Mirrors the repo. No SQL.

Replaces:
  journal.html (new ?v= stamps)
  journal-assets/journal.js · journal.css
  journal/src/JournalView.jsx
  journal/src/ChronicleView.jsx
  journal/src/styles.css
  journal/src/data/bookModel.js
  journal/smoke-book.mjs (15/15)

Fixes:
1. EDITOR BOX/BULLETS: the pagelink patch added a second editorProps key;
   JS duplicate-key rule silently dropped the first — which carried the
   j-editor-content styling class. Unstyled ProseMirror = default blue
   focus ring + bullets outside the box. Merged into one key.
2. BOOK NAMES: old drawer rows store the CLASS in meta.character
   ('Fighter'). The seat map now leads: character name displays
   (Vesperian Vale), hover reveals the PLAYER ALIAS (thebraveruby), with
   a seat-accent medallion badge (portrait slot; initial for now).
3. BOOK IMAGES: entry images clamp to 420px height (cover-fit, bordered,
   zoom-in cursor); click opens a LIGHTBOX (click anywhere or Esc closes).
