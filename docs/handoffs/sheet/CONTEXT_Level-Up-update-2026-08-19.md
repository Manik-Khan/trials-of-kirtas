# Trials of Kirtas — Focused Level Up handoff

Updated: **2026-08-19**
Repo authority: `Manik-Khan/trials-of-kirtas`
Checkpoint: **`6a427c14d6bb0deb4d94304c38e631c82304cc72`** (`main` = `origin/main`)
Working tree at handoff: **clean before these context-doc edits**

This is the current authority for the guarded focused Level Up candidate. Read
it with root `AGENTS.md` and `CONTEXT.md` before touching Level Up, Soul Shards
spell/feat selection, or the final character-write boundary.

---

## 1. Exact checkpoint

M approved the focused Level Up presentation as a good stopping point after a
real signed-in staging review. The current candidate is intentionally guarded:

- human doorway: `staging/level-up-liadan.html`;
- redirected candidate:
  `shards.html?mode=level-up&character=liadan&class=Bard&levelFlow=1&staging=lu6`;
- guard: `levelFlow=1` / `LEVEL_UP_FOCUS`;
- rollback/control path: omit `levelFlow=1` to receive the existing full Shard
  Reforger;
- no SQL, schema, Forge, Gear, Chronicle, World, or item integration is part of
  this slice.

The commit sequence is:

1. `24a022a` — standalone Líadan mock plus first guarded focused staging flow;
2. `b37f129` — explicit optional Bardic Versatility cantrip replacement;
3. `66bfe7b` — spell/feat descriptions, save-DC presentation, and nested choice
   work;
4. `2d19567` — interaction correction for the Fey Touched ability buttons;
5. `97ccb22` — complete official Fey Touched choice set, Gift of Alacrity,
   overlap labels, and missing-choice gates; and
6. `6a427c1` — descriptions placed immediately beneath their owning spell row.

Do not discard or rewrite those commits. M commits and pushes; Codex never
pushes and commits only on an explicit request.

---

## 2. The approved player case

The staging case is deliberately Líadan, not a generic level editor:

- current character level: **4**;
- current classes: **Bard 3 / Cleric 1**;
- target character level: **5**;
- advancing class: **Bard 3 → 4**;
- unchanged class: **Cleric 1**;
- carried character identity: `liadan` / Líadan Luchóg;
- carried species: Mouseling;
- existing character key must remain unchanged.

The focused rail is progressive and welcoming:

1. **Class** — narrates only Bard 4 gains and asks how to gain the new HP;
2. **Choices** — appears only when the engine says an optional-feature choice
   is owed;
3. **Ability or feat** — resolves the Bard 4 improvement;
4. **Spells** — resolves only the new/optional Bard decisions while keeping
   Bard and Cleric sources distinct; and
5. **Review** — summarizes the pending level change before the existing write.

Creation-only editing of species, background, proficiencies, items,
personality, arbitrary classes, and name is absent. Advanced Reforge remains a
separate concept; the focused flow is not permission to broaden the character.

---

## 3. Settled interaction and rules behavior

### Hit points

HP is not a fixed automatic average. The player must explicitly choose:

- Bard average; or
- roll the Bard d8, with the rolled value shown and reroll available.

The choice is stored for the new Bard class level only. Earlier per-level HP
history remains exactly as saved. Leaving Class is blocked until a method is
chosen.

### Ability score improvement or feat

The real feat catalogue and descriptions are used. Ability Score Improvement
supports the established +2-to-one or +1-to-two behavior. A half-feat ability
choice must be completed before leaving the step.

Fey Touched is the field fixture:

- choose INT, WIS, or CHA for +1;
- Misty Step is granted automatically;
- choose one 1st-level Divination or Enchantment spell;
- the chosen feat ability supplies the feat spellcasting profile and displayed
  save DC;
- the feat source remains separate even if the spell is already known through
  Bard or Cleric.

### Spell catalogue and provenance

`soul-shards-data.js` resolves a filter without `class=` across the official
spell files, rather than limiting it to the base class-list index. That is the
required behavior for Fey Touched and similar feats. **Gift of Alacrity** is an
eligible EGW Divination spell and must remain present.

The Fey Touched window labels:

- already known Bard/Cleric spells;
- spells also on one or both class lists; and
- spells available only through the feat in this build.

This label is informational. Class overlap does not make the feat choice
unselectable because the feat grants an independent source and free cast.

### Bard level 4 spells

The focused Bard step preserves pre-level choices and asks only for the new
entitlements. For this case it requires the newly gained Bard cantrip and Bard
spell. Spell tabs remain separated by spell level. A multiclass slot increase
does not manufacture access to a higher class-spell level.

