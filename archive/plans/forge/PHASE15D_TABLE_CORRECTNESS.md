# Battle Forge Phase 1.5d — table correctness

Version: `1.0.0`

## Viewer model

Authority and presentation are separate.

- **Authority** continues to come from the signed-in account, session row, controller claims, RLS and Forge protocol.
- **Presentation** is a local browser choice for privileged users.

A real player always receives Player View. Staff/DM/overseer accounts default to Staff View and can locally enter Player View from the Forge menu. The preference is stored in `localStorage` under `tok-forge-view-mode-v1` and is never broadcast.

`ForgeTableCorrectness.viewerSnapshot()` is the shared disclosure seam. Future fog, effects, feed and tactical overlays should consult the same viewer state rather than inventing independent role checks.

## Enemy disclosure

Player View:

- omits hidden foes from initiative through `foeVisible()`;
- omits enemy HP from visible initiative chips;
- suppresses the complete active-enemy BG3 HUD;
- removes enemy combat internals from any state passed to the HUD;
- removes the overseer toolbar.

Staff View keeps the complete board-management surface.

This is defense in depth for presentation, not a substitute for server/RLS authorization.

## Bestiary token identity

A foe's bestiary identity is `{name, source}`. It survives:

`5e.tools picker → saved/shelf row → session roster → combat unit → ForgeUnitArt`

Automatic art resolution is:

1. authoritative `tokenArt` / `tokenUrl`;
2. local per-combatant override;
3. local creature/character default;
4. PC portrait;
5. explicit statblock art;
6. same-origin bestiary token proxy;
7. direct 5e.tools retry;
8. initials fallback.

The proxy is deliberately not a generic URL proxy. It accepts only a validated source/name pair and constructs the fixed 5e.tools bestiary-token path itself.

## Resource aliases

The sheet/storage contract and combat contract may use different names. For Ki:

- raw sheet key: `kiPoints`;
- canonical combat key: `ki`;
- pool `rawKey`: `kiPoints`.

The table-correctness layer wraps the existing derivation doors and normalizes the resulting kit, leaving the underlying sheet untouched.

## Slot selection

A leveled spell with several eligible available slot levels always opens the chooser. Upcast scaling is not the condition for asking; resource ambiguity is.

The chooser identifies when a higher slot gives no additional effect. Persistent spell mechanics remain separate from resource selection.

## Cover adjudication

Cover Contest remains a deliberate one-shot pre-roll action. It is never automatic, because routine cover should not stop every attack. It is never post-roll, because a retroactive cover change could alter the hit verdict and expose target-number information.

## Feed authority

The right-side Forge feed paints structured facts, not the predictive attack narration.

- `attack_declared` is cached for compatibility with existing logs.
- `attack_resolved` is authoritative for final hit, damage and reaction-adjusted results.
- New resolved rows repeat display facts so losing a declaration cannot degrade the feed.
- `ability_used` paints healing/effect outcomes.
- Local sandbox actions use the same fact renderer.

The renderer deliberately excludes enemy AC.

## Next seams

- The effect ledger should use the same feed and viewer-disclosure paths.
- Fog should replace today's permissive `foeVisible()` implementation without changing HUD code.
- The firing-position preview should classify direct-attack cells from canonical geometry and honor Player View/fog before painting anything.
