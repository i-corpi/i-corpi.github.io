import { siteRoute, sitePath } from "../lib/site-path";
import { MODELS, type ModelRecord } from "../lib/models";

export function SiteHeader({ current }: { current?: "archive" | "gallery" | "compare" | "about" }) {
  return (
    <header className="topbar">
      <a className="brand" href={siteRoute("/")} aria-label="i corpi home">
        <span className="brand-dot" aria-hidden="true" />
        <span>i corpi</span>
        <span className="brand-count">{String(MODELS.length).padStart(2, "0")}</span>
      </a>
      <nav aria-label="Main navigation">
        <a className={current === "archive" ? "active" : ""} href={siteRoute("/archive")}>Archive</a>
        <a className={current === "gallery" ? "active" : ""} href={siteRoute("/gallery")}>Gallery</a>
        <a className={current === "compare" ? "active" : ""} href={siteRoute("/compare")}>Compare</a>
        <a className={current === "about" ? "active" : ""} href={siteRoute("/about")}>About</a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <span><i /> i corpi</span>
      <p>Every file keeps its own licence and provenance.</p>
      <p>Independent archive · 2026</p>
    </footer>
  );
}

export function ModelFigure({ kind, index, compact = false }: { kind: "robot" | "body"; index: number; compact?: boolean }) {
  return (
    <div className={`figure ${kind === "body" ? "body" : "robot"}${compact ? " compact" : ""}`} aria-hidden="true">
      <span className="head" /><span className="torso" /><span className="arm left" />
      <span className="arm right" /><span className="leg left" /><span className="leg right" />
      <b>{String(index + 1).padStart(2, "0")}</b>
    </div>
  );
}

/**
 * A featured-card visual: the model's own rendered gallery plate when one is
 * pinned locally, falling back to the abstract ModelFigure silhouette for
 * records with no hosted asset (e.g. account-gated SMPL-family bodies).
 */
export function ModelThumb({ model, index, compact = false }: { model: ModelRecord; index: number; compact?: boolean }) {
  if (!model.image) return <ModelFigure kind={model.kind} index={index} compact={compact} />;
  return (
    <div className={`figure ${model.kind === "body" ? "body" : "robot"} has-image${compact ? " compact" : ""}`} aria-hidden="true">
      <img src={sitePath(model.image)} alt="" loading="lazy" />
      <b>{String(index + 1).padStart(2, "0")}</b>
    </div>
  );
}
