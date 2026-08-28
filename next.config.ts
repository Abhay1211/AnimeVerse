import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The old catalogue lives at /browse now.
      {
        source: "/anime/browse",
        destination: "/browse",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
