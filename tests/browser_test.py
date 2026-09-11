"""Exercise actual browser behavior against either root or project-path output."""
import json
import os
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".cache/playwright"))
from playwright.sync_api import sync_playwright, expect
from scripts.preview import handler_for
from scripts.check_deployment import verify


class BrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.info = json.loads((ROOT / "_site/build-info.json").read_text())
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(ROOT / "_site", cls.info["baseurl"]))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"
        cls.url = cls.origin + cls.info["baseurl"]
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True, args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
        (ROOT / "work/browser").mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1440, "height": 1000})
        self.page = self.context.new_page()
        self.page.set_default_timeout(20000)
        self.errors = []
        self.requests = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("request", lambda request: self.requests.append(request.url))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], "Unhandled JavaScript errors")

    def open(self, path):
        self.page.goto(self.url + path, wait_until="networkidle")

    def assert_joint_map_geometry(self, selector="[data-model-viewer]"):
        errors = self.page.evaluate("""selector => {
          const root = document.querySelector(selector);
          const plot = root.querySelector('[data-viewer-part="body-map-plot"]').getBoundingClientRect();
          const markers = [...root.querySelectorAll('[data-viewer-part="joint-markers"] button')].filter(n => !n.hidden);
          const errors = [];
          for (const [i, marker] of markers.entries()) {
            const box = marker.getBoundingClientRect();
            const x = box.x + box.width / 2 - plot.x, y = box.y + box.height / 2 - plot.y;
            const line = [...root.querySelectorAll('.joint-leader')].find(n => n.dataset.joint === marker.dataset.joint);
            if (!line || Math.abs(Number(line.getAttribute('x2')) - x) > 1 ||
                Math.abs(Number(line.getAttribute('y2')) - y) > 1 ||
                Math.abs(Number(line.getAttribute('x1')) - Number(marker.dataset.anchorX)) > .1 ||
                Math.abs(Number(line.getAttribute('y1')) - Number(marker.dataset.anchorY)) > .1)
              errors.push('Disconnected callout: ' + marker.dataset.joint);
            if (box.left < plot.left || box.right > plot.right || box.top < plot.top || box.bottom > plot.bottom)
              errors.push('Clipped label: ' + marker.dataset.joint);
            for (const other of markers.slice(i + 1)) {
              const b = other.getBoundingClientRect();
              if (Math.hypot(box.x - b.x, box.y - b.y) < 35)
                errors.push('Overlapping labels: ' + marker.dataset.joint + ' / ' + other.dataset.joint);
            }
          }
          return errors;
        }""", selector)
        self.assertEqual(errors, [])

    def test_landing_shows_every_robot_without_clipping(self):
        self.open("/")
        expect(self.page.locator(".robot-tile")).to_have_count(16)
        expect(self.page.locator('.robot-tile[href$="/archive/icub/"]')).to_have_count(1)
        expect(self.page.locator(".robot-tile-number").last).to_have_text("16")
        self.page.locator(".robot-tile").last.scroll_into_view_if_needed()
        expect(self.page.locator(".robot-tile").last).to_be_in_viewport()
        self.page.evaluate("window.scrollTo(0, 0)")
        self.page.screenshot(path=str(ROOT / "work/browser/landing-all-robots.png"), full_page=True)

    def test_icub_orientation_and_map_follow_the_actual_pose(self):
        self.open("/archive/icub/")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("32 controllable joints", timeout=40000)
        self.page.wait_for_timeout(150)
        left = self.page.locator('#joint-markers [data-joint="l_hip_roll"]')
        right = self.page.locator('#joint-markers [data-joint="r_hip_roll"]')
        self.assertGreater(float(left.get_attribute("data-anchor-x")), float(right.get_attribute("data-anchor-x")))
        self.assert_joint_map_geometry()
        self.page.locator(".review-visuals").screenshot(path=str(ROOT / "work/browser/icub-front-map.png"))
        knee = self.page.locator('#joint-markers [data-joint="l_knee"]')
        before = float(knee.get_attribute("data-anchor-x"))
        slider = self.page.locator('#joint-controls input[data-joint="l_hip_roll"]')
        slider.focus()
        slider.press("End")
        self.page.wait_for_timeout(150)
        self.assertNotAlmostEqual(float(knee.get_attribute("data-anchor-x")), before, delta=2)
        self.assert_joint_map_geometry()
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.wait_for_timeout(200)
        self.assert_joint_map_geometry()
        self.page.locator("#body-map-plot").screenshot(path=str(ROOT / "work/browser/icub-mobile-map.png"))

    def test_smpl_pose_controls_animation_export_and_cleanup(self):
        self.page.add_init_script("window.__frames = 0; const raf = window.requestAnimationFrame; window.requestAnimationFrame = cb => { window.__frames++; return raf(cb); };")
        self.open("/archive/smpl/")
        expect(self.page.locator("[data-viewer-poster]")).to_contain_text("does not load SMPL model weights")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("24 joints · procedural pose demonstrator")
        expect(self.page.locator("#joint-markers button")).to_have_count(24)
        expect(self.page.locator("[data-body-joint]")).to_have_count(72)
        self.page.wait_for_timeout(150)
        self.assert_joint_map_geometry()
        self.assertFalse(any(url.endswith((".urdf", ".npz", ".pkl")) for url in self.requests))
        slider = self.page.locator('[data-body-joint="18"][data-axis="2"]')
        slider.evaluate("e => { e.value = 60; e.dispatchEvent(new Event('input', { bubbles: true })); }")
        with self.page.expect_download() as result:
            self.page.locator("[data-export-pose]").click()
        payload = json.loads(Path(result.value.path()).read_text())
        self.assertEqual(len(payload["pose"]), 72)
        self.assertEqual(payload["jointNames"][18], "left_elbow")
        self.assertAlmostEqual(payload["pose"][18 * 3 + 2], 3.141592653589793 / 3)
        self.assertEqual(payload["representation"], "axis-angle")
        self.page.locator('[data-pose="wave"]').click()
        self.page.wait_for_timeout(150)
        self.page.locator(".review-visuals").screenshot(path=str(ROOT / "work/browser/smpl-wave.png"))
        self.page.locator("[data-animate-pose]").click()
        before = self.page.evaluate("window.__frames")
        self.page.wait_for_timeout(250)
        self.assertGreater(self.page.evaluate("window.__frames") - before, 5)
        self.page.locator("[data-animate-pose]").click()
        self.page.wait_for_timeout(200)
        before = self.page.evaluate("window.__frames")
        self.page.wait_for_timeout(200)
        self.assertLessEqual(self.page.evaluate("window.__frames") - before, 1)
        self.page.locator("#joint-reset").click()
        expect(slider).to_have_value("0")
        marker = self.page.locator('#joint-markers [data-joint="left_elbow"]')
        marker.focus()
        marker.press("ArrowRight")
        expect(slider).to_have_value("5")
        marker.scroll_into_view_if_needed()
        bounds = marker.bounding_box()
        scroll = self.page.evaluate("window.scrollY")
        self.page.mouse.move(bounds["x"] + 16, bounds["y"] + 16)
        self.page.mouse.down()
        self.page.mouse.move(bounds["x"] + 36, bounds["y"] + 16, steps=5)
        self.page.mouse.up()
        self.assertGreater(float(slider.input_value()), 10)
        self.assertAlmostEqual(self.page.evaluate("window.scrollY"), scroll, delta=1)
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.wait_for_timeout(150)
        self.assert_joint_map_geometry()
        self.page.locator("[data-animate-pose]").click()
        self.page.locator("[data-close-viewer]").click()
        self.page.wait_for_timeout(200)
        before = self.page.evaluate("window.__frames")
        self.page.wait_for_timeout(200)
        self.assertLessEqual(self.page.evaluate("window.__frames") - before, 1)

    def test_initial_archive_does_not_download_models(self):
        self.open("/archive/unitree-g1/")
        expect(self.page.locator("#model-detail h2")).to_have_text("G1")
        expect(self.page.locator("[data-viewer-poster]")).to_be_visible()
        self.assertFalse(any("/vendor/" in url or url.endswith(".urdf") or ".stl" in url for url in self.requests))
        self.page.screenshot(path=str(ROOT / "work/browser/archive.png"), full_page=True)

    def test_all_imported_robots_load_complete_geometry_and_joint_controls(self):
        expected = {"unitree-r1": 26, "fourier-gr1": 44, "icub": 32,
                    "valkyrie": 43, "kbot": 20, "openloong": 31}
        failures = []
        self.page.on("response", lambda response: failures.append(response.url) if response.status >= 400 else None)
        assets = json.loads((ROOT / "_data/generated_assets.json").read_text())
        for model_id, count in expected.items():
            with self.subTest(model=model_id):
                self.requests.clear()
                self.open(f"/archive/{model_id}/")
                self.page.locator("[data-load-viewer]").click()
                expect(self.page.locator("#viewer-status")).to_have_text(f"{count} controllable joints", timeout=60000)
                expect(self.page.locator('#joint-controls input[type="range"]')).to_have_count(count)
                expect(self.page.locator("#joint-markers button")).to_have_count(count)
                self.page.wait_for_timeout(100)
                self.assert_joint_map_geometry()
                requested = set(self.requests)
                for compressed in assets[model_id]["meshMap"].values():
                    self.assertIn(self.url + compressed, requested)
                slider = self.page.locator('#joint-controls input[type="range"]').first
                slider.focus()
                slider.press("End")
                name = slider.get_attribute("data-joint")
                marker = self.page.locator(f'#joint-markers [data-joint="{name}"]')
                self.assertAlmostEqual(float(marker.get_attribute("aria-valuenow")), float(slider.input_value()))
                if model_id == "valkyrie":
                    group = self.page.locator(".joint-group").filter(has=self.page.locator('[data-joint="leftShoulderPitch"]'))
                    expect(group.locator("h4 span")).to_have_text("Left arm")
                if model_id == "openloong":
                    group = self.page.locator(".joint-group").filter(has=self.page.locator('[data-joint="J_arm_r_01"]'))
                    expect(group.locator("h4 span")).to_have_text("Right arm")
                if model_id == "fourier-gr1":
                    expect(self.page.locator(".joint-group h4 span").filter(has_text="Left hand")).to_have_count(1)
                self.page.screenshot(path=str(ROOT / f"work/browser/{model_id}.png"), full_page=True)
                self.page.locator("[data-close-viewer]").click()
                expect(self.page.locator("[data-viewer-poster]")).to_be_visible()
        self.assertEqual(failures, [], "All imported geometry and page assets must load")

    def test_deployment_checker_verifies_application_and_revision(self):
        self.assertEqual(verify(self.url)["buildId"], self.info["buildId"])
        with self.assertRaisesRegex(RuntimeError, "Expected revision"):
            verify(self.url, "incorrect-revision")

    def test_search_filters_navigation_and_history(self):
        self.open("/archive/")
        self.page.locator('[data-filter="body"]').click()
        expect(self.page.locator("#record-count")).to_have_text(f"4 of {self.info['records']} records")
        expect(self.page.locator('[data-filter="body"]')).to_have_attribute("aria-pressed", "true")
        self.page.locator("#model-search").fill("smpl")
        expect(self.page.locator("#record-count")).to_have_text(f"3 of {self.info['records']} records")
        self.page.locator('#record-list [data-model-id="smpl-x"]').click()
        expect(self.page.locator("#model-detail h2")).to_have_text("SMPL-X")
        self.assertIn("/archive/smpl-x/", self.page.url)
        self.page.reload(wait_until="networkidle")
        expect(self.page.locator("#model-search")).to_have_value("smpl")
        expect(self.page.locator("#record-count")).to_have_text(f"3 of {self.info['records']} records")
        self.page.locator('#record-list [data-model-id="smpl"]').click()
        expect(self.page.locator("#model-detail h2")).to_have_text("SMPL")
        self.page.go_back()
        expect(self.page.locator("#model-detail h2")).to_have_text("SMPL-X")
        self.page.locator("#model-search").fill("no such model")
        expect(self.page.locator("#record-empty")).to_be_visible()

    def test_legacy_links(self):
        self.open("/archive/#simple-humanoid")
        expect(self.page.locator("#model-detail h2")).to_have_text("Simple Humanoid")
        self.assertTrue(self.page.url.endswith("/archive/simple-humanoid/"))

    def test_comparison_visibility_values_and_shareable_url(self):
        self.open("/compare/")
        expect(self.page.locator('[data-viewer-part="viewer-status"]').nth(0)).to_have_text("29 controllable joints")
        expect(self.page.locator('[data-viewer-part="viewer-status"]').nth(1)).to_have_text("31 controllable joints")
        self.page.screenshot(path=str(ROOT / "work/browser/compare-robots.png"), full_page=True)
        expect(self.page.locator("#compare-note")).to_be_hidden()
        self.assertEqual(self.page.locator("#compare-note").evaluate("e => getComputedStyle(e).display"), "none")
        self.page.locator("#compare-right").select_option("smpl-x")
        expect(self.page.locator("#compare-note")).to_be_visible()
        expect(self.page.locator("#compare-table caption")).to_have_text("G1 and SMPL-X comparison")
        self.page.reload(wait_until="networkidle")
        expect(self.page.locator("#compare-right")).to_have_value("smpl-x")
        self.page.locator("#compare-left").select_option("smpl")
        expect(self.page.locator("#compare-note")).to_be_hidden()

    def test_comparison_instances_have_independent_joints_and_preserve_the_other_panel(self):
        self.open("/compare/?a=simple-humanoid&b=simple-humanoid")
        left = self.page.locator('[data-viewer-instance="compare-a"]')
        right = self.page.locator('[data-viewer-instance="compare-b"]')
        for panel in (left, right):
            expect(panel.locator('[data-viewer-part="viewer-status"]')).to_have_text("29 controllable joints")
            panel.locator("summary").click()
        self.page.wait_for_timeout(150)
        for selector in ('[data-viewer-instance="compare-a"]', '[data-viewer-instance="compare-b"]'):
            self.assert_joint_map_geometry(selector)
        slider_a = left.locator('input[type="range"]').first
        slider_b = right.locator('input[type="range"]').first
        before_b = slider_b.input_value()
        slider_a.focus()
        slider_a.press("End")
        expect(slider_b).to_have_value(before_b)
        pose_a = slider_a.input_value()
        self.page.evaluate("window.__leftCanvas = document.querySelector('[data-viewer-instance=\"compare-a\"] canvas')")
        self.page.locator("#compare-right").select_option("smpl")
        expect(right.locator('[data-viewer-part="viewer-status"]')).to_have_text("24 joints · procedural pose demonstrator")
        expect(slider_a).to_have_value(pose_a)
        self.assertTrue(self.page.evaluate("window.__leftCanvas === document.querySelector('[data-viewer-instance=\"compare-a\"] canvas')"))
        left.locator('[data-viewer-part="joint-reset"]').click()
        self.assertAlmostEqual(float(slider_a.input_value()), 0, delta=.02)
        self.page.locator("#compare-left").select_option("smpl")
        expect(left.locator('[data-viewer-part="viewer-status"]')).to_have_text("24 joints · procedural pose demonstrator")
        for panel in (left, right):
            panel.locator("summary").click()
        left.locator('[data-pose="wave"]').click()
        expect(right.locator('[data-body-joint="18"][data-axis="2"]')).to_have_value("0")
        self.assertEqual(self.page.evaluate("""() => {
          const ids = [...document.querySelectorAll('[id]')].map(n => n.id);
          return ids.filter((id, i) => ids.indexOf(id) !== i);
        }"""), [])
        self.assertTrue(self.page.evaluate("""() => [...document.querySelectorAll('[aria-controls]')].every(
          marker => marker.closest('[data-model-viewer]').contains(document.getElementById(marker.getAttribute('aria-controls'))))"""))
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.wait_for_timeout(150)
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        self.assert_joint_map_geometry('[data-viewer-instance="compare-b"]')
        right.locator('[data-close-viewer]').click()
        expect(left.locator('[data-viewer-workbench]')).to_be_visible()
        expect(right.locator('[data-viewer-poster]')).to_be_visible()

    def test_comparison_switch_during_load_cancels_obsolete_model(self):
        self.page.add_init_script("""const originalFetch = window.fetch;
          window.__cancelled = false;
          window.fetch = async (...args) => {
            if (String(args[0]).includes('/models/unitree-g1/model.urdf')) {
              args[1]?.signal?.addEventListener('abort', () => { window.__cancelled = true; }, { once: true });
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            return originalFetch(...args);
          };""")
        self.open("/compare/?a=unitree-g1&b=simple-humanoid")
        self.page.wait_for_function("!!document.querySelector('[data-viewer-instance=\"compare-b\"] .ready')")
        self.page.locator("#compare-left").select_option("smpl")
        self.page.locator("#compare-right").select_option("star")
        expect(self.page.locator('[data-viewer-instance="compare-a"] .ready')).to_have_text("24 joints · procedural pose demonstrator")
        self.page.wait_for_timeout(2100)
        self.assertTrue(self.page.evaluate("window.__cancelled"))
        expect(self.page.locator('[data-viewer-instance="compare-b"] .ready')).to_have_text("24 joints · procedural pose demonstrator")
        expect(self.page.locator("#compare-figures canvas")).to_have_count(2)
        expect(self.page.locator("#compare-figures .joint-marker")).to_have_count(48)

    def test_comparison_failed_side_can_retry_without_resetting_healthy_side(self):
        self.page.route("**/*.stl.gz", lambda route: route.fulfill(status=404, body="missing"))
        self.open("/compare/?a=unitree-g1&b=simple-humanoid")
        left = self.page.locator('[data-viewer-instance="compare-a"]')
        right = self.page.locator('[data-viewer-instance="compare-b"]')
        expect(left.locator("[data-viewer-message]")).to_contain_text("3D could not load")
        expect(right.locator(".ready")).to_have_text("29 controllable joints")
        self.page.evaluate("window.__rightCanvas = document.querySelector('[data-viewer-instance=\"compare-b\"] canvas')")
        self.page.unroute("**/*.stl.gz")
        left.locator("[data-load-viewer]").click()
        expect(left.locator(".ready")).to_have_text("29 controllable joints")
        self.assertTrue(self.page.evaluate("window.__rightCanvas === document.querySelector('[data-viewer-instance=\"compare-b\"] canvas')"))

    def test_learning_guide_filters_sources_and_explains_action_representations(self):
        self.open("/learn/?goal=manipulation&action=task-space#datasets")
        expect(self.page.locator("#dataset-count")).to_have_text("3 of 6 sources")
        expect(self.page.locator("[data-dataset]:visible")).to_have_count(3)
        expect(self.page.locator('[data-dataset="amass"]')).to_be_hidden()
        expect(self.page.locator('[data-action-example="task-space"]')).to_be_visible()
        self.page.locator("#learning-goal").select_option("humanoid")
        expect(self.page.locator("#dataset-count")).to_have_text("2 of 6 sources")
        expect(self.page.locator('[data-dataset="amass"]')).to_be_visible()
        self.page.locator("#action-representation").select_option("episode")
        self.page.reload(wait_until="networkidle")
        expect(self.page.locator("#learning-goal")).to_have_value("humanoid")
        expect(self.page.locator('[data-action-example="episode"]')).to_be_visible()
        self.page.locator("#learning-goal").select_option("all")
        expect(self.page.locator("[data-dataset]:visible")).to_have_count(6)
        self.assertFalse(any("/vendor/" in url or url.endswith((".urdf", ".npz", ".pkl")) for url in self.requests))
        self.open("/learn/?goal=unknown&action=unknown")
        expect(self.page.locator("#learning-goal")).to_have_value("all")
        expect(self.page.locator("#action-representation")).to_have_value("pose")
        self.page.screenshot(path=str(ROOT / "work/browser/learning-guide.png"), full_page=True)

    def test_smplh_sharpa_hybrid_and_canonical_hand_layout(self):
        self.open("/archive/smpl-h/")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("22 body joints + 44 Sharpa joints · hybrid demonstrator", timeout=40000)
        expect(self.page.locator("[data-body-joint]")).to_have_count(66)
        self.page.locator("[data-hand-attachments] > summary").click()
        for side in ("left", "right"):
            panel = self.page.locator(f'[data-hand-side="{side}"]')
            expect(panel.locator('input[data-joint]')).to_have_count(22)
            panel.locator('[data-hand-pose="grasp"]').click()
            self.page.wait_for_timeout(150)
            self.assert_joint_map_geometry(f'[data-hand-side="{side}"]')
            panel.locator("[data-focus-hand]").click()
        with self.page.expect_download() as result:
            self.page.locator("[data-export-pose]").click()
        payload = json.loads(Path(result.value.path()).read_text())
        self.assertEqual(payload["schema"], "i-corpi.body-robot-hybrid.v1")
        self.assertEqual(len(payload["pose"]), 66)
        self.assertEqual(len(payload["hands"]), 2)
        for hand in payload["hands"]:
            self.assertEqual(len(hand["jointPositions"]), 22)
            self.assertTrue(all(j["name"].startswith("right_") for j in hand["jointPositions"]))
            self.assertEqual(hand["mirrored"], hand["attachment"] == "left")
            self.assertTrue(any(j["position"] > .5 for j in hand["jointPositions"]))
        self.page.locator("#viewer-reset").click()
        self.page.locator(".review-visuals").screenshot(path=str(ROOT / "work/browser/smplh-sharpa.png"))
        self.page.locator("[data-hand-mode]").select_option("human")
        expect(self.page.locator("#viewer-status")).to_have_text("52 joints · procedural pose demonstrator")
        expect(self.page.locator("[data-hand-attachments]")).to_have_count(0)
        expect(self.page.locator("[data-body-joint]")).to_have_count(156)
        self.page.locator("[data-map-focus]").select_option("left")
        self.page.wait_for_timeout(150)
        expect(self.page.locator("#joint-markers button:visible")).to_have_count(16)
        self.assert_joint_map_geometry()
        self.page.locator('[data-pose="grasp"]').click()
        with self.page.expect_download() as result:
            self.page.locator("[data-export-pose]").click()
        payload = json.loads(Path(result.value.path()).read_text())
        self.assertEqual(payload["schema"], "i-corpi.smpl-h-pose.v1")
        self.assertEqual(len(payload["pose"]), 156)
        self.assertEqual(payload["jointNames"][22], "left_index1")
        self.assertEqual(payload["jointNames"][37], "right_index1")
        self.assertEqual(payload["jointNames"][-1], "right_thumb3")
        self.assertNotIn("hands", payload)
        self.page.locator("[data-hand-mode]").select_option("sharpa")
        expect(self.page.locator("#viewer-status")).to_have_text("22 body joints + 44 Sharpa joints · hybrid demonstrator")

    def test_sharpa_comparison_instances_and_cancelled_attachment_load(self):
        self.open("/compare/?a=smpl-h&b=smpl-h")
        for instance in ("compare-a", "compare-b"):
            panel = self.page.locator(f'[data-viewer-instance="{instance}"]')
            expect(panel.locator('[data-viewer-part="viewer-status"]')).to_have_text("22 body joints + 44 Sharpa joints · hybrid demonstrator")
            panel.locator(".compare-joints > summary").click()
        self.assertEqual(self.page.evaluate("""() => {
          const ids = [...document.querySelectorAll('[id]')].map(n => n.id);
          return ids.filter((id, i) => ids.indexOf(id) !== i);
        }"""), [])
        self.page.locator('[data-viewer-instance="compare-a"] [data-hand-mode]').select_option("human")
        expect(self.page.locator('[data-viewer-instance="compare-a"] [data-body-joint]')).to_have_count(156)
        expect(self.page.locator('[data-viewer-instance="compare-b"] [data-body-joint]')).to_have_count(66)
        expect(self.page.locator('[data-viewer-instance="compare-b"] [data-hand-side]')).to_have_count(2)
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        self.page.add_init_script("""const originalFetch = window.fetch;
          window.__cancelledHand = false;
          window.fetch = async (...args) => {
            if (String(args[0]).endsWith('.glb')) {
              args[1]?.signal?.addEventListener('abort', () => { window.__cancelledHand = true; }, { once: true });
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
            return originalFetch(...args);
          };""")
        self.open("/archive/smpl-h/")
        self.page.locator("[data-load-viewer]").click()
        self.page.wait_for_function("document.querySelector('#viewer-status').textContent.includes('Loading')")
        # Wait until an attachment request has actually begun, then cancel it.
        self.page.wait_for_timeout(250)
        self.page.locator('#record-list [data-model-id="star"]').click()
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("24 joints · procedural pose demonstrator")
        self.page.wait_for_timeout(1600)
        self.assertTrue(self.page.evaluate("window.__cancelledHand"))
        expect(self.page.locator("[data-hand-attachments]")).to_have_count(0)
        expect(self.page.locator("#model-detail h2")).to_have_text("STAR")

    def test_smplx_face_hands_and_star_export_their_own_layouts(self):
        self.open("/archive/smpl-x/")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("55 joints · procedural pose demonstrator")
        self.page.locator("[data-map-focus]").select_option("face")
        expect(self.page.locator("#joint-markers button:visible")).to_have_count(4)
        self.page.locator('[data-expression="smile"]').fill("0.8")
        self.page.locator('[data-body-joint="22"][data-axis="0"]').fill("20")
        self.page.wait_for_timeout(150)
        self.assert_joint_map_geometry()
        self.page.locator(".review-visuals").screenshot(path=str(ROOT / "work/browser/smplx-face.png"))
        with self.page.expect_download() as result:
            self.page.locator("[data-export-pose]").click()
        payload = json.loads(Path(result.value.path()).read_text())
        self.assertEqual(len(payload["pose"]), 165)
        self.assertEqual(payload["jointNames"][22:25], ["jaw", "left_eye_smplhf", "right_eye_smplhf"])
        self.assertEqual(payload["jointNames"][25], "left_index1")
        self.assertEqual(payload["jointNames"][40], "right_index1")
        self.assertEqual(payload["illustrativeExpressions"]["smile"], .8)
        self.assertAlmostEqual(payload["pose"][22 * 3], 20 * 3.141592653589793 / 180)
        self.page.locator("[data-map-focus]").select_option("right")
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.wait_for_timeout(150)
        self.assert_joint_map_geometry()
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        self.open("/archive/star/")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("24 joints · procedural pose demonstrator")
        expect(self.page.locator("[data-body-joint]")).to_have_count(72)
        with self.page.expect_download() as result:
            self.page.locator("[data-export-pose]").click()
        payload = json.loads(Path(result.value.path()).read_text())
        self.assertEqual(payload["schema"], "i-corpi.star-pose.v1")
        self.assertEqual(len(payload["pose"]), 72)
        self.assertEqual(payload["jointIndexBase"], 0)

    def test_olaf_character_filter_pose_expression_export_and_comparison(self):
        self.open("/archive/?kind=character")
        expect(self.page.locator("#record-count")).to_have_text(f"1 of {self.info['records']} records")
        self.page.locator('#record-list [data-model-id="olaf"]').click()
        expect(self.page.locator("#model-detail h2")).to_have_text("Olaf")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("16 joints · procedural pose demonstrator")
        expect(self.page.locator("[data-body-joint]")).to_have_count(48)
        self.assert_joint_map_geometry()
        self.page.locator('[data-pose="bow"]').click()
        self.page.locator('[data-pose="neutral"]').click()
        self.page.locator("[data-animate-pose]").click()
        self.page.wait_for_timeout(200)
        self.page.locator("[data-animate-pose]").click()
        self.assertNotEqual(float(self.page.locator('[data-body-joint="5"][data-axis="2"]').input_value()), 0)
        self.page.locator("[data-map-focus]").select_option("face")
        expect(self.page.locator("#joint-markers button:visible")).to_have_count(5)
        self.page.locator('[data-body-joint="15"][data-axis="1"]').fill("15")
        self.page.locator('[data-expression="smile"]').fill("0.7")
        self.page.wait_for_timeout(150)
        self.assert_joint_map_geometry()
        self.page.locator(".review-visuals").screenshot(path=str(ROOT / "work/browser/olaf-face.png"))
        with self.page.expect_download() as result:
            self.page.locator("[data-export-pose]").click()
        payload = json.loads(Path(result.value.path()).read_text())
        self.assertEqual(payload["schema"], "i-corpi.olaf-pose.v2")
        self.assertEqual(payload["jointNames"][0], "root")
        self.assertEqual(payload["jointNames"][15], "nose")
        self.assertEqual(len(payload["pose"]), 48)
        self.assertEqual(payload["parentIndices"][15], 3)
        self.assertAlmostEqual(payload["pose"][15 * 3 + 1], 15 * 3.141592653589793 / 180)
        self.assertEqual(payload["illustrativeExpressions"]["smile"], .7)
        self.assertFalse(any(url.endswith((".urdf", ".glb", ".pkl", ".npz")) for url in self.requests))
        self.open("/compare/?a=olaf&b=smpl-x")
        expect(self.page.locator('[data-viewer-instance="compare-a"] .ready')).to_have_text("16 joints · procedural pose demonstrator")
        expect(self.page.locator('[data-viewer-instance="compare-b"] .ready')).to_have_text("55 joints · procedural pose demonstrator")
        expect(self.page.locator("#compare-note")).to_be_visible()
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)

    def test_olaf_map_and_forward_motion_export_reset_and_cleanup(self):
        self.page.add_init_script("window.__frames = 0; const raf = window.requestAnimationFrame; window.requestAnimationFrame = cb => { window.__frames++; return raf(cb); };")
        self.open("/archive/olaf/")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_class("ready")
        expect(self.page.locator(".character-motion")).to_be_visible()
        self.assertGreater(self.page.locator(".joint-map-shape").count(), 20)
        # Parentage of a floating foot or eye must not be drawn as a leg/face bone.
        expect(self.page.locator('.joint-bone[data-joint*="foot"]')).to_have_count(0)
        expect(self.page.locator(".joint-bone")).to_have_count(4)
        self.assert_joint_map_geometry()
        self.page.locator(".review-visuals").screenshot(path=str(ROOT / "work/browser/olaf-body-map.png"))

        def pose():
            with self.page.expect_download() as result:
                self.page.locator("[data-export-pose]").click()
            return json.loads(Path(result.value.path()).read_text())

        step = self.page.locator("[data-step-forward]")
        step.click()
        expect(step).to_be_enabled(timeout=15000)
        moved = pose()
        self.assertAlmostEqual(moved["translation"][0], 0, places=6)
        self.assertAlmostEqual(moved["translation"][2], .3, places=6)
        self.assertAlmostEqual(moved["locomotion"]["travelledMetres"], .3, places=6)
        self.assertEqual(len(moved["jointTranslationOffsets"]), 16)
        self.assertGreater(abs(moved["jointTranslationOffsets"][10][2]), .1)
        self.assertEqual(moved["translationUnits"], "metres")
        self.assert_joint_map_geometry()
        # Resetting the camera must never erase real movement or rebase the rig.
        self.page.locator("#viewer-reset").click()
        self.assertEqual(pose()["translation"], moved["translation"])
        self.page.locator("[data-motion-heading]").fill("90")
        step.click()
        expect(step).to_be_enabled(timeout=15000)
        turned = pose()
        self.assertAlmostEqual(turned["translation"][0], .3, places=6)
        self.assertAlmostEqual(turned["translation"][2], .3, places=6)
        self.assertAlmostEqual(turned["pose"][1], 3.141592653589793 / 2, places=6)
        self.page.locator("[data-map-view]").select_option("side")
        expect(self.page.locator(".body-map-status b")).to_have_text("World side · +Z →")
        self.page.wait_for_timeout(100)
        self.assert_joint_map_geometry()
        self.page.locator("[data-motion-heading]").fill("0")
        self.page.locator(".review-visuals").screenshot(path=str(ROOT / "work/browser/olaf-side-map.png"))
        self.page.locator("[data-walk]").click()
        expect(self.page.locator("[data-walk]")).to_have_text("Pause walking")
        self.page.wait_for_timeout(250)
        self.page.locator("[data-walk]").click()
        frozen = self.page.locator("[data-motion-position]").get_attribute("data-distance")
        self.page.wait_for_timeout(200)
        frames = self.page.evaluate("window.__frames")
        self.page.wait_for_timeout(250)
        self.assertEqual(self.page.locator("[data-motion-position]").get_attribute("data-distance"), frozen)
        self.assertLessEqual(self.page.evaluate("window.__frames") - frames, 1)
        self.page.locator("[data-reset-position]").click()
        reset = pose()
        self.assertEqual(reset["translation"], [0, 0, 0])
        self.assertTrue(all(offset == [0, 0, 0] for offset in reset["jointTranslationOffsets"]))
        self.assertEqual(reset["locomotion"]["travelledMetres"], 0)
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.wait_for_timeout(100)
        self.assert_joint_map_geometry()
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        self.page.locator("[data-walk]").click()
        self.page.locator("[data-close-viewer]").click()
        expect(self.page.locator(".character-motion")).to_have_count(0)
        self.page.wait_for_timeout(200)
        frames = self.page.evaluate("window.__frames")
        self.page.wait_for_timeout(200)
        self.assertLessEqual(self.page.evaluate("window.__frames") - frames, 1)
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator(".character-motion")).to_have_count(1)
        expect(self.page.locator("[data-motion-position]")).to_have_attribute("data-distance", "0")

    def test_olaf_stance_foot_stays_planted_while_root_advances(self):
        self.open("/archive/olaf/")
        result = self.page.evaluate("""async () => {
          const base = window.ICorpi.asset;
          const THREE = await import(base('/vendor/three.module.js'));
          const { createOlafRig } = await import(base('/assets/js/olaf-rig.js'));
          const { createOlafMotion } = await import(base('/assets/js/olaf-motion.js'));
          const root = document.createElement('div');
          root.innerHTML = '<div class="review-visuals"></div>';
          const robot = createOlafRig(THREE);
          const values = robot.layout.joints.map(() => [0, 0, 0]);
          const abort = new AbortController();
          const originalRAF = window.requestAnimationFrame, originalCancel = window.cancelAnimationFrame;
          const pending = new Map(); let nextID = 0;
          window.requestAnimationFrame = cb => { pending.set(++nextID, cb); return nextID; };
          window.cancelAnimationFrame = id => pending.delete(id);
          const sync = () => {
            robot.layout.joints.forEach(([name], i) => robot.joints[name].rotation.set(...values[i].map(v => v * Math.PI / 180)));
            robot.updateWorldMatrix(true, true);
          };
          const position = name => robot.joints[name].getWorldPosition(new THREE.Vector3()).toArray();
          try {
            const motion = createOlafMotion({ root, robot, values, sync, signal: abort.signal, beforePlay: () => {} });
            root.querySelector('[data-walk]').click();
            const planted = position('left_foot');
            for (const time of [0, 100, 200, 300]) {
              const callbacks = [...pending.values()]; pending.clear();
              callbacks.forEach(cb => cb(time));
            }
            const after = position('left_foot'), swing = position('right_foot');
            const translation = robot.position.toArray(), offsets = motion.state().jointTranslationOffsets;
            abort.abort();
            return { planted, after, swing, translation, offsets, pending: pending.size };
          } finally {
            abort.abort();
            window.requestAnimationFrame = originalRAF;
            window.cancelAnimationFrame = originalCancel;
          }
        }""")
        for before, after in zip(result["planted"], result["after"]):
            self.assertAlmostEqual(before, after, places=6)
        self.assertGreater(result["translation"][2], .1)
        self.assertGreater(result["swing"][1], result["planted"][1] + .05)
        self.assertEqual(result["pending"], 0)

    def test_comparison_keeps_olaf_movement_independent(self):
        self.open("/compare/?a=olaf&b=olaf")
        left = self.page.locator('[data-viewer-instance="compare-a"]')
        right = self.page.locator('[data-viewer-instance="compare-b"]')
        expect(left.locator(".ready")).to_be_visible()
        expect(right.locator(".ready")).to_be_visible()
        left.locator("[data-motion-heading]").fill("90")
        left.locator("[data-follow-motion]").uncheck()
        left.locator("[data-step-forward]").click()
        expect(left.locator("[data-step-forward]")).to_be_enabled(timeout=15000)
        self.assertAlmostEqual(float(left.locator("[data-motion-position]").get_attribute("data-x")), .3)
        expect(right.locator("[data-motion-position]")).to_have_attribute("data-distance", "0")
        expect(right.locator("[data-motion-heading]")).to_have_value("0")
        right.locator("[data-walk]").click()
        left.locator("[data-reset-position]").click()
        expect(right.locator("[data-walk]")).to_have_text("Pause walking")
        right.locator("[data-walk]").click()
        self.assertGreater(float(right.locator("[data-motion-position]").get_attribute("data-distance")), 0)
        left.locator("[data-close-viewer]").click()
        expect(left.locator(".character-motion")).to_have_count(0)
        expect(right.locator(".character-motion")).to_have_count(1)
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)

    def test_gallery_keyboard_and_drag(self):
        self.open("/gallery/")
        stage = self.page.locator(".turntable-stage").first
        stage.focus()
        stage.press("ArrowRight")
        expect(stage).to_have_attribute("aria-valuenow", "2")
        expect(stage.locator("img")).to_have_js_property("naturalWidth", 800)
        stage.press("End")
        expect(stage).to_have_attribute("aria-valuenow", "16")
        stage.press("Home")
        bounds = stage.bounding_box()
        self.page.mouse.move(bounds["x"] + 100, bounds["y"] + 150)
        self.page.mouse.down()
        self.page.mouse.move(bounds["x"] + 160, bounds["y"] + 150, steps=5)
        self.page.mouse.up()
        self.assertNotEqual(stage.get_attribute("aria-valuenow"), "1")

    def test_viewer_joints_reset_and_idle_rendering(self):
        self.page.add_init_script("window.__frames = 0; const raf = window.requestAnimationFrame; window.requestAnimationFrame = cb => { window.__frames++; return raf(cb); };")
        self.open("/archive/simple-humanoid/")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("29 controllable joints")
        expect(self.page.locator("#joint-markers button")).to_have_count(29)
        slider = self.page.locator('#joint-controls input[type="range"]').first
        slider.focus()
        slider.press("End")
        name = slider.get_attribute("data-joint")
        marker = self.page.locator(f'#joint-markers [data-joint="{name}"]')
        self.assertAlmostEqual(float(marker.get_attribute("aria-valuenow")), float(slider.input_value()))
        self.page.locator("#joint-reset").click()
        self.assertAlmostEqual(float(slider.input_value()), 0, delta=0.02)
        self.page.wait_for_timeout(200)
        frames = self.page.evaluate("window.__frames")
        self.page.wait_for_timeout(350)
        self.assertLessEqual(self.page.evaluate("window.__frames") - frames, 1)
        self.page.screenshot(path=str(ROOT / "work/browser/viewer.png"), full_page=True)
        self.page.locator("[data-close-viewer]").click()
        expect(self.page.locator("[data-viewer-poster]")).to_be_visible()

    def test_failed_mesh_can_retry_and_load_compressed_geometry(self):
        self.page.route("**/*.stl.gz", lambda route: route.fulfill(status=404, body="missing"))
        self.open("/archive/unitree-g1/")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("[data-viewer-message]")).to_contain_text("3D could not load")
        expect(self.page.locator("[data-viewer-workbench]")).to_be_hidden()
        self.page.unroute("**/*.stl.gz")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("29 controllable joints", timeout=40000)
        self.assertTrue(any(url.endswith(".stl.gz") for url in self.requests))
        self.assertFalse(any(url.lower().endswith(".stl") for url in self.requests))

    def test_original_mesh_fallback_and_mimic_joints(self):
        self.page.add_init_script("window.DecompressionStream = undefined;")
        self.open("/archive/pal-talos/")
        expect(self.page.locator("[data-viewer-size]")).to_contain_text("6.3 MB geometry")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("32 controllable joints", timeout=40000)
        self.assertFalse(any(url.endswith(".stl.gz") for url in self.requests))
        self.assertTrue(any(url.lower().endswith(".stl") for url in self.requests))

    def test_switching_during_load_cannot_replace_the_new_record(self):
        self.page.add_init_script("""const originalFetch = window.fetch;
          window.fetch = async (...args) => {
            if (String(args[0]).includes('/models/unitree-g1/model.urdf')) await new Promise(resolve => setTimeout(resolve, 1200));
            return originalFetch(...args);
          };""")
        self.open("/archive/unitree-g1/")
        self.page.locator("[data-load-viewer]").click()
        self.page.locator('#record-list [data-model-id="simple-humanoid"]').click()
        expect(self.page.locator("#model-detail h2")).to_have_text("Simple Humanoid")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("#viewer-status")).to_have_text("29 controllable joints")
        self.page.wait_for_timeout(1400)
        expect(self.page.locator("#model-detail h2")).to_have_text("Simple Humanoid")
        expect(self.page.locator("#joint-markers button")).to_have_count(29)

    def test_webgl_failure_keeps_the_record_and_downloads_readable(self):
        self.page.add_init_script("const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.startsWith('webgl') ? null : get.call(this, type, ...args); };")
        self.open("/archive/simple-humanoid/")
        self.page.locator("[data-load-viewer]").click()
        expect(self.page.locator("[data-viewer-message]")).to_contain_text("3D could not load")
        expect(self.page.get_by_text("Download complete package", exact=False)).to_be_visible()

    def test_records_and_comparison_work_without_javascript(self):
        context = self.browser.new_context(java_script_enabled=False)
        page = context.new_page()
        page.goto(self.url + "/archive/unitree-h2/")
        expect(page.locator("#model-detail h2")).to_have_text("H2")
        expect(page.get_by_text("Download complete package", exact=False)).to_be_visible()
        page.goto(self.url + "/compare/")
        expect(page.locator("#compare-table caption")).to_have_text("G1 and H2 comparison")
        page.goto(self.url + "/learn/")
        expect(page.locator("[data-dataset]:visible")).to_have_count(6)
        expect(page.locator("[data-action-example]:visible")).to_have_count(5)
        expect(page.locator('a[href$="/archive/smpl/"]')).to_be_visible()
        context.close()

    def test_mobile_layout_and_licence_visibility(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        for path in ("/", "/archive/unitree-g1/", "/compare/", "/learn/", "/about/"):
            self.open(path)
            self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        expect(self.page.locator('.ledger-row[role="row"]').nth(1).locator('[role="cell"]').nth(3)).to_be_visible()
        self.open("/")
        self.page.screenshot(path=str(ROOT / "work/browser/mobile-home.png"), full_page=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
