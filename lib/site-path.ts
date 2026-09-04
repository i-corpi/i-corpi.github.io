const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const basePath = configuredBasePath === "/"
  ? ""
  : `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`.replace(/^\/$/, "");

/**
 * Resolves a file in `public/` from the current deployment root.
 *
 * GitHub project pages are served beneath `/<repository>`, while the Sites
 * deployment is served from `/`. Keeping this at the asset boundary lets the
 * model catalogue use the same source paths in both places.
 */
export const sitePath = (path: string) => {
  if (!path.startsWith("/") || path.startsWith("//") || !basePath) return path;
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
};

export const sitePathMap = (paths?: Record<string, string>) =>
  paths && Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, sitePath(path)]));

/** A clean application route, including the directory form required by Pages. */
export const siteRoute = (path: string) =>
  sitePath(path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`);
