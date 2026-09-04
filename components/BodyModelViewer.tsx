"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ModelRecord } from "../lib/models";
import { sitePath } from "../lib/site-path";

type ParameterValues = {
  rootYaw: number;
  spineBend: number;
  shoulderLift: number;
  elbowBend: number;
  hipFlex: number;
  kneeBend: number;
  bodyVolume: number;
  stature: number;
  shoulderHip: number;
  handCurl: number;
  jawOpen: number;
  expression: number;
};

type ParameterKey = keyof ParameterValues;

type ParameterControl = {
  key: ParameterKey;
  label: string;
  tensor: string;
  group: "Pose θ" | "Shape β" | "Hands" | "Face";
  min: number;
  max: number;
  step: number;
  unit: "angle" | "sigma" | "ratio";
};

const ZERO_PARAMETERS: ParameterValues = {
  rootYaw: 0,
  spineBend: 0,
  shoulderLift: 8,
  elbowBend: 0,
  hipFlex: 0,
  kneeBend: 0,
  bodyVolume: 0,
  stature: 0,
  shoulderHip: 0,
  handCurl: 0,
  jawOpen: 0,
  expression: 0,
};

const BASE_CONTROLS: ParameterControl[] = [
  { key: "rootYaw", label: "Global orientation", tensor: "global_orient · y", group: "Pose θ", min: -90, max: 90, step: 1, unit: "angle" },
  { key: "spineBend", label: "Spine bend", tensor: "body_pose · spine", group: "Pose θ", min: -35, max: 35, step: 1, unit: "angle" },
  { key: "shoulderLift", label: "Shoulder lift", tensor: "body_pose · shoulders", group: "Pose θ", min: 0, max: 120, step: 1, unit: "angle" },
  { key: "elbowBend", label: "Elbow bend", tensor: "body_pose · elbows", group: "Pose θ", min: 0, max: 135, step: 1, unit: "angle" },
  { key: "hipFlex", label: "Hip flexion", tensor: "body_pose · hips", group: "Pose θ", min: -50, max: 80, step: 1, unit: "angle" },
  { key: "kneeBend", label: "Knee bend", tensor: "body_pose · knees", group: "Pose θ", min: 0, max: 130, step: 1, unit: "angle" },
  { key: "bodyVolume", label: "Body volume", tensor: "betas[0]", group: "Shape β", min: -2.5, max: 2.5, step: .05, unit: "sigma" },
  { key: "stature", label: "Stature", tensor: "betas[1]", group: "Shape β", min: -2.5, max: 2.5, step: .05, unit: "sigma" },
  { key: "shoulderHip", label: "Shoulder / hip balance", tensor: "betas[2]", group: "Shape β", min: -2.5, max: 2.5, step: .05, unit: "sigma" },
];

const HAND_CONTROL: ParameterControl = { key: "handCurl", label: "Hand curl", tensor: "left/right_hand_pose", group: "Hands", min: 0, max: 1, step: .01, unit: "ratio" };
const FACE_CONTROLS: ParameterControl[] = [
  { key: "jawOpen", label: "Jaw pose", tensor: "jaw_pose", group: "Face", min: 0, max: 1, step: .01, unit: "ratio" },
  { key: "expression", label: "Expression blend", tensor: "expression[0]", group: "Face", min: -2, max: 2, step: .05, unit: "sigma" },
];

const PROFILES: Record<string, { pose: string; shape: string; extras: string }> = {
  smpl: { pose: "3 global + 69 body = 72 axis-angle values", shape: "β PCA coefficients · usually 10, up to 300", extras: "24-joint linear-blend skinning" },
  "smpl-h": { pose: "3 global + 63 body + 90 hands = 156 values", shape: "Body β plus MANO hand pose PCA", extras: "52-joint body-and-hand hierarchy" },
  "smpl-x": { pose: "3 global + 63 body + 90 hands + 9 face/eyes = 165", shape: "β shape + expression blend coefficients", extras: "55 joints across body, hands, jaw and eyes" },
  star: { pose: "3 global + 69 body = 72 axis-angle values", shape: "SMPL-compatible β shape coefficients", extras: "Sparse, spatially local pose correctives" },
};

const importBrowserModule = (url: string): Promise<Record<string, any>> =>
  Function("moduleUrl", "return import(moduleUrl)")(url) as Promise<Record<string, any>>;

const radians = (degrees: number) => degrees * Math.PI / 180;

