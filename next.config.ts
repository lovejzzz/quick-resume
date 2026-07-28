import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "quick-resume";
const pagesBasePath =
  process.env.GITHUB_PAGES_BASE_PATH ?? `/${repositoryName}`;

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        assetPrefix: pagesBasePath,
        basePath: pagesBasePath,
        images: { unoptimized: true },
        output: "export" as const,
        trailingSlash: true,
        typescript: { tsconfigPath: "tsconfig.pages.json" },
      }
    : {}),
};

export default nextConfig;
