# Topography visual pass — 2026-07-13a

## Included

- Scale-correct upright flora: visible solid height now follows the same feet-to-world conversion as the terrain tiers.
- Authored per-biome fog ranges are used instead of one generic map-span formula.
- Three-band toon ramp, lighter ambient darkening, and thinner prop outlines.
- Biome-colored cliff faces with a bright lip, broad strata, and sparse erosion marks.
- Six biome-specific transparent horizon paintings.
- One 4×4 transparent surface-decal atlas, clustered sparsely across open terrain.
- Bounded local PointLights with visible magical sources; three on small screens, up to six on larger screens.
- Combat presentation mode that fades Forge controls but keeps a persistent hammer-button door back.

## Mechanical boundary

The new horizons, decals and glow sources are decorative only. They do not enter `F.occ`, `wall`, collision, cover, range, replay, or network state. No new large solid landmark was added without a matching geometry contract.

## Tuning doors

- Add `?fxlights=0` to disable local lights for performance comparisons.
- Existing `?lightmul=` continues to affect only the restored legacy global lights.
