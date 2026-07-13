# Build A v3 — Integration Patch

This patch wires the Build A v2 art into the latest topography visual-pass mock.

## Production files

- `forge/topography-test-mock.html`
- `forge/assets/topography-art/`
- `forge/assets/forge-horizons/`
- `forge/assets/forge-skies-storybook/`
- `forge/assets/forge-parallax/`
- `forge/assets/forge-landmarks/`

## Runtime behavior

For the selected biome, the mock now stacks:

1. storybook sky
2. painted horizon
3. far parallax card
4. mid parallax card
5. near parallax card
6. one deterministic optional landmark card

The cards remain behind the battlefield and never enter the map document, collision, cover, range, replay, or combat state.

## Browser comparison switches

- `?storybook=0` — restores the previous gradient + repeated cylinder
- `?parallax=0` — keeps sky and horizon, hides the three depth cards
- `?landmarks=0` — hides the optional landmark

These switches may be combined.

## Patch base

This was built against the previously supplied visual-pass version of `forge/topography-test-mock.html`, not against an independently edited live GitHub copy. If the live file has received edits since that upload, compare before replacing it.
