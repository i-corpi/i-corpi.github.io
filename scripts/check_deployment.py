#!/usr/bin/env python3
"""Reject a README-only deployment, stale revision, or missing public routes."""
import argparse
import json
import time
from urllib.request import Request, urlopen


def verify(base, revision=None):
    base = base.rstrip("/")
    def get(path):
        request = Request(base + path, headers={"Cache-Control": "no-cache"})
        with urlopen(request, timeout=20) as response:
            if response.status != 200:
                raise RuntimeError(f"{path}: HTTP {response.status}")
            return response.read().decode()
    stamp = str(time.time_ns())
    info = json.loads(get("/build-info.json?verify=" + stamp))
    if revision and info.get("revision") != revision:
        raise RuntimeError(f"Expected revision {revision}; received {info.get('revision')}")
    for path in ("/", "/archive/", "/archive/unitree-g1/", "/compare/", "/gallery/", "/about/", "/learn/"):
        html = get(path + "?verify=" + stamp)
        if f'content="{info["buildId"]}"' not in html:
            raise RuntimeError(f"{path}: expected application build marker was not found")
    for path in ("/assets/css/site.css", "/assets/js/viewer.js", "/models/unitree-g1/model.urdf"):
        if not get(path):
            raise RuntimeError(f"Empty asset: {path}")
    return info


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--revision")
    parser.add_argument("--attempts", type=int, default=12)
    args = parser.parse_args()
    for attempt in range(args.attempts):
        try:
            info = verify(args.url, args.revision)
            print(f"Verified {info['records']} records, build {info['buildId']}")
            break
        except Exception as error:
            if attempt == args.attempts - 1:
                raise SystemExit(f"Deployment verification failed: {error}")
            print(f"Waiting for published files ({attempt + 1}/{args.attempts}): {error}", flush=True)
            time.sleep(5)
