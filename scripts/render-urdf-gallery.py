#!/usr/bin/env python3
"""Render deterministic gallery plates directly from the locally hosted URDFs."""

from __future__ import annotations

import math
import struct
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "gallery"
MODELS = [
    ("unitree-g1", ROOT / "public/models/unitree-g1/model.urdf", ROOT / "public/models/unitree-g1", (48, 55, 51)),
    ("unitree-h1", ROOT / "public/models/unitree-h1/model.urdf", ROOT / "public/models/unitree-h1", (58, 63, 61)),
    ("unitree-h2", ROOT / "public/models/unitree-h2/model.urdf", ROOT / "public/models/unitree-h2", (61, 66, 64)),
    ("robotis-op3", ROOT / "public/models/robotis-op3/model.urdf", ROOT / "public/models/robotis-op3", (48, 75, 87)),
    ("pal-talos", ROOT / "public/models/pal-talos/model.urdf", ROOT / "public/models/pal-talos", (66, 74, 75)),
    ("simple-humanoid", ROOT / "public/models/simple-humanoid/urdf/simple_humanoid.urdf", ROOT / "public/models/simple-humanoid", (65, 70, 65)),
    ("berkeley-humanoid", ROOT / "public/models/berkeley-humanoid/model.urdf", ROOT / "public/models/berkeley-humanoid", (43, 48, 45)),
    ("booster-t1", ROOT / "public/models/booster-t1/model.urdf", ROOT / "public/models/booster-t1", (57, 66, 69)),
    ("toddlerbot", ROOT / "public/models/toddlerbot/model.urdf", ROOT / "public/models/toddlerbot", (55, 68, 72)),
    ("engineai-pm01", ROOT / "public/models/engineai-pm01/model.urdf", ROOT / "public/models/engineai-pm01", (60, 64, 90)),
]


def numbers(value: str | None, count: int, default: float = 0.0) -> np.ndarray:
    vals = [float(v) for v in (value or "").split()]
    vals += [default] * (count - len(vals))
    return np.array(vals[:count], dtype=np.float64)


def transform(xyz: str | None = None, rpy: str | None = None) -> np.ndarray:
    x, y, z = numbers(xyz, 3)
    roll, pitch, yaw = numbers(rpy, 3)
    cr, sr, cp, sp, cy, sy = math.cos(roll), math.sin(roll), math.cos(pitch), math.sin(pitch), math.cos(yaw), math.sin(yaw)
    rx = np.array([[1, 0, 0], [0, cr, -sr], [0, sr, cr]])
    ry = np.array([[cp, 0, sp], [0, 1, 0], [-sp, 0, cp]])
    rz = np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]])
    out = np.eye(4)
    out[:3, :3] = rz @ ry @ rx
    out[:3, 3] = (x, y, z)
    return out


def origin_matrix(node: ET.Element) -> np.ndarray:
    origin = node.find("origin")
    return transform(origin.get("xyz"), origin.get("rpy")) if origin is not None else np.eye(4)


def read_stl(path: Path) -> np.ndarray:
    data = path.read_bytes()
    if len(data) >= 84:
        count = struct.unpack_from("<I", data, 80)[0]
        expected = 84 + count * 50
        if 0 < count and expected <= len(data):
            dtype = np.dtype([("normal", "<f4", (3,)), ("vertices", "<f4", (3, 3)), ("attr", "<u2")])
            return np.frombuffer(data, dtype=dtype, count=count, offset=84)["vertices"].astype(np.float64)
    vertices = []
    for line in data.decode("utf-8", "ignore").splitlines():
        parts = line.strip().split()
        if len(parts) == 4 and parts[0].lower() == "vertex":
            vertices.append([float(v) for v in parts[1:]])
    usable = len(vertices) - len(vertices) % 3
    return np.asarray(vertices[:usable], dtype=np.float64).reshape(-1, 3, 3)


