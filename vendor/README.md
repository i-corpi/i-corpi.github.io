# Browser dependencies

The website imports these local files only when a visitor loads a 3D model.
`manifest.json` records a SHA-256 digest for every vendored JavaScript file.

- Three.js: release **r169**, under `THREE-LICENSE.txt`.
- OrbitControls, STLLoader, GLTFLoader and BufferGeometryUtils: match the r169 sources with `three` imports
  changed to `./three.module.js`.
- URDFLoader and URDFClasses: from `gkjohnson/urdf-loaders`, under
  `URDF-LOADER-LICENSE.txt`. The original imported release was not recorded.
  Their exact local contents are identified by the manifest hashes. URDFLoader
  uses relative imports and supports STL meshes and URDF primitives.
  The Sharpa attachment supplies a GLTF mesh callback using the matched loader;
  its pinned GLBs are untextured, self-contained meshes with no external requests.

When updating a dependency, record its upstream release or commit, preserve its
licence, update the manifest digest, and run the browser suite. The application
owns cancellable loading in `assets/js/viewer.js`; keep that behavior outside the
vendored libraries.
