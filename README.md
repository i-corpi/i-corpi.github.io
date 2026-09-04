# i corpi

A source-first archive for humanoid robot descriptions and parametric human
body models. It follows the editorial pattern of `las-manos`: searchable
records, side-by-side comparison, exact asset provenance, and honest handling
of licences and unknowns.

## Site

- `/` — overview and archive coverage
- `/archive` — searchable records with asset detail and an interactive URDF viewer
- `/compare` — side-by-side model comparison
- `/gallery` — 16-angle URDF turntables for the hosted robots
- `/about` — method, licence ledger, and local package convention

## Local model packages

Redistributable files live under `public/models/<id>/`. Each package keeps its
upstream licence and a `SOURCE.md` with a pinned revision and transformation
record. The initial local package is LAAS-CNRS Simple Humanoid (BSD-2-Clause),
shown as a rotatable and zoomable Three.js URDF view.

Account-gated SMPL-family model weights are not redistributed. Their records
link to the Max Planck rights holder's official registration and licence pages.

## Run locally

```bash
npm install
npm run dev
npm run build
```

## GitHub Pages

This repository can also be published as a static GitHub Pages site. The
existing Sites/Cloudflare Worker target remains unchanged; the Pages build
uses `next.config.ts` only when `GITHUB_PAGES=true`.

1. Push this project to a GitHub repository whose default branch is `main`.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. The included workflow at `.github/workflows/deploy-github-pages.yml` builds
   `dist/client`, adds clean directory URLs for the static pages, and deploys
   it on every push to `main` (or manually from the Actions tab).

For a normal project repository, the site publishes at
`https://<owner>.github.io/<repository>/`. The workflow already supplies that
path to the URDF, Three.js, gallery, and download asset URLs. If the repository
is named `<owner>.github.io` and should publish at the domain root, change
`NEXT_PUBLIC_BASE_PATH` to an empty string; `NEXT_PUBLIC_SITE_ORIGIN` already
uses the domain root.

To make the static build locally, provide the same public path values, for
example:

```bash
NEXT_PUBLIC_BASE_PATH=/my-repository \
NEXT_PUBLIC_SITE_ORIGIN=https://my-user.github.io \
npm run build:github-pages
```
