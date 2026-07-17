# GitHub web upload manifest

Upload these paths exactly as shown:

- `forge/topography-test-mock.html` — replaces the existing mock.
- `forge/assets/topography-art/biome-decals.png`
- `forge/assets/topography-art/horizon-grass.png`
- `forge/assets/topography-art/horizon-druidic.png`
- `forge/assets/topography-art/horizon-tundra.png`
- `forge/assets/topography-art/horizon-swamp.png`
- `forge/assets/topography-art/horizon-temple.png`
- `forge/assets/topography-art/horizon-cavern.png`

`ART-PREVIEW.png` and `PATCH-NOTES.md` are review files and do not need to be deployed.

## Browser-only workflow

1. Open the repository folder in GitHub.
2. Upload the `forge/assets/topography-art/` files first.
3. Replace `forge/topography-test-mock.html` last.
4. Commit all uploaded files in the same commit when possible.
5. Hard-refresh the deployed mock after Netlify finishes.

No terminal commands are required.
