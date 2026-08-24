/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required on Next 14 for src/instrumentation.js (auto-migrate on boot).
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig
