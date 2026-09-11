# Sharpa Wave browser attachment

Imported from the user's [las manos archive](https://las-manos.github.io/archive/#sharpa-wave).
Repository revision: `6c330aa5a2900f25495c1e38226db07067a6b10d`.
Retrieved: 2026-09-11.

Upstream: [Sharpa Robotics](https://github.com/sharpa-robotics/sharpa-urdf-usd-xml),
revision `6eea427eb24189519f32b9f21674cd534d3f973c`,
`wave_01/right_sharpa_wave/right_sharpa_wave.urdf`.

The imported browser bundle has 22 independent revolute joints and 13 unique
visual GLBs. Its URDF and meshes are retained byte-for-byte from las manos.
`IMPORT.json` records every imported file, source URL, byte size and SHA-256.
`LICENSE`, `NOTICE.txt` and the original `SOURCE.txt` retain upstream notices.

Las manos removed collision geometry, converted visual STL meshes to glTF,
decimated meshes over 24,000 faces, and rewrote mesh paths. This is a browser
visualization bundle, not the complete original simulation package.

The site attaches the right-hand asset to the right wrist of an authored body.
For the left wrist it mirrors the same right-hand asset in the display. This is
not an official left-hand model. Source `right_*` joint names, axes and limits
remain unchanged; exported attachment-side metadata identifies each placement.
The mounting transform is authored for the demonstrator, not calibrated hardware.
The viewer computes surface normals from the imported triangle geometry for
lighting, because these GLBs contain positions and indices without normals.

SMPL+H's native hands are MANO hands. This Sharpa mode is a separate hybrid with
22 three-axis body joints and two sets of 22 scalar robot joint commands.
Its exports use `i-corpi.body-robot-hybrid.v1`, not a native SMPL+H pose schema.
It does not implement tactile sensing, physical simulation or automatic retargeting.
