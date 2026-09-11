import copy
import gzip
import hashlib
import json
import re
import struct
import sys
import unittest
import xml.etree.ElementTree as ET
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.prepare_assets import validate_catalog
from scripts.import_models import verify_source

SITE = ROOT / "_site"


class References(HTMLParser):
    def __init__(self, base=""):
        super().__init__()
        self.urls = []
        self.base = base

    def handle_starttag(self, tag, attributes):
        for key, value in attributes:
            if key in ("href", "src") and value:
                self.urls.append(value)
            elif key == "srcset" and value:
                self.urls.extend(part.strip().split()[0] for part in value.split(","))
            elif key == "data-frames":
                self.urls.extend(self.base + path for path in json.loads(value))


class GeneratedSiteTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = json.loads((ROOT / "_data/models.json").read_text())
        cls.assets = json.loads((ROOT / "_data/generated_assets.json").read_text())
        cls.info = json.loads((SITE / "build-info.json").read_text())
        cls.base = cls.info["baseurl"]

    def test_catalog_and_all_urdf_dependencies_are_valid(self):
        validate_catalog(self.records)

    def test_imported_sources_topology_and_portable_mesh_paths(self):
        self.assertTrue(all(model["access"] == "local" for model in self.records if model["kind"] == "robot"))

        def signature(node):
            return (node.tag, sorted(node.attrib.items()), (node.text or "").strip(),
                    [signature(child) for child in node])

        for path in (ROOT / "models").glob("*/UPSTREAM.json"):
            with self.subTest(model=path.parent.name):
                manifest = json.loads(path.read_text())
                for entry in manifest["files"]:
                    verify_source(path.parent, entry)
                source = ET.parse(path.parent / manifest["entrypoint"])
                hosted = ET.parse(path.parent / "model.urdf")
                self.assertEqual([signature(j) for j in source.findall("joint")],
                                 [signature(j) for j in hosted.findall("joint")])
                self.assertEqual([signature(j) for j in source.findall("link/inertial")],
                                 [signature(j) for j in hosted.findall("link/inertial")])
                self.assertEqual(len(source.findall(".//mesh")), len(hosted.findall(".//mesh")))
                files = {file.relative_to(path.parent).as_posix() for file in path.parent.rglob("*") if file.is_file()}
                for mesh in hosted.findall(".//mesh"):
                    # Exact spelling matters on case-sensitive hosts, even when
                    # developing on a case-insensitive filesystem.
                    self.assertIn(mesh.get("filename"), files)
                for dae in path.parent.rglob("*.dae"):
                    for image in ET.parse(dae).findall(".//{*}library_images/{*}image/{*}init_from"):
                        texture = (dae.parent / image.text).resolve().relative_to(path.parent.resolve()).as_posix()
                        self.assertIn(texture, files)

    def test_valkyrie_conversion_is_complete_and_matches_its_sources(self):
        package = ROOT / "models/valkyrie"
        manifest = json.loads((package / "UPSTREAM.json").read_text())
        report = json.loads((package / "CONVERSION.json").read_text())
        expected = {}
        for source in manifest["meshPaths"].values():
            target = "meshes/" + str(Path(source.split("/model/meshes/", 1)[1]).with_suffix(".stl"))
            expected[target] = package / "upstream" / source
        self.assertEqual(set(report), set(expected))
        for target, source in expected.items():
            entry = report[target]
            data = (package / target).read_bytes()
            count = struct.unpack_from("<I", data, 80)[0]
            self.assertGreater(count, 0)
            self.assertEqual(len(data), 84 + count * 50)
            self.assertEqual(count, entry["triangles"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), entry["outputSha256"])
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), entry["sourceSha256"])

    def test_invalid_catalog_changes_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate_catalog(self.records + [self.records[0]])
        invalid = copy.deepcopy(self.records)
        invalid[0]["dof"] += 1
        with self.assertRaisesRegex(ValueError, "Joint count"):
            validate_catalog(invalid)
        invalid[0]["sourceUrl"] = "javascript:alert(1)"
        with self.assertRaisesRegex(ValueError, "Invalid sourceUrl"):
            validate_catalog(invalid)

    def test_pages_and_record_details_are_static(self):
        paths = ["index.html", "archive/index.html", "compare/index.html", "gallery/index.html", "about/index.html", "learn/index.html", "404.html"]
        paths += [f"archive/{model['id']}/index.html" for model in self.records]
        for path in paths:
            with self.subTest(path=path):
                html = (SITE / path).read_text()
                self.assertNotIn("/_next/", html)
                self.assertNotIn("__NEXT_DATA__", html)
                self.assertIn(self.info["buildId"], html)
                self.assertIn('rel="canonical"', html)
        for model in self.records:
            html = (SITE / "archive" / model["id"] / "index.html").read_text()
            self.assertIn(f'data-model-id="{model["id"]}"', html)
            self.assertIn(f"<h2>{model['name']}</h2>", html)
            self.assertIn("Measurement sources", html)
            if model["access"] == "local":
                self.assertIn("Download complete package", html)
                self.assertIn(model["provenance"]["revision"], html)

    def test_all_html_references_resolve_at_configured_base(self):
        for html in SITE.rglob("*.html"):
            parser = References(self.base)
            parser.feed(html.read_text())
            for reference in parser.urls:
                url = urlsplit(reference)
                if url.scheme or url.netloc or not url.path:
                    continue
                path = unquote(url.path)
                if self.base and path.startswith(self.base + "/"):
                    path = path[len(self.base):]
                elif self.base and path.startswith("/"):
                    self.fail(f"Missing base path: {html.relative_to(SITE)} → {reference}")
                target = SITE / path.lstrip("/") if path.startswith("/") else html.parent / path
                if target.is_dir():
                    target /= "index.html"
                self.assertTrue(target.is_file(), f"{html.relative_to(SITE)} → {reference}")

    def test_sitemap_has_all_distinct_pages(self):
        root = ET.parse(SITE / "sitemap.xml").getroot()
        urls = [node.text for node in root.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        self.assertEqual(len(urls), len(self.records) + 6)
        self.assertEqual(len(urls), len(set(urls)))
        for model in self.records:
            self.assertTrue(any(url.endswith(f"{self.base}/archive/{model['id']}/") for url in urls))

    def test_compressed_meshes_are_lossless_and_published(self):
        for model in self.records:
            for source, compressed in self.assets[model["id"]].get("meshMap", {}).items():
                with self.subTest(mesh=source):
                    original = (ROOT / source.lstrip("/")).read_bytes()
                    preview = gzip.decompress((SITE / compressed.lstrip("/")).read_bytes())
                    self.assertEqual(hashlib.sha256(original).digest(), hashlib.sha256(preview).digest())

    def test_complete_packages_preserve_every_file_and_checksum(self):
        for model in self.records:
            if model["access"] != "local":
                self.assertNotIn("downloadPath", self.assets[model["id"]])
                continue
            path = self.assets[model["id"]]["downloadPath"]
            package = ROOT / "models" / model["id"]
            with zipfile.ZipFile(SITE / path.lstrip("/")) as archive:
                names = archive.namelist()
                self.assertIn(f"{model['id']}/SOURCE.md", names)
                self.assertIn(f"{model['id']}/{Path(model['licenseUrl']).name}", names)
                checksums = archive.read(f"{model['id']}/SHA256SUMS").decode().splitlines()
                for line in checksums:
                    checksum, relative = line.split("  ", 1)
                    self.assertNotIn("..", Path(relative).parts)
                    data = archive.read(f"{model['id']}/{relative}")
                    self.assertEqual(hashlib.sha256(data).hexdigest(), checksum)
                    self.assertEqual(data, (package / relative).read_bytes())
                self.assertEqual(len(checksums), len([p for p in package.rglob('*') if p.is_file() and not p.name.startswith('.')]))

    def test_comparison_has_semantic_content_without_javascript(self):
        html = (SITE / "compare/index.html").read_text()
        self.assertIn('<table class="compare-table"', html)
        self.assertIn('<th scope="row">', html)
        self.assertIn("Not applicable", html)
        self.assertIn("BSD-3-Clause", html)

    def test_learning_catalog_has_sources_valid_examples_and_resolvable_goals(self):
        data = json.loads((ROOT / "_data/learning.json").read_text())
        html = (SITE / "learn/index.html").read_text()
        goals = {goal["id"] for goal in data["goals"]}
        for dataset in data["datasets"]:
            self.assertTrue(set(dataset["goals"]) <= goals)
            self.assertTrue(dataset["gap"] and dataset["access"])
            self.assertIn(dataset["url"], html)
            for field in ("url", "termsUrl"):
                self.assertEqual(urlsplit(dataset[field]).scheme, "https")
        for action in data["actions"]:
            example = json.loads(action["example"])
            self.assertIn("kind", example)
            self.assertIn(f'data-action-example="{action["id"]}"', html)
        self.assertIn("do not load licensed body meshes", html)

    def test_sharpa_attachment_keeps_pinned_assets_and_self_contained_meshes(self):
        root = ROOT / "attachments/sharpa-wave"
        manifest = json.loads((root / "IMPORT.json").read_text())
        for entry in manifest["files"]:
            data = (SITE / "attachments/sharpa-wave" / entry["path"]).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), entry["sha256"])
            self.assertEqual(len(data), entry["bytes"])
            if entry["path"].endswith(".glb"):
                length, kind = struct.unpack_from("<II", data, 12)
                self.assertEqual(kind, 0x4e4f534a)
                gltf = json.loads(data[20:20 + length])
                self.assertFalse(gltf.get("images"))
                self.assertTrue(all("uri" not in buffer for buffer in gltf["buffers"]))
                self.assertEqual(len(gltf["meshes"]), 1)
        urdf = ET.parse(root / "model.urdf")
        self.assertEqual(len([j for j in urdf.findall("joint") if j.get("type") == "revolute"]), 22)
        self.assertFalse(urdf.findall(".//collision"))
        for mesh in urdf.findall(".//mesh"):
            self.assertTrue((root / mesh.get("filename")).is_file())
        self.assertTrue((SITE / "attachments/sharpa-wave/PROVENANCE.md").is_file())

    def test_only_website_files_are_published(self):
        for path in ("Gemfile", "requirements.txt", "scripts", "tests", ".venv", ".cache", "work", "vendor/bundle", "node_modules", "dist"):
            self.assertFalse((SITE / path).exists(), path)
        self.assertTrue((SITE / "vendor/three.module.js").is_file())

    def test_vendored_code_matches_recorded_hashes(self):
        for entry in json.loads((ROOT / "vendor/manifest.json").read_text()):
            source = (SITE / "vendor" / entry["file"]).read_bytes()
            self.assertEqual(hashlib.sha256(source).hexdigest(), entry["sha256"], entry["file"])


if __name__ == "__main__":
    unittest.main()
