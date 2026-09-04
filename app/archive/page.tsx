import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { ArchiveClient } from "./ArchiveClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Archive",
  description: "Review humanoid URDFs in 3D, control their joints, and browse parametric human body models by access and licence.",
};

export default function ArchivePage() {
  return (
    <div className="site-shell">
      <SiteHeader current="archive" />
      <main className="page-wrap wide">
        <div className="page-intro">
          <div><p className="eyebrow">01 · Archive</p><h1>Inspect every model.</h1></div>
          <p>Rotate every hosted robot and body model in 3D, drive joints or pose parameters, and follow each asset to the exact source and licence that governs it.</p>
        </div>
        <ArchiveClient />
      </main>
      <SiteFooter />
    </div>
  );
}
