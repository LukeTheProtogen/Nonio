import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev: login OAuth e cookies usam 127.0.0.1; sem isto o HMR/cliente quebra
  // e botões que dependem só de onClick parecem mortos.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
