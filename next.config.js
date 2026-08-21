/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response. These are the low-risk,
// high-value set (clickjacking, MIME-sniffing, referrer leakage, feature access,
// HTTPS pinning). A full Content-Security-Policy is intentionally NOT set here:
// it must allowlist Cloudflare Turnstile, Supabase, Google Fonts and the inline
// text-size boot script, so it needs careful per-app tuning to avoid breakage.
// Content-Security-Policy tuned for this app's real dependencies:
//   - Supabase (data + realtime websocket): https/wss *.supabase.co
//   - Cloudflare Turnstile: script + iframe from challenges.cloudflare.com
//   - Fonts: self-hosted by next/font (no external), google domains allowed as a
//     harmless safety net
//   - 'unsafe-inline' (the text-size boot script + Next inline bootstrap) and
//     'unsafe-eval' (needed by Next dev HMR) keep it from breaking the app; the
//     value is still real because connect-src / form-action / frame-ancestors /
//     object-src / base-uri are locked down (limits data exfiltration + clickjacking).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
