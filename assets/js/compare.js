document.addEventListener("DOMContentLoaded", () => {
  const { asset, models, escapeHTML, mountViewerPanel } = window.ICorpi;
  const records = new Map(models().map((model) => [model.id, model]));
  const leftPicker = document.getElementById("compare-left");
  const rightPicker = document.getElementById("compare-right");
  const figures = document.getElementById("compare-figures");
  const table = document.getElementById("compare-table");
  const note = document.getElementById("compare-note");
  const template = document.getElementById("compare-viewer-template");
  const slots = [null, null];
  const readQuery = () => {
    const params = new URL(location.href).searchParams;
    leftPicker.value = records.has(params.get("a")) ? params.get("a") : "unitree-g1";
    rightPicker.value = records.has(params.get("b")) ? params.get("b") : "unitree-h2";
  };
  const value = (model, key) => {
    if ((model.kind === "robot" && ["vertices", "parameters"].includes(key)) ||
        (model.kind !== "robot" && ["heightM", "weightKg"].includes(key))) return "Not applicable";
    const input = model[key];
    if (Array.isArray(input)) return input.length ? input.join(" · ") : "Metadata only";
    if (input === null || input === undefined) return "Not published";
    return `${input}${key === "heightM" ? " m" : key === "weightKg" ? " kg" : ""}`;
  };
  const visual = (model) => {
    const preview = model.assets?.images;
    const image = model.image
      ? `<img src="${asset(preview?.["800"] || model.image)}" ${preview ? `srcset="${asset(preview["400"])} 400w, ${asset(preview["800"])} 800w" sizes="(max-width: 600px) 100vw, 50vw"` : ""} width="800" height="800" alt="${escapeHTML(model.imageAlt)}" decoding="async">`
      : '<span class="head"></span><span class="torso"></span><span class="arm left"></span><span class="arm right"></span><span class="leg left"></span><span class="leg right"></span>';
    return `<div class="figure ${model.kind}${model.image ? " has-image" : ""}">${image}</div>`;
  };
  const rows = [
    ["Model class", "family"], ["Upstream formats", "formats"], ["Hosted formats", "hostedFormats"],
    ["Pose / movable DoF", "dof"], ["Joints", "joints"], ["Body mesh vertices", "vertices"],
    ["Height", "heightM"], ["Mass", "weightKg"], ["Parametric space", "parameters"],
    ["Variants", "variants"], ["Licence", "license"], ["Archive access", "accessLabel"],
  ];
  const renderPanel = (model, index) => {
    if (slots[index]?.id === model.id) return;
    slots[index]?.owner?.destroy();
    const instance = `compare-${index === 0 ? "a" : "b"}`;
    const panel = document.createElement("article");
    panel.dataset.modelViewer = model.id;
    panel.dataset.viewerInstance = instance;
    panel.setAttribute("aria-label", `Model ${index === 0 ? "A" : "B"}: ${model.name}`);
    panel.innerHTML = `<p class="eyebrow">${model.kind === "robot" ? "Humanoid robot" : model.kind === "character" ? "Procedural character" : "Parametric body"}</p>
      <h2><a href="${asset(`/archive/${model.id}/`)}">${escapeHTML(model.name)}</a></h2>
      <p class="compare-tagline">${escapeHTML(model.tagline)}</p>`;
    const canPreview = model.hostedPath || model.posePreview;
    const disclosure = model.posePreview
      ? escapeHTML(`${model.previewLabel}. ${model.kind === "character" ? "An unofficial, authored character rig." : "Body geometry is illustrative; licensed body weights are not loaded."}`)
      : `${(model.assets.previewBytes / 1e6).toFixed(1)} MB compressed geometry · ${model.assets.meshCount} meshes`;
    if (canPreview) {
      panel.insertAdjacentHTML("beforeend", `<p class="compare-preview-label" data-viewer-size>${disclosure}</p>
        <div class="viewer-poster" data-viewer-poster>
          <div class="compare-model-visual">${visual(model)}</div>
          <div class="viewer-poster-actions">
            <button class="button" type="button" data-load-viewer>Load interactive model</button>
            <p role="status" data-viewer-message></p>
          </div>
        </div>`);
      const content = template.content.cloneNode(true);
      // Stable scoped hooks keep the shared controls independent of DOM ids.
      content.querySelectorAll("[id]").forEach(node => { node.id = `${instance}-${node.id}`; });
      content.querySelector("canvas").setAttribute("aria-label", `Interactive 3D view of ${model.name}, model ${index === 0 ? "A" : "B"}`);
      const workbench = content.querySelector("[data-viewer-workbench]");
      const details = document.createElement("details");
      details.className = "compare-joints";
      details.innerHTML = "<summary>Joint map and controls</summary>";
      details.append(content.querySelector(".body-map"), content.querySelector(".joint-map"));
      workbench.append(details);
      panel.append(content);
    } else {
      panel.insertAdjacentHTML("beforeend", `<div class="compare-model-visual">${visual(model)}</div>
        <p class="compare-preview-label">Illustration only. This model’s weights are available from its provider under their access terms.</p>`);
    }
    panel.insertAdjacentHTML("beforeend", `<a class="compare-record-link" href="${asset(`/archive/${model.id}/`)}">Full record, files and provenance →</a>`);
    figures.children[index].replaceWith(panel);
    const owner = canPreview ? mountViewerPanel(panel, model) : null;
    slots[index] = { id: model.id, owner };
    owner?.load();
  };
  const render = (save = true) => {
    const left = records.get(leftPicker.value);
    const right = records.get(rightPicker.value);
    if (!left || !right) return;
    [left, right].forEach(renderPanel);
    table.innerHTML = `
      <caption>${escapeHTML(left.name)} and ${escapeHTML(right.name)} comparison</caption>
      <thead><tr><th scope="col">Attribute</th><th scope="col">${escapeHTML(left.name)}</th><th scope="col">${escapeHTML(right.name)}</th></tr></thead>
      <tbody>${rows.map(([label, key]) => `<tr><th scope="row">${label}</th><td>${escapeHTML(value(left, key))}</td><td>${escapeHTML(value(right, key))}</td></tr>`).join("")}</tbody>`;
    note.hidden = left.kind === right.kind;
    if (save) {
      const url = new URL(location.href);
      url.searchParams.set("a", left.id);
      url.searchParams.set("b", right.id);
      history.replaceState(null, "", url);
    }
    document.getElementById("compare-status").textContent = `Comparing ${left.name} and ${right.name}`;
  };
  leftPicker.addEventListener("change", () => render());
  rightPicker.addEventListener("change", () => render());
  window.addEventListener("popstate", () => { readQuery(); render(false); });
  window.addEventListener("pagehide", () => slots.forEach((slot, index) => {
    slot?.owner?.destroy();
    slots[index] = null;
  }));
  window.addEventListener("pageshow", event => { if (event.persisted) { readQuery(); render(false); } });
  readQuery();
  render(false);
});
