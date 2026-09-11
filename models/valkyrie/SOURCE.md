# Valkyrie — pinned model source

- Repository: https://github.com/ihmcrobotics/valkyrie
- Revision: `45e0e5195fd1e2fc849248e5bcb51a87771edbe4`
- Pinned source: https://github.com/ihmcrobotics/valkyrie/tree/45e0e5195fd1e2fc849248e5bcb51a87771edbe4
- Retrieved: 2026-09-11
- Selected variant: IHMC valkyrie_sim, with fingers and Hokuyo scanner
- Original entry point: `upstream/src/main/resources/models/val_description/urdf/valkyrie_sim.urdf`
- Licence: NASA-1.3

IHMC-maintained Valkyrie simulation description: 43 independent joints, including the Hokuyo scanner, plus 16 mimic joints. Collada geometry is converted to STL for the viewer; original textured assets remain in the package.

## Contents and provenance

`model.urdf` is the portable entry point. Download the complete package and keep
its directory structure intact so its relative mesh paths resolve.
`upstream/` preserves the selected source URDF and all referenced visual and
collision geometry. `UPSTREAM.json` records the exact download URL and SHA-256
of each original file; Git blob hashes and Git LFS object hashes are included
where applicable. The downloadable ZIP adds `SHA256SUMS` for every packaged file.

NASA-1.3 is declared in val_description/package.xml and README.md. LICENSE contains the standard NASA-1.3 text from SPDX v3.27.0; the enclosing IHMC repository Apache-2.0 license is preserved separately under upstream/LICENSE.txt.

The source assets and derived previews retain the model's applicable licence;
the website's own code licence does not replace it. No endorsement by the robot
maker is implied.

## Transformations

- Regenerated the hosted URDF with portable relative mesh paths; retained every referenced visual and collision mesh and the unmodified source URDF.
- Preserved joint definitions, limits, inertias, and mimic relationships.
- Converted every Collada scene instance to binary STL in metres without reducing triangles; scene transforms are baked into geometry.
- STL previews omit Collada textures and materials. Original DAE files and all referenced textures are retained, with two whiteTexture filenames matched to the spelling used by upstream DAE references.

## Measurement interpretation

The selected URDF contains 81 links, 80
total joints, 59 movable joints, and 16 mimic joints.
The catalog reports **43 independent movable joints**. This is a description
of this particular model, not the manufacturer's total actuator count.
Existing height and mass values, if displayed, are retained from the earlier
catalog; their exact measurement citations were not recorded. No dimensions
or physical mass have been inferred from the preview geometry.

## Reproduction

From the website repository root:

```bash
.venv/bin/python scripts/import_models.py --model valkyrie
# Restore missing originals from the pinned URLs, with checksum verification:
.venv/bin/python scripts/import_models.py --fetch --model valkyrie
.venv/bin/pip install -r requirements-import.txt
.venv/bin/python scripts/import_models.py --rebuild --model valkyrie
.venv/bin/python scripts/render-urdf-gallery.py --from-source --model valkyrie
./scripts/site build
```

`CONVERSION.json` records the triangle count, metric bounds, and source/output hashes for each Collada conversion. The maintained upstream URDF is already expanded, so ROS and Xacro are not required.
