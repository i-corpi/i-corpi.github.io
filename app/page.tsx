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

// One plate per hosted render: every robot package, then a single body-model
// plate for the SMPL family, whose weights stay with the rights holder.
const showcase = [
  ...MODELS.filter((model) => model.kind === "robot" && model.image),
  MODELS.find((model) => model.id === "smpl")!,
];
const robotCount = MODELS.filter((model) => model.kind === "robot").length;
const bodyCount = MODELS.filter((model) => model.kind === "body").length;

export default function Home() {
  return (
    <div className="site-shell">
      <SiteHeader />

      <main>
        <section className="home-lede">
          <h1>Humanoid models,<br />clearly indexed.</h1>
          <p>{MODELS.length} records · {robotCount} robots · {bodyCount} bodies</p>
        </section>

        <section className="showcase" aria-label="Model index">
          <div className="showcase-grid">
            {showcase.map((model) => (
              <a className="showcase-card" key={model.id} href={`${siteRoute("/archive")}#${model.id}`}>
                <ModelThumb model={model} />
                <h2>{model.name}</h2>
                <p>{model.maker}</p>
              </a>
            ))}
            <a className="showcase-all" href={siteRoute("/archive")}>
              <span>Archive</span>
              <b>All {MODELS.length} records →</b>
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
