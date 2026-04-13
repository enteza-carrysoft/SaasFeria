import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();

    const origin = new URL(request.url).origin;
    return NextResponse.redirect(new URL('/login', origin));
}
