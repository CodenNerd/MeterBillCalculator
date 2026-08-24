/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required on Next 14 for src/instrumentation.js (local auto-migrate).
  experimental: {
    instrumentationHook: true,
    // Keep migrate assets in serverless traces (fallback cold-start migrate).
    outputFileTracingIncludes: {
      '/*': [
        './supabase-bootstrap.sql',
        './scripts/run-migrations.mjs',
        './src/lib/dbMigrate.mjs',
      ],
    },
  },
}

export default nextConfig