def box_triangles(size: np.ndarray) -> np.ndarray:
    x, y, z = size / 2
    v = np.array([[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]])
    f = np.array([[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]])
    return v[f]


def cylinder_triangles(radius: float, length: float, sides: int = 18) -> np.ndarray:
    out = []
    z0, z1 = -length / 2, length / 2
    for i in range(sides):
        a, b = 2 * math.pi * i / sides, 2 * math.pi * (i + 1) / sides
        p0, p1 = [radius * math.cos(a), radius * math.sin(a)], [radius * math.cos(b), radius * math.sin(b)]
        out.extend([
            [[p0[0],p0[1],z0],[p1[0],p1[1],z0],[p1[0],p1[1],z1]],
            [[p0[0],p0[1],z0],[p1[0],p1[1],z1],[p0[0],p0[1],z1]],
            [[0,0,z0],[p1[0],p1[1],z0],[p0[0],p0[1],z0]],
            [[0,0,z1],[p0[0],p0[1],z1],[p1[0],p1[1],z1]],
        ])
    return np.asarray(out, dtype=np.float64)


def sphere_triangles(radius: float, rings: int = 10, sides: int = 18) -> np.ndarray:
    out = []
    for r in range(rings):
        p0, p1 = -math.pi / 2 + math.pi * r / rings, -math.pi / 2 + math.pi * (r + 1) / rings
        for i in range(sides):
            a0, a1 = 2 * math.pi * i / sides, 2 * math.pi * (i + 1) / sides
            def p(phi: float, theta: float) -> list[float]:
                return [radius * math.cos(phi) * math.cos(theta), radius * math.cos(phi) * math.sin(theta), radius * math.sin(phi)]
            out.extend([[p(p0,a0),p(p0,a1),p(p1,a1)],[p(p0,a0),p(p1,a1),p(p1,a0)]])
    return np.asarray(out, dtype=np.float64)


def geometry_triangles(geometry: ET.Element, package_root: Path) -> np.ndarray | None:
    mesh = geometry.find("mesh")
    if mesh is not None:
        source = mesh.get("filename", "")
        relative = source.split("/", 3)[-1] if source.startswith("package://") else source
        path = package_root / relative
        if not path.exists():
            return None
        tris = read_stl(path)
        scale = numbers(mesh.get("scale"), 3, 1.0)
        return tris * scale
    box = geometry.find("box")
    if box is not None:
        return box_triangles(numbers(box.get("size"), 3, 1.0))
    cylinder = geometry.find("cylinder")
    if cylinder is not None:
        return cylinder_triangles(float(cylinder.get("radius", ".1")), float(cylinder.get("length", ".2")))
    sphere = geometry.find("sphere")
    if sphere is not None:
        return sphere_triangles(float(sphere.get("radius", ".1")))
    return None