The ordinary Bard level-up replacement remains optional. Bardic Versatility is
also explicit and optional: it may replace one existing Bard cantrip at this
ASI level, and is separate from the newly gained cantrip. Turning it on without
both the old and replacement cantrip blocks completion; turning it off keeps
the prior cantrips.

### Save DCs and descriptions

Saving-throw spells show the target save and the current applicable source DC.
Bard uses Charisma and Cleric uses Wisdom. Multiclass sources must not collapse
to one swappable universal DC. Fey Touched uses the ability selected in the
feat step.

The information button opens the full spell description as a full-width table
row immediately beneath the spell that owns it. This settled behavior applies
to:

- ordinary class spell rows;
- Fey Touched choices;
- automatically granted feat spells such as Misty Step;
- racial spell grants; and
- subclass/domain spell grants.

Long lists must never separate a spell from its open information panel.
Filtering a Fey Touched list hides or shows the paired detail row with its
spell.

### Missing-choice gates

Forward navigation and Review may not silently accept missing decisions. The
page narrates and highlights the unresolved control for:

- HP method;
- Ability Score Improvement or feat;
- half-feat ability;
- Fey Touched spell;
- new Bard cantrip;
- new Bard spell; and
- an enabled but incomplete Bardic Versatility replacement.

Rail clicks cannot skip over an unresolved focused step. Loading states also
block departure rather than treating an unfinished fetch as no choices owed.

---

## 4. Source ownership

Primary files for this candidate:

- `shards.html` — guarded rail, focused Class/Review presentation, nested
  feat/spell UI, save-DC display, missing-choice gates, and the existing final
  derive/write call;
- `soul-shards-data.js` — official rules-data resolution, including
  non-class-filtered spell choices;
- `staging/level-up-liadan.html` — same-site noindex doorway and cache stamp;
- `_edits/mock-sheet-level-up-liadan.html` — approved standalone interaction
  reference, not the live candidate;
- `tests/smoke/smoke-level-up-focus.mjs` — known answers against the real
  focused functions and markup;
- `tests/smoke/smoke-sheet-level-up-liadan-mock.mjs` — standalone mock contract;
  and
- `tests/smoke/smoke-soulshards-feats.mjs` — feat schema and official filtered
  spell data, including Gift of Alacrity.

Do not touch `theme.css` for this page. Do not edit Forge, Gear, item SQL, or
other production systems as a side effect. Preserve the cache stamp on the
staging doorway whenever inline `shards.html` behavior changes.

---

## 5. Validation authority

Final validation at `6a427c1`:

- `smoke-level-up-focus.mjs` — **56/56**;
- `smoke-shards-level-up.mjs` — **12/12**;
- `smoke-multiclass-slots.js` — **13/13**;
- `smoke-shards-forge.mjs` — **18/18**;
- `smoke-spell-detail.mjs` — **45/45**; and
- `smoke-sheet-level-up-liadan-mock.mjs` — **61/61**.

Total for that final handoff battery: **205/205**. The real inline script in
`shards.html` parsed successfully and `git diff --check` was clean. The focused
smoke executes the actual Bardic Versatility swap, actual Fey Touched renderer,
shared detail-table-row helper, and ordinary spell-row renderer; it is not only
a string-presence test.

Earlier data-specific proof also established the official Fey Touched filter
and Gift of Alacrity in `smoke-soulshards-feats.mjs`. Rerun that test whenever
`soul-shards-data.js` or feat hydration changes.

---

## 6. Field truth and remaining gates

M field-reported and approved:

- the narrower Level Up arrangement and optional-change presentation;
- explicit HP average/roll choice;
- selectable Fey Touched INT/WIS/CHA buttons;
- complete Fey Touched spell selection including Gift of Alacrity;
- class-overlap labels;
- Bardic Versatility's optional cantrip replacement;
- blocking/highlighting when a required choice is missing; and
- spell descriptions directly beneath their owning rows.

Still open:

1. **Do not complete Líadan merely as a test.** `Complete Level Up` reaches the
   existing real character-write path.
2. Audit the final Review/structural payload for the exact Líadan transition,
   including HP, PB/slots, Bard/Cleric casting profiles, ASI/feat, feat spells,
   new Bard choices, optional replacements, Facet snapshot, and unchanged
   inventory/equipment/corrections.
3. Use a safe explicit write plan or M-authorized real transition to prove the
   save and reload. Verify the same character key, one new Facet, no lost
   Cleric data, and no doubled/omitted spells.
4. Only after that proof may M decide whether the regular sheet **Level Up**
   action should enter `levelFlow=1` by default. Keep Advanced Reforge available
   as a separately named action/rollback route.

This handoff does **not** authorize that production route switch or a character
write. Begin the next session by synchronizing HEAD/status and asking M which
subsystem to resume. If M returns to Loot Workshop, read the item handoff and
respect its separate closed production boundary; do not combine the two arcs.
