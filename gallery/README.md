# Gallery plates

Robot `<id>.png` images and `turntables/<id>/00.png` through `15.png` are rendered
from the archive's pinned URDFs through the same Three.js viewer used by the
website. All visual triangles are retained. The older renderer's triangle
subsampling has been removed.

The model list comes from `_data/models.json`. To regenerate:

```bash
./scripts/site setup-browser
./scripts/site build
.venv/bin/python scripts/render-urdf-gallery.py
./scripts/site build
```

Use `--model unitree-g1` to regenerate one package. The renderer uses the pinned
Playwright Chromium build, software WebGL, and 800×800 frames. Missing geometry
fails the render. Camera angles are equally spaced around the model. Source
PNGs remain here; the build generates content-addressed WebP display images
under `previews/`.

For a newly imported record, generate its first real images before the initial
site build with:

```bash
.venv/bin/python scripts/render-urdf-gallery.py --from-source --model unitree-r1
./scripts/site build
```

`--model` can be repeated. The source mode serves the local model and uses the
same viewer/workbench without requiring pre-existing gallery files. Derived
robot images retain the applicable model licence recorded in `models/<id>/SOURCE.md`.

`smpl.png` is a retained illustration of the previous site's procedural capsule
proxy. It is not an SMPL mesh and is not produced by the robot renderer. The
current site shows it as a static illustration; SMPL-family model weights are
not hosted.
