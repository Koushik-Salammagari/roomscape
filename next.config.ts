import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets an open tab notice that a newer version is live and reload itself.
  env: { NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7) },
};

export default nextConfig;
