import type { NextConfig } from "next";

// Static export for shared hosting (Apache, no Node.js) – see CLAUDE.md.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // dev only: the Next.js indicator sits bottom-right, away from "Nastavenia" pinned bottom-left
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
