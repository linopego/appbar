import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // I markdown legali vengono letti da filesystem a runtime: vanno inclusi
  // esplicitamente nel bundle serverless (file tracing).
  outputFileTracingIncludes: {
    "/privacy": ["./content/legal/*.md"],
    "/termini": ["./content/legal/*.md"],
  },
};

export default nextConfig;
