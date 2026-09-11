document.addEventListener("DOMContentLoaded", () => {
  const { asset } = window.ICorpi;
  document.querySelectorAll("[data-turntable]").forEach((card) => {
    const id = card.dataset.turntable;
    const frames = JSON.parse(card.dataset.frames);
    const frameCount = frames.length;
    const wrap = (value) => (value % frameCount + frameCount) % frameCount;
    const stage = card.querySelector(".turntable-stage");
    const image = stage.querySelector("img");
    const readout = stage.querySelector(".turntable-controls em");
    let frame = 0;
    let drag = null;

    const source = (value) => asset(frames[wrap(value)]);
    const update = (next) => {
      if (wrap(next) === frame) return;
      frame = wrap(next);
      image.src = source(frame);
      stage.setAttribute("aria-valuenow", String(frame + 1));
      stage.setAttribute("aria-valuetext", `Angle ${frame + 1} of ${frameCount}`);
      readout.textContent = `${String(frame + 1).padStart(2, "0")} / ${frameCount}`;
      [frame - 1, frame + 1].forEach((nearby) => {
        const preload = new Image();
        preload.src = source(nearby);
      });
    };
    image.addEventListener("error", () => {
      const fallback = asset(`/gallery/turntables/${id}/${String(frame).padStart(2, "0")}.png`);
      if (image.getAttribute("src") !== fallback) image.src = fallback;
    });

    card.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => update(frame + Number(button.dataset.step)));
    });
    stage.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      update(event.key === "Home" ? 0 : event.key === "End" ? frameCount - 1 : frame + (event.key === "ArrowRight" ? 1 : -1));
    });
    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = { x: event.clientX, frame, pointerId: event.pointerId };
      stage.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    stage.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      update(drag.frame - Math.round((event.clientX - drag.x) / 18));
    });
    const release = (event) => {
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      drag = null;
    };
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", release);
  });
});
