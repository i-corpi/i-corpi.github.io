import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { CompareClient } from "./CompareClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Compare",
  description: "Compare humanoid robot descriptions and human body models side by side.",
};

export default function ComparePage() {
  return (
    <div className="site-shell">
      <SiteHeader current="compare" />
      <main className="page-wrap">
        <div className="page-intro">
          <div><p className="eyebrow">02 · Compare</p><h1>Line up two bodies.</h1></div>
          <p>Compare machine kinematics with machine kinematics, body topology with body topology—or cross the boundary to see where the concepts stop mapping cleanly.</p>
        </div>
        <CompareClient />
      </main>
      <SiteFooter />
    </div>
  );
}
