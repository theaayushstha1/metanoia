import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small Cloud Run container image.
  output: "standalone",
};

export default nextConfig;
