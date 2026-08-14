import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const results: Record<string, string> = {};
    
    try {
        const express = await import('express');
        results['express'] = 'OK - ' + (typeof express.default);
    } catch (e: any) {
        results['express'] = 'ERRO: ' + e.message;
    }
    
    try {
        const multer = await import('multer');
        results['multer'] = 'OK - ' + (typeof multer.default);
    } catch (e: any) {
        results['multer'] = 'ERRO: ' + e.message;
    }
    
    try {
        const { createClient } = await import('@supabase/supabase-js');
        results['supabase'] = 'OK - ' + (typeof createClient);
    } catch (e: any) {
        results['supabase'] = 'ERRO: ' + e.message;
    }
    
    results['status'] = 'OK';
    results['timestamp'] = new Date().toISOString();

    res.status(200).json({ modules: results });
}
