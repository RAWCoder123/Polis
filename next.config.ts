import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Worktrees sit inside another checkout; never resolve from its lockfile.
  turbopack: { root: process.cwd() },
  // Sign-in links shared while Polis ran on OpenAI Sites. Query strings,
  // including return_to, carry over.
  async redirects() {
    return [
      { source: "/signin-with-chatgpt", destination: "/sign-in", permanent: false },
      { source: "/signout-with-chatgpt", destination: "/sign-out", permanent: false },
    ];
  },
};

export default nextConfig;
