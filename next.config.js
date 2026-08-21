/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response. These are the low-risk,
// high-value set (clickjacking, MIME-sniffing, referrer leakage, feature access,
// HTTPS pinning). A full Content-Security-Policy is intentionally NOT set here:
// it must allowlist Cloudflare Turnstile, Supabase, Google Fonts and the inline
// text-size boot script, so it needs careful per-app tuning to avoid breakage.
// NOTE: the Content-Security-Policy is set PER-REQUEST in middleware
// (lib/supabase/middleware.ts) so it can carry a fresh nonce and drop
// 'unsafe-inline'/'unsafe-eval' from script-src in production. The static,
// nonce-independent headers stay here.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  // Only enforced by browsers over HTTPS (ignored on http://localhost).
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
