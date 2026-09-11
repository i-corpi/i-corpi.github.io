// An authored root trajectory and foot-placement cycle, not robot dynamics.
// One full cycle covers 0.60 m. During each straight-line stance, the foot
// moves backwards in root space at exactly the root's forward speed.
export function createOlafMotion({ root, robot, values, sync, beforePlay, signal }) {
  const panel = document.createElement("section");
  panel.className = "character-motion";
  panel.setAttribute("aria-label", "Olaf movement");
  panel.innerHTML = `<h3>Move Olaf</h3>
    <p>Forward follows body heading (+Z at rest). Walking moves the whole character and places his feet; rotating a foot alone cannot move him forward.</p>
    <div class="pose-actions">
      <button type="button" data-walk>Walk forward</button>
      <button type="button" data-step-forward>Step forward · 0.30 m</button>
      <button type="button" data-reset-position>Reset position</button>
    </div>
    <div class="motion-settings">
      <label>Heading <input type="range" data-motion-heading min="-180" max="180" step="1" value="0"><output>0°</output></label>
      <label>Speed <input type="range" data-motion-speed min="0.1" max="0.8" step="0.05" value="0.35"><output>0.35 m/s</output></label>
      <label><input type="checkbox" data-follow-motion checked> Follow with camera</label>
    </div>
    <output data-motion-position>Position X 0.00 m · Z 0.00 m · travelled 0.00 m</output>
    <p class="motion-note">Stylized animation with floating snow feet. No hips, knees or physical balance simulation.</p>`;
  root.querySelector(".review-visuals").before(panel);
  const walk = panel.querySelector("[data-walk]");
  const step = panel.querySelector("[data-step-forward]");
  const heading = panel.querySelector("[data-motion-heading]");
  const speedInput = panel.querySelector("[data-motion-speed]");
  const position = panel.querySelector("[data-motion-position]");
  const listen = (node, event, fn) => node.addEventListener(event, fn, { signal });
  const restPositions = Object.fromEntries(Object.entries(robot.joints).map(([name, node]) => [name, node.position.clone()]));
  let frame = 0, playing = false, lastTime = null, phase = 0, travelled = 0, speed = .35, remaining = Infinity;
  const refresh = () => {
    heading.value = String(values[0][1]);
    heading.nextElementSibling.textContent = `${Math.round(values[0][1])}°`;
    position.textContent = `Position X ${robot.position.x.toFixed(2)} m · Z ${robot.position.z.toFixed(2)} m · travelled ${travelled.toFixed(2)} m`;
    position.dataset.x = robot.position.x;
    position.dataset.z = robot.position.z;
    position.dataset.distance = travelled;
  };
  const pause = () => {
    playing = false;
    cancelAnimationFrame(frame);
    frame = 0; lastTime = null;
    walk.textContent = "Walk forward";
    walk.setAttribute("aria-pressed", "false");
    step.disabled = false;
  };
  const resetOffsets = () => {
    phase = 0;
    for (const [name, node] of Object.entries(robot.joints)) node.position.copy(restPositions[name]);
  };
  const poseStep = () => {
    const bob = .018 * (1 - Math.cos(phase * 4 * Math.PI));
    robot.joints.root.position.y = restPositions.root.y + bob;
    for (const [index, side] of ["left", "right"].entries()) {
      const footPhase = (phase + index * .5) % 1;
      const swing = Math.max(0, (footPhase - .5) * 2);
      const z = footPhase < .5 ? .15 - .6 * footPhase : -.15 + .3 * swing * swing * (3 - 2 * swing);
      const foot = robot.joints[`${side}_foot`];
      foot.position.copy(restPositions[`${side}_foot`]);
      foot.position.z += z;
      foot.position.y += .10 * Math.sin(Math.PI * swing) - bob;
    }
    // Keep the root upright so the planted feet stay on the ground.
    values[0][0] = values[0][2] = 0;
    values[10].fill(0); values[11].fill(0);
    const sway = 18 * Math.sin(phase * 2 * Math.PI);
    values[4] = [0, sway, -65]; values[7] = [0, sway, 65];
    values[1][0] = 3 * Math.sin(phase * 4 * Math.PI);
  };
  const tick = time => {
    if (!playing || signal.aborted) return;
    if (document.hidden) return pause();
    const dt = lastTime === null ? 0 : Math.min(.1, (time - lastTime) / 1000);
    lastTime = time;
    const distance = Math.min(speed * dt, remaining);
    const yaw = values[0][1] * Math.PI / 180;
    robot.position.x += Math.sin(yaw) * distance;
    robot.position.z += Math.cos(yaw) * distance;
    travelled += distance;
    remaining -= distance;
    phase = (phase + distance / .6) % 1;
    poseStep();
    sync();
    if (remaining <= 1e-8) pause();
    else frame = requestAnimationFrame(tick);
  };
  const start = distance => {
    // Resume the current cycle; beforePlay clears the other animation and
    // poses. Preserve heading and phase across that reset.
    const yaw = values[0][1];
    const savedPhase = phase;
    beforePlay();
    values[0][1] = yaw;
    phase = savedPhase;
    remaining = distance;
    playing = true;
    walk.textContent = "Pause walking";
    walk.setAttribute("aria-pressed", "true");
    step.disabled = true;
    poseStep(); sync();
    frame = requestAnimationFrame(tick);
  };
  listen(walk, "click", () => playing ? pause() : start(Infinity));
  listen(step, "click", () => start(.3));
  listen(heading, "input", () => { pause(); values[0][1] = Number(heading.value); sync(); });
  listen(speedInput, "input", () => {
    speed = Number(speedInput.value);
    speedInput.nextElementSibling.textContent = `${speed.toFixed(2)} m/s`;
  });
  listen(panel.querySelector("[data-follow-motion]"), "change", event => {
    root.dispatchEvent(new CustomEvent("viewer-follow-motion", { detail: event.target.checked }));
  });
  listen(panel.querySelector("[data-reset-position]"), "click", () => {
    beforePlay(); resetOffsets();
    robot.position.set(0, 0, 0);
    travelled = 0;
    sync();
  });
  listen(document, "visibilitychange", () => { if (document.hidden) pause(); });
  signal.addEventListener("abort", () => { pause(); panel.remove(); }, { once: true });
  refresh();
  return {
    pause, refresh, resetOffsets,
    state: () => ({
      jointTranslationOffsets: robot.layout.joints.map(([name]) =>
        robot.joints[name].position.clone().sub(restPositions[name]).toArray()),
      translationUnits: "metres",
      locomotion: { type: "authored-foot-placement", phase, speedMetresPerSecond: speed, travelledMetres: travelled },
    }),
  };
}
