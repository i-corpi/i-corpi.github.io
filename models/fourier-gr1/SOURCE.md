# GR-1 — pinned model source

- Repository: https://github.com/FFTAI/Wiki-GRx-Models
- Revision: `7d96c758f048fe1bf92b3258864d94771ae0c093`
- Pinned source: https://github.com/FFTAI/Wiki-GRx-Models/tree/7d96c758f048fe1bf92b3258864d94771ae0c093
- Retrieved: 2026-09-11
- Selected variant: GR1T1 with Fourier six-DoF hands
- Original entry point: `upstream/GRX/GR1/gr1t1/urdf/gr1t1_fourier_hand_6dof.urdf`
- Licence: GPL-3.0

GR1T1 with both Fourier six-DoF hands: 44 independent joints and 10 additional mimic joints.

## Contents and provenance

`model.urdf` is the portable entry point. Download the complete package and keep
its directory structure intact so its relative mesh paths resolve.
`upstream/` preserves the selected source URDF and all referenced visual and
collision geometry. `UPSTREAM.json` records the exact download URL and SHA-256
of each original file; Git blob hashes and Git LFS object hashes are included
where applicable. The downloadable ZIP adds `SHA256SUMS` for every packaged file.

The upstream repository license is preserved verbatim as LICENSE and in upstream/.

The source assets and derived previews retain the model's applicable licence;
the website's own code licence does not replace it. No endorsement by the robot
maker is implied.

## Transformations

- Regenerated the hosted URDF with portable relative mesh paths; retained every referenced visual and collision mesh and the unmodified source URDF.
- Preserved joint definitions, limits, inertias, and mimic relationships.

## Measurement interpretation

The selected URDF contains 71 links, 70
total joints, 54 movable joints, and 10 mimic joints.
The catalog reports **44 independent movable joints**. This is a description
of this particular model, not the manufacturer's total actuator count.
Existing height and mass values, if displayed, are retained from the earlier
catalog; their exact measurement citations were not recorded. No dimensions
or physical mass have been inferred from the preview geometry.

## Reproduction

From the website repository root:

```bash
.venv/bin/python scripts/import_models.py --model fourier-gr1
# Restore missing originals from the pinned URLs, with checksum verification:
.venv/bin/python scripts/import_models.py --fetch --model fourier-gr1
.venv/bin/python scripts/import_models.py --rebuild --model fourier-gr1
.venv/bin/python scripts/render-urdf-gallery.py --from-source --model fourier-gr1
./scripts/site build
```
