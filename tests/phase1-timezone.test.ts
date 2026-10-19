import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Auditoria V7 — Item 7: Timezone Explícito em Consultas Temporais (America/Sao_Paulo)', () => {
  let db: PGlite;

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

      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT, active INT DEFAULT 1);
      INSERT INTO public.stages (id, name, active) VALUES (1, 'Corte & Enfesto', 1);

      CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT, active INT DEFAULT 1);
      INSERT INTO public.users (name, email, role, active) VALUES ('Admin TZ', 'admin.tz@empresa.com', 'Administrador', 1);

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

    const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
    await db.exec(deploySql);
  });

  afterAll(async () => {
    await db.close();
  });

  it('deve agrupar corretamente registros gravados às 23:59:59 e às 00:00:01 do fuso de Brasília nos dias corretos', async () => {
    // 2026-10-18 23:59:59 em Brasília (UTC-3) é 2026-10-19 02:59:59 UTC
    // 2026-10-19 00:00:01 em Brasília (UTC-3) é 2026-10-19 03:00:01 UTC
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (701, 'PED-TZ-701', 10, 'Entrada', '[1]'::jsonb), (702, 'PED-TZ-702', 20, 'Entrada', '[1]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET required_stages = '[1]'::jsonb;

      INSERT INTO public.order_progress_logs (
        order_id, stage_id, user_id, user_name, quantidade_boa_incremento, created_at
      )
      VALUES
        (701, 1, 1, 'Operador 1', 10, '2026-10-19T02:59:59.000Z'::timestamptz),
        (702, 1, 1, 'Operador 1', 20, '2026-10-19T03:00:01.000Z'::timestamptz);
    `);

    // Consulta de produção diária explicitamente convertida para America/Sao_Paulo
    const dailyRes = await db.query(`
      SELECT 
        TO_CHAR(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia_sp,
        SUM(quantidade_boa_incremento) AS total_pecas
      FROM public.order_progress_logs
      WHERE order_id IN (701, 702)
      GROUP BY TO_CHAR(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')
      ORDER BY dia_sp ASC;
    `);

    expect(dailyRes.rows.length).toBe(2);
    // Primeiro registro (23:59:59 no Brasil) DEVE ser 2026-10-18
    expect((dailyRes.rows[0] as any).dia_sp).toBe('2026-10-18');
    expect(Number((dailyRes.rows[0] as any).total_pecas)).toBe(10);

    // Segundo registro (00:00:01 no Brasil) DEVE ser 2026-10-19
    expect((dailyRes.rows[1] as any).dia_sp).toBe('2026-10-19');
    expect(Number((dailyRes.rows[1] as any).total_pecas)).toBe(20);
  });

  it('deve agrupar corretamente virada de mês (31 de Maio 23:59:59 vs 01 de Junho 00:00:01)', async () => {
    // 31/05/2026 23:59:59 Brasília -> 01/06/2026 02:59:59 UTC
    // 01/06/2026 00:00:01 Brasília -> 01/06/2026 03:00:01 UTC
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status)
      VALUES (801, 'PED-TZ-801', 5, 'Entrada'), (802, 'PED-TZ-802', 15, 'Entrada')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.order_progress_logs (
        order_id, stage_id, user_id, user_name, quantidade_boa_incremento, created_at
      )
      VALUES
        (801, 1, 1, 'Op Maio', 5, '2026-06-01T02:59:59.000Z'::timestamptz),
        (802, 1, 1, 'Op Junho', 15, '2026-06-01T03:00:01.000Z'::timestamptz);
    `);

    const monthRes = await db.query(`
      SELECT 
        TO_CHAR(date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS mes_sp,
        SUM(quantidade_boa_incremento) AS total_pecas
      FROM public.order_progress_logs
      WHERE order_id IN (801, 802)
      GROUP BY date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo')
      ORDER BY mes_sp ASC;
    `);

    expect(monthRes.rows.length).toBe(2);
    expect((monthRes.rows[0] as any).mes_sp).toBe('2026-05');
    expect(Number((monthRes.rows[0] as any).total_pecas)).toBe(5);

    expect((monthRes.rows[1] as any).mes_sp).toBe('2026-06');
    expect(Number((monthRes.rows[1] as any).total_pecas)).toBe(15);
  });

  it('deve agrupar corretamente virada de ano (31 de Dezembro 23:59:59 vs 01 de Janeiro 00:00:01)', async () => {
    // 31/12/2026 23:59:59 Brasília -> 01/01/2027 02:59:59 UTC
    // 01/01/2027 00:00:01 Brasília -> 01/01/2027 03:00:01 UTC
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status)
      VALUES (901, 'PED-TZ-901', 100, 'Entrada'), (902, 'PED-TZ-902', 200, 'Entrada')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.order_progress_logs (
        order_id, stage_id, user_id, user_name, quantidade_boa_incremento, created_at
      )
      VALUES
        (901, 1, 1, 'Op 2026', 100, '2027-01-01T02:59:59.000Z'::timestamptz),
        (902, 1, 1, 'Op 2027', 200, '2027-01-01T03:00:01.000Z'::timestamptz);
    `);

    const yearRes = await db.query(`
      SELECT 
        TO_CHAR(date_trunc('year', created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY') AS ano_sp,
        SUM(quantidade_boa_incremento) AS total_pecas
      FROM public.order_progress_logs
      WHERE order_id IN (901, 902)
      GROUP BY date_trunc('year', created_at AT TIME ZONE 'America/Sao_Paulo')
      ORDER BY ano_sp ASC;
    `);

    expect(yearRes.rows.length).toBe(2);
    expect((yearRes.rows[0] as any).ano_sp).toBe('2026');
    expect(Number((yearRes.rows[0] as any).total_pecas)).toBe(100);

    expect((yearRes.rows[1] as any).ano_sp).toBe('2027');
    expect(Number((yearRes.rows[1] as any).total_pecas)).toBe(200);
  });

  it('as RPCs devem retornar timestamp_sp formatado de forma coerente com o horário de São Paulo', async () => {
    // Configurar etapa no pedido
    await db.exec(`
      INSERT INTO public.order_stage_progress (order_id, stage_id, quantidade_pedido, status_operacao)
      VALUES (701, 1, 10, 'LIBERADA')
      ON CONFLICT (order_id, stage_id) DO UPDATE SET status_operacao = 'LIBERADA';
    `);

    const rpcRes = await db.query(`
      SELECT public.pcp_apply_stage_progress(
        p_order_id => 701,
        p_stage_id => 1,
        p_user_id => 1,
        p_good_inc => 5,
        p_idempotency_key => 'idem_tz_test_01'
      ) AS res;
    `);

    const rawRes = (rpcRes.rows[0] as any).res;
    const res = typeof rawRes === 'string' ? JSON.parse(rawRes) : rawRes;
    expect(res.success).toBe(true);
    expect(res.timestamp_sp).toBeDefined();

    // Validar formato ISO completo com offset de Brasília YYYY-MM-DDTHH:MM:SS-03:00
    expect(res.timestamp_sp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
    expect(res.timestamp_sp.endsWith('-03:00')).toBe(true);
  });
});
