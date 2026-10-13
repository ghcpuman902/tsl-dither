import type { NextConfig } from "next";
import path from "node:path";

const emptyModule = path.resolve(__dirname, "src/lib/empty-module.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "onnxruntime-node", "onnxruntime-web"],
  turbopack: {
    resolveAlias: {
      "onnxruntime-node": emptyModule,
      sharp: emptyModule,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node$": emptyModule,
      sharp$: emptyModule,
    };
    // onnxruntime-web ships .mjs/.wasm that the bundler should leave alone.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
