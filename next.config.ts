import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Next's dev server refuses /_next/* requests whose Host is not a known dev
   * origin, answering 403 — which silently prevents hydration rather than
   * failing loudly. Playwright drives the app over 127.0.0.1, so it has to be
   * listed alongside localhost. Development only; ignored in production.
   */
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
