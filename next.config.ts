import type { NextConfig } from "next";

const noindex = [{ key: "X-Robots-Tag", value: "noindex" }];

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // RF-33: el panel y su API no se indexan.
  async headers() {
    return [
      { source: "/adminpanel/:path*", headers: noindex },
      { source: "/api/admin/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
