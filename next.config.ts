import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root has its own lockfile; pin Turbopack's root to this app so it
  // doesn't infer the parent workspace.
  turbopack: { root: __dirname },
  // These packages must never be bundled — they run only on the Node server
  // (API routes): postgres opens raw TCP/TLS sockets, playwright drives a real
  // browser. Keeping them external avoids bundler issues with their dynamic
  // requires and native bindings.
  serverExternalPackages: ["postgres", "playwright", "playwright-core"],
};

export default nextConfig;
