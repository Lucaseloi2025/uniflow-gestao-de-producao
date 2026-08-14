import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const errors: string[] = [];
    const ok: string[] = [];

    try {
        await import('express');
        ok.push('express');
    } catch (e: any) { errors.push('express: ' + e.message); }

    try {
        await import('multer');
        ok.push('multer');
    } catch (e: any) { errors.push('multer: ' + e.message); }

    try {
        await import('dotenv');
        ok.push('dotenv');
    } catch (e: any) { errors.push('dotenv: ' + e.message); }

    try {
        await import('@supabase/supabase-js');
        ok.push('supabase-js');
    } catch (e: any) { errors.push('supabase-js: ' + e.message); }

    try {
        await import('./lib/lossStore.js');
        ok.push('lossStore.js');
    } catch (e1: any) {
        try {
            await import('./lib/lossStore.ts');
            ok.push('lossStore.ts');
        } catch (e2: any) {
            errors.push('lossStore.js: ' + e1.message);
            errors.push('lossStore.ts: ' + e2.message);
        }
    }

    res.status(200).json({ ok, errors, nodeVersion: process.version, env: { hasSupabaseUrl: !!process.env.SUPABASE_URL, hasAnonKey: !!process.env.SUPABASE_ANON_KEY } });
}
