/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Removido output: 'export' para permitir API routes
  // Ensure proper asset handling for production deployments
  images: {
    unoptimized: true,
  },
  // Enable production optimizations
  poweredByHeader: false,
  compress: true,
};

module.exports = nextConfig;
