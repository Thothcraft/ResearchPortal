/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  // Enable static exports for full static site generation
  output: 'standalone',
  // Disable TypeScript type checking during build (handled by CI)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build (handled by CI)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
