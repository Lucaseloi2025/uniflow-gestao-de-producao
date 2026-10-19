import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Auditoria V7 — Item 8: Menor Privilégio nas Políticas RLS de Leitura', () => {
  let db: PGlite;

  const usersMap = {
    admin: { id: 1, uuid: '11111111-1111-1111-1111-111111111111', role: 'Administrador', name: 'Admin RLS' },
    pcp: { id: 2, uuid: '22222222-2222-2222-2222-222222222222', role: 'PCP', name: 'PCP RLS' },
    supervisor: { id: 3, uuid: '33333333-3333-3333-3333-333333333333', role: 'Supervisor', name: 'Supervisor RLS' },
    operador1: { id: 4, uuid: '44444444-4444-4444-4444-444444444444', role: 'Operador', name: 'Operador 1 RLS' },
    operador2: { id: 5, uuid: '55555555-5555-5555-5555-555555555555', role: 'Operador', name: 'Operador 2 RLS' },
    comercial: { id: 6, uuid: '66666666-6666-6666-6666-666666666666', role: 'Comercial', name: 'Comercial RLS' },
    visualizacao: { id: 7, uuid: '77777777-7777-7777-7777-777777777777', role: 'Visualização', name: 'Visualização RLS' },
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT UNIQUE);
      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT, active INT DEFAULT 1);
      INSERT INTO public.stages (id, name, active) VALUES (1, 'Corte', 1), (2, 'Costura', 1);

      CREATE TABLE public.users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        role TEXT,
        active INT DEFAULT 1,
        auth_user_id UUID
      );

      CREATE TABLE public.orders (id BIGSERIAL PRIMARY KEY, order_number TEXT, quantity INT DEFAULT 1, status TEXT DEFAULT 'Entrada');
      CREATE TABLE public.order_stage_progress (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT);
      CREATE TABLE public.stage_executions (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, status TEXT, start_time TIMESTAMPTZ);
      CREATE TABLE public.pauses (id BIGSERIAL PRIMARY KEY, execution_id BIGINT, start_pause TIMESTAMPTZ);
      CREATE TABLE public.order_progress_logs (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT);
      CREATE TABLE public.order_loss_logs (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, quantidade_perdida INT, motivo TEXT, etapa_reentrada_id BIGINT, created_at TIMESTAMPTZ);
      CREATE TABLE public.pcp_settings (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.pcp_blocks (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.pcp_audit_log (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, acao TEXT, created_at TIMESTAMPTZ);
      CREATE TABLE public.pcp_producao_necessidades (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.order_history (id BIGSERIAL PRIMARY KEY);
    `);

    // Inserir os 7 usuários com seus UUIDs
    for (const u of Object.values(usersMap)) {
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES ('${u.uuid}', '${u.role.toLowerCase()}.${u.id}@empresa.com');
        INSERT INTO public.users (id, name, email, role, active, auth_user_id)
        VALUES (${u.id}, '${u.name}', '${u.role.toLowerCase()}.${u.id}@empresa.com', '${u.role}', 1, '${u.uuid}');
      `);
    }

    const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
    await db.exec(deploySql);

    // Inserir dados de teste para verificar as policies
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status)
      VALUES (501, 'PED-PRIV-501', 10, 'Entrada')
      ON CONFLICT (id) DO NOTHING;

      -- Execuções: Operador 1 (id 4) e Operador 2 (id 5)
      INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status)
      VALUES 
        (1001, 501, 1, 4, 'Em andamento'),
        (1002, 501, 2, 5, 'Em andamento')
      ON CONFLICT (id) DO NOTHING;

      -- Perdas: Operador 1 (id 4) e Operador 2 (id 5)
      INSERT INTO public.order_loss_logs (id, order_id, stage_id, user_id, quantidade_perdida, motivo)
      VALUES
        (2001, 501, 1, 4, 2, 'Defeito tecido'),
        (2002, 501, 2, 5, 3, 'Erro de costura')
      ON CONFLICT (id) DO NOTHING;

      -- Idempotência
      INSERT INTO public.idempotency_requests (idempotency_key, payload_hash, action, order_id, stage_id, user_id, status)
      VALUES ('idem_priv_01', 'hash_priv_01', 'apontamento', 501, 1, 4, 'COMPLETED')
      ON CONFLICT (idempotency_key) DO NOTHING;

      -- Histórico de pedidos
      INSERT INTO public.order_history (id, order_id, usuario, acao)
      VALUES (3001, 501, 'Admin', 'criou')
      ON CONFLICT (id) DO NOTHING;

      -- Auditoria
      INSERT INTO public.pcp_audit_log (id, order_id, usuario, acao)
      VALUES (4001, 501, 'Admin', 'CRIACAO')
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  async function queryAsUser(userUuid: string, sql: string) {
    await db.exec(`
      SET ROLE authenticated;
      SET "request.jwt.claim.sub" = '${userUuid}';
    `);
    try {
      return await db.query(sql);
    } finally {
      await db.exec(`
        RESET ROLE;
        RESET "request.jwt.claim.sub";
      `);
    }
  }

  describe('1. idempotency_requests (Somente Gestão: Admin, PCP, Supervisor)', () => {
    it('Gestores (Admin, PCP, Supervisor) conseguem ler idempotency_requests', async () => {
      for (const u of [usersMap.admin, usersMap.pcp, usersMap.supervisor]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.idempotency_requests;`);
        expect(Number((res.rows[0] as any).total)).toBeGreaterThanOrEqual(1);
      }
    });

    it('Não-gestores (Operador, Comercial, Visualização) recebem 0 linhas em idempotency_requests', async () => {
      for (const u of [usersMap.operador1, usersMap.comercial, usersMap.visualizacao]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.idempotency_requests;`);
        expect(Number((res.rows[0] as any).total)).toBe(0);
      }
    });
  });

  describe('2. pcp_settings (Somente Gestão: Admin, PCP, Supervisor)', () => {
    it('Gestores conseguem ler pcp_settings', async () => {
      for (const u of [usersMap.admin, usersMap.pcp, usersMap.supervisor]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.pcp_settings;`);
        expect(Number((res.rows[0] as any).total)).toBeGreaterThanOrEqual(1);
      }
    });

    it('Não-gestores recebem 0 linhas em pcp_settings', async () => {
      for (const u of [usersMap.operador1, usersMap.comercial, usersMap.visualizacao]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.pcp_settings;`);
        expect(Number((res.rows[0] as any).total)).toBe(0);
      }
    });
  });

  describe('3. order_history (Gestão + Comercial; Operador e Visualização NÃO)', () => {
    it('Admin, PCP, Supervisor e Comercial conseguem ler order_history', async () => {
      for (const u of [usersMap.admin, usersMap.pcp, usersMap.supervisor, usersMap.comercial]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.order_history WHERE order_id = 501;`);
        expect(Number((res.rows[0] as any).total)).toBeGreaterThanOrEqual(1);
      }
    });

    it('Operadores e Visualização recebem 0 linhas em order_history', async () => {
      for (const u of [usersMap.operador1, usersMap.operador2, usersMap.visualizacao]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.order_history WHERE order_id = 501;`);
        expect(Number((res.rows[0] as any).total)).toBe(0);
      }
    });
  });

  describe('4. pcp_audit_log (Estritamente Administrador e PCP)', () => {
    it('Administrador e PCP conseguem ler pcp_audit_log', async () => {
      for (const u of [usersMap.admin, usersMap.pcp]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.pcp_audit_log WHERE order_id = 501;`);
        expect(Number((res.rows[0] as any).total)).toBeGreaterThanOrEqual(1);
      }
    });

    it('Supervisor, Operadores, Comercial e Visualização recebem 0 linhas em pcp_audit_log', async () => {
      for (const u of [usersMap.supervisor, usersMap.operador1, usersMap.operador2, usersMap.comercial, usersMap.visualizacao]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.pcp_audit_log WHERE order_id = 501;`);
        expect(Number((res.rows[0] as any).total)).toBe(0);
      }
    });
  });

  describe('5. stage_executions & order_loss_logs (Gestão vê todas; Operador vê apenas as suas)', () => {
    it('Gestão vê todas as execuções de todos os operadores', async () => {
      for (const u of [usersMap.admin, usersMap.pcp, usersMap.supervisor]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.stage_executions WHERE order_id = 501;`);
        expect(Number((res.rows[0] as any).total)).toBe(2);
      }
    });

    it('Operador 1 vê apenas suas próprias execuções e NÃO as do Operador 2', async () => {
      const res = await queryAsUser(usersMap.operador1.uuid, `SELECT id, user_id FROM public.stage_executions WHERE order_id = 501;`);
      expect(res.rows.length).toBe(1);
      expect((res.rows[0] as any).id).toBe(1001);
      expect((res.rows[0] as any).user_id).toBe(4);
    });

    it('Operador 2 vê apenas suas próprias execuções e NÃO as do Operador 1', async () => {
      const res = await queryAsUser(usersMap.operador2.uuid, `SELECT id, user_id FROM public.stage_executions WHERE order_id = 501;`);
      expect(res.rows.length).toBe(1);
      expect((res.rows[0] as any).id).toBe(1002);
      expect((res.rows[0] as any).user_id).toBe(5);
    });

    it('Operador 1 vê apenas seus próprios registros de perda e NÃO os do Operador 2', async () => {
      const res = await queryAsUser(usersMap.operador1.uuid, `SELECT id, user_id FROM public.order_loss_logs WHERE order_id = 501;`);
      expect(res.rows.length).toBe(1);
      expect((res.rows[0] as any).id).toBe(2001);
      expect((res.rows[0] as any).user_id).toBe(4);
    });

    it('Visualização e Comercial recebem 0 linhas em stage_executions de operadores', async () => {
      for (const u of [usersMap.visualizacao, usersMap.comercial]) {
        const res = await queryAsUser(u.uuid, `SELECT count(*) as total FROM public.stage_executions WHERE order_id = 501;`);
        expect(Number((res.rows[0] as any).total)).toBe(0);
      }
    });
  });
});
