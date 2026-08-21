import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Per-request Content-Security-Policy with a nonce. In PRODUCTION the script-src
// is nonce-based (no 'unsafe-inline'/'unsafe-eval'), so an injected inline script
// can't run. In DEV it stays permissive because Next's HMR needs inline + eval.
// The Turnstile host stays explicitly allow-listed (not via strict-dynamic) so
// the bot-challenge script keeps loading. Next reads the nonce from the CSP on the
// request headers and applies it to its own scripts; our one inline boot script
// (app/layout.tsx) reads it from `x-nonce`.
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' https://challenges.cloudflare.com`
    : "'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
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
}

export async function updateSession(request: NextRequest) {
  // Fresh nonce per request (Edge runtime: btoa is available, Buffer is not).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const nonce = btoa(bin);
  const csp = buildCsp(nonce);

  // Forward the nonce + CSP on the REQUEST headers: Next extracts the nonce from
  // the CSP header to nonce its framework scripts, and app/layout.tsx reads x-nonce.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that skip the page-level session redirect.
  // NOTE: all `/api/*` routes self-authorize (cron via the Bearer secret,
  // user APIs via their own getUser check) and must return JSON, not be
  // redirected to an HTML login page.
  const isPublicRoute =
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname.startsWith('/book') ||
    request.nextUrl.pathname.startsWith('/enroll') ||
    request.nextUrl.pathname.startsWith('/onboarding') ||
    request.nextUrl.pathname.startsWith('/set-password') ||
    request.nextUrl.pathname.startsWith('/api');

  // Deny-by-default: an unauthenticated request to any protected route is
  // redirected to /login. There is no demo/bypass cookie - the database
  // session is the only source of truth for who you are.
  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  // A signed-in user has no reason to sit on the login screen.
  if (user && request.nextUrl.pathname === '/login') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  // Enforce the CSP on the response the browser receives.
  response.headers.set('Content-Security-Policy', csp);
  return response;
}
