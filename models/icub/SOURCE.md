# iCub — pinned model source

- Repository: https://github.com/robotology/icub-models
- Revision: `dca8c618c264be70ce285bad38040411725e3551`
- Pinned source: https://github.com/robotology/icub-models/tree/dca8c618c264be70ce285bad38040411725e3551
- Retrieved: 2026-09-11
- Selected variant: iCubGazeboV2_7
- Original entry point: `upstream/iCub/robots/iCubGazeboV2_7/model.urdf`
- Licence: CC-BY-SA-4.0

iCub v2.7 Gazebo variant: 32 independent joints. This upstream simulation model has rigid hands and simulation-adjusted inertias; the count differs from the complete physical robot.

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

The selected URDF contains 214 links, 213
total joints, 32 movable joints, and 0 mimic joints.
The catalog reports **32 independent movable joints**. This is a description
of this particular model, not the manufacturer's total actuator count.
Existing height and mass values, if displayed, are retained from the earlier
catalog; their exact measurement citations were not recorded. No dimensions
or physical mass have been inferred from the preview geometry.

## Reproduction

From the website repository root:

```bash
.venv/bin/python scripts/import_models.py --model icub
# Restore missing originals from the pinned URLs, with checksum verification:
.venv/bin/python scripts/import_models.py --fetch --model icub
.venv/bin/python scripts/import_models.py --rebuild --model icub
.venv/bin/python scripts/render-urdf-gallery.py --from-source --model icub
./scripts/site build
```
