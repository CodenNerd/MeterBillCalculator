/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required on Next 14 for src/instrumentation.js (local auto-migrate).
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    // Keep migrate assets + Chromium binaries in serverless traces.
    outputFileTracingIncludes: {
      '/*': [
        './supabase-bootstrap.sql',
        './scripts/run-migrations.mjs',
        './src/lib/dbMigrate.mjs',
        './node_modules/@sparticuz/chromium/**/*',
      ],
    },
  },
}

export default nextConfig
