import { createJointProjection } from "./joint-projection.js";
import { bodyLayout, SMPL_JOINTS } from "./body-layouts.js";
import { createOlafMotion } from "./olaf-motion.js";

export const BODY_JOINTS = SMPL_JOINTS;

export function createBodyRig(THREE, model) {
  const rig = new THREE.Group();
  rig.layout = bodyLayout(model);
  rig.name = `${rig.layout.name} procedural demonstrator`;
  rig.joints = {};
  rig.expression = { blink: 0, smile: 0 };
  const definition = rig.layout.joints;
  const material = new THREE.MeshStandardMaterial({ color: 0x7a8583, roughness: .75 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xd8461b, roughness: .7 });
  const nodes = [];
  definition.forEach(([name, parentIndex, position], index) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.fromArray(position);
    if (parentIndex >= 0) node.position.sub(new THREE.Vector3(...definition[parentIndex][2]));
    (nodes[parentIndex] || rig).add(node);
    nodes.push(node);
    rig.joints[name] = node;
    const finger = /(?:index|middle|pinky|ring|thumb)\d$/.test(name);
    const face = /jaw|eye_smplhf/.test(name);
    const pivot = new THREE.Mesh(new THREE.SphereGeometry(finger || face ? .007 : .022, 12, 8), accent);
    node.add(pivot);
    if (parentIndex >= 0 && !face) {
      const offset = node.position.clone();
      const length = offset.length();
      const radius = finger ? .010 : /knee|ankle/.test(name) ? .067 : /spine|neck/.test(name) ? .085 : .042;
      const bone = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(.001, length - radius * 2), 6, 12), material);
      bone.position.copy(offset).multiplyScalar(.5);
      bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), offset.normalize());
      nodes[parentIndex].add(bone);
    }
    const shape = (scale, offset) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
      mesh.scale.fromArray(scale);
      mesh.position.fromArray(offset);
      node.add(mesh);
    };
    if (index === 0) shape([.17, .11, .11], [0, 0, 0]);
    if (index === 9) shape([.20, .19, .105], [0, -.07, 0]);
    if (rig.layout.detailedHands && !rig.layout.hybrid && /^(left|right)_wrist$/.test(name)) {
      shape([.053, .049, .022], [name.startsWith("left") ? .048 : -.048, -.005, 0]);
    }
    if (finger && name.endsWith("3")) shape([.018, .010, .010], [name.startsWith("left") ? .014 : -.014, 0, 0]);
    if (index === 15) {
      shape([.105, .135, .105], [0, .075, 0]);
      for (const x of rig.layout.expressive ? [] : [-.04, .04]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.013, 10, 8), accent);
        eye.position.set(x, .1, .098);
        node.add(eye);
      }
    }
    if (name.includes("eye_smplhf")) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.016, 16, 12), material);
      node.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(.008, 12, 8), accent);
      pupil.position.z = .013;
      eye.add(pupil);
      node.userData.eye = eye;
    }
    if (name === "jaw") {
      shape([.055, .026, .033], [0, -.005, 0]);
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(.037, .003, 8, 24, Math.PI), accent);
      mouth.rotation.z = Math.PI;
      mouth.position.z = .033;
      node.add(mouth);
      rig.mouth = mouth;
    }
  });
  return rig;
}

