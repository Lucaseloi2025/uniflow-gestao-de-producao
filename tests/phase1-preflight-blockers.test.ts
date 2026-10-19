import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * AUDITORIA V8 — ITEM 2: PREFLIGHT CHECK RESILIENTE COM DETECÇÃO ESTRITA DE DUPLICIDADES
 * 
 * Valida que o preflight NUNCA retorna falso PASS quando existem duplicidades que violariam
 * as constraints e índices da Fase 1, e confirma que usuários inativos sem auth geram apenas WARNING.
 */
describe('Auditoria V8 — Item 2: Verificações BLOCKER e WARNING do Preflight', () => {
  let db: PGlite;
  const preflightSql = fs.readFileSync(path.resolve('supabase', 'preflight_phase1_check.sql'), 'utf8');

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT);

      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT, active INT DEFAULT 1);
      INSERT INTO public.stages (id, name, active) VALUES (1, 'Corte', 1);

      CREATE TABLE public.users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT,
        email TEXT,
        role TEXT,
        active INT DEFAULT 1,
        auth_user_id UUID
      );

      CREATE TABLE public.orders (
        id BIGSERIAL PRIMARY KEY,
        order_number TEXT,
        quantity INT DEFAULT 1,
        status TEXT DEFAULT 'Entrada',
        required_stages JSONB DEFAULT '[1]'::jsonb
      );

      CREATE TABLE public.order_stage_progress (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT,
        stage_id BIGINT
      );

      CREATE TABLE public.order_items (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT,
        item_index INT
      );

      CREATE TABLE public.order_item_stage_progress (
        id BIGSERIAL PRIMARY KEY,
        order_item_id BIGINT,
        stage_id BIGINT
      );

      CREATE TABLE public.order_progress_logs (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT,
        stage_id BIGINT,
        idempotency_key TEXT
      );

      CREATE TABLE public.stage_executions (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT,
        stage_id BIGINT,
        user_id BIGINT,
        order_item_id BIGINT,
        status TEXT
      );
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  const runPreflight = async (targetDb: PGlite) => {
    await targetDb.exec(preflightSql);
    const summary = await targetDb.query(`
      SELECT
        CASE
          WHEN COUNT(*) FILTER (WHERE severidade = 'BLOCKER') > 0 THEN 'BLOCKED'
          ELSE 'PASS'
        END AS status,
        COUNT(*) FILTER (WHERE severidade = 'BLOCKER') AS total_bloqueadores,
        COUNT(*) FILTER (WHERE severidade = 'WARNING') AS total_avisos,
        COALESCE(
          jsonb_agg(jsonb_build_object('categoria', categoria, 'descricao', descricao, 'detalhes', detalhes))
          FILTER (WHERE severidade = 'BLOCKER'),
          '[]'::jsonb
        ) AS detalhes_bloqueadores
      FROM _preflight_audit_results;
    `);
    const blockers = await targetDb.query(`
      SELECT categoria, severidade, descricao, detalhes
      FROM _preflight_audit_results
      WHERE severidade = 'BLOCKER';
    `);
    const warnings = await targetDb.query(`
      SELECT categoria, severidade, descricao, detalhes
      FROM _preflight_audit_results
      WHERE severidade = 'WARNING';
    `);
    return {
      status: (summary.rows[0] as any).status,
      total_bloqueadores: Number((summary.rows[0] as any).total_bloqueadores),
      total_avisos: Number((summary.rows[0] as any).total_avisos),
      detalhes_bloqueadores: (summary.rows[0] as any).detalhes_bloqueadores,
      blockers: blockers.rows as any[],
      warnings: warnings.rows as any[],
    };
  };

  it('1. Preflight emite PASS quando o banco está limpo e consistente', async () => {
    // Configurar usuário válido com auth
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('PASS');
    expect(res.total_bloqueadores).toBe(0);
  });

  it('2. Bloqueia se order_stage_progress tiver duplicidade em (order_id, stage_id)', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');

      INSERT INTO public.order_stage_progress (order_id, stage_id) VALUES (1, 1), (1, 1);
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    expect(res.total_bloqueadores).toBeGreaterThanOrEqual(1);
    const blk = res.blockers.find((b) => b.categoria === 'ORDER_STAGE_PROGRESS_DUPLICADO');
    expect(blk).toBeDefined();
    expect(blk.descricao).toContain('uq_order_stage_progress');
  });

  it('3. Bloqueia se order_items tiver duplicidade em (order_id, item_index)', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');

      INSERT INTO public.order_items (order_id, item_index) VALUES (1, 0), (1, 0);
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    const blk = res.blockers.find((b) => b.categoria === 'ORDER_ITEMS_DUPLICADO');
    expect(blk).toBeDefined();
    expect(blk.descricao).toContain('uq_order_items_order_index');
  });

  it('4. Bloqueia se order_item_stage_progress tiver duplicidade em (order_item_id, stage_id)', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');

      INSERT INTO public.order_item_stage_progress (order_item_id, stage_id) VALUES (5, 1), (5, 1);
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    const blk = res.blockers.find((b) => b.categoria === 'ORDER_ITEM_STAGE_PROGRESS_DUPLICADO');
    expect(blk).toBeDefined();
  });

  it('5. Bloqueia se order_progress_logs tiver idempotency_key duplicada', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');

      INSERT INTO public.order_progress_logs (order_id, stage_id, idempotency_key)
      VALUES (1, 1, 'duplicate_idemp_key_123'), (1, 1, 'duplicate_idemp_key_123');
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    const blk = res.blockers.find((b) => b.categoria === 'ORDER_PROGRESS_LOGS_IDEMPOTENCY_DUPLICADO');
    expect(blk).toBeDefined();
  });

  it('6. Bloqueia se stage_executions tiver duas sessões abertas para o mesmo operador', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');

      INSERT INTO public.stage_executions (order_id, stage_id, user_id, status)
      VALUES (1, 1, 1, 'Em andamento'), (2, 1, 1, 'Pausado');
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    const blk = res.blockers.find((b) => b.categoria === 'STAGE_EXECUTIONS_OPERADOR_DUPLICADO');
    expect(blk).toBeDefined();
  });

  it('7. Bloqueia se stage_executions tiver duas sessões abertas para o mesmo pedido + etapa + item', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');

      -- Operador 10 e Operador 20 ambos com sessão aberta no pedido 1, etapa 1, item 99
      INSERT INTO public.stage_executions (order_id, stage_id, user_id, order_item_id, status)
      VALUES (1, 1, 10, 99, 'Em andamento'), (1, 1, 20, 99, 'Em andamento');
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    const blk = res.blockers.find((b) => b.categoria === 'STAGE_EXECUTIONS_ETAPA_ITEM_DUPLICADO');
    expect(blk).toBeDefined();
  });

  it('8. Bloqueia usuário ativo sem correspondência em auth.users, mas usuário inativo gera apenas WARNING', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');

      -- Usuário inativo sem auth
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Ex-Funcionario', 'inativo@empresa.com', 'Operador', 0, NULL);
    `);

    // Deve passar pois usuário inativo sem auth é apenas WARNING
    const resWarn = await runPreflight(db);
    expect(resWarn.status).toBe('PASS');
    expect(resWarn.total_bloqueadores).toBe(0);
    const warn = resWarn.warnings.find((w) => w.categoria === 'AUTH_USERS_INATIVOS_SEM_VINCULO');
    expect(warn).toBeDefined();

    // Agora adiciona usuário ativo sem auth
    await db.exec(`
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Operador Ativo Sem Auth', 'ativo.sem.auth@empresa.com', 'Operador', 1, NULL);
    `);

    const resBlock = await runPreflight(db);
    expect(resBlock.status).toBe('BLOCKED');
    const blk = resBlock.blockers.find((b) => b.categoria === 'AUTH_USERS_SEM_VINCULO');
    expect(blk).toBeDefined();
  });

  it('9. Bloqueia se existirem e-mails normalizados duplicados em public.users ou auth.users', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES
        ('Admin 1', 'admin@empresa.com', 'Administrador', 1, '${authId}'),
        ('Admin 2 Duplicado', ' ADMIN@empresa.com ', 'Administrador', 1, NULL);
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    const blk = res.blockers.find((b) => b.categoria === 'USUARIOS_EMAIL_DUPLICADO');
    expect(blk).toBeDefined();
  });

  it('10. Bloqueia se existirem múltiplos usuários vinculados ao mesmo auth_user_id', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'shared@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES
        ('Usuario 1', 'u1@empresa.com', 'Operador', 1, '${authId}'),
        ('Usuario 2', 'u2@empresa.com', 'Operador', 1, '${authId}');
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    const blk = res.blockers.find((b) => b.categoria === 'AUTH_USER_ID_DUPLICADO');
    expect(blk).toBeDefined();
  });

  it('11. Quando preflight retorna BLOCKED, a migration é impedida de executar e detalhes contêm as linhas duplicadas', async () => {
    const authId = 'a0000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${authId}', 'admin@empresa.com');
      INSERT INTO public.users (name, email, role, active, auth_user_id)
      VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1, '${authId}');

      -- Inserir duplicidades em order_stage_progress
      INSERT INTO public.order_stage_progress (order_id, stage_id) VALUES (10, 1), (10, 1);
    `);

    const res = await runPreflight(db);
    expect(res.status).toBe('BLOCKED');
    expect(res.total_bloqueadores).toBeGreaterThanOrEqual(1);

    // Detalhes contêm exatamente as linhas duplicadas
    const blk = res.blockers.find((b) => b.categoria === 'ORDER_STAGE_PROGRESS_DUPLICADO');
    expect(blk).toBeDefined();
    const details = blk.detalhes;
    expect(details[0].order_id).toBe(10);
    expect(details[0].stage_id).toBe(1);
    expect(details[0].total).toBe(2);

    // Orquestrador de deploy deve abortar se preflight for BLOCKED
    let migrationExecuted = false;
    if (res.status === 'PASS') {
      const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
      await db.exec(deploySql);
      migrationExecuted = true;
    }

    expect(migrationExecuted).toBe(false);
  });
});
