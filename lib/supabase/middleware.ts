import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Content-Security-Policy applied to every response. Uses 'unsafe-inline' for
// script-src (needed by Next's inline bootstrap + the text-size boot script). A
// nonce-based policy was tried but is fragile with Next's cached/prefetched HTML
// (a nonce mismatch silently blocks ALL scripts -> no hydration), so we use this
// robust static policy instead. The value is still real: connect-src / form-action
// / frame-ancestors / object-src / base-uri stay locked down.
function buildCsp(): string {
  return [
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
}

export async function updateSession(request: NextRequest) {
  const csp = buildCsp();

  let response = NextResponse.next({
    request: {
      headers: request.headers,
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
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
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
