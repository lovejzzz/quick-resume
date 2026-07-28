/**
 * Resolves a public-directory path against the deployment base path.
 *
 * Absolute `/…` URLs break the moment the app is served from a subdirectory
 * (project-style GitHub Pages, a reverse proxy). `NEXT_PUBLIC_BASE_PATH` is
 * inlined at build time by the same workflow that sets `basePath`.
 */
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function assetPath(path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalised}`;
}

export const basePath = BASE_PATH;
