# Local model packages

This directory is reserved for redistributable humanoid robot descriptions.
Use one folder per archive ID:

```text
public/models/<id>/
  model.urdf
  meshes/
  textures/
  LICENSE
  SOURCE.md
```

`SOURCE.md` must record the upstream URL, pinned revision, retrieval date,
original licence, and every transformation applied to the files. Preserve the
exact licence shipped with each asset package.

The hosted review set currently includes Unitree G1, Unitree H1, Unitree H2,
ROBOTIS OP3, PAL TALOS, LAAS Simple Humanoid, Berkeley Humanoid, Booster T1,
ToddlerBot 2XC, and EngineAI PM01. Each browser-ready URDF is pinned to an
upstream revision and exposes its movable joints through the archive viewer.

Do not place SMPL, SMPL+H, SMPL-X, STAR, or other account-gated model weights in
this public directory. Those records should link to the rights holder's official
download flow.
