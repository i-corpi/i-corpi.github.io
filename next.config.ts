import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

// The standard deployment remains a Cloudflare Worker. GitHub Pages receives
// a fully static export from the same routes and assets. The Vite `base`
// setting handles the repository path because Vinext's exporter renders its
// internal routes from `/` during the build.
const nextConfig: NextConfig = isGitHubPages
  ? {
    output: "export",
      trailingSlash: false,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
