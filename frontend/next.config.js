/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/2026/08/Person',
        destination: '/2026/08/Person.html',
      },
      {
        source: '/2026/08/DataSet',
        destination: '/2026/08/DataSet.html',
      },
      {
        source: '/2026/08/DatabaseSchema',
        destination: '/2026/08/DatabaseSchema.html',
      },
      {
        source: '/2026/08/type',
        destination: '/2026/08/type.html',
      },
      {
        source: '/2026/08/name',
        destination: '/2026/08/name.html',
      },
      {
        source: '/2026/08/description',
        destination: '/2026/08/description.html',
      },
      {
        source: '/2026/08/database-schema',
        destination: '/2026/08/database-schema.html',
      },
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
