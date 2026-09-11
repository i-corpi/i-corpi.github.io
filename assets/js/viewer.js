const { asset } = window.ICorpi;
let modules;
function browserModules() {
  modules ||= Promise.all([
    import(asset("/vendor/three.module.js")), import(asset("/vendor/OrbitControls.js")),
    import(asset("/vendor/URDFLoader.js")), import(asset("/vendor/STLLoader.js")),
    import("./joint-map.js"),
  ]).catch((error) => { modules = null; throw error; });
  return modules;
}

// Ownership starts before imports or requests, including loads that fail.
export function createViewer(model, root) {
  const controller = new AbortController();
  const { signal } = controller;
  const geometries = new Set();
  let stopped = false;
  let renderer, scene, camera, orbit, observer, wrapper, joints;
  let frame = 0;
  let timeout;
  const check = () => {
    if (signal.aborted) throw signal.reason || new DOMException("Load cancelled", "AbortError");
  };
  const destroy = () => {
    if (stopped) return;
    stopped = true;
    controller.abort();
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    observer?.disconnect();
    orbit?.dispose();
    const materials = new Set();
    const textures = new Set();
    scene?.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => {
        if (!material) return;
        materials.add(material);
        Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    renderer?.dispose();
    renderer?.forceContextLoss();
    root.querySelector('[data-viewer-part="joint-controls"]').replaceChildren();
    root.querySelector('[data-viewer-part="joint-markers"]').replaceChildren();
    root.querySelector('[data-viewer-part="joint-reset"]').disabled = true;
    root.querySelector('[data-viewer-part="viewer-reset"]').disabled = true;
  };

  const ready = (async () => {
    const [THREE, { OrbitControls }, { default: URDFLoader }, { STLLoader }, { createJointControls }] = await browserModules();
    check();
    const stage = root.querySelector('[data-viewer-part="urdf-stage"]');
    // A disposed WebGL context belongs to its canvas. Retry on a fresh canvas
    // so a delayed context-lost event cannot close the next viewer.
    const oldCanvas = stage.querySelector("canvas");
    const canvas = oldCanvas.cloneNode(false);
    oldCanvas.replaceWith(canvas);
    const status = root.querySelector('[data-viewer-part="viewer-status"]');
    const reset = root.querySelector('[data-viewer-part="viewer-reset"]');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    orbit = new OrbitControls(camera, canvas);
    orbit.enablePan = false;
    // Input, resize and joint changes request one frame; idle scenes do no work.
    const invalidate = () => {
      if (stopped || frame || document.hidden) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!stopped) renderer.render(scene, camera);
      });
    };
    orbit.addEventListener("change", invalidate);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else invalidate();
    }, { signal });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      root.dispatchEvent(new CustomEvent("viewer-error", { detail: "The 3D context was lost. Try loading the model again." }));
    }, { signal });
    scene.add(new THREE.HemisphereLight(0xf4f2ec, 0x464943, 2.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1.1);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    const grid = new THREE.GridHelper(8, 32, 0xbcb7ab, 0xd8d4ca);
    grid.material.opacity = 0.38;
    grid.material.transparent = true;
    scene.add(grid);
    const resize = () => {
      if (stopped) return;
      const bounds = stage.getBoundingClientRect();
      renderer.setSize(Math.max(bounds.width, 1), Math.max(bounds.height, 1), false);
      camera.aspect = Math.max(bounds.width, 1) / Math.max(bounds.height, 1);
      camera.updateProjectionMatrix();
      invalidate();
    };
    observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    timeout = setTimeout(() => controller.abort(new Error("The model load timed out. Please retry.")), 90000);
    const request = async (url) => {
      check();
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`An asset could not be loaded (HTTP ${response.status}).`);
      return response;
    };
    const meshMap = new Map(Object.entries(model.assets.meshMap || {})
      .map(([source, compressed]) => [new URL(asset(source), location.href).href, asset(compressed)]));
    const meshCache = new Map();
    const queue = [];
    let running = 0;
    const drain = () => {
      while (running < 4 && queue.length) {
        const { task, resolve, reject } = queue.shift();
        if (signal.aborted) { reject(signal.reason); continue; }
        running += 1;
        Promise.resolve().then(task).then(resolve, reject).finally(() => { running -= 1; drain(); });
      }
    };
    const schedule = (task) => new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      drain();
    });
    signal.addEventListener("abort", drain, { once: true });
    let robot;
    let makeControls = createJointControls;
    const pending = [];
    const bodyPreview = Boolean(model.posePreview);
    if (bodyPreview) {
      const { createBodyRig, createBodyControls } = await import("./body-rig.js");
      check();
      if (model.posePreview === "olaf16") {
        const { createOlafRig } = await import("./olaf-rig.js");
        check();
        robot = createOlafRig(THREE);
      } else robot = createBodyRig(THREE, model);
      makeControls = createBodyControls;
    } else {
      const loader = new URDFLoader();
      loader.packages = Object.fromEntries(Object.entries(model.packageMap || {}).map(([name, path]) => [name, asset(path)]));
      let completed = 0;
      loader.loadMeshCb = (path, _manager, done) => {
        const absolute = new URL(path, location.href).href;
        if (!meshCache.has(absolute)) {
          meshCache.set(absolute, schedule(async () => {
            const compressed = typeof DecompressionStream === "function" && meshMap.get(absolute);
            const response = await request(compressed || absolute);
            const bytes = compressed
              ? await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
              : await response.arrayBuffer();
            check();
            const geometry = new STLLoader().parse(bytes);
            geometries.add(geometry);
            completed += 1;
            status.textContent = `Loading geometry · ${completed} of ${model.assets.meshCount} meshes`;
            return geometry;
          }));
        }
        const task = meshCache.get(absolute).then((geometry) => {
          check();
          done(new THREE.Mesh(geometry, null));
        });
        pending.push(task);
        task.catch(() => {});
      };
      const urdfUrl = asset(model.hostedPath);
      const text = await (await request(urdfUrl)).text();
      check();
      robot = loader.parse(text, urdfUrl.slice(0, urdfUrl.lastIndexOf("/") + 1));
      // Presentation only: iCub's source faces -X and has left on -Y.
      // Its original URDF, inertias, and joint coordinates stay untouched.
      robot.rotateZ((model.viewer?.yawDegrees || 0) * Math.PI / 180);
    }
    wrapper = new THREE.Group();
    wrapper.rotation.x = bodyPreview ? 0 : -Math.PI / 2;
    wrapper.add(robot);
    scene.add(wrapper);
    if (robot.layout?.hybrid) {
      const { attachSharpaHands, createSharpaControls } = await import("./sharpa-hands.js");
      check();
      await attachSharpaHands({ THREE, rig: robot, request, check, geometries, schedule });
      robot.makeHandControls = createSharpaControls;
    }
    await Promise.all(pending);
    check();
    clearTimeout(timeout);
    robot.traverse((node) => {
      (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => {
        if (!material?.color) return;
        const luminance = 0.2126 * material.color.r + 0.7152 * material.color.g + 0.0722 * material.color.b;
        if (luminance > 0.9 && !robot.layout?.authoredCharacter) material.color.setHex(0x5a5f5b);
      });
    });
    const character = Boolean(robot.layout?.authoredCharacter);
    let fitted = false, followMotion = true;
    const motionLocation = robot.position.clone();
    const directionArrow = character ? new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(), .65, 0xd8461b, .13, .09) : null;
    if (directionArrow) scene.add(directionArrow);
    const fit = () => {
      // Once the character is placed, camera resets must preserve its world
      // trajectory and the stationary grid used to judge forward travel.
      if (!character || !fitted) wrapper.position.set(0, 0, 0);
      wrapper.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(wrapper);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      if (!character || !fitted) {
        wrapper.position.sub(box.getCenter(new THREE.Vector3()));
        wrapper.position.y += size.y / 2;
      }
      fitted = true;
      wrapper.updateWorldMatrix(true, true);
      const center = new THREE.Box3().setFromObject(wrapper).getCenter(new THREE.Vector3());
      const reach = Math.max(size.x, size.y, size.z, 0.01);
      const distance = Math.max(reach * (bodyPreview ? 2.55 : 2.05), 1.2);
      orbit.target.set(center.x, center.y - size.y * .02, center.z);
      orbit.minDistance = reach * 0.65;
      orbit.maxDistance = reach * 8;
      camera.position.set(center.x + distance * .52, center.y + size.y * .02 + distance * .2, center.z + distance * .86);
      orbit.update();
      joints?.positionJointMap();
      invalidate();
    };
    fit();
    const updateMotionView = () => {
      if (character) {
        const delta = robot.position.clone().sub(motionLocation);
        if (followMotion && delta.lengthSq()) {
          camera.position.add(delta);
          orbit.target.add(delta);
          orbit.update();
        }
        motionLocation.copy(robot.position);
        // Move the finite grid by whole grid intervals so it covers long
        // journeys while its world-space lines remain stationary.
        grid.position.set(Math.round(orbit.target.x), 0, Math.round(orbit.target.z));
        wrapper.updateWorldMatrix(true, true);
        const origin = robot.joints.root.getWorldPosition(new THREE.Vector3());
        origin.y = .012;
        const yaw = robot.joints.root.rotation.y;
        const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        directionArrow.position.copy(origin).addScaledVector(direction, .36);
        directionArrow.setDirection(direction);
      }
      invalidate();
    };
    root.addEventListener("viewer-follow-motion", event => { followMotion = Boolean(event.detail); }, { signal });
    joints = makeControls({ THREE, root, robot, wrapper, onChange: updateMotionView, signal, model });
    reset.disabled = false;
    reset.addEventListener("click", fit, { signal });
    const focusNode = node => {
      if (!node) return;
      const box = new THREE.Box3().setFromObject(node);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      orbit.target.copy(center);
      orbit.minDistance = size * .3;
      camera.position.copy(center).add(new THREE.Vector3(.3, .2, 1).normalize().multiplyScalar(size * 1.8));
      orbit.update();
      invalidate();
    };
    root.addEventListener("viewer-focus-hand", event => {
      focusNode(robot.handAttachments?.find(hand => hand.side === event.detail)?.robot);
    }, { signal });
    root.addEventListener("viewer-focus-region", event => {
      if (event.detail === "body" || event.detail === "all") fit();
      else focusNode(robot.joints[event.detail === "face" ? "head" : `${event.detail}_wrist`]);
    }, { signal });
    status.textContent = robot.layout?.hybrid ? "22 body joints + 44 Sharpa joints · hybrid demonstrator"
      : bodyPreview ? `${joints.count} joints · procedural pose demonstrator` : `${joints.count} controllable joints`;
    status.className = "ready";
    invalidate();
  })().catch((error) => { destroy(); throw error; });
  // Used by the offline gallery generator, which shares the actual viewer
  // geometry and materials instead of approximating them with dropped faces.
  const snapshot = async (angle = 0, size = 800) => {
    await ready;
    check();
    const position = camera.position.clone();
    const aspect = camera.aspect;
    const pixelRatio = renderer.getPixelRatio();
    const width = renderer.domElement.width / pixelRatio;
    const height = renderer.domElement.height / pixelRatio;
    const offset = position.clone().sub(orbit.target);
    const x = offset.x * Math.cos(angle) + offset.z * Math.sin(angle);
    const z = -offset.x * Math.sin(angle) + offset.z * Math.cos(angle);
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    camera.position.set(orbit.target.x + x, position.y, orbit.target.z + z);
    camera.lookAt(orbit.target);
    renderer.render(scene, camera);
    const image = renderer.domElement.toDataURL("image/png");
    camera.position.copy(position);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.lookAt(orbit.target);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    return image;
  };
  return { ready, destroy, snapshot };
}
