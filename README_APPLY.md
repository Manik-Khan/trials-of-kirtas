# Battle Forge — Phase 1.5c top-down token rig

This is an **incremental** bundle for the working July 13b production-camera build. Apply the 3D ↔ Top-down camera bundle first; this patcher refuses a file that lacks its camera markers.

## What this bite changes

- Keeps the existing standees in **3D** view.
- Shows flat circular tokens in **Top-down** view.
- Uses existing PC portraits automatically.
- Resolves 5e.tools bestiary token art from each monster’s statblock source/name, with explicit statblock art preferred when present.
- Falls back to a generated initials token if any image is absent or fails to load.
- Adds per-combatant and per-character/creature-kind overrides.
- Accepts either an image URL or a local image file.
- Keeps one shared unit for movement, selection, targeting, hit flash, death/revival, inspection, God Mode, and the coming fog-of-war system.
- Adds no multiplayer protocol fact and no database migration.

## Apply through a browser

1. Open `tools/forge-topdown-token-rig-browser-patcher.html` locally.
2. Choose the **current working** `forge/topography-test-mock.html` that already contains the 3D ↔ Top-down camera.
3. Click **Validate, patch, and download**.
4. Upload the downloaded replacement to `forge/topography-test-mock.html` in GitHub.
5. Upload these new files with their paths intact:
   - `forge/forge-unit-art.js`
   - `forge/TOPDOWN_TOKEN_RIG.md`
   - `forge/tests/smoke-unit-art.js`
   - `forge/tests/smoke-token-rig-contract.js`

The browser patcher is offline and count-guarded. It aborts on drift rather than guessing.

## Apply from a checkout

From the repository root:

```bash
node /path/to/unzipped-bundle/tools/apply-forge-topdown-token-rig.js .
node forge/tests/smoke-unit-art.js
node forge/tests/smoke-token-rig-contract.js
```

Then run the existing Forge battery and inspect the diff. The script makes no commit and performs no push.

## Browser checks

1. Start a fight in 3D. Existing standees should look unchanged.
2. Switch to Top-down. Every living unit should become a circular token at the same cell and tier.
3. Select, target, move, damage, down, and heal a unit in Top-down.
4. Confirm a monster uses its bestiary token and a PC uses its portrait.
5. Select a unit and choose **Token art…**:
   - set a one-combatant override;
   - set a creature/character default;
   - choose a local image;
   - clear each scope explicitly.
6. Use **Use default** and confirm it clears only the selected combatant override.
7. Switch repeatedly between views during movement and targeting.
8. As overseer, confirm God Mode can select a top-down token.

## Important boundary

Overrides saved through this UI are local to the current browser/device. A future shared-art bite may publish `tokenArt` in session/roster metadata; the resolver already honors that field with highest precedence.
