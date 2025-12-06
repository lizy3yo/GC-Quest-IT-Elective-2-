import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  // Server-side packages that should not be bundled
  serverExternalPackages: ["mongoose", "mammoth", "pdf-parse", "iconv-lite", "bcrypt"],
  
  // Environment variables
  env: {
    MONGO_URI: process.env.MONGO_URI,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  },
  
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
    // Enable image optimization
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  // Compression
  compress: true,

  // Production optimizations
  productionBrowserSourceMaps: false,

  // Headers for caching and security
  async headers() {
    return [
      {
        // Static assets caching
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes - no caching by default
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Redirects for common patterns
  async redirects() {
    return [
      {
        source: '/student',
        destination: '/student_page/dashboard',
        permanent: true,
      },
      {
        source: '/teacher',
        destination: '/teacher_page/dashboard',
        permanent: true,
      },
      {
        source: '/login',
        destination: '/auth/login',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
