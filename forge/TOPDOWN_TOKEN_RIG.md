# Battle Forge — top-down token rig

Version: `1.0.0`

## Purpose

The Forge now treats a combatant as one rules object with two view-only representations:

- **3D view:** the existing animated/pixel standee;
- **Top-down view:** a flat circular tactical token at the same world position and terrain height.

The camera view changes the representation, not the combat state. Movement, targeting, selection, damage, death, revival, inspection, God Mode, and the future fog-of-war gate continue to address one unit.

## Art resolution order

`forge-unit-art.js` resolves token art in this order:

1. authoritative `unit.tokenArt` / `unit.tokenUrl` metadata;
2. this-device override for the individual combatant;
3. this-device default for the character or creature kind;
4. existing PC portrait;
5. explicit token/image data on a monster statblock;
6. derived 5e.tools token path from statblock `source` + `name`;
7. generated initials token.

A failed remote image never removes a combatant. The initials token remains mounted as the fallback texture.

## Customization scopes

- **This combatant only:** useful for Goblin 2, a named NPC, a transformed character, or a one-off boss skin.
- **Creature / character default:** applies to every matching statblock identity (`source + name`) or PC character key.

The panel’s **Use default** button clears only the selected combatant’s override. It does not silently delete a creature/character default. The editor’s **Clear this scope** button is the explicit door for removing either scope.

Customization accepts:

- an `http(s)` image URL;
- an image data URL;
- a local image file.

Local files are center-cropped to a square and reduced to 384×384 before being persisted in this device’s `localStorage`.

## Multiplayer boundary

This bite intentionally adds no protocol fact or database migration. Local overrides are presentation preferences on each device. The resolver already accepts `tokenArt` metadata on a unit/session roster row, which is the future shared-authority seam when table-wide art assignment is designed.

## Fog dependency

`syncUnitVisual(unit)` owns the representation switch and calls the existing `foeVisible(unit)` seam. Party-shared fog should update that seam and then resync the rig. It must not separately hide the standee and top-down token.

## Size boundary

All top-down discs occupy one visual grid cell for now. Creature-size footprints remain a later rules/data task; the art must not imply a multi-cell footprint that movement and targeting do not yet enforce.