export function createBodyControls({ THREE, root, robot, wrapper, onChange, signal, model }) {
  const { escapeHTML } = window.ICorpi;
  const container = root.querySelector('[data-viewer-part="joint-controls"]');
  const markers = root.querySelector('[data-viewer-part="joint-markers"]');
  const active = root.querySelector('[data-viewer-part="body-map-active"]');
  const axes = ["x", "y", "z"];
  const definition = robot.layout.joints;
  const character = Boolean(robot.layout.authoredCharacter);
  const eyes = robot.layout.eyeNames || ["left_eye_smplhf", "right_eye_smplhf"];
  const faceJoints = robot.layout.faceJointNames || ["head", "jaw", ...eyes];
  const hasMapFocus = robot.layout.expressive || (robot.layout.detailedHands && !robot.layout.hybrid);
  const instance = root.dataset.viewerInstance || root.dataset.modelViewer;
  const values = definition.map(() => [0, 0, 0]);
  let mapAxis = 2, projection, projectionAbort, handControls, motion, animation = 0, playing = false;
  const controls = definition.map(([name], number) => ({ name, number, joint: robot.joints[name] }));
  const listen = (node, event, handler) => node.addEventListener(event, handler, { signal });
  root.querySelector(".joint-map-head h3").textContent = `${controls.length} joints · ${controls.length * 3} rotation controls`;
  container.innerHTML = `<div class="pose-tools">
    <p>${character
      ? "Olaf · an original procedural snowman study. The rig and zero-based joint indices are authored by this site, not taken from Disney animation or robotics assets."
      : `${escapeHTML(robot.layout.name)} · procedural geometry. No licensed mesh, learned shape model or pose correctives are loaded.
      Numbers are zero-based pose-array indices; detector landmarks and mesh vertices use other index sets.`}</p>
    ${model.posePreview === "smplh52" ? `<label>Hand representation <select data-hand-mode aria-label="Hand representation">
      <option value="sharpa" ${robot.layout.hybrid ? "selected" : ""}>Sharpa Wave robot hands · hybrid</option>
      <option value="human" ${!robot.layout.hybrid ? "selected" : ""}>SMPL+H human layout · 52 joints</option>
    </select></label><p>Switching hand representation resets the pose. Sharpa commands are exported separately from body rotations.</p>` : ""}
    <div class="pose-actions">
      <button type="button" data-pose="neutral">${character ? "Rest pose" : "T-pose"}</button>
      <button type="button" data-pose="reach">Reach</button>
      <button type="button" data-pose="wave">Wave</button>
      <button type="button" data-pose="${character ? "bow" : "crouch"}">${character ? "Bow" : "Crouch"}</button>
      ${robot.layout.detailedHands && !robot.layout.hybrid ? '<button type="button" data-pose="grasp">Finger curl</button>' : ""}
      <button type="button" data-animate-pose>Animate wave</button>
      <button type="button" data-export-pose>Export pose</button>
    </div>
    ${hasMapFocus ? `<label>Joint map focus <select data-map-focus aria-label="Joint map focus">
      <option value="body">Body</option>${robot.layout.detailedHands ? '<option value="left">Left hand</option><option value="right">Right hand</option>' : ""}
      ${robot.layout.expressive ? '<option value="face">Face</option>' : ""}</select></label>
      <p>Numbers keep their full-rig indices when the map focus changes.</p>` : ""}
    ${character ? `<label>Map view <select data-map-view aria-label="Map view">
      <option value="front">Front · +Z towards you</option><option value="side">Side · +Z to the right</option>
    </select></label><p>The silhouette follows the 3D pose. Numbers mark rotation pivots; only the twig arms have connecting bones. Feet 10 and 11 also translate during walking. The map centres on the character; use the grid and position readout to see travel.</p>` : ""}
    <label>Map rotation axis <select data-map-axis aria-label="Map rotation axis">
      <option value="0">X</option><option value="1">Y</option><option value="2" selected>Z</option>
    </select></label>
    <p>Drag a number or use arrow keys. Sliders rotate around local axes; exported poses use axis-angle radians.</p>
    ${robot.layout.expressive ? `<div class="face-expression-tools"><p>${character ? "Authored blink and smile controls for this character." : "Illustrative expressions, separate from SMPL-X’s learned expression coefficients."}</p>
      <label>Blink <input type="range" data-expression="blink" min="0" max="1" step=".01" value="0" aria-label="Illustrative blink"></label>
      <label>Smile <input type="range" data-expression="smile" min="0" max="1" step=".01" value="0" aria-label="Illustrative smile"></label></div>` : ""}
  </div><div class="pose-joints">${controls.map(({ name, number }) => `
    <section class="pose-joint" id="${instance}-pose-${name}">
      <h4><span class="joint-number">${number}</span>${escapeHTML(name.replaceAll("_", " "))}</h4>
      ${axes.map((axis, i) => `<label>${axis.toUpperCase()} <input type="range" min="-180" max="180" step="1"
        value="0" data-body-joint="${number}" data-axis="${i}" aria-label="${name} ${axis.toUpperCase()} rotation">
        <output>0°</output></label>`).join("")}
    </section>`).join("")}</div>`;
  const playButton = container.querySelector("[data-animate-pose]");
  const stop = () => {
    playing = false; cancelAnimationFrame(animation); playButton.textContent = "Animate wave";
    motion?.pause();
  };
  const select = control => {
    active.textContent = `${control.number} · ${control.name}`;
    container.querySelectorAll(".pose-joint").forEach(row => row.classList.toggle("active", row.id === `${instance}-pose-${control.name}`));
    root.querySelectorAll(".joint-pivot, .joint-leader, .joint-marker").forEach(node =>
      node.classList.toggle("active", node.dataset.joint === control.name));
  };
  const sync = () => {
    controls.forEach(control => {
      const angles = values[control.number];
      control.joint.rotation.set(...angles.map(value => value * Math.PI / 180), "XYZ");
      control.inputs.forEach((input, axis) => {
        input.value = String(angles[axis]);
        input.nextElementSibling.textContent = `${Math.round(angles[axis])}°`;
      });
      control.marker.setAttribute("aria-valuenow", angles[mapAxis]);
      control.marker.setAttribute("aria-valuetext", `${Math.round(angles[mapAxis])} degrees around ${axes[mapAxis].toUpperCase()}`);
      control.marker.style.setProperty("--joint-fill", `${(angles[mapAxis] + 180) / 3.6}%`);
    });
    if (robot.layout.expressive) {
      for (const eye of eyes) robot.joints[eye].userData.eye.scale.y = 1 - .95 * robot.expression.blink;
      robot.mouth.scale.y = (robot.mouth.userData.baseScaleY || 1) *
        (character ? .6 + .4 * robot.expression.smile : .1 + .9 * robot.expression.smile);
    }
    projection?.schedule();
    handControls?.update();
    motion?.refresh();
    onChange();
  };
  const change = (control, axis, value) => {
    stop();
    values[control.number][axis] = Math.max(-180, Math.min(180, value));
    select(control);
    sync();
  };
  markers.replaceChildren();
  controls.forEach(control => {
    control.inputs = [...container.querySelectorAll(`[data-body-joint="${control.number}"]`)];
    control.inputs.forEach((input, axis) => listen(input, "input", () => change(control, axis, Number(input.value))));
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "joint-marker";
    marker.textContent = control.number;
    marker.dataset.joint = control.name;
    marker.setAttribute("role", "slider");
    marker.setAttribute("aria-label", `${control.number}. ${control.name}`);
    marker.setAttribute("aria-valuemin", "-180");
    marker.setAttribute("aria-valuemax", "180");
    marker.setAttribute("aria-controls", `${instance}-pose-${control.name}`);
    control.marker = marker;
    let drag, suppressClick = false;
    listen(marker, "pointerdown", event => {
      stop();
      suppressClick = false;
      drag = { x: event.clientX, y: event.clientY, value: values[control.number][mapAxis] };
      marker.setPointerCapture(event.pointerId);
      select(control);
      event.preventDefault();
    });
    listen(marker, "pointermove", event => {
      if (drag) {
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 3) suppressClick = true;
        change(control, mapAxis, drag.value + (event.clientX - drag.x) - (event.clientY - drag.y));
      }
    });
    const release = event => {
      drag = null;
      if (marker.hasPointerCapture(event.pointerId)) marker.releasePointerCapture(event.pointerId);
    };
    listen(marker, "pointerup", release);
    listen(marker, "pointercancel", release);
    listen(marker, "focus", () => select(control));
    listen(marker, "click", () => {
      if (suppressClick) { suppressClick = false; return; }
      select(control);
      control.inputs[mapAxis].focus({ preventScroll: true });
      control.inputs[mapAxis].scrollIntoView({ block: "nearest", behavior: "instant" });
    });
    listen(marker, "keydown", event => {
      const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[event.key];
      if (step !== undefined || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        change(control, mapAxis, step !== undefined ? values[control.number][mapAxis] + step : event.key === "Home" ? -180 : 180);
      }
    });
    markers.appendChild(marker);
  });
  listen(container.querySelector("[data-map-axis]"), "change", event => { mapAxis = Number(event.target.value); sync(); });
  if (model.posePreview === "smplh52") listen(container.querySelector("[data-hand-mode]"), "change", event => {
    root.dispatchEvent(new CustomEvent("body-hand-mode", { detail: event.target.value }));
  });
  container.querySelectorAll("[data-expression]").forEach(input => listen(input, "input", () => {
    robot.expression[input.dataset.expression] = Number(input.value);
    sync();
  }));
  const preset = name => {
    stop();
    motion?.resetOffsets();
    values.forEach(value => value.fill(0));
    robot.position.y = 0;
    handControls?.reset();
    robot.expression = { blink: 0, smile: 0 };
    container.querySelectorAll("[data-expression]").forEach(input => { input.value = "0"; });
    const set = (joint, angles) => {
      const index = definition.findIndex(([n]) => n === joint);
      if (index >= 0) values[index] = angles;
    };
    if (name === "wave") {
      set("left_shoulder", [0, 0, 65]); set("left_elbow", [0, 0, 45]);
      set("right_shoulder", [0, 0, 80]);
    } else if (name === "reach") {
      set("left_shoulder", [0, -85, 0]); set("right_shoulder", [0, 85, 0]);
    } else if (name === "crouch") {
      for (const side of ["left", "right"]) {
        set(`${side}_hip`, [-40, 0, 0]); set(`${side}_knee`, [80, 0, 0]); set(`${side}_ankle`, [-40, 0, 0]);
      }
      robot.position.y = -.19;
    } else if (name === "grasp") {
      definition.forEach(([joint], index) => {
        if (/(?:index|middle|pinky|ring|thumb)\d$/.test(joint)) values[index][1] = joint.startsWith("left") ? -55 : 55;
      });
    } else if (name === "bow") {
      set("chest", [25, 0, 0]); set("head", [20, 0, 0]);
      set("left_shoulder", [0, 0, -35]); set("right_shoulder", [0, 0, 35]);
    }
    active.textContent = `${name === "neutral" ? (character ? "Rest pose" : "T-pose") : name} · illustrative pose`;
    sync();
  };
  container.querySelectorAll("[data-pose]").forEach(button => listen(button, "click", () => preset(button.dataset.pose)));
  const tick = time => {
    if (!playing || signal.aborted || document.hidden) return;
    values[definition.findIndex(([name]) => name === "left_elbow")][2] = 45 + 22 * Math.sin(time / 350);
    values[definition.findIndex(([name]) => name === "left_wrist")][2] = 15 * Math.sin(time / 350);
    sync();
    animation = requestAnimationFrame(tick);
  };
  listen(playButton, "click", () => {
    if (playing) return stop();
    preset("wave");
    playing = true;
    playButton.textContent = "Pause animation";
    animation = requestAnimationFrame(tick);
  });
  listen(document, "visibilitychange", () => {
    cancelAnimationFrame(animation);
    if (playing && !document.hidden) animation = requestAnimationFrame(tick);
  });
  const reset = root.querySelector('[data-viewer-part="joint-reset"]');
  reset.disabled = false;
  reset.textContent = "Reset pose";
  listen(reset, "click", () => preset("neutral"));
  listen(container.querySelector("[data-export-pose]"), "click", () => {
    const pose = controls.flatMap(control => {
      const q = control.joint.quaternion.clone().normalize();
      if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      const angle = 2 * Math.acos(Math.min(1, Math.max(-1, q.w)));
      const sine = Math.sqrt(Math.max(0, 1 - q.w * q.w));
      return sine < 1e-8 ? [0, 0, 0] : [q.x, q.y, q.z].map(v => v / sine * angle);
    });
    const payload = { schema: character ? "i-corpi.olaf-pose.v2" : robot.layout.hybrid ? "i-corpi.body-robot-hybrid.v1" : `i-corpi.${model.id}-pose.v1`,
      model: model.id, procedural: true, representation: "axis-angle", units: "radians",
      jointIndexBase: 0, parentIndices: definition.map(joint => joint[1]),
      restJointPositions: definition.map(joint => joint[2]), restPositionUnits: "metres",
      coordinateSystem: { up: "+Y", forward: "+Z", restPose: character ? "authored rest pose" : "T-pose", localRotationOrderInUI: "XYZ" },
      jointNames: controls.map(c => c.name), pose, translation: robot.position.toArray(),
      note: character ? "Original character-study rig and joint order; not an official Disney rig or robot description."
        : "Authored pose on a procedural rig. Align its authored rest frames before applying it to a licensed body model or robot." };
    if (robot.layout.hybrid) payload.hands = handControls.state();
    if (robot.layout.expressive) payload.illustrativeExpressions = { ...robot.expression };
    if (motion) Object.assign(payload, motion.state());
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${model.id}${robot.layout.hybrid ? "-sharpa-hybrid" : ""}-pose.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  signal.addEventListener("abort", stop, { once: true });
  const updateMapFocus = (focusCamera = true) => {
    projectionAbort?.abort();
    projectionAbort = new AbortController();
    const focus = container.querySelector("[data-map-focus]")?.value || "all";
    const shown = controls.filter(control => focus === "all" ||
      (focus === "body" && control.number < (robot.layout.bodyJointCount || 22)) ||
      (focus === "face" && faceJoints.includes(control.name)) ||
      (["left", "right"].includes(focus) && control.name.startsWith(`${focus}_`) &&
        /wrist|(?:index|middle|pinky|ring|thumb)\d$/.test(control.name)));
    controls.forEach(control => {
      const visible = shown.includes(control);
      control.marker.hidden = !visible;
      container.querySelector(`#${instance}-pose-${control.name}`).hidden = !visible;
    });
    const sideView = container.querySelector("[data-map-view]")?.value === "side";
    projection = createJointProjection({ THREE, root, wrapper, controls: shown,
      front: sideView ? [-1, 0, 0] : [0, 0, 1],
      ...(character ? {
        surfaceRoot: focus === "face" ? robot.joints.head : robot,
        boneFilter: control => /elbow|wrist/.test(control.name),
      } : {}),
      signal: projectionAbort.signal });
    if (character) {
      root.querySelector(".body-map-status b").textContent = sideView ? "World side · +Z →" : "World front · +Z towards you";
      root.querySelector(".body-map-hint").textContent = "Dots = pivots · outlines = snow and twigs · feet can translate";
    }
    if (focusCamera) root.dispatchEvent(new CustomEvent("viewer-focus-region", { detail: focus }));
  };
  const mapFocus = container.querySelector("[data-map-focus]");
  if (mapFocus) listen(mapFocus, "change", () => updateMapFocus());
  if (character) {
    listen(container.querySelector("[data-map-view]"), "change", () => updateMapFocus(false));
    motion = createOlafMotion({ root, robot, values, sync, beforePlay: () => preset("neutral"), signal });
  }
  signal.addEventListener("abort", () => projectionAbort?.abort(), { once: true });
  handControls = robot.makeHandControls?.({ THREE, root, robot, onChange, signal });
  sync();
  updateMapFocus();
  return { count: controls.length, positionJointMap: () => { projection.update(); handControls?.update(); } };
}
