import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "pg",
    "@anthropic-ai/sdk",
    "dns",
    "playwright",
    "pino",
    "pino-pretty",
  ],
};

export default nextConfig;
