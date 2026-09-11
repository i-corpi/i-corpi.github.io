# i corpi

A Jekyll archive of humanoid robot descriptions and parametric body models.
The site has static record pages, searchable metadata, two-panel 3D comparisons,
joint inspection, 16-angle galleries, complete model downloads, and a guide
connecting bodies, motion, actions and robot-learning data.
The catalog contains 16 robots, four human body models and an authored Olaf
snowman character study.

## Serve locally

Requirements: Ruby 2.6+ and Python 3.9+. Ruby 3.3 is used in CI. Node is not
required. Setup installs dependencies in this repository, without sudo.

```bash
./scripts/site setup       # first run; requires internet access
./scripts/site serve       # live reload at http://127.0.0.1:4000/
```

Stop with Ctrl-C. Choose another port with `./scripts/site serve --port 4001`.
Templates, catalog edits, JavaScript, and CSS reload through Jekyll. After adding
or changing model packages or gallery source images, restart the serve command
so compressed assets and complete downloads are regenerated and validated.

To preview the production output:

```bash
./scripts/site preview     # build, then serve _site at http://127.0.0.1:4000/
```

To build without starting a server, and run the static/asset checks:

```bash
./scripts/site build
./scripts/site test
```

Browser tests use an isolated, pinned Chromium installation:

```bash
./scripts/site setup-browser   # one-time download
./scripts/site test-browser    # run after building
```

The browser suite checks search, filtering, navigation/history, comparison,
turntable controls, joint controls, idle rendering, cancelled/failed loads,
retry, unavailable WebGL, mobile layout, and pages without JavaScript. Screenshots
are written to `work/browser/`.

## Pages and serving architecture

- `/`: visual index of all 16 robots.
- `/archive/`: searchable list and an initial model record.
- `/archive/<id>/`: complete HTML record with sources and downloads, readable
  without JavaScript. Legacy `/archive/#<id>` links still work.
- `/compare/?a=unitree-g1&b=unitree-h2`: two independent 3D viewers with expandable
  joint maps and controls, plus a semantic comparison table.
- `/gallery/`: 16-angle robot turntables.
- `/about/`: method and asset ledger.
- `/learn/`: SMPL’s role, format choices, action representations, retargeting and
  a dataset chooser with official sources. `?goal=manipulation&action=episode`
  preserves exploration choices in the URL. All content remains readable
  without JavaScript.

Jekyll reads `_data/models.json` and Liquid templates and writes `_site/`.
`_plugins/catalog.rb` generates the individual model pages and a build identity.
GitHub Pages serves that output; there is no application server or database.

The archive enhances ordinary record links by fetching each static record page,
replacing its detail panel, and updating browser history. Search and comparison
run locally. Archive records import Three.js after clicking **Load interactive
model**. Comparisons load both selected previews automatically. Each side keeps
its own camera and pose when the other side changes, including when comparing
the same model twice. The cameras frame each body independently; use the table
to compare physical measurements.

The viewer uses a separate cancellable owner for every load, aborts obsolete
requests, bounds concurrent mesh requests, releases GPU resources, reports
failed loads with a retry action, and renders only when the scene changes.
Browser modules are documented in `vendor/README.md`.

The landing page displays all robot records. Joint maps project each model's
actual pivots and connect displaced number labels with leader lines; they update
with articulation and resizing. iCub has a presentation-only 180-degree heading
correction, also applied to its gallery renders.

SMPL has a clearly labeled procedural 24-joint pose demonstrator, with 72 local
rotation controls, pose presets, a pausable wave animation, and axis-angle JSON
export. It does not contain licensed SMPL weights or learned body deformation.
SMPL+H has a canonical 52-joint human layout and a default Sharpa hybrid mode
with 22 body joints and two 22-joint robot-hand placements. Its Sharpa assets
come from the pinned las manos bundle; the left placement mirrors the supplied
right-hand URDF. The hybrid exports body rotations and named robot joint
positions separately. SMPL-X adds the canonical 55-joint layout, focused hand
and face maps, jaw/eye rotations and separately labelled illustrative
blink/smile controls. STAR provides its compatible 24-joint procedural layout.
None of these reproduces learned body shape, skinning or pose correctives.

Olaf is an original procedural interpretation of the snowman character, with
16 authored joints, 48 rotation controls, front/side silhouette maps, poses
and expressions. **Move Olaf** adds walking, a 0.30 m step, heading, speed
and camera follow. Forward travel combines whole-rig translation with
animated foot placement; the snow feet have no hidden hip or knee mechanism.
The `i-corpi.olaf-pose.v2` export includes local joint translation offsets
so a walking pose can be reconstructed. Reset view preserves scene position;
Reset position returns the character to the origin.
Its indices and export schema are defined by this site, not an official Disney
rig or robot. Geometry, movement and attribution are in `assets/js/olaf-rig.js`,
`assets/js/olaf-motion.js` and
`characters/olaf/ATTRIBUTION.md`. The Archive's Characters filter and Compare
page both support the new record.

