import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
    // Guard: if env vars are missing, skip auth and let pages handle it
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    try {
        const { data: { user } } = await supabase.auth.getUser();

        // Public paths that don't require auth
        const publicPaths = ['/', '/login', '/register', '/auth/callback'];
        const isPublicPath = publicPaths.some(
            (path) => request.nextUrl.pathname === path
        );

        // If user is not authenticated and trying to access protected route
        if (!user && !isPublicPath) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }

        // If user is authenticated and on login/register page, redirect to app
        if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
            const url = request.nextUrl.clone();
            url.pathname = '/app';
            return NextResponse.redirect(url);
        }
    } catch {
        // If Supabase auth fails, let the request through — pages handle auth on their own
        return NextResponse.next({ request });
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)',
    ],
};
