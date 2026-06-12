/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverPort: 3107,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8107/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
