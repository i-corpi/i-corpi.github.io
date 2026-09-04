# Gallery plates

Every image in this directory is rendered from an asset this archive actually
hosts. None of them are marketing photographs.

## Robot plates

`<id>.png` and `turntables/<id>/00-15.png` are produced by
`scripts/render-urdf-gallery.py`, which reads each pinned local URDF, resolves
its referenced STL geometry, and rasterises 16 camera angles at a fixed
orientation. Frame `00` is copied out as the flat `<id>.png` plate. Re-run the
script after adding a package; it is deterministic.

## Body plate

`smpl.png` is a capture of this site's own `BodyModelViewer` at its default
parameters, composited onto the same plate background as the robot renders.

It is **not** the SMPL mesh. SMPL-family weights are account-gated and are
never redistributed here, so the archive has no real SMPL geometry to render.
The viewer draws a procedural capsule proxy — no mesh, no linear blend
skinning, no blend shapes — and the plate inherits every one of those
limitations. It stands in for the record on index surfaces; the record itself
still links to the Max Planck rights holder for the real model.
