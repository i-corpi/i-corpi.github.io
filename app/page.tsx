import type { Metadata } from "next";
import { ModelThumb, SiteFooter, SiteHeader } from "../components/SiteChrome";
import { MODELS } from "../lib/models";
import { siteRoute } from "../lib/site-path";

// All page data is checked into the repository; interactivity hydrates on the client.
export const dynamic = "force-static";

export const metadata: Metadata = {
  description:
    "A source-first archive for humanoid robot descriptions and parametric human body models.",
};

const featuredIds = ["unitree-g1", "unitree-h1", "smpl", "smpl-x"];
const featured = featuredIds.map((id) => MODELS.find((model) => model.id === id)!);
const robotCount = MODELS.filter((model) => model.kind === "robot").length;
const bodyCount = MODELS.filter((model) => model.kind === "body").length;
const reviewReadyCount = MODELS.filter((model) => model.hostedPath).length;

export default function Home() {
  return (
    <div className="site-shell">
      <SiteHeader />

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">The open embodied model index</p>
            <h1>Humanoid models,<br />clearly indexed.</h1>
            <p className="lede">
              A practical home for robot descriptions and parametric human bodies—formats,
              topology, licences, source files, and usage constraints in one place.
            </p>
            <div className="actions">
              <a className="button primary" href={siteRoute("/archive")}>Browse the archive</a>
              <a className="button" href={siteRoute("/about")}>Read the method</a>
            </div>
          </div>

          <dl className="coverage" aria-label="Archive coverage">
            <div><dt>Entries</dt><dd>{String(MODELS.length).padStart(2, "0")}</dd><span>{robotCount} robots · {bodyCount} bodies</span></div>
            <div><dt>Review ready</dt><dd>{String(reviewReadyCount).padStart(2, "0")}</dd><span>interactive URDF packages</span></div>
            <div><dt>Public source</dt><dd>{String(robotCount).padStart(2, "0")}</dd><span>licence-visible robot packages</span></div>
            <div><dt>Restricted</dt><dd>04</dd><span>source-gated downloads</span></div>
          </dl>
        </section>

        <section className="featured" aria-labelledby="featured-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">A mixed archive</p>
              <h2 id="featured-title">Machines and bodies,<br />without blurred licences.</h2>
            </div>
            <p>Robot packages can be mirrored when their licences permit it. SMPL-family weights stay at their official source when access terms prohibit redistribution.</p>
          </div>
          <div className="model-grid">
            {featured.map((model, index) => (
              <article className="model-card" key={model.name}>
                <ModelThumb model={model} index={index} />
                <div className="card-meta"><span>{model.kind === "robot" ? "Robot" : "Body"} · {model.formats[0]}</span><span>{model.accessLabel}</span></div>
                <h3>{model.name}</h3>
                <p>{model.maker} · {model.joints} joints</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-routes" aria-label="Explore i corpi">
          <a href={siteRoute("/archive")}><span className="eyebrow">01 · Archive</span><h2>Inspect every model.</h2><p>Rotate hosted URDFs, drive every movable joint, and verify exact licence terms.</p><b>Open archive →</b></a>
          <a href={siteRoute("/gallery")}><span className="eyebrow">02 · Gallery</span><h2>See every robot.</h2><p>Browse a consistent image plate rendered directly from each pinned URDF.</p><b>Open gallery →</b></a>
          <a href={siteRoute("/compare")}><span className="eyebrow">03 · Compare</span><h2>Line up two bodies.</h2><p>Compare two robots, two parametric bodies, or cross domains carefully.</p><b>Start comparing →</b></a>
          <a href={siteRoute("/about")}><span className="eyebrow">04 · About</span><h2>Read the asset rules.</h2><p>See the provenance ledger and the convention for adding local packages.</p><b>Read the method →</b></a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
