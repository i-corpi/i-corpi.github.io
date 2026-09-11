# Local model packages

This directory is reserved for redistributable humanoid robot descriptions.
Use one folder per archive ID:

```text
models/<id>/
  model.urdf
  meshes/
  textures/
  LICENSE
  SOURCE.md
```

`SOURCE.md` must record the upstream URL, pinned revision, retrieval date,
original licence, and every transformation applied to the files. Preserve the
exact licence shipped with each asset package.

All 16 robot records now have local URDF packages. The hosted review set includes
Unitree G1, Unitree H1, Unitree H2, Unitree R1,
ROBOTIS OP3, PAL TALOS, LAAS Simple Humanoid, Berkeley Humanoid, Booster T1,
ToddlerBot 2XC, EngineAI PM01, Fourier GR1T1 with six-DoF hands, iCub v2.7,
IHMC Valkyrie, K-Bot v2, and QingLoong / AzureLoong. Each browser-ready URDF is pinned to an
upstream revision and exposes its movable joints through the archive viewer.

The six newly imported packages contain `UPSTREAM.json` with pinned download
URLs and SHA-256 checksums. Their root `model.urdf` uses portable relative paths;
the complete package must be kept together. Original URDFs, collision meshes,
and licensing declarations remain under `upstream/`.

Valkyrie's browser geometry is converted from Collada without reducing triangles;
original DAE files and referenced textures are also included. Its conversion
report records per-mesh triangle counts and hashes. K-Bot's hardware license is
documented by the main K-Bot project; the separate asset repository has no
license file. See each package's `SOURCE.md` for exact variants and limitations.

Verify imports offline with `.venv/bin/python scripts/import_models.py`.
Use `--fetch` to restore missing originals from their pinned URLs, and `--rebuild`
to reproduce the portable URDFs. Valkyrie conversion additionally requires
`requirements-import.txt`; serving the site does not.

Do not place SMPL, SMPL+H, SMPL-X, STAR, or other account-gated model weights in
this public directory. Those records should link to the rights holder's official
download flow.
