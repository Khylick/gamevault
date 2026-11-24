import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  logging: { incomingRequests: { ignore: [/^\/auth\/.*\/callback(?:\?|$)/, /^\/auth\/callback(?:\?|$)/] } },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
  experimental: {
    // L’API TypeScript évite de lancer un processus détaché pour lire tsconfig.json.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
