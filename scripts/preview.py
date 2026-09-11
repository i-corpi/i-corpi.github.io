#!/usr/bin/env python3
"""Serve a built site, including a GitHub project-page base path."""

import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def handler_for(directory, baseurl=""):
    prefix = baseurl.rstrip("/")

    class Handler(SimpleHTTPRequestHandler):
        def do_GET(self):
            path = urlsplit(self.path).path
            if prefix and path == prefix:
                self.send_response(301)
                self.send_header("Location", prefix + "/")
                self.end_headers()
                return
            if prefix:
                if not path.startswith(prefix + "/"):
                    self.send_error(404)
                    return
                self.path = self.path[len(prefix):]
            super().do_GET()

        def log_message(self, *_args):
            pass

    return partial(Handler, directory=str(directory))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4000)
    parser.add_argument("--directory", type=Path, default=ROOT / "_site")
    args = parser.parse_args()
    info = json.loads((args.directory / "build-info.json").read_text())
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(args.directory, info["baseurl"]))
    print(f"Preview: http://127.0.0.1:{args.port}{info['baseurl']}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
