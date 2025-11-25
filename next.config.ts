import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co",
      },
      {
        protocol: "https",
        hostname: "image-cdn-ak.spotifycdn.com",
      },
      {
        protocol: "https",
        hostname: "image-cdn-fa.spotifycdn.com",
      },
      {
        protocol: "https",
        hostname: "*.spotifycdn.com",
      },
      {
        protocol: "https",
        hostname: "blend-playlist-covers.spotifycdn.com",
      },
      {
        protocol: "https",
        hostname: "seed-mix-image.spotifycdn.com",
      },
      {
        protocol: "https",
        hostname: "wrapped-images.spotifycdn.com",
      },
      {
        protocol: "https",
        hostname: "lineup-images.scdn.co",
      },
      {
        protocol: "https",
        hostname: "daily-mix.scdn.co",
      },
      {
        protocol: "https",
        hostname: "seeded-session-images.scdn.co",
      },
      {
        protocol: "https",
        hostname: "thisis-images.spotifycdn.com",
      },
    ],
  },
};

export default nextConfig;
