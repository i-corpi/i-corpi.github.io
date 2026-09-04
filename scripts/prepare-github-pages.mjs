import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = "dist/client";
const routes = ["about", "archive", "compare", "gallery"];

// Vinext emits extensionless route files as `<route>.html`. GitHub Pages
// serves clean route URLs from `<route>/index.html`, so retain the original
// file and add the directory form used by the app links.
await Promise.all(routes.map(async (route) => {
  const routeDirectory = join(outputDirectory, route);
  await mkdir(routeDirectory, { recursive: true });
  await copyFile(join(outputDirectory, `${route}.html`), join(routeDirectory, "index.html"));
}));
