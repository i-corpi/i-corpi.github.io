"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { sitePath } from "../lib/site-path";

type LoadState = "loading" | "ready" | "error";
type JointKind = "revolute" | "continuous" | "prismatic";

type JointControl = {
  name: string;
  type: JointKind;
  group: string;
  min: number;
  max: number;
  value: number;
  mapX?: number;
  mapY?: number;
};

const GROUP_ORDER = [
  "Torso",
  "Head",
  "Left arm",
  "Right arm",
  "Left hand",
  "Right hand",
  "Left leg",
  "Right leg",
  "Other",
];

const importBrowserModule = (url: string): Promise<Record<string, unknown>> =>
  Function("moduleUrl", "return import(moduleUrl)")(url) as Promise<Record<string, unknown>>;

const SIDE_RULES: Array<[RegExp, "Left" | "Right"]> = [
  // Whole words first ("left_hip", "arm_right_1"), then chain prefixes
  // ("ll_haa", "l_sho_pitch", "LARM_ELBOW"), then a trailing token
  // ("J00_HIP_PITCH_L"). Prefixes are tried before the suffix on purpose:
  // Simple Humanoid writes its axis as the last token (RLEG_HIP_R is a roll
  // axis, not a right side), and its LLEG/RARM prefix settles the side first.
  [/(^|[_.-])left([_.-]|$)/, "Left"],
  [/(^|[_.-])right([_.-]|$)/, "Right"],
  [/^(ll|lleg|larm|lhand|l)[_.-]/, "Left"],
  [/^(lr|rleg|rarm|rhand|r)[_.-]/, "Right"],
  [/[_.-]l$/, "Left"],
  [/[_.-]r$/, "Right"],
];

const jointGroup = (name: string) => {
  const key = name.toLowerCase();
  const rule = SIDE_RULES.find(([pattern]) => pattern.test(key));
  const side = rule?.[1] ?? "";
  // Match the body part on what is left once the side marker is removed, so
  // abbreviated chains ("l_el", "l_ank_roll") still land on the right limb.
  const rest = rule ? key.replace(rule[0], "_") : key;
  const tokens = rest.split(/[_.\-\d]+/).filter(Boolean);
  const hasToken = (...words: string[]) => words.some((word) => tokens.includes(word));
  const hasText = (...words: string[]) => words.some((word) => rest.includes(word));

  if (hasText("finger", "thumb", "gripper", "palm") || hasToken("hand")) return side ? `${side} hand` : "Other";
  if (hasText("shoulder", "elbow", "wrist") || hasToken("sho", "elb", "el", "arm")) return side ? `${side} arm` : "Other";
  if (hasText("hip", "knee", "ankle", "thigh", "shin") || hasToken("ank", "leg", "haa", "hfe", "kfe", "ffe", "faa", "hr")) return side ? `${side} leg` : "Other";
  if (hasText("head", "neck")) return "Head";
  if (hasText("torso", "waist", "chest", "spine", "trunk")) return "Torso";
  return "Other";
};

const bodyMapPoint = (group: string, index: number, count: number) => {
  const t = count <= 1 ? 0.5 : index / (count - 1);
  const spread = (index % 2 ? 1 : -1) * Math.min(Math.floor(index / 2) * 2.2, 8);
  switch (group) {
    case "Head": return { x: 47 + (index % 2) * 7, y: 13 + Math.floor(index / 2) * 7 };
    case "Torso": return { x: 45 + (index % 2) * 10, y: 37 + Math.floor(index / 2) * 8 };
    case "Left arm": return { x: 33 - t * 20 + spread * .35, y: 35 + t * 26 };
    case "Right arm": return { x: 67 + t * 20 - spread * .35, y: 35 + t * 26 };
    case "Left hand": return { x: 12 + spread * .4, y: 64 + Math.floor(index / 2) * 6 };
    case "Right hand": return { x: 88 - spread * .4, y: 64 + Math.floor(index / 2) * 6 };
    case "Left leg": return { x: 44 - t * 5 + spread * .35, y: 62 + t * 31 };
    case "Right leg": return { x: 56 + t * 5 - spread * .35, y: 62 + t * 31 };
    default: return { x: 43 + (index % 3) * 7, y: 48 + Math.floor(index / 3) * 7 };
  }
};

