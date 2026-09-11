document.addEventListener("DOMContentLoaded", () => {
  const { asset, models } = window.ICorpi;
  const records = new Map(models().map((model) => [model.id, model]));
  const list = document.getElementById("record-list");
  const search = document.getElementById("model-search");
  const count = document.getElementById("record-count");
  const status = document.getElementById("archive-status");
  const filters = [...document.querySelectorAll("[data-filter]")];
  let navigation;
  let filter = "all";
  let version = 0;

  const applyFilter = (save = true) => {
    const needle = search.value.trim().toLowerCase();
    let visible = 0;
    list.querySelectorAll("[data-model-id]").forEach((link) => {
      const model = records.get(link.dataset.modelId);
      const text = [model.name, model.maker, model.family, ...model.formats].join(" ").toLowerCase();
      link.hidden = !((filter === "all" || model.kind === filter) && (!needle || text.includes(needle)));
      if (!link.hidden) visible += 1;
    });
    filters.forEach((button) => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    count.textContent = `${visible} of ${records.size} records`;
    document.getElementById("record-empty").hidden = visible > 0;
    if (save) {
      const url = new URL(location.href);
      if (needle) url.searchParams.set("q", search.value); else url.searchParams.delete("q");
      if (filter !== "all") url.searchParams.set("kind", filter); else url.searchParams.delete("kind");
      history.replaceState(null, "", url);
    }
  };
  const restoreFilter = () => {
    const params = new URL(location.href).searchParams;
    search.value = params.get("q") || "";
    filter = ["robot", "body", "character"].includes(params.get("kind")) ? params.get("kind") : "all";
    applyFilter(false);
  };

  const navigate = async (target, historyMode = "push") => {
    navigation?.abort();
    navigation = new AbortController();
    const token = ++version;
    const detail = document.getElementById("model-detail");
    document.dispatchEvent(new Event("icorpi:record-changing"));
    detail.setAttribute("aria-busy", "true");
    status.textContent = "Opening model…";
    try {
      const response = await fetch(target, { signal: navigation.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = new DOMParser().parseFromString(await response.text(), "text/html");
      const next = page.getElementById("model-detail");
      if (!next || !records.has(next.dataset.modelId)) throw new Error("Invalid record page");
      if (token !== version) return;
      detail.replaceWith(document.importNode(next, true));
      document.title = page.title;
      document.querySelector(".page-intro h1").textContent = page.querySelector(".page-intro h1").textContent;
      for (const selector of ['link[rel="canonical"]', 'meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]', 'meta[property="og:image"]']) {
        const old = document.querySelector(selector);
        const fresh = page.querySelector(selector);
        if (old && fresh) old.replaceWith(document.importNode(fresh, true));
      }
      list.querySelectorAll("[data-model-id]").forEach((link) => {
        const selected = link.dataset.modelId === next.dataset.modelId;
        link.classList.toggle("active", selected);
        if (selected) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
      });
      if (historyMode === "push") history.pushState(null, "", target);
      if (historyMode === "replace") history.replaceState(null, "", target);
      restoreFilter();
      status.textContent = `${records.get(next.dataset.modelId).name} selected`;
      document.dispatchEvent(new Event("icorpi:record-changed"));
    } catch (error) {
      if (token !== version || error.name === "AbortError") return;
      status.textContent = "The model page could not load. Check your connection and select it again.";
      document.dispatchEvent(new Event("icorpi:record-changed"));
    } finally {
      if (token === version) document.getElementById("model-detail").removeAttribute("aria-busy");
    }
  };
  list.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-model-id]");
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = new URL(link.href);
    target.search = location.search;
    navigate(target);
  });
  search.addEventListener("input", () => applyFilter());
  filters.forEach((button) => button.addEventListener("click", () => {
    filter = button.dataset.filter;
    applyFilter();
  }));
  window.addEventListener("popstate", () => navigate(location.href, "none"));
  window.addEventListener("pagehide", () => navigation?.abort());
  const legacyHash = () => {
    const id = location.hash.slice(1);
    if (records.has(id)) navigate(asset(`/archive/${id}/`) + location.search, "replace");
  };
  window.addEventListener("hashchange", legacyHash);
  restoreFilter();
  legacyHash();
});
