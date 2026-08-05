import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
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
    request.nextUrl.pathname.startsWith('/api');

  // Deny-by-default: an unauthenticated request to any protected route is
  // redirected to /login. There is no demo/bypass cookie — the database
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

  return response;
}
