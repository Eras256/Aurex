/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable built-in eslint checks since they are completed globally via validation
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
