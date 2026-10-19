import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Auditoria V7 — Item 1: Limitação Estrita de REVOKEs às Tabelas e RPCs da Fase 1', () => {
  it('deve aplicar migration e comprovar que políticas, GRANTs em tabelas externas e funções externas permanecem 100% intactos', async () => {
    const testDb = new PGlite();

    // Setup base
    await testDb.exec(`
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

      -- 1. Tabela externa ao ecossistema da Fase 1
      CREATE TABLE public.tabela_externa_crm (
        id SERIAL PRIMARY KEY,
        cliente_nome TEXT,
        contato TEXT
      );
      ALTER TABLE public.tabela_externa_crm ENABLE ROW LEVEL SECURITY;

      -- 2. Policy própria na tabela externa
      CREATE POLICY "politica_crm_externa_select" ON public.tabela_externa_crm
        FOR SELECT TO authenticated USING (true);

      -- 3. GRANTs específicos na tabela externa: SELECT para anon, UPDATE para authenticated
      GRANT SELECT ON public.tabela_externa_crm TO anon;
      GRANT UPDATE ON public.tabela_externa_crm TO authenticated;

      -- 4. Função externa com EXECUTE para anon
      CREATE OR REPLACE FUNCTION public.fn_calculo_externo_crm(p_val INT)
      RETURNS INT LANGUAGE sql AS $$
        SELECT p_val * 2;
      $$;
      GRANT EXECUTE ON FUNCTION public.fn_calculo_externo_crm(INT) TO anon;

      -- 5. Tabelas legadas necessárias para a migration
      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT);
      CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT, active INT DEFAULT 1);
      INSERT INTO public.users (name, email, role, active) VALUES ('Admin', 'admin@crm.com', 'Administrador', 1);
      CREATE TABLE public.orders (id BIGSERIAL PRIMARY KEY, quantity INT DEFAULT 1, status TEXT DEFAULT 'Entrada');
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

    // Aplica a migration consolidada da Fase 1
    const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
    await testDb.exec(deploySql);

    // 1. Validar que a policy externa permaneceu intacta
    const polRes = await testDb.query(`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'tabela_externa_crm';
    `);
    expect(polRes.rows.length).toBe(1);
    expect((polRes.rows[0] as any).policyname).toBe('politica_crm_externa_select');

    // 2. Validar que o privilégio SELECT para anon na tabela externa permaneceu intacto
    const grantAnonRes = await testDb.query(`
      SELECT privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee = 'anon'
        AND table_schema = 'public'
        AND table_name = 'tabela_externa_crm';
    `);
    const anonPrivs = grantAnonRes.rows.map((r: any) => r.privilege_type);
    expect(anonPrivs).toContain('SELECT');

    // 3. Validar que o privilégio UPDATE para authenticated na tabela externa permaneceu intacto
    const grantAuthRes = await testDb.query(`
      SELECT privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee = 'authenticated'
        AND table_schema = 'public'
        AND table_name = 'tabela_externa_crm';
    `);
    const authPrivs = grantAuthRes.rows.map((r: any) => r.privilege_type);
    expect(authPrivs).toContain('UPDATE');

    // 4. Validar que o privilégio EXECUTE para anon na função externa permaneceu intacto
    const fnGrantRes = await testDb.query(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'fn_calculo_externo_crm'
        AND grantee = 'anon';
    `);
    expect(fnGrantRes.rows.length).toBeGreaterThan(0);
    const fnPrivs = fnGrantRes.rows.map((r: any) => r.privilege_type);
    expect(fnPrivs).toContain('EXECUTE');

    // 5. Comprovar que tabelas da Fase 1 tiveram REVOKE de anon executado
    const phase1AnonCheck = await testDb.query(`
      SELECT privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee = 'anon'
        AND table_schema = 'public'
        AND table_name = 'orders';
    `);
    expect(phase1AnonCheck.rows.length).toBe(0);

    await testDb.close();
  });
});
