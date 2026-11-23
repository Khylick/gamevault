import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // L’API TypeScript évite de lancer un processus détaché pour lire tsconfig.json.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
