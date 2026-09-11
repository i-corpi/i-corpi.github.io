(() => {
  const { models, mountViewerPanel } = window.ICorpi;
  let current = null;
  const unmount = () => {
    current?.destroy();
    current = null;
  };
  const mount = () => {
    unmount();
    const root = document.querySelector("[data-model-viewer]");
    if (!root) return;
    const model = models().find((record) => record.id === root.dataset.modelViewer);
    if (!model) return;
    current = mountViewerPanel(root, model);
  };
  document.addEventListener("DOMContentLoaded", mount);
  document.addEventListener("icorpi:record-changing", unmount);
  document.addEventListener("icorpi:record-changed", mount);
  window.addEventListener("pagehide", unmount);
  window.addEventListener("pageshow", (event) => { if (event.persisted) mount(); });
})();
