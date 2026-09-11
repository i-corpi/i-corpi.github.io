# R1 — pinned model source

- Repository: https://github.com/unitreerobotics/unitree_ros
- Revision: `7d6075f7f58588b189b940130e3edab3c839b2df`
- Pinned source: https://github.com/unitreerobotics/unitree_ros/tree/7d6075f7f58588b189b940130e3edab3c839b2df
- Retrieved: 2026-09-11
- Selected variant: R1, 26 DoF
- Original entry point: `upstream/robots/r1_description/R1.urdf`
- Licence: BSD-3-Clause

Unitree R1: 26 independent joints, including the original linkage geometry.

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
- Removed the MuJoCo-only compiler extension from the hosted URDF because its meshdir no longer matches the portable layout; it remains in the original source.

## Measurement interpretation

The selected URDF contains 40 links, 39
total joints, 26 movable joints, and 0 mimic joints.
The catalog reports **26 independent movable joints**. This is a description
of this particular model, not the manufacturer's total actuator count.
Existing height and mass values, if displayed, are retained from the earlier
catalog; their exact measurement citations were not recorded. No dimensions
or physical mass have been inferred from the preview geometry.

## Reproduction

From the website repository root:

```bash
.venv/bin/python scripts/import_models.py --model unitree-r1
# Restore missing originals from the pinned URLs, with checksum verification:
.venv/bin/python scripts/import_models.py --fetch --model unitree-r1
.venv/bin/python scripts/import_models.py --rebuild --model unitree-r1
.venv/bin/python scripts/render-urdf-gallery.py --from-source --model unitree-r1
./scripts/site build
```
