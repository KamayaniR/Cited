import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moss ships a native in-process search core; keep it out of the bundle.
  serverExternalPackages: ["@moss-js/moss", "@moss-js/moss-core"],
  // The Neo4j schema is read from disk at runtime; ship it with every server function on Vercel.
  outputFileTracingIncludes: { "/**": ["./lib/graph/schema.cypher"] },
};

export default nextConfig;
