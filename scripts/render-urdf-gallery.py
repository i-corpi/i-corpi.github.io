#!/usr/bin/env python3
"""Render complete URDF geometry through the same WebGL viewer as the website.

Run ./scripts/site setup-browser and ./scripts/site build first. Then:
  .venv/bin/python scripts/render-urdf-gallery.py [--model unitree-g1]
  ./scripts/site build

For a newly imported model without gallery images, use --from-source before
the first build. This renders the actual URDF, without placeholder images.
"""
import argparse
import base64
import io
import json
import math
import os
import sys
import threading
import xml.etree.ElementTree as ET
from http.server import ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".cache/playwright"))
from playwright.sync_api import sync_playwright
from scripts.preview import handler_for


def main():
    records = json.loads((ROOT / "_data/models.json").read_text())
    models = [record for record in records if record["access"] == "local"]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", action="append", choices=[model["id"] for model in models])
    parser.add_argument("--from-source", action="store_true", help="Render new models before the first site build")
    args = parser.parse_args()
    info = {"baseurl": ""} if args.from_source else json.loads((ROOT / "_site/build-info.json").read_text())
    directory = ROOT if args.from_source else ROOT / "_site"
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(directory, info["baseurl"]))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}{info['baseurl']}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
            for model in models:
                if args.model and model["id"] not in args.model:
                    continue
                page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
                page.set_default_timeout(120000)
                if args.from_source:
                    # Use the real workbench markup and viewer, but bypass Liquid
                    # and the generated image manifest during an initial import.
                    workbench = (ROOT / "_includes/viewer-workbench.html").read_text()
                    html = ('<!doctype html><link rel="stylesheet" href="/assets/css/site.css">'
                            '<section data-model-viewer>' + workbench + '</section>'
                            '<script src="/assets/js/site.js"></script>')
                    page.route("**/__gallery__", lambda route: route.fulfill(content_type="text/html", body=html))
                    page.goto(f"{base}/__gallery__")
                    urdf = ET.parse(ROOT / model["hostedPath"].lstrip("/"))
                    model = dict(model, assets={"meshMap": {}, "meshCount": len({
                        mesh.get("filename") for mesh in urdf.findall(".//visual/geometry/mesh")
                    })})
                else:
                    page.goto(f"{base}/archive/{model['id']}/")
                page.evaluate("""async suppliedModel => {
                    const root = document.querySelector('[data-model-viewer]');
                    root.querySelector('[data-viewer-workbench]').hidden = false;
                    const model = suppliedModel || window.ICorpi.models().find(m => m.id === root.dataset.modelViewer);
                    const { createViewer } = await import(window.ICorpi.asset('/assets/js/viewer.js'));
                    window.galleryViewer = createViewer(model, root);
                    await window.galleryViewer.ready;
                }""", model if args.from_source else None)
                target = ROOT / "gallery/turntables" / model["id"]
                target.mkdir(parents=True, exist_ok=True)
                for frame in range(16):
                    data = page.evaluate("angle => window.galleryViewer.snapshot(angle)", frame * math.tau / 16)
                    rgba = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGBA")
                    background = Image.new("RGBA", rgba.size, (233, 230, 222, 255))
                    background.alpha_composite(rgba)
                    image = background.convert("RGB")
                    ImageDraw.Draw(image).rectangle((0, 792, 800, 800), fill=(216, 70, 27))
                    image.save(target / f"{frame:02}.png", optimize=True)
                    if frame == 0:
                        image.save(ROOT / "gallery" / f"{model['id']}.png", optimize=True)
                page.evaluate("window.galleryViewer.destroy()")
                page.close()
                print(f"Rendered {model['id']}: 16 angles, full visual geometry", flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
