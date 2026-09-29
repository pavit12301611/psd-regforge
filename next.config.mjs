import { resolveEnv } from './lib/resolve-env.mjs';

// Resolved once at build time and inlined into the client bundle.
// See lib/resolve-env.mjs for every accepted way of providing the keys.
const resolved = resolveEnv(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_REGFORGE_ENV: JSON.stringify(resolved),
  },
  // Dev server is reached through the sandbox preview proxy, so allow those hosts.
  allowedDevOrigins: [
    '*.e2b.app',
    '*.arena.ai',
    '*.onarena.ai',
    '*.vercel.app',
    'localhost',
  ],
};

export default nextConfig;
