// One owner per panel, shared by archive records and two-sided comparisons.
(() => {
  const { asset } = window.ICorpi;
  window.ICorpi.mountViewerPanel = (root, model) => {
    const listeners = new AbortController();
    const { signal } = listeners;
    const part = name => root.querySelector(`[data-viewer-part="${name}"]`);
    const poster = root.querySelector("[data-viewer-poster]");
    const workbench = root.querySelector("[data-viewer-workbench]");
    const message = root.querySelector("[data-viewer-message]");
    const button = root.querySelector("[data-load-viewer]");
    let current = null, generation = 0;
    let activeModel = model;
    if (!model.posePreview && typeof DecompressionStream !== "function") {
      root.querySelector("[data-viewer-size]").textContent =
        `${(model.assets.originalBytes / 1e6).toFixed(1)} MB geometry · ${model.assets.meshCount} meshes`;
    }
    const close = (text = "3D closed. You can load it again at any time.") => {
      generation += 1;
      current?.destroy();
      current = null;
      workbench.hidden = true;
      poster.hidden = false;
      message.textContent = text;
      button.disabled = false;
    };
    const load = async () => {
      if (signal.aborted || current || button.disabled) return;
      const version = ++generation;
      button.disabled = true;
      poster.hidden = true;
      workbench.hidden = false;
      const status = part("viewer-status");
      status.className = "";
      status.textContent = "Loading 3D model…";
      try {
        const { createViewer } = await import(asset("/assets/js/viewer.js"));
        if (version !== generation || signal.aborted) return;
        current = createViewer(activeModel, root);
        await current.ready;
      } catch (error) {
        if (version !== generation || signal.aborted) return;
        close("3D could not load. Check your connection and WebGL support, then try again.");
        button.textContent = "Retry interactive model";
      }
    };
    const destroy = () => {
      generation += 1;
      listeners.abort();
      current?.destroy();
      current = null;
    };
    close(model.posePreview ? "Open the procedural pose demonstrator." : "Load 3D when you want to inspect the joints.");
    root.querySelector("[data-close-viewer]").addEventListener("click", () => {
      close();
      button.focus();
    }, { signal });
    root.addEventListener("viewer-error", event => close(event.detail), { signal });
    root.addEventListener("body-hand-mode", event => {
      if (model.posePreview !== "smplh52" || !["human", "sharpa"].includes(event.detail)) return;
      activeModel = { ...model, previewHandMode: event.detail };
      close();
      load();
    }, { signal });
    button.addEventListener("click", load, { signal });
    return { load, close, destroy };
  };
})();
