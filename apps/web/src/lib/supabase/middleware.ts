import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  // Refresh session — do NOT add logic between createServerClient and getUser
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Protect all /app/* routes except login/signup
  const { pathname } = request.nextUrl;
  const isAppRoute = pathname.startsWith('/app');
  const isAuthRoute = pathname === '/app/login' || pathname === '/app/signup';

  if (isAppRoute && !isAuthRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/app/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login/signup
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/app/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
