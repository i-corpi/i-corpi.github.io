import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { TurntableCard } from "../../components/TurntableCard";
import { MODELS } from "../../lib/models";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Robot gallery",
  description: "A visual gallery of every review-ready humanoid robot in the i corpi archive.",
};

const robots = MODELS.filter((model) => model.kind === "robot" && model.image);

export default function GalleryPage() {
  return (
    <div className="site-shell">
      <SiteHeader current="gallery" />
      <main className="page-wrap wide">
        <section className="page-intro">
          <div><p className="eyebrow">Robot gallery · {String(robots.length).padStart(2, "0")}</p><h1>Every machine,<br />from every side.</h1></div>
          <p>Drag each plate through a 16-angle turntable rendered from the pinned local URDF—not a marketing photograph—then open the model to rotate and control every joint.</p>
        </section>

        <section className="gallery-grid" aria-label="Humanoid robot gallery">
          {robots.map((model, index) => (
            <TurntableCard model={model} index={index} key={model.id} />
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