const alignPointToBody = (group: string, projectedX: number, projectedY: number) => {
  const legProgress = Math.min(1, Math.max(0, (projectedY - 52) / 42));
  if (group === "Head") return 50;
  if (group === "Torso") return 50;
  // This is a front view: the robot's right side appears on screen-left.
  // Arm chains stay on a single vertical axis to match the straight-arm figure.
  if (group === "Right arm") return 35;
  if (group === "Left arm") return 65;
  if (group === "Right hand") return 35;
  if (group === "Left hand") return 65;
  if (group === "Right leg") return 43 - legProgress * 3;
  if (group === "Left leg") return 57 + legProgress * 3;
  return projectedX;
};

const alignJointChains = (controls: JointControl[]) => {
  const chainRanges: Record<string, [number, number]> = {
    Head: [9, 17],
    Torso: [33, 45],
    "Left arm": [28, 58],
    "Right arm": [28, 58],
    "Left hand": [62, 76],
    "Right hand": [62, 76],
    "Left leg": [56, 90],
    "Right leg": [56, 90],
  };
  const aligned = new Map<string, number>();

  Object.entries(chainRanges).forEach(([group, [start, end]]) => {
    const chain = controls
      .filter((joint) => joint.group === group)
      .sort((a, b) => (a.mapY ?? 50) - (b.mapY ?? 50) || a.name.localeCompare(b.name));
    chain.forEach((joint, index) => {
      const progress = chain.length <= 1 ? .5 : index / (chain.length - 1);
      aligned.set(joint.name, start + (end - start) * progress);
    });
  });

  return controls.map((joint) => ({ ...joint, mapY: aligned.get(joint.name) ?? joint.mapY }));
};

const separateMapMarkers = (controls: JointControl[]) => {
  const placed: Array<{ x: number; y: number }> = [];
  const offsets = [
    [0, 0], [4.5, -3], [-4.5, 3], [4.5, 3], [-4.5, -3],
    [0, 6], [0, -6], [8, 0], [-8, 0], [8, 5], [-8, 5],
  ];

  return controls.map((joint) => {
    const fallback = bodyMapPoint(joint.group, 0, 1);
    const anchorX = joint.mapX ?? fallback.x;
    const anchorY = joint.mapY ?? fallback.y;
    const available = offsets.find(([dx, dy]) => {
      const x = Math.min(92, Math.max(8, anchorX + dx));
      const y = Math.min(94, Math.max(6, anchorY + dy));
      return placed.every((point) => Math.hypot((x - point.x) * .72, y - point.y) >= 4.6);
    }) ?? offsets[offsets.length - 1];
    const point = {
      x: Math.min(92, Math.max(8, anchorX + available[0])),
      y: Math.min(94, Math.max(6, anchorY + available[1])),
    };
    placed.push(point);
    return { ...joint, mapX: point.x, mapY: point.y };
  });
};

const formatJointValue = (joint: JointControl, value = joint.value) =>
  joint.type === "prismatic"
    ? `${value.toFixed(3)} m`
    : `${(value * 180 / Math.PI).toFixed(1)}°`;

const safeRange = (joint: any): Pick<JointControl, "min" | "max"> => {
  if (joint.jointType === "continuous") return { min: -Math.PI, max: Math.PI };
  const lower = Number(joint.limit?.lower);
  const upper = Number(joint.limit?.upper);
  if (Number.isFinite(lower) && Number.isFinite(upper) && upper > lower) return { min: lower, max: upper };
  return joint.jointType === "prismatic" ? { min: -1, max: 1 } : { min: -Math.PI, max: Math.PI };
};

const disposeObject = (object: any) => {
  object?.traverse?.((node: any) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material: any) => material?.dispose?.());
  });
};

