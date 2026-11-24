import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moss ships a native in-process search core; keep it out of the bundle.
  serverExternalPackages: ["@moss-js/moss", "@moss-js/moss-core"],
};

export default nextConfig;
