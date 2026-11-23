import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // L’API TypeScript évite de lancer un processus détaché pour lire tsconfig.json.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