Robot map numbers are site-local labels, grouped by anatomy and sorted by
source joint name. Human map numbers are zero-based pose-array indices.
`/learn/#joint-numbering` explains the distinction, canonical ranges and export
conventions; every record links to it.

Recreate the body posters with `.venv/bin/python scripts/render-body-previews.py`
after a build, then rebuild to generate responsive images.
See [the animation and retargeting guide](docs/animation-and-retargeting.md) for
the distinction between rigs, skinning, animation, and transferring motion.
The public `/learn/` guide expands these ideas with six curated dataset sources,
an action-representation explorer, format roles and capability boundaries.
Maintain its source links and review date in `_data/learning.json`; it does not
download training data or implement a simulator, retargeter or training job.

## Asset build and provenance

`_data/models.json` contains display metadata, upstream and hosted formats,
measurement-source notes, and structured provenance. Dates or exact measurement
citations absent from the source records remain explicitly unknown.

Original redistributable packages live in `models/<id>/`. Preserve the upstream
licence or licence declaration and `SOURCE.md` with the revision and any
transformations. Keep account-gated body-model weights outside the public tree.

All 16 robot records have local packages and interactive previews. The six
latest imports are R1, GR1T1 with Fourier hands, iCub v2.7, IHMC Valkyrie,
K-Bot v2, and QingLoong. Their counts describe the selected URDF variants,
excluding mimic joints. The four restricted body-model records remain links
to their rights holders.

These imports preserve every referenced visual/collision mesh and record
checksummed source files in `models/<id>/UPSTREAM.json`. They can be verified
offline or restored from pinned upstream URLs:

```bash
.venv/bin/python scripts/import_models.py
.venv/bin/python scripts/import_models.py --fetch --model unitree-r1
```

See `models/README.md` and each `SOURCE.md` for reproduction, licensing scope,
and variant details. Valkyrie includes the original textured Collada assets
and a complete STL conversion for the browser. Normal builds need no network
access or ROS installation.

Every build runs `scripts/prepare_assets.py` to validate the catalog and URDF
references and generate:

- Lossless gzip-compressed STL previews. The viewer decompresses these in the
  browser, with original STL fallback where decompression is unavailable.
- Responsive WebP images and turntable frames.
- Complete ZIP packages retaining all local files, licence/source records,
  relative paths, and a `SHA256SUMS` manifest. Existing ROS `package://` references
  retain their package semantics; the six latest imports also provide a root
  URDF with portable relative paths.
- `_data/generated_assets.json`, containing content-addressed URLs and sizes.

`previews/`, `downloads/`, and the generated manifest are build artifacts and
are not committed. Unreferenced generated assets are removed during preparation.
Static tests verify every compressed mesh against the original bytes and every
packaged file against its checksum. Original model files are never simplified.

Gallery regeneration is separate from normal builds. See `gallery/README.md`.
It now renders full geometry through the actual viewer instead of dropping
triangles to approximate a mesh.

## GitHub Pages deployment

In **Settings → Pages**, select **GitHub Actions** as the publishing source.
The repository migration, including templates, `_plugins`, `_data`, source
assets, scripts, and the workflow, must be committed together.

The workflow validates pull requests and pushes to `main`, using the locked
Ruby dependencies and pinned Python packages. It builds and tests both the
configured site path and `/project-preview`. Only successful `main` builds
publish the Pages artifact. A post-deployment check verifies the expected Git
revision, build marker, application routes, CSS, JavaScript, and a model asset;
a README-only or stale deployment fails this check.

For a project-page fork, set `baseurl: /repository-name` in `_config.yml` and
update `url` and `repository`. Both templates and browser asset URLs honor it.
To test a subpath locally:

```bash
./scripts/site build --baseurl /project-preview
.venv/bin/python scripts/preview.py --port 4001
# Open http://127.0.0.1:4001/project-preview/
```

`./scripts/site build` restores the configured path. Inspect a published site:

```bash
python3 scripts/check_deployment.py https://i-corpi.github.io
```

## Main implementation files

- `_layouts/`, `_includes/`, and page templates: shared static HTML.
- `assets/js/archive.js`: search, record navigation, and browser history.
- `assets/js/viewer-panel.js`: shared viewer UI, retry and cancellation ownership.
- `assets/js/record-view.js`: archive viewer mounting and navigation cleanup.
- `assets/js/viewer.js`: network, geometry, WebGL lifecycle, and offline snapshots.
- `assets/js/joint-map.js`: joint grouping, body map, and accessible controls.
- `assets/js/body-layouts.js`, `body-rig.js`: canonical parameter ordering,
  authored procedural geometry, focused maps and model-specific pose exports.
- `assets/js/sharpa-hands.js`, `attachments/sharpa-wave/`: licensed hand assets,
  wrist attachments, scoped robot controls and provenance.
- `assets/js/compare.js`, `gallery.js`: page-specific interactions.
- `learn.html`, `_data/learning.json`, `assets/js/learning.js`: sourced learning
  guide, action examples and shareable dataset filters.
- `scripts/site`: reproducible setup/build/serve/test commands.
- `tests/site_test.py`, `tests/browser_test.py`: validation and real browser checks.