const formatValue = (control: ParameterControl, value: number) => {
  if (control.unit === "angle") return `${value.toFixed(0)}°`;
  if (control.unit === "ratio") return `${Math.round(value * 100)}%`;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}σ`;
};

export function BodyModelViewer({ model, compact = false }: { model: ModelRecord; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Record<string, any>>({});
  const resetViewRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [values, setValues] = useState<ParameterValues>(ZERO_PARAMETERS);

  const controls = useMemo(() => {
    const available = [...BASE_CONTROLS];
    if (model.id === "smpl-h" || model.id === "smpl-x") available.push(HAND_CONTROL);
    if (model.id === "smpl-x") available.push(...FACE_CONTROLS);
    return available;
  }, [model.id]);
  const profile = PROFILES[model.id] ?? PROFILES.smpl;

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
    importBrowserModule(sitePath("/vendor/three.module.js")).then((THREE) => {
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.setClearColor(0x000000, 0);
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, .01, 50);
      const controlsModulePromise = importBrowserModule(sitePath("/vendor/OrbitControls.js"));

      scene.add(new THREE.HemisphereLight(0xf7f4ed, 0x454d4a, 2.5));
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(3, 5, 4);
      key.castShadow = true;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xd9e6ea, 1.5);
      rim.position.set(-4, 2, -3);
      scene.add(rim);

      const grid = new THREE.GridHelper(5, 20, 0xb4b7b1, 0xd1d2cc);
      grid.material.opacity = .42;
      grid.material.transparent = true;
      scene.add(grid);

      const root = new THREE.Group();
      scene.add(root);
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x7a8583, roughness: .74, metalness: .02 });
      const jointMaterial = new THREE.MeshStandardMaterial({ color: 0xd8461b, roughness: .68 });

      const capsule = (length: number, radius: number) => {
        const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(.01, length - radius * 2), 7, 16), bodyMaterial);
        mesh.position.y = -length / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      };
      const joint = (parent: any) => {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(.026, 12, 8), jointMaterial);
        marker.castShadow = true;
        parent.add(marker);
      };

      const pelvis = new THREE.Mesh(new THREE.SphereGeometry(.2, 28, 18), bodyMaterial);
      pelvis.position.y = 1.01;
      pelvis.scale.set(1.18, .76, .78);
      pelvis.castShadow = true;
      root.add(pelvis);

      const spine = new THREE.Group();
      spine.position.y = 1.12;
      root.add(spine);
      const torso = new THREE.Mesh(new THREE.SphereGeometry(.25, 32, 22), bodyMaterial);
      torso.position.y = .31;
      torso.scale.set(1.2, 1.4, .62);
      torso.castShadow = true;
      spine.add(torso);
      const neck = capsule(.16, .055);
      neck.position.y = .68;
      spine.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.14, 28, 20), bodyMaterial);
      head.position.y = .82;
      head.scale.set(.82, 1.08, .88);
      head.castShadow = true;
      spine.add(head);
      const jaw = new THREE.Mesh(new THREE.SphereGeometry(.09, 22, 14), bodyMaterial);
      jaw.position.set(0, .755, .035);
      jaw.scale.set(.78, .48, .82);
      jaw.castShadow = true;
      spine.add(jaw);

      const makeArm = (side: "left" | "right") => {
        const sign = side === "left" ? -1 : 1;
        const shoulder = new THREE.Group();
        shoulder.position.set(sign * .34, .55, 0);
        spine.add(shoulder);
        joint(shoulder);
        const upper = capsule(.42, .075);
        shoulder.add(upper);
        const elbow = new THREE.Group();
        elbow.position.y = -.42;
        shoulder.add(elbow);
        joint(elbow);
        const lower = capsule(.40, .062);
        elbow.add(lower);
        const hand = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .09, 6, 14), bodyMaterial);
        hand.position.y = -.47;
        hand.scale.set(.78, 1.08, .56);
        hand.castShadow = true;
        elbow.add(hand);
        return { shoulder, elbow, upper, lower, hand };
      };

      const makeLeg = (side: "left" | "right") => {
        const sign = side === "left" ? -1 : 1;
        const hip = new THREE.Group();
        hip.position.set(sign * .14, .98, 0);
        root.add(hip);
        joint(hip);
        const upper = capsule(.60, .105);
        hip.add(upper);
        const knee = new THREE.Group();
        knee.position.y = -.60;
        hip.add(knee);
        joint(knee);
        const lower = capsule(.58, .085);
        knee.add(lower);
        const foot = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .18, 6, 14), bodyMaterial);
        foot.rotation.x = Math.PI / 2;
        foot.position.set(0, -.61, .10);
        foot.scale.set(.82, 1.15, .72);
        foot.castShadow = true;
        knee.add(foot);
        return { hip, knee, upper, lower, foot };
      };

      const leftArm = makeArm("left");
      const rightArm = makeArm("right");
      const leftLeg = makeLeg("left");
      const rightLeg = makeLeg("right");
      nodesRef.current = { root, spine, torso, pelvis, head, jaw, leftArm, rightArm, leftLeg, rightLeg };

      controlsModulePromise.then(({ OrbitControls }) => {
        if (disposed) return;
        const orbit = new OrbitControls(camera, canvas);
        orbit.enableDamping = true;
        orbit.dampingFactor = .075;
        orbit.enablePan = false;
        orbit.minDistance = 1.8;
        orbit.maxDistance = 8;
        orbit.target.set(0, .95, 0);
        const resetView = () => {
          camera.position.set(2.25, 1.42, 3.35);
          orbit.target.set(0, .96, 0);
          orbit.update();
        };
        resetViewRef.current = resetView;
        resetView();

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

        const render = () => {
          if (disposed) return;
          orbit.update();
          renderer.render(scene, camera);
          animationFrame = window.requestAnimationFrame(render);
        };
        render();
        setState("ready");

        teardown = () => {
          orbit.dispose();
          root.traverse((node: any) => {
            node.geometry?.dispose?.();
            if (Array.isArray(node.material)) node.material.forEach((material: any) => material.dispose?.());
          });
          bodyMaterial.dispose();
          jointMaterial.dispose();
          renderer.dispose();
        };
      }).catch(() => {
        if (!disposed) setState("error");
      });
    }).catch(() => {
      if (!disposed) setState("error");
    });

    return () => {
      disposed = true;
      nodesRef.current = {};
      resetViewRef.current = null;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      teardown?.();
    };
  }, []);

  useEffect(() => {
    const nodes = nodesRef.current;
    if (!nodes.root) return;
    const { root, spine, torso, pelvis, jaw, leftArm, rightArm, leftLeg, rightLeg } = nodes;
    root.rotation.y = radians(values.rootYaw);
    root.scale.y = 1 + values.stature * .055;
    spine.rotation.x = radians(values.spineBend);
    leftArm.shoulder.rotation.z = -radians(values.shoulderLift);
    rightArm.shoulder.rotation.z = radians(values.shoulderLift);
    leftArm.elbow.rotation.z = radians(values.elbowBend);
    rightArm.elbow.rotation.z = -radians(values.elbowBend);
    leftLeg.hip.rotation.x = radians(values.hipFlex);
    rightLeg.hip.rotation.x = radians(values.hipFlex);
    leftLeg.knee.rotation.x = -radians(values.kneeBend);
    rightLeg.knee.rotation.x = -radians(values.kneeBend);

    const volume = 1 + values.bodyVolume * .055;
    const balance = values.shoulderHip * .025;
    torso.scale.set(1.2 * volume + balance, 1.4, .62 * volume);
    pelvis.scale.set(1.18 * volume - balance, .76, .78 * volume);
    leftArm.shoulder.position.x = -.34 - balance * .06;
    rightArm.shoulder.position.x = .34 + balance * .06;
    leftLeg.hip.position.x = -.14 + balance * .025;
    rightLeg.hip.position.x = .14 - balance * .025;
    [leftArm.upper, leftArm.lower, rightArm.upper, rightArm.lower, leftLeg.upper, leftLeg.lower, rightLeg.upper, rightLeg.lower]
      .forEach((limb: any) => limb.scale.set(volume, 1, volume));
    leftArm.hand.rotation.x = radians(values.handCurl * 72);
    rightArm.hand.rotation.x = radians(values.handCurl * 72);
    jaw.position.y = .755 - values.jawOpen * .035;
    jaw.scale.x = .78 * (1 + values.expression * .06);
  }, [values, state]);

  const resetParameters = () => setValues({ ...ZERO_PARAMETERS });

  return (
    <div className={`body-model-review${compact ? " compact" : ""}`}>
      <div className={`body-model-stage${compact ? " compact" : ""}`}>
        <canvas ref={canvasRef} aria-label={`Interactive 3D parameter proxy for ${model.name}`} />
        <div className="viewer-status"><span className={state}>{state === "ready" ? "Interactive pose proxy" : state === "loading" ? "Preparing body model" : "Preview unavailable"}</span></div>
        <button className="viewer-reset" type="button" onClick={() => resetViewRef.current?.()} disabled={state !== "ready"}>Reset view</button>
        <p className="body-proxy-label">Procedural proxy · official weights not redistributed</p>
        <p className="viewer-hint">Drag to rotate · scroll or pinch to zoom</p>
      </div>

      {!compact && (
        <>
          <div className="parameterization-strip" aria-label={`${model.name} parameterization summary`}>
            <div><span>Pose θ</span><strong>{profile.pose}</strong></div>
            <div><span>Shape β</span><strong>{profile.shape}</strong></div>
            <div><span>Deformation</span><strong>{profile.extras}</strong></div>
          </div>
          <section className="body-parameter-panel" aria-label={`${model.name} body controls`}>
            <div className="body-parameter-head">
              <div><p className="eyebrow">Movement parameters</p><h3>Readable controls into the pose vector.</h3></div>
              <button type="button" onClick={resetParameters}>Reset parameters</button>
            </div>
            <p className="body-parameter-note">The sliders expose representative entries and mirrored joint pairs. Production SMPL pipelines accept the complete axis-angle tensors plus separate shape—and, where available, hand and expression—coefficients.</p>
            <div className="body-parameter-list">
              {controls.map((control) => {
                const inputId = `${model.id}-${control.key}`;
                return (
                  <label className="body-parameter-control" htmlFor={inputId} key={control.key}>
                    <span><em>{control.group}</em><strong>{control.label}</strong><code>{control.tensor}</code></span>
                    <input id={inputId} type="range" min={control.min} max={control.max} step={control.step} value={values[control.key]} onChange={(event) => setValues((current) => ({ ...current, [control.key]: Number(event.target.value) }))} />
                    <output htmlFor={inputId}>{formatValue(control, values[control.key])}</output>
                  </label>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
