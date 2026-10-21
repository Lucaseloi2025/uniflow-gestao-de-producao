import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import app, { supabaseAdmin } from '../api/index';

describe('Validação de Upload de Imagens/Fichas nos Pedidos', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. Deve rejeitar upload sem autenticação com 401 UNAUTHENTICATED', async () => {
    const formData = new FormData();
    const blob = new Blob(['conteudo'], { type: 'image/png' });
    formData.append('art_files', blob, 'foto.png');

    const res = await fetch(`${baseUrl}/api/orders/3173/images`, {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHENTICATED');
  });

  it('2. Deve permitir que Operador faça upload de imagens anexas no pedido', async () => {
    vi.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'uuid-op-1', email: 'op@teste.com' } as any },
      error: null,
    });

    vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 10, email: 'op@teste.com', role: 'Operador', active: 1, auth_user_id: 'uuid-op-1' },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 3173, art_urls: ['https://old.url/art.jpg'], art_url: 'https://old.url/art.jpg' }, error: null }),
            }),
          }),
          update: (updates: any) => ({
            eq: async () => {
              expect(updates.art_urls).toHaveLength(2);
              expect(updates.art_url).toBe('https://old.url/art.jpg');
              return { error: null };
            },
          }),
        } as any;
      }
      return {} as any;
    });

    vi.spyOn(supabaseAdmin.storage, 'from').mockImplementation(() => ({
      upload: async () => ({ data: { path: 'pedidos/nova-foto.png' }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://storage/pedidos/nova-foto.png' } }),
    } as any));

    const formData = new FormData();
    const blob = new Blob(['foto operador'], { type: 'image/png' });
    formData.append('art_files', blob, 'foto-operador.png');

    const res = await fetch(`${baseUrl}/api/orders/3173/images`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid.op.jwt',
      },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.art_urls).toContain('https://storage/pedidos/nova-foto.png');
    expect(body.art_url).toBe('https://old.url/art.jpg');
  });

  it('3. Deve permitir que Administrador faça upload de novas imagens', async () => {
    vi.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'uuid-admin-1', email: 'admin@teste.com' } as any },
      error: null,
    });

    vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 1, email: 'admin@teste.com', role: 'Administrador', active: 1, auth_user_id: 'uuid-admin-1' },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 3173, art_urls: [] }, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        } as any;
      }
      return {} as any;
    });

    vi.spyOn(supabaseAdmin.storage, 'from').mockImplementation(() => ({
      upload: async () => ({ data: { path: 'pedidos/admin-art.pdf' }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://storage/pedidos/admin-art.pdf' } }),
    } as any));

    const formData = new FormData();
    const blob = new Blob(['pdf design'], { type: 'application/pdf' });
    formData.append('art_files', blob, 'admin-art.pdf');

    const res = await fetch(`${baseUrl}/api/orders/3173/images`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid.admin.jwt',
      },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.art_urls).toEqual(['https://storage/pedidos/admin-art.pdf']);
    expect(body.art_url).toBe('https://storage/pedidos/admin-art.pdf');
  });

  it('4. Deve bloquear perfil Visualização de anexar imagens', async () => {
    vi.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'uuid-vis-1', email: 'vis@teste.com' } as any },
      error: null,
    });

    vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 99, email: 'vis@teste.com', role: 'Visualização', active: 1, auth_user_id: 'uuid-vis-1' },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const formData = new FormData();
    const blob = new Blob(['imagem teste'], { type: 'image/png' });
    formData.append('art_files', blob, 'tentativa.png');

    const res = await fetch(`${baseUrl}/api/orders/3173/images`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid.vis.jwt',
      },
      body: formData,
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('INSUFFICIENT_ROLE');
  });
});
