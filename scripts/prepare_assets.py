#!/usr/bin/env python3
"""Validate the catalog and prepare deterministic, lossless preview assets."""

from __future__ import annotations

import gzip
import hashlib
import json
import re
import struct
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def local_file(url: str) -> Path:
    path = (ROOT / url.lstrip("/")).resolve()
    if ROOT not in path.parents or not path.is_file():
        raise ValueError(f"Missing or unsafe local asset: {url}")
    return path


def resolve_mesh(model: dict, filename: str) -> Path:
    if filename.startswith("package://"):
        package, relative = filename[10:].split("/", 1)
        base = ROOT / model["packageMap"][package].lstrip("/")
    else:
        base = local_file(model["hostedPath"]).parent
        relative = filename
    path = (base / relative).resolve()
    package_root = (ROOT / "models" / model["id"]).resolve()
    if package_root not in path.parents or not path.is_file():
        raise ValueError(f"{model['id']}: missing or unsafe mesh {filename}")
    return path


def validate_catalog(records: list[dict]) -> None:
    ids = set()
    required = ("id", "name", "maker", "kind", "access", "formats", "license", "sourceUrl")
    for model in records:
        for key in required:
            if not model.get(key):
                raise ValueError(f"Missing {key} in catalog record {model.get('id')}")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", model["id"]) or model["id"] in ids:
            raise ValueError(f"Invalid or duplicate model ID: {model['id']}")
        ids.add(model["id"])
        if model["kind"] not in ("robot", "body", "character") or model["access"] not in ("local", "source", "restricted"):
            raise ValueError(f"Invalid category: {model['id']}")
        for key in ("sourceUrl", "modelUrl", "licenseUrl"):
            url = model.get(key, "")
            if not (url.startswith("https://") or url.startswith("/")) or url.startswith("//"):
                raise ValueError(f"Invalid {key}: {model['id']}")
            if url.startswith("/"):
                local_file(url)
        if model.get("image"):
            local_file(model["image"])
        for key in ("dof", "joints", "vertices", "heightM", "weightKg"):
            value = model.get(key)
            if value is not None and (not isinstance(value, (int, float)) or value < 0):
                raise ValueError(f"Invalid measurement {key}: {model['id']}")
        if model["access"] != "local":
            if model.get("hostedPath"):
                raise ValueError(f"Nonlocal record has hosted assets: {model['id']}")
            continue
        tree = ET.parse(local_file(model["hostedPath"]))
        controls = [
            joint for joint in tree.findall("joint")
            if joint.get("type") in ("revolute", "continuous", "prismatic")
            and joint.find("mimic") is None
        ]
        if len(controls) != model["dof"]:
            raise ValueError(f"Joint count does not match catalog: {model['id']}")
        for mesh in tree.findall(".//mesh"):
            resolve_mesh(model, mesh.get("filename", ""))
        source = local_file(f"/models/{model['id']}/SOURCE.md").read_text()
        if not re.search(r"Revision: `([0-9a-f]{40})`", source):
            raise ValueError(f"Missing pinned revision: {model['id']}")
        for frame in range(16):
            local_file(f"/gallery/turntables/{model['id']}/{frame:02}.png")


def write_changed(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file() or path.read_bytes() != data:
        path.write_bytes(data)


def picture(path: Path, width: int) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    target = ROOT / "previews" / "images" / f"{path.stem}-{digest}-{width}.webp"
    if not target.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(path) as image:
            image = image.convert("RGB")
            image.thumbnail((width, width), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=85, method=6)
    return "/" + target.relative_to(ROOT).as_posix()


def prepare_model(model: dict) -> dict:
    entry = {}
    if model.get("image"):
        image = local_file(model["image"])
        entry["images"] = {str(width): picture(image, width) for width in (400, 800)}
    if model["access"] != "local":
        return entry

    package = ROOT / "models" / model["id"]
    tree = ET.parse(local_file(model["hostedPath"]))
    visual_meshes = sorted({
        resolve_mesh(model, mesh.get("filename", ""))
        for mesh in tree.findall(".//visual/geometry/mesh")
    })
    mesh_map = {}
    original_bytes = preview_bytes = 0
    for mesh in visual_meshes:
        data = mesh.read_bytes()
        if mesh.suffix.lower() != ".stl":
            raise ValueError(f"Unsupported preview mesh: {mesh}")
        # Validate binary STL lengths; ASCII STL remains supported by the viewer.
        if len(data) >= 84:
            count = struct.unpack_from("<I", data, 80)[0]
            if not data.lstrip().lower().startswith(b"solid") and len(data) != 84 + count * 50:
                raise ValueError(f"Invalid binary STL: {mesh}")
        digest = hashlib.sha256(data).hexdigest()
        target = ROOT / "previews" / model["id"] / f"{digest[:20]}.stl.gz"
        if not target.is_file():
            write_changed(target, gzip.compress(data, compresslevel=9, mtime=0))
        mesh_map["/" + mesh.relative_to(ROOT).as_posix()] = "/" + target.relative_to(ROOT).as_posix()
        original_bytes += len(data)
        preview_bytes += target.stat().st_size
    entry.update({
        "meshMap": mesh_map,
        "meshCount": len(visual_meshes),
        "originalBytes": original_bytes,
        "previewBytes": preview_bytes,
        "frames": [picture(local_file(f"/gallery/turntables/{model['id']}/{i:02}.png"), 800) for i in range(16)],
    })

    # Hash every retained file, including provenance and licensing material.
    files = sorted(p for p in package.rglob("*") if p.is_file() and not p.name.startswith("."))
    checksums = {
        p.relative_to(package).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in files
    }
    package_digest = hashlib.sha256(json.dumps(checksums, sort_keys=True).encode()).hexdigest()
    target = ROOT / "downloads" / f"{model['id']}-{package_digest[:16]}.zip"
    if not target.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in files:
                info = zipfile.ZipInfo(f"{model['id']}/{path.relative_to(package).as_posix()}", (1980, 1, 1, 0, 0, 0))
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, path.read_bytes())
            info = zipfile.ZipInfo(f"{model['id']}/SHA256SUMS", (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, "".join(f"{digest}  {name}\n" for name, digest in checksums.items()))
    entry.update({"downloadPath": "/" + target.relative_to(ROOT).as_posix(), "downloadBytes": target.stat().st_size})
    return entry


def main() -> None:
    records = json.loads((ROOT / "_data/models.json").read_text())
    validate_catalog(records)
    assets = {model["id"]: prepare_model(model) for model in records}
    write_changed(ROOT / "_data/generated_assets.json", (json.dumps(assets, indent=2, sort_keys=True) + "\n").encode())
    # These two directories contain only generated artifacts. Drop old
    # content-addressed versions so changed models do not grow every release.
    referenced = set()
    def collect(value):
        if isinstance(value, dict):
            for item in value.values():
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, str) and value.startswith(("/previews/", "/downloads/")):
            referenced.add(value)
    collect(assets)
    for folder in ("previews", "downloads"):
        for path in (ROOT / folder).rglob("*"):
            if path.is_file() and "/" + path.relative_to(ROOT).as_posix() not in referenced:
                path.unlink()
    original = sum(x.get("originalBytes", 0) for x in assets.values())
    previews = sum(x.get("previewBytes", 0) for x in assets.values())
    print(f"Validated {len(records)} records; lossless visual meshes: {original / 1e6:.1f} MB → {previews / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
