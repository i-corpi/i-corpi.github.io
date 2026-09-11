import { projectSurfaces } from "./projected-surfaces.js";

// Orthographic projection of real pivots. Labels may move; their anchors do not.
export function createJointProjection({ THREE, root, wrapper, controls, front = [1, 0, 0],
  surfaceRoot, boneFilter = () => true, signal }) {
  const plot = root.querySelector('[data-viewer-part="body-map-plot"]');
  const svg = root.querySelector('[data-viewer-part="joint-skeleton"]');
  const right = new THREE.Vector3(...front).negate().cross(new THREE.Vector3(0, 1, 0)).normalize();
  const elements = new Map();
  const nodes = new Map(controls.map(control => [control.joint, control]));
  const make = (tag, attributes) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    svg.appendChild(node);
    return node;
  };
  svg.replaceChildren();
  const surfaceLayer = surfaceRoot ? make("g", { class: "joint-map-surface" }) : null;
  let surfacePaths = [];
  for (const control of controls) {
    let parent = control.joint.parent;
    while (parent && !nodes.has(parent)) parent = parent.parent;
    elements.set(control, {
      parent: nodes.get(parent),
      bone: boneFilter(control) ? make("line", { class: "joint-bone", "data-joint": control.name }) : null,
      leader: make("line", { class: "joint-leader", "data-joint": control.name }),
      pivot: make("circle", { class: "joint-pivot", r: 3, "data-joint": control.name }),
    });
  }
  let frame = 0;
  const update = () => {
    if (signal.aborted || !controls.length) return;
    wrapper.updateWorldMatrix(true, true);
    const { width, height } = plot.getBoundingClientRect();
    if (!width || !height) return;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const positions = controls.map(control => {
      const position = control.joint.getWorldPosition(new THREE.Vector3());
      return { control, x: position.dot(right), y: position.y };
    });
    const surfaces = surfaceRoot ? projectSurfaces({ THREE, surfaceRoot, right, front: new THREE.Vector3(...front) }) : [];
    // Keep aspect ratio and a generous margin for callouts. A skeleton built
    // from the current FK pose replaces the old fixed human silhouette.
    const bounds = [...positions, ...surfaces.flatMap(surface => surface.points)];
    const xs = bounds.map(p => p.x), ys = bounds.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min((width - 100) / Math.max(maxX - minX, .15),
      (height - 150) / Math.max(maxY - minY, .15));
    const project = ({ x, y }) => ({
      x: width / 2 + (x - (minX + maxX) / 2) * scale,
      y: height / 2 + ((minY + maxY) / 2 - y) * scale,
    });
    const projected = new Map(positions.map(position => [position.control, project(position)]));
    if (surfaceLayer) {
      if (surfacePaths.length !== surfaces.length) {
        surfaceLayer.replaceChildren();
        surfacePaths = surfaces.map(() => {
          const path = make("path", { class: "joint-map-shape" });
          surfaceLayer.appendChild(path);
          return path;
        });
      }
      surfaces.forEach((surface, index) => {
        const points = surface.points.map(project);
        surfacePaths[index].setAttribute("d", points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + " Z");
        surfacePaths[index].setAttribute("fill", surface.color);
      });
    }
    const placed = [];
    for (const control of controls) {
      const anchor = projected.get(control);
      let label;
      // Distances are in pixels, so touch targets stay separated at every size.
      for (let radius = 0; radius <= Math.max(width, height) * 2 && !label; radius += 36) {
        const samples = radius ? Math.max(12, Math.ceil(2 * Math.PI * radius / 36)) : 1;
        for (let i = 0; i < samples; i++) {
          const angle = 2 * Math.PI * i / samples;
          const x = anchor.x + Math.cos(angle) * radius;
          const y = anchor.y + Math.sin(angle) * radius;
          if (x < 20 || x > width - 20 || y < 62 || y > height - 48) continue;
          if (placed.every(point => Math.hypot(x - point.x, y - point.y) >= 35.5)) {
            label = { x, y };
            break;
          }
        }
      }
      label ||= anchor;
      placed.push(label);
      const { pivot, bone, leader, parent } = elements.get(control);
      const parentPoint = projected.get(parent) || anchor;
      const line = (node, a, b) => {
        for (const [key, value] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })) node.setAttribute(key, value);
      };
      if (bone) line(bone, parentPoint, anchor);
      line(leader, anchor, label);
      pivot.setAttribute("cx", anchor.x);
      pivot.setAttribute("cy", anchor.y);
      if (control.marker) {
        control.marker.style.left = `${label.x}px`;
        control.marker.style.top = `${label.y}px`;
        control.marker.dataset.anchorX = anchor.x;
        control.marker.dataset.anchorY = anchor.y;
      }
    }
  };
  const schedule = () => {
    if (!frame && !signal.aborted) frame = requestAnimationFrame(() => { frame = 0; update(); });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(plot);
  signal.addEventListener("abort", () => { observer.disconnect(); cancelAnimationFrame(frame); }, { once: true });
  update();
  return { update, schedule };
}
