#!/usr/bin/env python3
"""Render procedural body posters using the website's actual viewer.

Run ./scripts/site build, then .venv/bin/python scripts/render-body-previews.py,
then ./scripts/site build again to publish the new responsive images.
"""
import base64
import io
import json
import os
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.preview import handler_for

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".cache/playwright"))


def main():
    models = json.loads((ROOT / "_data/models.json").read_text())
    base = json.loads((ROOT / "_site/build-info.json").read_text())["baseurl"]
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(ROOT / "_site", base))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            for model in models:
                if not model.get("posePreview"):
                    continue
                page.goto(f"http://127.0.0.1:{server.server_port}{base}/archive/{model['id']}/")
                encoded = page.evaluate("""async id => {
                  const model = window.ICorpi.models().find(m => m.id === id);
                  const root = document.querySelector('[data-model-viewer]');
                  root.querySelector('[data-viewer-poster]').hidden = true;
                  root.querySelector('[data-viewer-workbench]').hidden = false;
                  const { createViewer } = await import(window.ICorpi.asset('/assets/js/viewer.js'));
                  const viewer = createViewer(model, root);
                  try { return await viewer.snapshot(0, 800); }
                  finally { viewer.destroy(); }
                }""", model["id"])
                image = Image.open(io.BytesIO(base64.b64decode(encoded.split(",", 1)[1]))).convert("RGBA")
                poster = Image.new("RGB", image.size, "#e7e4dc")
                poster.paste(image, mask=image.getchannel("A"))
                poster.save(ROOT / "gallery" / f"{model['id']}.png")
                print(f"Rendered {model['id']}", flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
