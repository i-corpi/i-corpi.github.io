# K-Bot — pinned model source

- Repository: https://github.com/kscalelabs/kscale-assets
- Revision: `f51d6ea19b8b824dd7661600c7a87f3691f770be`
- Pinned source: https://github.com/kscalelabs/kscale-assets/tree/f51d6ea19b8b824dd7661600c7a87f3691f770be
- Retrieved: 2026-09-11
- Selected variant: K-Bot v2, no-hands description
- Original entry point: `upstream/kbot-v2/robot.urdf`
- Licence: CERN-OHL-S-2.0

K-Scale K-Bot v2 no-hands description: 20 independent joints. Hardware licensing follows the K-Bot project declaration; kscale-assets has no separate license file. Actual Git LFS meshes are included.

## Contents and provenance

`model.urdf` is the portable entry point. Download the complete package and keep
its directory structure intact so its relative mesh paths resolve.
`upstream/` preserves the selected source URDF and all referenced visual and
collision geometry. `UPSTREAM.json` records the exact download URL and SHA-256
of each original file; Git blob hashes and Git LFS object hashes are included
where applicable. The downloadable ZIP adds `SHA256SUMS` for every packaged file.

The K-Bot project README assigns hardware components to CERN-OHL-S-2.0 and software to GPL v3. The separate kscale-assets repository has no license file. This model is a K-Bot hardware description; the project declaration and both texts are preserved. No MIT license is claimed for these assets.

The source assets and derived previews retain the model's applicable licence;
the website's own code licence does not replace it. No endorsement by the robot
maker is implied.

## Transformations

- Regenerated the hosted URDF with portable relative mesh paths; retained every referenced visual and collision mesh and the unmodified source URDF.
- Preserved joint definitions, limits, inertias, and mimic relationships.
- Resolved Git LFS pointers to their actual STL contents and verified LFS SHA-256 and size.

## Measurement interpretation

The selected URDF contains 23 links, 22
total joints, 20 movable joints, and 0 mimic joints.
The catalog reports **20 independent movable joints**. This is a description
of this particular model, not the manufacturer's total actuator count.
Existing height and mass values, if displayed, are retained from the earlier
catalog; their exact measurement citations were not recorded. No dimensions
or physical mass have been inferred from the preview geometry.

## Reproduction

From the website repository root:

```bash
.venv/bin/python scripts/import_models.py --model kbot
# Restore missing originals from the pinned URLs, with checksum verification:
.venv/bin/python scripts/import_models.py --fetch --model kbot
.venv/bin/python scripts/import_models.py --rebuild --model kbot
.venv/bin/python scripts/render-urdf-gallery.py --from-source --model kbot
./scripts/site build
```
