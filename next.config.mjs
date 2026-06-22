/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Don't block production builds on lint errors. Many Vercel deploys
    // fail on minor warnings (unescaped quotes, unused vars). Run `npm run lint`
    // locally or via CI instead.
    ignoreDuringBuilds: true,
  },
  images: {
    domains: [
      "avatars.githubusercontent.com",
      "lh3.googleusercontent.com",
      "media.licdn.com",
      "res.cloudinary.com",
      "supabase.co",
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
      // Increase body size limit to handle resume file uploads (PDF/DOCX up to 10MB)
      bodySizeLimit: '10mb',
    },
  },
  // Tell webpack not to bundle pdfjs-dist — it loads at runtime in Node.js serverless
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        'pdfjs-dist',
        'canvas',
      ];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ],
      },
    ]
  },
};

export default nextConfig;
