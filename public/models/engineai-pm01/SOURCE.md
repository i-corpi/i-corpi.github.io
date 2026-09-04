# EngineAI PM01 review package

- Source: https://github.com/engineai-robotics/engineai_amp
- Revision: `83ba64bbb58a02e14483e52adce5f893f3f31cdf`
- Primary file: `source/engineai_lab/assets/pm01/urdf/serial_pm01.urdf`, mirrored here
  as `model.urdf`
- Referenced geometry: `source/engineai_lab/assets/pm01/meshes/*.dae`
- Licence: `LICENSE` (`BSD-3-Clause`, Shenzhen Zhongqing Robot Technology Co.,
  Ltd. / EngineAI)

The upstream URDF's own header comment notes it should be used "for robot
training instead of the version in the `native_sdk` repository, due to
mismatched inertial properties and collision models" — this package pins that
recommended `serial_pm01.urdf` variant rather than the one shipped in
EngineAI's native SDK.

## Transformation applied

The 25 visual meshes ship upstream as COLLADA (`.dae`). The archive's viewer
only loads binary STL, so each mesh was converted losslessly with `trimesh`
(no decimation, no simplification) and the URDF's `mesh filename` references
were rewritten from `../meshes/<name>.dae` to `meshes/<name>.stl`. Geometry,
joint origins, and inertial values are otherwise unchanged from upstream.

## Notes on figures

The hosted URDF defines 23 revolute joints (`dof`/`joints` below); EngineAI's
public spec sheet lists PM01 at 24 DoF, so this training-oriented package is
very likely missing one axis present on the physical unit. Modeled link
masses in this URDF sum to 40.9 kg, close to EngineAI's quoted 40 kg
(with battery). Height (1.38 m) is from EngineAI's public spec sheet, not
derivable from this URDF.
