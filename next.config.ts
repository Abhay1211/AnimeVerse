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
      // Saved / Favorites / Continue Watching are unified into /library.
      // Data (the saved/favorites/watch-progress collections) is unchanged;
      // only the routes collapse.
      { source: "/saved", destination: "/library", permanent: false },
      { source: "/favorites", destination: "/library", permanent: false },
      {
        source: "/continue-watching",
        destination: "/library?filter=watching",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