def render(model_id: str, urdf: Path, package_root: Path, base_color: tuple[int, int, int]) -> None:
    root = ET.parse(urdf).getroot()
    links = {link.get("name", ""): link for link in root.findall("link")}
    children: dict[str, list[tuple[str, np.ndarray]]] = {}
    child_names = set()
    for joint in root.findall("joint"):
        parent, child = joint.find("parent"), joint.find("child")
        if parent is None or child is None:
            continue
        parent_name, child_name = parent.get("link", ""), child.get("link", "")
        children.setdefault(parent_name, []).append((child_name, origin_matrix(joint)))
        child_names.add(child_name)
    roots = [name for name in links if name not in child_names]
    link_world: dict[str, np.ndarray] = {}
    stack = [(name, np.eye(4)) for name in roots]
    while stack:
        name, matrix = stack.pop()
        if name in link_world:
            continue
        link_world[name] = matrix
        stack.extend((child, matrix @ joint_origin) for child, joint_origin in children.get(name, []))

    batches = []
    for name, link in links.items():
        world = link_world.get(name, np.eye(4))
        for visual in link.findall("visual"):
            geometry = visual.find("geometry")
            if geometry is None:
                continue
            tris = geometry_triangles(geometry, package_root)
            if tris is None or not len(tris):
                continue
            if len(tris) > 3500:
                tris = tris[::math.ceil(len(tris) / 3500)]
            local = world @ origin_matrix(visual)
            ones = np.ones((*tris.shape[:2], 1))
            points = np.concatenate([tris, ones], axis=2)
            batches.append((points @ local.T)[..., :3])
    if not batches:
        raise RuntimeError(f"No renderable visual geometry in {urdf}")
    tris = np.concatenate(batches)
    if len(tris) > 52000:
        tris = tris[::math.ceil(len(tris) / 52000)]

    points = tris.reshape(-1, 3)
    low, high = np.percentile(points, .2, axis=0), np.percentile(points, 99.8, axis=0)
    center = (low + high) / 2
    center[2] = (low[2] + high[2]) / 2
    world_up = np.array([0.0, 0.0, 1.0])
    relative = tris - center
    frame_count = 16
    camera_radius = math.hypot(4.2, -5.5)
    base_angle = math.atan2(-5.5, 4.2)
    views = []
    for frame in range(frame_count):
        angle = base_angle + 2 * math.pi * frame / frame_count
        camera_side = np.array([camera_radius * math.cos(angle), camera_radius * math.sin(angle), 2.4], dtype=np.float64)
        forward = -camera_side / np.linalg.norm(camera_side)
        right = np.cross(forward, world_up); right /= np.linalg.norm(right)
        up = np.cross(right, forward); up /= np.linalg.norm(up)
        views.append((relative @ right, relative @ up, relative @ forward))
    extent_x = max(max(float(np.percentile(abs(sx), 99.8)), 1e-6) for sx, _, _ in views)
    extent_y = max(max(float(np.percentile(abs(sy), 99.8)), 1e-6) for _, sy, _ in views)
    size, margin = 1200, 130
    scale = min((size - 2 * margin) / (2 * extent_x), (size - 2 * margin) / (2 * extent_y))
    light = np.array([.3, -.5, .82]); light /= np.linalg.norm(light)
    normals = np.cross(tris[:,1] - tris[:,0], tris[:,2] - tris[:,0])
    norm = np.linalg.norm(normals, axis=1); norm[norm == 0] = 1
    normals /= norm[:,None]
    shades = .58 + .42 * np.abs(normals @ light)
    accent = np.array(base_color)
    turntable_dir = OUT / "turntables" / model_id
    turntable_dir.mkdir(parents=True, exist_ok=True)
    for frame, (sx, sy, depth) in enumerate(views):
        screen = np.empty((len(tris), 3, 2))
        screen[..., 0] = size / 2 + sx * scale
        screen[..., 1] = size / 2 - sy * scale
        order = np.argsort(depth.mean(axis=1))[::-1]
        image = Image.new("RGB", (size, size), (233, 230, 222))
        draw = ImageDraw.Draw(image)
        grid = (210, 207, 198)
        for x in range(100, size, 100):
            draw.line((x, 0, x, size), fill=grid, width=1)
        for y in range(100, size, 100):
            draw.line((0, y, size, y), fill=grid, width=1)
        draw.ellipse((margin - 20, size - margin - 20, size - margin + 20, size - margin + 20), fill=(205, 201, 191))
        for idx in order:
            polygon = [tuple(v) for v in screen[idx]]
            color = tuple(np.clip(accent * shades[idx], 0, 255).astype(int))
            draw.polygon(polygon, fill=color)
        draw.rectangle((0, size - 12, size, size), fill=(216, 70, 27))
        thumbnail = image.resize((800, 800), Image.Resampling.LANCZOS)
        thumbnail.save(turntable_dir / f"{frame:02}.png", optimize=True)
        if frame == 0:
            thumbnail.save(OUT / f"{model_id}.png", optimize=True)
    print(f"rendered {model_id}: {frame_count} angles, {len(tris):,} triangles each")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for record in MODELS:
        render(*record)


if __name__ == "__main__":
    main()
