import { createJointProjection } from "./joint-projection.js";
// Joint naming, anatomical placement, and accessible articulation controls.
const { escapeHTML } = window.ICorpi;
  const sideRules = [
    [/(^|[_.-])left([_.-]|$)/, "Left"],
    [/(^|[_.-])right([_.-]|$)/, "Right"],
    [/^(ll|lleg|larm|lhand|l)[_.-]/, "Left"],
    [/^(lr|rleg|rarm|rhand|r)[_.-]/, "Right"],
    [/[_.-]l$/, "Left"],
    [/[_.-]r$/, "Right"],
    [/(^|[_.-])l(?=[_.-]|$)/, "Left"],
    [/(^|[_.-])r(?=[_.-]|$)/, "Right"],
  ];
  const groupName = (name) => {
    const key = name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    const rule = sideRules.find(([pattern]) => pattern.test(key));
    const side = rule?.[1] || "";
    const rest = rule ? key.replace(rule[0], "_") : key;
    const tokens = rest.split(/[_.\-\d]+/).filter(Boolean);
    const hasToken = (...words) => words.some((word) => tokens.includes(word));
    const hasText = (...words) => words.some((word) => rest.includes(word));
    if (hasText("finger", "thumb", "gripper", "palm") || hasToken("hand", "index", "middle", "ring", "pinky", "little")) return side ? `${side} hand` : "Other";
    if (hasText("shoulder", "elbow", "wrist") || hasToken("sho", "elb", "el", "arm")) return side ? `${side} arm` : "Other";
    if (hasText("hip", "knee", "ankle", "thigh", "shin") || hasToken("ank", "leg", "haa", "hfe", "kfe", "ffe", "faa", "hr")) return side ? `${side} leg` : "Other";
    if (hasText("head", "neck")) return "Head";
    if (hasText("torso", "waist", "chest", "spine", "trunk")) return "Torso";
    return "Other";
  };
  const groupOrder = ["Torso", "Head", "Left arm", "Right arm", "Left hand", "Right hand", "Left leg", "Right leg", "Other"];
  const rangeFor = (joint) => {
    if (joint.jointType === "continuous") return [-Math.PI, Math.PI];
    const lower = Number(joint.limit?.lower);
    const upper = Number(joint.limit?.upper);
    if (Number.isFinite(lower) && Number.isFinite(upper) && upper > lower) return [lower, upper];
    return joint.jointType === "prismatic" ? [-1, 1] : [-Math.PI, Math.PI];
  };
  const valueLabel = (joint, value) =>
    joint.jointType === "prismatic" ? `${value.toFixed(3)} m` : `${(value * 180 / Math.PI).toFixed(1)}°`;


