#!/usr/bin/env python3
"""Verify or restore the pinned robot imports, and reproduce their hosted URDFs.

  .venv/bin/python scripts/import_models.py
  .venv/bin/python scripts/import_models.py --fetch --model unitree-r1
  .venv/bin/pip install -r requirements-import.txt
  .venv/bin/python scripts/import_models.py --rebuild

--fetch downloads missing originals only, verifying the recorded SHA-256 before
writing. Existing files with different contents fail verification. Nothing is
downloaded during normal website builds. See each package's SOURCE.md.
"""
import argparse
import concurrent.futures
import hashlib
import json
import struct
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def package_file(package, relative):
    path = (package / relative).resolve()
    if package.resolve() not in path.parents:
        raise ValueError(f"Path escapes package: {relative}")
    return path


def verify_source(package, entry, fetch=False):
    path = package_file(package, entry["path"])
    if path.is_file():
        data = path.read_bytes()
    elif fetch:
        url = urllib.parse.urlsplit(entry["url"])
        if url.scheme != "https" or url.hostname not in (
            "raw.githubusercontent.com", "media.githubusercontent.com",
        ):
            raise ValueError(f"Unexpected source URL: {entry['url']}")
        request = urllib.request.Request(entry["url"], headers={"User-Agent": "i-corpi-asset-import"})
        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read()
    else:
        raise ValueError(f"Missing upstream file: {path}")
    if hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise ValueError(f"Upstream checksum mismatch: {path}")
    if data.startswith(b"version https://git-lfs.github.com/spec/v1"):
        raise ValueError(f"Git LFS pointer is not a model asset: {path}")
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def convert_collada(source, destination):
    """Bake all scene instances into binary STL, without reducing triangles."""
    import collada
    import numpy as np

    document = collada.Collada(str(source))
    if document.assetInfo.upaxis != "Z_UP":
        raise ValueError(f"Unexpected Collada axis: {source}")
    if document.scene is None:
        raise ValueError(f"Missing Collada scene: {source}")
    parts = []
    for geometry in document.scene.objects("geometry"):
        for primitive in geometry.primitives():
            if hasattr(primitive, "triangleset"):
                primitive = primitive.triangleset()
            if not isinstance(primitive, collada.triangleset.BoundTriangleSet):
                raise ValueError(f"Unsupported Collada primitive: {source}")
            # Bound primitives already include the Collada node transforms.
            parts.append(primitive.vertex[primitive.vertex_index])
    if not parts:
        raise ValueError(f"Empty Collada geometry: {source}")
    triangles = np.concatenate(parts) * (document.assetInfo.unitmeter or 1.0)
    if not np.isfinite(triangles).all():
        raise ValueError(f"Non-finite Collada geometry: {source}")
    normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    lengths = np.linalg.norm(normals, axis=1)
    normals /= np.where(lengths > 0, lengths, 1)[:, None]
    dtype = np.dtype([("normal", "<f4", (3,)), ("vertices", "<f4", (3, 3)), ("attribute", "<u2")])
    records = np.zeros(len(triangles), dtype=dtype)
    records["normal"] = normals
    records["vertices"] = triangles
    data = b"i-corpi Collada conversion; full geometry; see SOURCE.md".ljust(80, b"\0")
    data += struct.pack("<I", len(triangles)) + records.tobytes()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return {
        "triangles": len(triangles),
        "boundsMetres": [triangles.min(axis=(0, 1)).tolist(), triangles.max(axis=(0, 1)).tolist()],
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "outputSha256": hashlib.sha256(data).hexdigest(),
    }


def rebuild(package, manifest):
    document = ET.parse(package_file(package, manifest["entrypoint"])).getroot()
    conversions = {}
    paths = {}
    for original, upstream_path in manifest["meshPaths"].items():
        source = package_file(package, "upstream/" + upstream_path)
        if source.suffix.lower() == ".dae":
            relative = Path("meshes") / Path(upstream_path.split("/model/meshes/", 1)[1]).with_suffix(".stl")
            target = package_file(package, relative)
            conversions[relative.as_posix()] = convert_collada(source, target)
            paths[original] = relative.as_posix()
        else:
            paths[original] = "upstream/" + upstream_path
    for mesh in document.findall(".//mesh"):
        mesh.set("filename", paths[mesh.get("filename")])
    # Simulation-only meshdir values become stale when rebasing the package.
    # They are outside URDF and the hosted description is for URDF consumers.
    # The original extension remains in the unmodified upstream file.
    for extension in document.findall("mujoco"):
        document.remove(extension)
    ET.indent(document, space="  ")
    header = (b'<?xml version="1.0" encoding="utf-8"?>\n'
              b'<!-- i-corpi: portable mesh paths; originals retained under upstream/. See SOURCE.md. -->\n')
    (package / "model.urdf").write_bytes(header + ET.tostring(document, encoding="utf-8") + b"\n")
    if conversions:
        (package / "CONVERSION.json").write_text(json.dumps(conversions, indent=2) + "\n")


def main():
    manifests = sorted((ROOT / "models").glob("*/UPSTREAM.json"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", action="append", choices=[path.parent.name for path in manifests])
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args()
    for path in manifests:
        if args.model and path.parent.name not in args.model:
            continue
        manifest = json.loads(path.read_text())
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(verify_source, path.parent, entry, args.fetch) for entry in manifest["files"]]
            for future in futures:
                future.result()
        if args.rebuild:
            rebuild(path.parent, manifest)
        print(f"{path.parent.name}: verified {len(manifest['files'])} pinned source files", flush=True)


if __name__ == "__main__":
    main()
