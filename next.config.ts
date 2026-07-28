import type { NextConfig } from "next";

/**
 * Quicky Resume is a fully static client-side app, so there is a single build
 * path: `next build` emits a static export in `out/`.
 *
 * `NEXT_PUBLIC_BASE_PATH` lets the same build serve from a subdirectory. It is
 * read by `app/lib/asset-path.ts` too, so runtime `fetch` calls and the service
 * worker scope stay in step with `basePath`.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
