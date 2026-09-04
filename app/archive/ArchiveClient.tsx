"use client";

import { useEffect, useMemo, useState } from "react";
import { BodyModelViewer } from "../../components/BodyModelViewer";
import { ModelFigure } from "../../components/SiteChrome";
import { URDFViewer } from "../../components/URDFViewer";
import { MODELS, accessTone, displayValue, type ModelKind } from "../../lib/models";
import { sitePath, sitePathMap } from "../../lib/site-path";

type Filter = "all" | ModelKind;

export function ArchiveClient() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(MODELS.find((model) => model.hostedPath)?.id ?? MODELS[0].id);

  useEffect(() => {
    const selectHash = () => {
      const id = window.location.hash.slice(1);
      if (MODELS.some((model) => model.id === id)) setSelectedId(id);
    };
    selectHash();
    window.addEventListener("hashchange", selectHash);
    return () => window.removeEventListener("hashchange", selectHash);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MODELS.filter((model) => {
      const kindMatch = filter === "all" || model.kind === filter;
      const textMatch = !needle || [model.name, model.maker, model.family, ...model.formats]
        .join(" ").toLowerCase().includes(needle);
      return kindMatch && textMatch;
    });
  }, [query, filter]);

  const selected = MODELS.find((model) => model.id === selectedId) ?? filtered[0] ?? MODELS[0];
  const selectedIndex = MODELS.findIndex((model) => model.id === selected.id);
  const assetUrl = selected.hostedPath ? sitePath(selected.hostedPath) : selected.modelUrl;
  const licenseUrl = selected.access === "local" ? sitePath(selected.licenseUrl) : selected.licenseUrl;

  return (
    <section className="archive-shell" aria-label="Model archive">
      <aside className="archive-list">
        <div className="list-tools">
          <label htmlFor="model-search">Search models</label>
          <input id="model-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, maker, or format" />
          <div className="filter-chips" aria-label="Filter by model type">
            {(["all", "robot", "body"] as Filter[]).map((value) => (
              <button className={filter === value ? "selected" : ""} key={value} onClick={() => setFilter(value)} type="button">
                {value === "all" ? "All" : value === "robot" ? "Robots" : "Body models"}
              </button>
            ))}
          </div>
          <p>{filtered.length} of {MODELS.length} records</p>
        </div>
        <div className="record-list">
          {filtered.length ? filtered.map((model) => (
            <button className={`record-button ${model.id === selected.id ? "active" : ""}`} key={model.id} onClick={() => {
              setSelectedId(model.id);
              window.history.replaceState(null, "", `#${model.id}`);
            }} type="button">
              <span className={`kind-pip ${model.kind}`} aria-hidden="true" />
              <span><strong>{model.name}</strong><small>{model.maker}</small></span>
              <em>{model.formats[0]}</em>
            </button>
          )) : <p className="empty-list">No records match this search.</p>}
        </div>
      </aside>

      <article className="model-detail" aria-live="polite">
        <div className="detail-title">
          <div><p className="eyebrow">{selected.kind === "robot" ? "Humanoid robot" : "Parametric body"}</p><h2>{selected.name}</h2><p>{selected.maker} · {selected.country} · {selected.year}</p></div>
          <div className="badges"><span>{selected.formats.join(" · ")}</span><span className={accessTone(selected.access)}>{selected.accessLabel}</span></div>
        </div>
        <p className="detail-tagline">{selected.tagline}</p>

        <dl className="quick-stats">
          <div><dt>{selected.kind === "robot" ? "Actuated DoF" : "Pose DoF"}</dt><dd>{displayValue(selected.dof)}</dd></div>
          <div><dt>Joints</dt><dd>{displayValue(selected.joints)}</dd></div>
          <div><dt>{selected.kind === "robot" ? "Height" : "Vertices"}</dt><dd>{selected.kind === "robot" ? displayValue(selected.heightM, " m") : displayValue(selected.vertices)}</dd></div>
          <div><dt>{selected.kind === "robot" ? "Mass" : "Shape space"}</dt><dd>{selected.kind === "robot" ? displayValue(selected.weightKg, " kg") : (selected.parameters ?? "Not published")}</dd></div>
          <div><dt>Licence</dt><dd>{selected.license}</dd></div>
        </dl>

        <div className={`detail-grid ${selected.kind === "body" || (selected.hostedPath && selected.formats.includes("URDF")) ? "review-ready" : ""}`}>
          {selected.kind === "body" ? (
            <BodyModelViewer model={selected} key={selected.id} />
          ) : selected.hostedPath && selected.formats.includes("URDF") ? (
            <URDFViewer src={sitePath(selected.hostedPath)} name={selected.name} packages={sitePathMap(selected.packageMap)} />
          ) : (
            <div className="preview-fallback">
              <ModelFigure kind={selected.kind} index={selectedIndex} />
              <p>{selected.access === "restricted" ? "Model weights stay with the rights holder." : "Interactive view will appear when a local package is pinned."}</p>
            </div>
          )}
          <div className="asset-panel">
            <p className="eyebrow">Asset record</p>
            <h3>{selected.access === "restricted" ? "Kept with the rights holder." : selected.access === "local" ? "Hosted in this archive." : "Public model source."}</h3>
            <p>{selected.note}</p>
            <div className="asset-actions">
              <a className="button primary" href={assetUrl} download={selected.access === "local" ? true : undefined} target={selected.access === "local" ? undefined : "_blank"} rel={selected.access === "local" ? undefined : "noreferrer"}>{selected.access === "restricted" ? "Open official download" : selected.access === "local" ? "Download local URDF" : "Open model source"}</a>
              <a className="text-link" href={licenseUrl} target={selected.access === "local" ? undefined : "_blank"} rel={selected.access === "local" ? undefined : "noreferrer"}>Read exact licence {selected.access === "local" ? "→" : "↗"}</a>
            </div>
            <dl className="asset-ledger">
              <div><dt>Primary format</dt><dd>{selected.formats[0]}</dd></div>
              <div><dt>Variants</dt><dd>{selected.variants}</dd></div>
              <div><dt>Archive policy</dt><dd>{selected.access === "restricted" ? "Metadata only · no model weights" : selected.access === "local" ? "Pinned local package" : "Eligible for a pinned local mirror"}</dd></div>
              <div><dt>Evidence</dt><dd><a href={selected.sourceUrl} target="_blank" rel="noreferrer">Pinned project source ↗</a></dd></div>
            </dl>
          </div>
        </div>
      </article>
    </section>
  );
}
