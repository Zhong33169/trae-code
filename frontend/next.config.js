/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    backendPort: process.env.BACKEND_PORT || '8080',
  },
  publicRuntimeConfig: {
    backendPort: process.env.BACKEND_PORT || '8080',
  },
  async rewrites() {
    const backendPort = process.env.BACKEND_PORT || '8080';
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${backendPort}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