export function URDFViewer({
  src,
  name,
  packages,
  compact = false,
}: {
  src: string;
  name: string;
  packages?: Record<string, string>;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const robotRef = useRef<any>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const sliderRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dragRef = useRef<{ name: string; x: number; y: number; value: number; pointerId: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [joints, setJoints] = useState<JointControl[]>([]);
  const [activeJoint, setActiveJoint] = useState<string | null>(null);
  const packageKey = JSON.stringify(packages ?? {});

  const groupedJoints = useMemo(() => {
    const groups = new Map<string, JointControl[]>();
    joints.forEach((joint) => {
      const group = groups.get(joint.group) ?? [];
      group.push(joint);
      groups.set(joint.group, group);
    });
    return [...groups.entries()].sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
  }, [joints]);

  const activeMapJoint = activeJoint ? joints.find((joint) => joint.name === activeJoint) ?? null : null;
  const activeMapNumber = activeMapJoint ? joints.findIndex((joint) => joint.name === activeMapJoint.name) + 1 : null;

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    let resizeFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let teardown: (() => void) | null = null;
    const canvas = canvasRef.current;
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;

    setState("loading");
    setJoints([]);
    setActiveJoint(null);
    robotRef.current = null;

    Promise.all([
      importBrowserModule(sitePath("/vendor/three.module.js")),
      importBrowserModule(sitePath("/vendor/OrbitControls.js")),
      importBrowserModule(sitePath("/vendor/URDFLoader.js")),
    ]).then(([THREE, controlsModule, urdfModule]) => {
      if (disposed) return;

      const Renderer = THREE.WebGLRenderer as new (options: object) => any;
      const Scene = THREE.Scene as new () => any;
      const Camera = THREE.PerspectiveCamera as new (fov: number, aspect: number, near: number, far: number) => any;
      const HemisphereLight = THREE.HemisphereLight as new (sky: number, ground: number, intensity: number) => any;
      const DirectionalLight = THREE.DirectionalLight as new (color: number, intensity: number) => any;
      const Group = THREE.Group as new () => any;
      const GridHelper = THREE.GridHelper as new (size: number, divisions: number, colorCenter: number, colorGrid: number) => any;
      const LoadingManager = THREE.LoadingManager as new () => any;
      const Box3 = THREE.Box3 as new () => any;
      const Vector3 = THREE.Vector3 as new () => any;
      const OrbitControls = controlsModule.OrbitControls as new (camera: any, element: HTMLElement) => any;
      const URDFLoader = urdfModule.default as new (manager?: any) => any;

      const renderer = new Renderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.setClearColor(0x000000, 0);

      const scene = new Scene();
      const camera = new Camera(35, 1, 0.01, 100);
      const orbit = new OrbitControls(camera, canvas);
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.075;
      orbit.enablePan = false;
      orbit.minPolarAngle = 0.08;
      orbit.maxPolarAngle = Math.PI * 0.92;

      scene.add(new HemisphereLight(0xf4f2ec, 0x464943, 2.25));
      const key = new DirectionalLight(0xffffff, 2.8);
      key.position.set(3, 5, 4);
      key.castShadow = true;
      scene.add(key);
      const fill = new DirectionalLight(0xffffff, 1.1);
      fill.position.set(-4, 2, -3);
      scene.add(fill);

      const grid = new GridHelper(8, 32, 0xbcb7ab, 0xd8d4ca);
      grid.material.opacity = 0.38;
      grid.material.transparent = true;
      scene.add(grid);

      const pivot = new Group();
      scene.add(pivot);

      const resize = () => {
        const bounds = stage.getBoundingClientRect();
        const width = Math.max(Math.round(bounds.width), 1);
        const height = Math.max(Math.round(bounds.height), 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(() => {
        if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(resize);
      });
      resizeObserver.observe(stage);
      resize();

      let frameLoadedModel = () => {};
      let positionJointMap = () => {};
      const manager = new LoadingManager();
      manager.onLoad = () => {
        if (disposed) return;
        frameLoadedModel();
        positionJointMap();
        setState("ready");
      };
      const loader = new URDFLoader(manager);
      loader.packages = JSON.parse(packageKey);
      loader.load(src, (robot: any) => {
        if (disposed) {
          disposeObject(robot);
          return;
        }
        robotRef.current = robot;
        robot.traverse((node: any) => {
          if (!node.isMesh) return;
          node.castShadow = true;
          node.receiveShadow = true;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material: any) => {
            if (!material) return;
            if (material.color) {
              const luminance = 0.2126 * material.color.r + 0.7152 * material.color.g + 0.0722 * material.color.b;
              if (luminance > 0.9) material.color.setHex(0x5a5f5b);
            }
            if ("roughness" in material) material.roughness = 0.72;
          });
        });

        const wrapper = new Group();
        wrapper.rotation.x = -Math.PI / 2;
        wrapper.add(robot);
        pivot.add(wrapper);

        const frame = () => {
          wrapper.position.set(0, 0, 0);
          wrapper.updateWorldMatrix(true, true);
          const box = new Box3().setFromObject(wrapper);
          if (box.isEmpty()) return;
          const size = box.getSize(new Vector3());
          const centre = box.getCenter(new Vector3());
          wrapper.position.sub(centre);
          wrapper.position.y += size.y / 2;
          const reach = Math.max(size.x, size.y, size.z);
          const distance = Math.max(reach * 2.05, 1.2);
          orbit.target.set(0, size.y * 0.48, 0);
          orbit.minDistance = reach * 0.65;
          orbit.maxDistance = reach * 8;
          camera.position.set(distance * 0.52, size.y * 0.52 + distance * 0.2, distance * 0.86);
          orbit.update();
        };

        const controls = Object.values(robot.joints as Record<string, any>)
          .filter((joint: any) =>
            ["revolute", "continuous", "prismatic"].includes(joint.jointType) &&
            !joint.mimicJoint
          )
          .map((joint: any) => {
            const range = safeRange(joint);
            return {
              name: joint.name,
              type: joint.jointType as JointKind,
              group: jointGroup(joint.name),
              min: range.min,
              max: range.max,
              value: Number(joint.jointValue?.[0] ?? 0),
            };
          })
          .sort((a: JointControl, b: JointControl) => {
            const groupDelta = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
            return groupDelta || a.name.localeCompare(b.name);
          });

        positionJointMap = () => {
          wrapper.updateWorldMatrix(true, true);
          const bounds = new Box3().setFromObject(wrapper);
          const spatial = controls.map((control) => {
            const position = robot.joints[control.name]?.getWorldPosition(new Vector3()) ?? new Vector3();
            return { control, lateral: Number(position.z), vertical: Number(position.y) };
          });
          const left = spatial.filter(({ control }) => control.group.startsWith("Left")).map(({ lateral }) => lateral);
          const right = spatial.filter(({ control }) => control.group.startsWith("Right")).map(({ lateral }) => lateral);
          const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
          const leftMean = mean(left);
          const rightMean = mean(right);
          const direction = left.length && right.length && leftMean > rightMean ? -1 : 1;
          const lateralCentre = left.length && right.length ? (leftMean + rightMean) / 2 : mean(spatial.map(({ lateral }) => lateral));
          const lateralReach = Math.max(...spatial.map(({ lateral }) => Math.abs(lateral - lateralCentre)), .001);
          const verticalValues = spatial.map(({ vertical }) => vertical);
          const low = bounds.isEmpty() ? Math.min(...verticalValues) : bounds.min.y;
          const high = bounds.isEmpty() ? Math.max(...verticalValues) : bounds.max.y;
          const height = Math.max(high - low, .001);
          const projected = spatial.map(({ control, lateral, vertical }) => {
            const mapY = 90 - ((vertical - low) / height) * 80;
            const spatialX = 50 + direction * ((lateral - lateralCentre) / lateralReach) * 36;
            return { ...control, mapX: alignPointToBody(control.group, spatialX, mapY), mapY };
          });
          setJoints(separateMapMarkers(alignJointChains(projected)));
        };

        resetViewRef.current = frame;
        frameLoadedModel = frame;
        setJoints(controls);
        frame();
        positionJointMap();
      }, undefined, () => {
        if (!disposed) setState("error");
      });

      const render = () => {
        if (disposed) return;
        orbit.update();
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(render);
      };
      render();

      teardown = () => {
        disposeObject(pivot);
        renderer.dispose();
        orbit.dispose();
      };
    }).catch(() => {
      if (!disposed) setState("error");
    });

    return () => {
      disposed = true;
      robotRef.current = null;
      resetViewRef.current = null;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      teardown?.();
    };
  }, [src, packageKey]);

  const setJointValue = (jointName: string, value: number) => {
    robotRef.current?.setJointValue(jointName, value);
    setJoints((current) => current.map((joint) => joint.name === jointName ? { ...joint, value } : joint));
    setActiveJoint(jointName);
  };

  const resetJoints = () => {
    setJoints((current) => current.map((joint) => {
      const value = Math.min(joint.max, Math.max(joint.min, 0));
      robotRef.current?.setJointValue(joint.name, value);
      return { ...joint, value };
    }));
    setActiveJoint(null);
  };

  const focusJoint = (jointName: string) => {
    const input = sliderRefs.current[jointName];
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
    setActiveJoint(jointName);
  };

  const startMarkerDrag = (event: ReactPointerEvent<HTMLButtonElement>, joint: JointControl) => {
    dragRef.current = { name: joint.name, x: event.clientX, y: event.clientY, value: joint.value, pointerId: event.pointerId, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveJoint(joint.name);
    event.preventDefault();
  };

  const moveMarker = (event: ReactPointerEvent<HTMLButtonElement>, joint: JointControl) => {
    const drag = dragRef.current;
    if (!drag || drag.name !== joint.name || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    const next = Math.min(joint.max, Math.max(joint.min, drag.value + ((dx - dy * .55) / 140) * (joint.max - joint.min)));
    setJointValue(joint.name, next);
  };

  const endMarkerDrag = (event: ReactPointerEvent<HTMLButtonElement>, joint: JointControl) => {
    const drag = dragRef.current;
    if (!drag || drag.name !== joint.name) return;
    if (drag.moved) suppressClickRef.current = joint.name;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const keyMarker = (event: KeyboardEvent<HTMLButtonElement>, joint: JointControl) => {
    const step = joint.type === "prismatic" ? Math.max((joint.max - joint.min) / 100, .001) : Math.max((joint.max - joint.min) / 100, .01);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(joint.max, joint.value + step);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(joint.min, joint.value - step);
    if (event.key === "Home") next = joint.min;
    if (event.key === "End") next = joint.max;
    if (next === null) return;
    event.preventDefault();
    setJointValue(joint.name, next);
  };

  if (compact) {
    return (
      <div className="urdf-stage compare-preview-stage">
        <canvas ref={canvasRef} aria-label={`Interactive 3D view of ${name}`} />
        <div className="viewer-status">
          <span className={state}>{state === "ready" ? `${joints.length} controllable joints` : state === "loading" ? "Loading review model" : "Preview unavailable"}</span>
        </div>
        <button className="viewer-reset" type="button" onClick={() => resetViewRef.current?.()} disabled={state !== "ready"}>Reset view</button>
        <p className="viewer-hint">Drag to rotate · scroll to zoom</p>
      </div>
    );
  }

  return (
    <div className="review-workbench">
      <div className="review-visuals">
        <div className="urdf-stage">
          <canvas ref={canvasRef} aria-label={`Interactive 3D view of ${name}`} />
          <div className="viewer-status">
            <span className={state}>
              {state === "ready" ? `${joints.length} controllable joints` : state === "loading" ? "Loading review model" : "Preview unavailable"}
            </span>
          </div>
          <button className="viewer-reset" type="button" onClick={() => resetViewRef.current?.()} disabled={state !== "ready"}>Reset view</button>
          <p className="viewer-hint">Drag to rotate · scroll or pinch to zoom</p>
        </div>

        <section className="body-map" aria-label="Numbered body joint map">
          <div className="body-map-plot">
            <div className="body-map-status">
              <span className={activeMapJoint ? "active" : ""} aria-live="polite">
                {activeMapJoint && activeMapNumber
                  ? <><strong>{String(activeMapNumber).padStart(2, "0")}</strong>{activeMapJoint.name}</>
                  : "Whole body · front view"}
              </span>
              <b><i>Robot R</i><em>← facing you →</em><i>Robot L</i></b>
            </div>
            <span className="body-part map-head" /><span className="body-part map-neck" /><span className="body-part map-torso" />
            <span className="body-part map-arm left" /><span className="body-part map-arm right" />
            <span className="body-part map-leg left" /><span className="body-part map-leg right" />
            {joints.map((joint) => {
              const number = joints.findIndex((item) => item.name === joint.name) + 1;
              const point = { x: joint.mapX ?? 50, y: joint.mapY ?? 50 };
              const fill = ((joint.value - joint.min) / Math.max(joint.max - joint.min, Number.EPSILON)) * 100;
              return (
                <button
                  className={`joint-marker ${activeJoint === joint.name ? "active" : ""}`}
                  key={joint.name}
                  type="button"
                  role="slider"
                  aria-label={`${number}. ${joint.name}`}
                  aria-valuemin={joint.min}
                  aria-valuemax={joint.max}
                  aria-valuenow={joint.value}
                  aria-valuetext={formatJointValue(joint)}
                  title={`${number}. ${joint.name} · ${formatJointValue(joint)}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%`, "--joint-fill": `${fill}%` } as Record<string, string>}
                  onPointerDown={(event) => startMarkerDrag(event, joint)}
                  onPointerMove={(event) => moveMarker(event, joint)}
                  onPointerUp={(event) => endMarkerDrag(event, joint)}
                  onPointerCancel={(event) => endMarkerDrag(event, joint)}
                  onKeyDown={(event) => keyMarker(event, joint)}
                  onMouseEnter={() => setActiveJoint(joint.name)}
                  onMouseLeave={() => setActiveJoint(null)}
                  onFocus={() => setActiveJoint(joint.name)}
                  onBlur={() => setActiveJoint(null)}
                  onClick={() => {
                    if (suppressClickRef.current === joint.name) {
                      suppressClickRef.current = null;
                      return;
                    }
                    focusJoint(joint.name);
                  }}
                >{number}</button>
              );
            })}
            <p className="body-map-hint">Drag a number to move it · select to find its full control below</p>
          </div>
        </section>
      </div>

      <aside className="joint-map" aria-label={`Joint controls for ${name}`}>
        <div className="joint-map-head">
          <div>
            <p className="eyebrow">Joint controls</p>
            <h3>{state === "ready" ? `${joints.length} named controls` : "Preparing controls"}</h3>
          </div>
          <button type="button" onClick={resetJoints} disabled={state !== "ready"}>Reset all</button>
        </div>
        {state === "error" ? (
          <p className="joint-map-empty">The URDF could not be loaded. Use the source links below to inspect the package.</p>
        ) : state === "loading" ? (
          <p className="joint-map-empty">Reading limits and movable joints…</p>
        ) : (
          <div className="joint-map-list">
              {groupedJoints.map(([group, controls]) => (
                <section className="joint-group" key={group}>
                  <h4><span>{group}</span><b>{controls.length}</b></h4>
                  {controls.map((joint) => {
                    const number = joints.findIndex((item) => item.name === joint.name) + 1;
                  const inputId = `joint-${name}-${joint.name}`.replace(/[^a-z0-9_-]+/gi, "-");
                  return (
                    <label
                      className={`joint-control ${activeJoint === joint.name ? "active" : ""}`}
                      htmlFor={inputId}
                      key={joint.name}
                      onMouseEnter={() => setActiveJoint(joint.name)}
                      onMouseLeave={() => setActiveJoint(null)}
                    >
                      <span className="joint-control-title">
                        <span className="joint-number">{number}</span>
                        <strong>{joint.name}</strong>
                        <output htmlFor={inputId}>{formatJointValue(joint)}</output>
                      </span>
                      <input
                        ref={(node) => { sliderRefs.current[joint.name] = node; }}
                        id={inputId}
                        type="range"
                        min={joint.min}
                        max={joint.max}
                        step={joint.type === "prismatic" ? Math.max((joint.max - joint.min) / 200, 0.0005) : 0.01}
                        value={joint.value}
                        onChange={(event) => setJointValue(joint.name, Number(event.target.value))}
                        onFocus={() => setActiveJoint(joint.name)}
                        onBlur={() => setActiveJoint(null)}
                        aria-label={`${joint.name}, ${joint.type}, range ${formatJointValue(joint, joint.min)} to ${formatJointValue(joint, joint.max)}`}
                      />
                      <span className="joint-control-range">
                        <span>{formatJointValue(joint, joint.min)}</span>
                        <em>{joint.type}</em>
                        <span>{formatJointValue(joint, joint.max)}</span>
                      </span>
                    </label>
                  );
                })}
                </section>
              ))}
          </div>
        )}
      </aside>
    </div>
  );
}
