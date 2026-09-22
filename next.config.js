/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  // Enable static exports for full static site generation
  output: 'standalone',
  typescript: {
    // Type errors fail the build — fix them, don't hide them.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Lint errors fail the build.
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
