(() => {
  const base = (window.ICORPI_BASE || "").replace(/\/$/, "");
  const asset = (path) => {
    if (!path || /^(?:https?:)?\/\//.test(path)) return path;
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  };
  const models = () => {
    const node = document.getElementById("model-data");
    return node ? JSON.parse(node.textContent) : [];
  };
  const escapeHTML = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  window.ICorpi = { asset, models, escapeHTML };
})();

