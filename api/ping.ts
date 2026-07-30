import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.status(200).json({
        ok: true,
        env: {
            SUPABASE_URL: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0, 40) : 'NAO_DEFINIDA',
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.slice(0, 25) + '...' : 'NAO_DEFINIDA',
        },
        node_version: process.version
    });
}
