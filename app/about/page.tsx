import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { MODELS } from "../../lib/models";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About",
  description: "How i corpi handles model provenance, local mirrors, formats, and restricted body-model weights.",
};

export default function AboutPage() {
  return (
    <div className="site-shell">
      <SiteHeader current="about" />
      <main className="page-wrap about-wrap">
        <div className="page-intro">
          <div><p className="eyebrow">03 · About</p><h1>Models need context.</h1></div>
          <p>Geometry without its source, version, and licence is not an archive. This project treats provenance as part of the model.</p>
        </div>

        <section className="about-lede">
          <p>i corpi is a small source-first index for two model cultures that increasingly meet in embodied AI: physical humanoid robot descriptions and statistical human body models.</p>
          <p>They belong in the same search surface, but not under the same assumptions. A BSD URDF can often be mirrored. A registered SMPL weight file generally cannot.</p>
        </section>

        <section className="method-grid" aria-label="Archive method">
          <article><span>01</span><h2>Pin the source.</h2><p>Every record points to the project or rights holder, not an untraceable re-upload. Local packages should record an upstream revision.</p></article>
          <article><span>02</span><h2>Keep exact terms.</h2><p>Licence labels follow the individual asset package. Code, meshes, model weights, and exported bodies can carry different permissions.</p></article>
          <article><span>03</span><h2>Do not flatten formats.</h2><p>URDF, MJCF, USD, FBX, NPZ, and PKL encode different combinations of kinematics, dynamics, geometry, and parameters.</p></article>
          <article><span>04</span><h2>Name the unknown.</h2><p>Not applicable and not published are distinct from zero. Cross-domain comparisons explain where a metric changes meaning.</p></article>
        </section>

        <section className="ledger-section">
          <div className="ledger-head"><div><p className="eyebrow">Asset ledger</p><h2>The first collection.</h2></div><p>“Public source” means the upstream project exposes a model package. It does not imply that this archive may relicense it.</p></div>
          <div className="ledger-table" role="table" aria-label="Asset ledger">
            <div className="ledger-row heading" role="row"><span role="columnheader">Model</span><span role="columnheader">Kind</span><span role="columnheader">Formats</span><span role="columnheader">Licence</span><span role="columnheader">Access</span></div>
            {MODELS.map((model) => (
              <div className="ledger-row" role="row" key={model.id}>
                <strong role="cell"><a href={model.sourceUrl} target="_blank" rel="noreferrer">{model.name} ↗</a></strong>
                <span role="cell">{model.kind === "robot" ? "Robot" : "Body"}</span>
                <span role="cell">{model.formats.join(" · ")}</span>
                <span role="cell">{model.license}</span>
                <span role="cell">{model.accessLabel}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="add-model">
          <div><p className="eyebrow">Repository convention</p><h2>Adding a local model.</h2></div>
          <div>
            <p>Place redistributable assets under <code>public/models/&lt;id&gt;/</code>. Keep the upstream licence, a source record, and the original model structure together.</p>
            <ol>
              <li><code>model.urdf</code>, <code>model.xml</code>, or a primary <code>.usd</code> entry point</li>
              <li><code>meshes/</code> and textures using relative paths</li>
              <li><code>LICENSE</code> copied from the exact upstream package</li>
              <li><code>SOURCE.md</code> with URL, revision, date, and every transformation</li>
            </ol>
            <p>Never place account-gated SMPL-family weights in the public tree. Add metadata and an official download link instead.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
