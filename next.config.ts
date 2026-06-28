import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Playwright (Node.js-only) from being bundled for browser/edge runtimes
  serverExternalPackages: ['playwright', 'playwright-core'],
};

export default nextConfig;
