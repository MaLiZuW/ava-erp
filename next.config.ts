import type { NextConfig } from "next";

// Static export for shared hosting (Apache, no Node.js) – see CLAUDE.md.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
