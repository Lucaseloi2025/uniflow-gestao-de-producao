import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Auditoria V7 — Item 4: Bloqueio Transacional Estrito de Usuários Sem Auth na Migration', () => {
  const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');

  async function createBaseDb() {
    const db = new PGlite();
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

      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE
      );

      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT);
      CREATE TABLE public.users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT,
        email TEXT,
        role TEXT,
        active INT DEFAULT 1,
        auth_user_id UUID
      );
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
    return db;
  }

  it('deve abortar com RAISE EXCEPTION e rollback se usuário ativo possuir e-mail vazio ou nulo', async () => {
    const db = await createBaseDb();
    await db.exec(`
      INSERT INTO public.users (name, email, role, active)
      VALUES ('Operador Sem Email', '', 'Operador', 1);
    `);

    let errorThrown: any = null;
    try {
      await db.exec(deploySql);
    } catch (err) {
      errorThrown = err;
      await db.exec('ROLLBACK;');
    }

    expect(errorThrown).toBeDefined();
    expect(errorThrown.message).toMatch(/MIGRATION ABORTED.*e-mail vazio ou nulo/i);

    // Comprovar rollback integral
    const rlsCheck = await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'orders';`);
    expect(rlsCheck.rows[0]?.relrowsecurity).toBe(false);
    await db.close();
  });

  it('deve abortar com RAISE EXCEPTION e rollback se dois usuários internos apontarem para o mesmo auth_user_id', async () => {
    const db = await createBaseDb();
    const sharedUuid = '11111111-1111-1111-1111-111111111111';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${sharedUuid}', 'admin@teste.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin 1', 'admin1@teste.com', 'Administrador', 1, '${sharedUuid}'),
             ('Admin 2', 'admin2@teste.com', 'Supervisor', 1, '${sharedUuid}');
    `);

    let errorThrown: any = null;
    try {
      await db.exec(deploySql);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).toBeDefined();
    expect(errorThrown.message).toMatch(/MIGRATION ABORTED.*vinculados ao mesmo auth_user_id/i);
    await db.close();
  });

  it('deve abortar com RAISE EXCEPTION e rollback se houver correspondência ambígua/duplicada em auth.users', async () => {
    const db = await createBaseDb();
    // Inserir dois registros com o mesmo email normalizado no auth (desativando temporariamente a constraint do mock)
    await db.exec(`
      ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS users_email_key;
      INSERT INTO auth.users (id, email) VALUES 
        ('22222222-2222-2222-2222-222222222222', 'duplicado@empresa.com'),
        ('33333333-3333-3333-3333-333333333333', 'DUPLICADO@EMPRESA.COM');
      INSERT INTO public.users (name, email, role, active)
      VALUES ('Usuario Duplicado', 'duplicado@empresa.com', 'Operador', 1);
    `);

    let errorThrown: any = null;
    try {
      await db.exec(deploySql);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).toBeDefined();
    expect(errorThrown.message).toMatch(/MIGRATION ABORTED.*Correspondência ambígua\/duplicada/i);
    await db.close();
  });

  it('deve abortar com RAISE EXCEPTION e rollback se qualquer usuário ativo ficar com auth_user_id IS NULL após o backfill', async () => {
    const db = await createBaseDb();
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('44444444-4444-4444-4444-444444444444', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active) VALUES 
        ('Admin Cadastrado', 'admin@empresa.com', 'Administrador', 1),
        ('Operador Sem Conta Auth', 'operador.fantasma@empresa.com', 'Operador', 1);
    `);

    let errorThrown: any = null;
    try {
      await db.exec(deploySql);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).toBeDefined();
    expect(errorThrown.message).toMatch(/MIGRATION ABORTED.*Usuários ativos sem conta correspondente em auth.users/i);
    expect(errorThrown.message).toContain('operador.fantasma@empresa.com');
    await db.close();
  });

  it('deve permitir usuário inativo (active = 0) sem auth_user_id sem abortar a migration', async () => {
    const db = await createBaseDb();
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('55555555-5555-5555-5555-555555555555', 'ativo@empresa.com');
      INSERT INTO public.users (name, email, role, active) VALUES 
        ('Usuario Ativo', 'ativo@empresa.com', 'Administrador', 1),
        ('Ex-Funcionario Desativado', 'demitido@empresa.com', 'Operador', 0);
    `);

    await expect(db.exec(deploySql)).resolves.not.toThrow();

    const activeUser = await db.query(`SELECT auth_user_id FROM public.users WHERE email = 'ativo@empresa.com';`);
    expect(activeUser.rows[0]?.auth_user_id).toBe('55555555-5555-5555-5555-555555555555');

    const inactiveUser = await db.query(`SELECT auth_user_id FROM public.users WHERE email = 'demitido@empresa.com';`);
    expect(inactiveUser.rows[0]?.auth_user_id).toBeNull();

    await db.close();
  });

  it('deve concluir a migration com sucesso quando todos os usuários ativos possuem vínculo unívoco com auth.users', async () => {
    const db = await createBaseDb();
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES 
        ('66666666-6666-6666-6666-666666666661', 'admin@empresa.com'),
        ('66666666-6666-6666-6666-666666666662', 'pcp@empresa.com'),
        ('66666666-6666-6666-6666-666666666663', 'supervisor@empresa.com');

      INSERT INTO public.users (name, email, role, active) VALUES 
        ('Admin', 'admin@empresa.com', 'Administrador', 1),
        ('PCP', 'pcp@empresa.com', 'PCP', 1),
        ('Supervisor', 'supervisor@empresa.com', 'Supervisor', 1);
    `);

    await expect(db.exec(deploySql)).resolves.not.toThrow();

    const usersRes = await db.query(`SELECT id, email, auth_user_id FROM public.users;`);
    for (const r of usersRes.rows as any[]) {
      expect(r.auth_user_id).not.toBeNull();
    }

    await db.close();
  });
});
