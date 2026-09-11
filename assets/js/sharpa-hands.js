// Browser assets from las manos; their original Apache licence stays with them.
import URDFLoader from "../../vendor/URDFLoader.js";
import { GLTFLoader } from "../../vendor/GLTFLoader.js";
import { createJointControls } from "./joint-map.js";

export async function attachSharpaHands({ THREE, rig, request, check, geometries, schedule }) {
  const { asset } = window.ICorpi;
  const base = asset("/attachments/sharpa-wave/");
  const text = await (await request(`${base}model.urdf`)).text();
  const cache = new Map();
  const hands = [];
  const pending = [];
  // Attach parsed trees immediately so the viewer owns their resources even
  // when another mesh fails or the user changes records during loading.
  for (const side of ["right", "left"]) {
    const loader = new URDFLoader();
    loader.loadMeshCb = (path, _manager, done) => {
      if (!cache.has(path)) cache.set(path, schedule(async () => {
        const bytes = await (await request(path)).arrayBuffer();
        check();
        const gltf = await new GLTFLoader().parseAsync(bytes, base);
        const meshes = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse(node => {
          if (node.geometry) geometries.add(node.geometry);
          if (node.isMesh) meshes.push(node);
          // These verified GLBs each contain one untextured STL-derived mesh.
          (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => material?.dispose());
        });
        try { check(); } catch (error) { meshes.forEach(mesh => mesh.geometry.dispose()); throw error; }
        if (meshes.length !== 1) throw new Error("Unexpected Sharpa mesh structure");
        const geometry = meshes[0].geometry.applyMatrix4(meshes[0].matrixWorld);
        // The STL-derived GLBs contain positions/indices only. URDF's Phong
        // material needs normals to light the surface instead of rendering black.
        if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
        return geometry;
      }));
      const task = cache.get(path).then(geometry => { check(); done(new THREE.Mesh(geometry, null)); });
      task.catch(() => {});
      pending.push(task);
    };
    const hand = loader.parse(text, base);
    const mount = new THREE.Group();
    // Source +Z runs wrist to fingertips; body arms extend along +/-X.
    // The supplied asset is right-handed. Left placement is a visual mirror.
    mount.scale.x = side === "left" ? -1 : 1;
    hand.rotation.y = -Math.PI / 2;
    mount.add(hand);
    rig.joints[`${side}_wrist`].add(mount);
    hands.push({ side, robot: hand, mount, mirrored: side === "left" });
  }
  rig.handAttachments = hands;
  await Promise.all(pending);
  check();
}

export function createSharpaControls({ THREE, root, robot, onChange, signal }) {
  const { asset } = window.ICorpi;
  const instance = root.dataset.viewerInstance || root.dataset.modelViewer;
  const details = document.createElement("details");
  details.dataset.handAttachments = "";
  details.className = "hand-attachments";
  details.innerHTML = `<summary>Sharpa Wave · two hand placements · 22 joints each</summary>
    <p class="hand-disclosure">Right-hand URDF from las manos. The left placement mirrors that right-hand asset.
    L1–L22 and R1–R22 are local display labels; source joint names remain unchanged. This hybrid is not a native SMPL+H/MANO pose.</p>
    <p class="hand-disclosure"><a href="https://las-manos.github.io/archive/#sharpa-wave">Open Sharpa on las manos ↗</a> ·
    <a href="${asset("/attachments/sharpa-wave/PROVENANCE.md")}">Asset provenance</a> ·
    <a href="${asset("/attachments/sharpa-wave/LICENSE")}">Apache-2.0 licence</a></p>
    <div class="hand-attachment-panels"></div>`;
  root.querySelector("[data-viewer-workbench]").append(details);
  const panels = details.querySelector(".hand-attachment-panels");
  const controllers = robot.handAttachments.map(hand => {
    const panel = document.createElement("section");
    panel.className = "hand-attachment";
    panel.dataset.handSide = hand.side;
    panel.dataset.viewerInstance = `${instance}-${hand.side}-sharpa`;
    panel.innerHTML = `<div class="hand-toolbar"><h3>${hand.side === "left" ? "Left · mirrored" : "Right · source"} placement</h3>
      <button type="button" data-focus-hand>Focus hand in 3D</button></div>
      <div class="body-map"><div class="body-map-plot" data-viewer-part="body-map-plot">
        <div class="body-map-status"><span data-viewer-part="body-map-active"></span></div>
        <svg class="joint-skeleton" data-viewer-part="joint-skeleton" aria-hidden="true"></svg>
        <div data-viewer-part="joint-markers"></div>
      </div></div>
      <aside class="joint-map"><div class="joint-map-head"><h3>Source URDF joints</h3>
        <button type="button" data-viewer-part="joint-reset">Open hand</button></div>
        <div class="hand-presets"><button type="button" data-hand-pose="grasp">Grasp</button><button type="button" data-hand-pose="point">Point</button></div>
        <div class="joint-map-list" data-viewer-part="joint-controls"></div></aside>`;
    panels.append(panel);
    const controller = createJointControls({ THREE, root: panel, robot: hand.robot, wrapper: hand.mount,
      onChange, signal, mapFront: [0, 0, 1], numberPrefix: hand.side === "left" ? "L" : "R" });
    panel.querySelector("[data-focus-hand]").addEventListener("click", () => {
      root.dispatchEvent(new CustomEvent("viewer-focus-hand", { detail: hand.side }));
    }, { signal });
    panel.querySelectorAll("[data-hand-pose]").forEach(button => button.addEventListener("click", () => {
      const values = Object.fromEntries(controller.getJointState().map(({ name }) => {
        const bend = /_FE$|_PIP$|_DIP$|_IP$/.test(name);
        const pointing = button.dataset.handPose === "point" && name.includes("_index_");
        return [name, bend && !pointing ? .8 : 0];
      }));
      controller.setJointValues(values);
    }, { signal }));
    return { hand, controller };
  });
  signal.addEventListener("abort", () => details.remove(), { once: true });
  return {
    update: () => controllers.forEach(({ controller }) => controller.positionJointMap()),
    reset: () => controllers.forEach(({ controller }) => controller.setJointValues({})),
    state: () => controllers.map(({ hand, controller }) => ({
      attachment: hand.side, sourceHand: "right", mirrored: hand.mirrored,
      jointPositions: controller.getJointState(), units: "radians",
    })),
  };
}