export function createJointControls({ THREE, root, robot, wrapper, onChange, signal, mapFront = [1, 0, 0], numberPrefix = "" }) {
  const jointContainer = root.querySelector('[data-viewer-part="joint-controls"]');
  const jointHeading = root.querySelector(".joint-map-head h3");
  const resetJointButton = root.querySelector('[data-viewer-part="joint-reset"]');
  const markerLayer = root.querySelector('[data-viewer-part="joint-markers"]');
  const mapActive = root.querySelector('[data-viewer-part="body-map-active"]');
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal });
  let markerEvents = new AbortController();
  signal.addEventListener("abort", () => markerEvents.abort(), { once: true });
  const listenMarker = (target, type, handler) => target.addEventListener(type, handler, { signal: markerEvents.signal });
  let markerDrag = null;
  let suppressMarkerClick = null;
  let projection;
  const controls = Object.values(robot.joints)
    .filter((joint) => ["revolute", "continuous", "prismatic"].includes(joint.jointType) && !joint.mimicJoint)
    .map((joint) => {
      const [min, max] = rangeFor(joint);
      return { name: joint.name, joint, type: joint.jointType, group: groupName(joint.name),
        min, max, value: Number(joint.jointValue?.[0] ?? 0) };
    })
    .sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) || a.name.localeCompare(b.name))
    .map((control, index) => ({ ...control, number: index + 1 }));
    const setActiveJoint = (name) => {
      root.querySelectorAll(".joint-pivot, .joint-leader").forEach(node =>
        node.classList.toggle("active", node.dataset.joint === name));
      controls.forEach((control) => {
        const active = control.name === name;
        control.row?.classList.toggle("active", active);
        control.marker?.classList.toggle("active", active);
      });
      const active = controls.find((control) => control.name === name);
      if (!active) {
        mapActive.classList.remove("active");
        mapActive.textContent = "Joint pivots · front view";
        return;
      }
      mapActive.classList.add("active");
      mapActive.innerHTML = `<strong>${String(active.number).padStart(2, "0")}</strong>${escapeHTML(active.name)}`;
    };

    const syncControl = (control, value) => {
      let next = Math.min(control.max, Math.max(control.min, value));
      if (control.input) {
        control.input.value = String(next);
        next = Number(control.input.value);
      }
      control.value = next;
      robot.setJointValue(control.name, next);
      onChange();
      projection?.schedule();
      if (control.output) control.output.textContent = valueLabel(control.joint, next);
      if (control.marker) {
        const fill = ((next - control.min) / Math.max(control.max - control.min, Number.EPSILON)) * 100;
        control.marker.style.setProperty("--joint-fill", `${fill}%`);
        control.marker.setAttribute("aria-valuenow", String(next));
        control.marker.setAttribute("aria-valuetext", valueLabel(control.joint, next));
        control.marker.title = `${control.number}. ${control.name} · ${valueLabel(control.joint, next)}`;
      }
      setActiveJoint(control.name);
    };

    const focusControl = (control) => {
      control.input?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
      control.input?.focus({ preventScroll: true });
      setActiveJoint(control.name);
    };

    const renderMarkers = () => {
      markerEvents.abort();
      markerEvents = new AbortController();
      markerLayer.innerHTML = "";
      controls.forEach((control) => {
        const marker = document.createElement("button");
        marker.className = "joint-marker";
        marker.type = "button";
        marker.setAttribute("role", "slider");
        marker.setAttribute("aria-label", `${control.number}. ${control.name}`);
        marker.setAttribute("aria-valuemin", String(control.min));
        marker.setAttribute("aria-valuemax", String(control.max));
        marker.dataset.joint = control.name;
        marker.textContent = `${numberPrefix}${control.number}`;
        control.marker = marker;
        syncControl(control, control.value);

        listenMarker(marker, "mouseenter", () => setActiveJoint(control.name));
        listenMarker(marker, "mouseleave", () => {
          if (document.activeElement !== marker) setActiveJoint(null);
        });
        listenMarker(marker, "focus", () => setActiveJoint(control.name));
        listenMarker(marker, "blur", () => setActiveJoint(null));
        listenMarker(marker, "pointerdown", (event) => {
          markerDrag = {
            control,
            x: event.clientX,
            y: event.clientY,
            value: control.value,
            pointerId: event.pointerId,
            moved: false,
          };
          marker.setPointerCapture(event.pointerId);
          setActiveJoint(control.name);
          event.preventDefault();
        });
        listenMarker(marker, "pointermove", (event) => {
          if (!markerDrag || markerDrag.control !== control || markerDrag.pointerId !== event.pointerId) return;
          const dx = event.clientX - markerDrag.x;
          const dy = event.clientY - markerDrag.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) markerDrag.moved = true;
          const next = markerDrag.value + ((dx - dy * 0.55) / 140) * (control.max - control.min);
          syncControl(control, next);
        });
        const releaseMarker = (event) => {
          if (!markerDrag || markerDrag.control !== control) return;
          if (markerDrag.moved) suppressMarkerClick = control.name;
          if (marker.hasPointerCapture(event.pointerId)) marker.releasePointerCapture(event.pointerId);
          markerDrag = null;
        };
        listenMarker(marker, "pointerup", releaseMarker);
        listenMarker(marker, "pointercancel", releaseMarker);
        listenMarker(marker, "keydown", (event) => {
          const step = control.type === "prismatic"
            ? Math.max((control.max - control.min) / 100, 0.001)
            : Math.max((control.max - control.min) / 100, 0.01);
          let next = null;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") next = control.value + step;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = control.value - step;
          if (event.key === "Home") next = control.min;
          if (event.key === "End") next = control.max;
          if (next === null) return;
          event.preventDefault();
          syncControl(control, next);
        });
        listenMarker(marker, "click", () => {
          if (suppressMarkerClick === control.name) {
            suppressMarkerClick = null;
            return;
          }
          focusControl(control);
        });
        markerLayer.appendChild(marker);
      });
      setActiveJoint(null);
    };

    const renderJoints = () => {
      if (!controls.length) {
        jointContainer.innerHTML = '<p class="joint-map-empty">No independently controllable joints were found.</p>';
        markerLayer.innerHTML = "";
        return;
      }
      jointHeading.textContent = `${controls.length} named controls`;
      jointContainer.innerHTML = groupOrder.map((group) => {
        const members = controls.filter((control) => control.group === group);
        if (!members.length) return "";
        return `<section class="joint-group"><h4><span>${group}</span><b>${members.length}</b></h4>${members.map((control) => {
          const inputId = `joint-${root.dataset.viewerInstance || root.dataset.modelViewer}-${control.name}`.replace(/[^a-z0-9_-]+/gi, "-");
          const step = control.type === "prismatic"
            ? Math.max((control.max - control.min) / 200, 0.0005)
            : 0.01;
          return `<label class="joint-control" for="${inputId}">
            <span class="joint-control-title"><span class="joint-number">${numberPrefix}${String(control.number).padStart(2, "0")}</span><strong>${escapeHTML(control.name)}</strong><output for="${inputId}">${valueLabel(control.joint, control.value)}</output></span>
            <input id="${inputId}" type="range" min="${control.min}" max="${control.max}" step="${step}" value="${control.value}" data-joint="${escapeHTML(control.name)}" aria-label="${escapeHTML(control.name)}, ${control.type}">
            <span class="joint-control-range"><span>${valueLabel(control.joint, control.min)}</span><em>${control.type}</em><span>${valueLabel(control.joint, control.max)}</span></span>
          </label>`;
        }).join("")}</section>`;
      }).join("");

      jointContainer.querySelectorAll("[data-joint]").forEach((input) => {
        const control = controls.find((item) => item.name === input.dataset.joint);
        control.input = input;
        control.row = input.closest(".joint-control");
        control.output = control.row.querySelector("output");
        listen(input, "input", () => syncControl(control, Number(input.value)));
        listen(input, "focus", () => setActiveJoint(control.name));
        listen(input, "blur", () => setActiveJoint(null));
        listen(control.row, "mouseenter", () => setActiveJoint(control.name));
        listen(control.row, "mouseleave", () => {
          if (document.activeElement !== input) setActiveJoint(null);
        });
      });
      renderMarkers();
      resetJointButton.disabled = false;
      listen(resetJointButton, "click", () => {
        controls.forEach((control) => syncControl(control, 0));
        setActiveJoint(null);
      });
    };


  renderJoints();
  projection = createJointProjection({ THREE, root, wrapper, controls, signal, front: mapFront });
  return { count: controls.length, positionJointMap: projection.update,
    getJointState: () => controls.map(control => ({ name: control.name, position: control.value })),
    setJointValues: values => controls.forEach(control => syncControl(control, values[control.name] || 0)),
  };
}
