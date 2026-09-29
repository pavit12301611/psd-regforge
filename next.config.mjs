/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
