import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // football-data.org serves team crests from this host
      { protocol: "https", hostname: "crests.football-data.org" },
    ],
  },
};

export default nextConfig;
