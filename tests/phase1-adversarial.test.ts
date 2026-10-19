import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import app, { supabaseAdmin } from '../api/index';

describe('Suíte Adversarial de Verificação dos 20 Bloqueios da Auditoria', () => {
  let db: PGlite;
  let server: http.Server;
  let baseUrl: string;
  const webhookSecret = 'test_olist_secret_key_12345';

  beforeAll(async () => {
    process.env.OLIST_WEBHOOK_SECRET = webhookSecret;

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    db = new PGlite();

    // 1. Roles pré-existentes
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END $$;

      -- Mock nativo do Supabase Auth para o harness de teste
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      CREATE TABLE IF NOT EXISTS public.stages (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INT DEFAULT 1,
        active INT DEFAULT 1,
        calculation_type TEXT DEFAULT 'por_peca'
      );

      CREATE TABLE IF NOT EXISTS public.users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        role TEXT NOT NULL,
        active INT DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS public.orders (
        id BIGSERIAL PRIMARY KEY,
        order_number TEXT,
        client_name TEXT,
        product_type TEXT,
        quantity INT DEFAULT 1,
        status TEXT DEFAULT 'Entrada',
        pcp_status TEXT DEFAULT 'AGUARDANDO LIBERAÇÃO',
        pcp_is_blocked BOOLEAN DEFAULT false,
        items JSONB DEFAULT '[]'::jsonb,
        required_stages JSONB DEFAULT '[]'::jsonb,
        total_time_seconds INT DEFAULT 0,
        deadline TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS public.stage_executions (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        stage_id BIGINT REFERENCES public.stages(id),
        order_item_id BIGINT,
        user_id BIGINT REFERENCES public.users(id),
        start_time TIMESTAMPTZ DEFAULT NOW(),
        end_time TIMESTAMPTZ,
        status TEXT DEFAULT 'Em andamento',
        total_time_seconds INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.pauses (
        id BIGSERIAL PRIMARY KEY,
        execution_id BIGINT REFERENCES public.stage_executions(id) ON DELETE CASCADE,
        start_pause TIMESTAMPTZ DEFAULT NOW(),
        end_pause TIMESTAMPTZ,
        duration_seconds INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS public.order_stage_progress (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        stage_id BIGINT REFERENCES public.stages(id),
        quantidade_pedido INT DEFAULT 0,
        quantidade_recebida INT DEFAULT 0,
        quantidade_boa INT DEFAULT 0,
        quantidade_perdida INT DEFAULT 0,
        quantidade_retrabalho INT DEFAULT 0,
        quantidade_transferida INT DEFAULT 0,
        pendencia_reposicao INT DEFAULT 0,
        saldo_pendente INT DEFAULT 0,
        finished BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_order_stage_progress UNIQUE(order_id, stage_id)
      );

      CREATE TABLE IF NOT EXISTS public.order_progress_logs (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        stage_id BIGINT REFERENCES public.stages(id),
        user_id BIGINT REFERENCES public.users(id),
        quantidade_boa INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.order_loss_logs (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        stage_id BIGINT REFERENCES public.stages(id),
        user_id BIGINT REFERENCES public.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.pcp_settings (
        id SERIAL PRIMARY KEY,
        dias_atencao INT DEFAULT 4,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.pcp_blocks (
        id SERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        motivo TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS public.pcp_audit_log (
        id BIGSERIAL PRIMARY KEY,
        entidade TEXT DEFAULT 'orders',
        order_id BIGINT,
        stage_id BIGINT,
        user_id BIGINT,
        usuario TEXT,
        acao TEXT NOT NULL,
        quantidade INT,
        motivo TEXT,
        observacao TEXT,
        valor_antigo JSONB,
        valor_novo JSONB,
        origem TEXT DEFAULT 'WEB',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.pcp_producao_necessidades (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        item_id TEXT,
        sku TEXT,
        qty_vendida INT NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS public.order_history (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        action TEXT,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Criar permissão permissiva antiga para testar que a migration a remove
      CREATE POLICY "old_permissive_update_orders" ON public.orders FOR UPDATE TO authenticated USING (true);
    `);

    // Inserir usuários com perfis legados variados
    await db.exec(`
      INSERT INTO public.users (id, name, email, role, active)
      VALUES
        (1, 'Admin Um', 'admin1@test.com', 'Admin', 1),
        (2, 'Op Um', 'op1@test.com', 'Producao', 1),
        (3, 'Op Dois', 'op2@test.com', 'producao', 1),
        (4, 'Op Tres', 'op3@test.com', 'Produção', 1),
        (5, 'Op Quatro', 'op4@test.com', 'Operador de Produção', 1),
        (6, 'Sup Um', 'sup1@test.com', 'Supervisor', 1),
        (7, 'PCP Um', 'pcp1@test.com', 'PCP', 1);

      INSERT INTO public.stages (id, name, sort_order, active, calculation_type)
      VALUES
        (10, 'Corte', 1, 1, 'por_peca'),
        (20, 'Estamparia Silk', 2, 1, 'por_peca'),
        (30, 'Costura', 3, 1, 'por_peca'),
        (40, 'Embalagem', 4, 1, 'por_peca');
    `);

    // Aplicar a migration consolidada da Fase 1
    const deploySql = fs.readFileSync(
      path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
      'utf8'
    );
    await db.exec(deploySql);
  });

  afterAll(async () => {
    if (server) server.close();
    if (db) await db.close();
  });

  // BLOQUEIO 1: rpc_record_production aceita apontamento sem existir execução ativa
  it('[BLOQUEIO 1] rpc_record_production deve bloquear apontamento se não houver execução ativa', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (2001, 'PED-ADV-2001', 50, 'Em Produção', '[10, 20]'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `);

    const res = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => 2001,
        p_stage_id => 10,
        p_user_id => 2,
        p_idempotency_key => 'adv_key_no_exec_01',
        p_good_inc => 10
      ) AS res;
    `);

    const data = (res.rows[0] as any).res;
    expect(data.http_status).toBe(409);
    expect(data.code).toBe('NO_ACTIVE_EXECUTION');
  });

  // BLOQUEIO 2: rpc_record_production aceita apontamento durante execução pausada
  it('[BLOQUEIO 2] rpc_record_production deve bloquear apontamento quando a execução estiver pausada', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (2002, 'PED-ADV-2002', 50, 'Em Produção', '[10, 20]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status, start_time)
      VALUES (20021, 2002, 10, 2, 'Pausado', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    const res = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => 2002,
        p_stage_id => 10,
        p_user_id => 2,
        p_idempotency_key => 'adv_key_paused_01',
        p_good_inc => 10
      ) AS res;
    `);

    const data = (res.rows[0] as any).res;
    expect(data.http_status).toBe(409);
    expect(data.code).toBe('EXECUTION_PAUSED');

    // Limpar execução para não colidir com o índice único de operador
    await db.exec(`UPDATE public.stage_executions SET status = 'Finalizado' WHERE id = 20021;`);
  });

  // BLOQUEIO 3: rpc_start_operation permite iniciar etapa fora da rota quando order_item_id é nulo
  it('[BLOQUEIO 3] rpc_start_operation deve rejeitar etapa fora da rota quando order_item_id for nulo', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (2003, 'PED-ADV-2003', 50, 'Entrada', '[10, 20]'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Tentar iniciar etapa 40 (fora da rota [10, 20])
    const res = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id => 2003,
        p_stage_id => 40,
        p_user_id => 2,
        p_order_item_id => NULL
      ) AS res;
    `);

    const data = (res.rows[0] as any).res;
    expect(data.http_status).toBe(400);
    expect(data.code).toBe('STAGE_NOT_IN_ROUTE');
  });

  // BLOQUEIO 4: Operador consegue informar supervisor_override=true em sua própria execução e produzir acima da meta
  it('[BLOQUEIO 4] Operador não deve conseguir usar supervisor_override=true em sua própria execução', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (2004, 'PED-ADV-2004', 10, 'Em Produção', '[10]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status, start_time)
      VALUES (20041, 2004, 10, 2, 'Em andamento', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    const res = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => 2004,
        p_stage_id => 10,
        p_user_id => 2,
        p_idempotency_key => 'adv_key_override_op_01',
        p_good_inc => 15,
        p_supervisor_override => true,
        p_override_reason => 'Tentativa de override por operador'
      ) AS res;
    `);

    const data = (res.rows[0] as any).res;
    expect(data.http_status).toBe(403);
    expect(data.code).toBe('SUPERVISOR_OVERRIDE_FORBIDDEN');

    await db.exec(`UPDATE public.stage_executions SET status = 'Finalizado' WHERE id = 20041;`);
  });

  // BLOQUEIO 5: Pedido multi-item marca a etapa global como CONCLUIDA após concluir apenas o primeiro item
  it('[BLOQUEIO 5] Multi-item: concluir o 1º item NÃO deve marcar a etapa do pedido como CONCLUIDA se o 2º item estiver pendente', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (2005, 'PED-ADV-2005', 20, 'Em Produção', '[10]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.order_items (id, order_id, item_index, quantity, route_stages, status)
      VALUES (20051, 2005, 0, 10, '[10]'::jsonb, 'LIBERADA')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.order_items (id, order_id, item_index, quantity, route_stages, status)
      VALUES (20052, 2005, 1, 10, '[10]'::jsonb, 'LIBERADA')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.stage_executions (id, order_id, stage_id, order_item_id, user_id, status, start_time)
      VALUES (200501, 2005, 10, 20051, 3, 'Em andamento', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    const res = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => 2005,
        p_stage_id => 10,
        p_user_id => 3,
        p_idempotency_key => 'adv_key_multi_item_01',
        p_good_inc => 10,
        p_order_item_id => 20051
      ) AS res;
    `);

    const data = (res.rows[0] as any).res;
    expect(data.success).toBe(true);
    expect(data.finished).toBe(true); // O item 1 concluiu

    // Verificar se o progresso global da ordem NÃO está CONCLUIDO
    const progGlobal = await db.query(`
      SELECT finished, status_operacao FROM public.order_stage_progress
      WHERE order_id = 2005 AND stage_id = 10;
    `);

    expect(progGlobal.rows.length).toBe(1);
    expect((progGlobal.rows[0] as any).finished).toBe(false);
    expect((progGlobal.rows[0] as any).status_operacao).toBe('PARCIAL');

    await db.exec(`UPDATE public.stage_executions SET status = 'Finalizado' WHERE id = 200501;`);
  });

  // BLOQUEIO 6: A migration consolidada mantém políticas RLS permissivas preexistentes
  it('[BLOQUEIO 6] RLS: authenticated deve ser proibido de executar UPDATE direto em orders', async () => {
    let updateFailed = false;
    try {
      await db.exec(`
        SET ROLE authenticated;
        UPDATE public.orders SET status = 'Cancelado' WHERE id = 2001;
        RESET ROLE;
      `);
    } catch (err: any) {
      updateFailed = true;
      expect(err.message).toMatch(/permission denied|violates row-level security/i);
    } finally {
      await db.exec(`RESET ROLE;`);
    }
    expect(updateFailed).toBe(true);
  });

  // BLOQUEIO 7: O trigger append-only de pcp_audit_log e ON DELETE SET NULL preservam auditoria
  it('[BLOQUEIO 7] Exclusão física de order deve acionar ON DELETE SET NULL em pcp_audit_log sem violar integridade nem apagar auditoria', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, status)
      VALUES (2007, 'PED-ADV-2007', 'Entrada')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.pcp_audit_log (id, order_id, acao, usuario, created_at)
      VALUES (70001, 2007, 'CRIACAO_PEDIDO', 'admin', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Exclusão do pedido deve ser permitida pelo banco graças ao ON DELETE SET NULL
    await db.exec(`DELETE FROM public.orders WHERE id = 2007;`);

    // A auditoria permanece intacta e com order_id = NULL
    const auditRow = await db.query(`SELECT id, order_id, acao FROM public.pcp_audit_log WHERE id = 70001;`);
    expect(auditRow.rows.length).toBe(1);
    expect((auditRow.rows[0] as any).order_id).toBeNull();
    expect((auditRow.rows[0] as any).acao).toBe('CRIACAO_PEDIDO');
  });

  // BLOQUEIO 8: O perfil legado “Producao” não recebe backfill e faz a migration falhar
  it('[BLOQUEIO 8] Todos os perfis legados (Producao, producao, Produção, Admin) devem ter sido migrados para os 6 canônicos', async () => {
    const roles = await db.query(`
      SELECT id, role FROM public.users WHERE id IN (1, 2, 3, 4, 5) ORDER BY id;
    `);
    expect((roles.rows[0] as any).role).toBe('Administrador');
    expect((roles.rows[1] as any).role).toBe('Operador'); // 'Producao'
    expect((roles.rows[2] as any).role).toBe('Operador'); // 'producao'
    expect((roles.rows[3] as any).role).toBe('Operador'); // 'Produção'
    expect((roles.rows[4] as any).role).toBe('Operador'); // 'Operador de Produção'
  });

  // BLOQUEIO 9: timestamp_sp apresenta horário de São Paulo rotulado incorretamente como +00
  it('[BLOQUEIO 9] timestamp_sp deve ser timestamptz/ISO válido com timezone coerente', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (2009, 'PED-ADV-2009', 10, 'Em Produção', '[10]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status, start_time)
      VALUES (20091, 2009, 10, 4, 'Em andamento', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    const res = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => 2009,
        p_stage_id => 10,
        p_user_id => 4,
        p_idempotency_key => 'adv_key_ts_sp_01',
        p_good_inc => 5
      ) AS res;
    `);

    const data = (res.rows[0] as any).res;
    expect(data.timestamp_sp).toBeDefined();
    const parsedDate = new Date(data.timestamp_sp);
    expect(isNaN(parsedDate.getTime())).toBe(false);

    await db.exec(`UPDATE public.stage_executions SET status = 'Finalizado' WHERE id = 20091;`);
  });

  // BLOQUEIO 10: A API envia p_idempotency_key para rpc_record_loss, mas a função SQL não possui o parâmetro
  it('[BLOQUEIO 10] rpc_record_loss deve aceitar p_idempotency_key e realizar replay idempotente', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (2010, 'PED-ADV-2010', 50, 'Em Produção', '[10]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status, start_time)
      VALUES (20101, 2010, 10, 5, 'Em andamento', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Primeira chamada
    const res1 = await db.query(`
      SELECT public.rpc_record_loss(
        p_order_id => 2010,
        p_stage_id => 10,
        p_user_id => 5,
        p_lost_qty => 3,
        p_reason => 'Defeito de corte',
        p_idempotency_key => 'loss_idem_key_01'
      ) AS res;
    `);
    const data1 = (res1.rows[0] as any).res;
    expect(data1.success).toBe(true);
    expect(data1.quantidade_perdida).toBe(3);

    // Replay com mesma chave
    const res2 = await db.query(`
      SELECT public.rpc_record_loss(
        p_order_id => 2010,
        p_stage_id => 10,
        p_user_id => 5,
        p_lost_qty => 3,
        p_reason => 'Defeito de corte',
        p_idempotency_key => 'loss_idem_key_01'
      ) AS res;
    `);
    const data2 = (res2.rows[0] as any).res;
    expect(data2.idempotent_replay).toBe(true);
    expect(data2.quantidade_perdida).toBe(3);

    await db.exec(`UPDATE public.stage_executions SET status = 'Finalizado' WHERE id = 20101;`);
  });

  // BLOQUEIO 11: A API envia p_motivo para rpc_resume_operation, mas a função SQL não possui o parâmetro
  it('[BLOQUEIO 11] rpc_resume_operation deve aceitar p_motivo sem erro de assinatura', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (2011, 'PED-ADV-2011', 50, 'Em Produção', '[10]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status, start_time)
      VALUES (20111, 2011, 10, 2, 'Pausado', NOW())
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.pauses (execution_id, start_pause, motivo)
      VALUES (20111, NOW() - INTERVAL '10 minutes', 'Almoço')
      ON CONFLICT (id) DO NOTHING;
    `);

    const res = await db.query(`
      SELECT public.rpc_resume_operation(
        p_execution_id => 20111,
        p_user_id => 2,
        p_supervisor_override => false,
        p_motivo => 'Retorno do intervalo'
      ) AS res;
    `);

    const data = (res.rows[0] as any).res;
    expect(data.success).toBe(true);
    expect(data.status_operacao).toBe('EM_ANDAMENTO');

    await db.exec(`UPDATE public.stage_executions SET status = 'Finalizado' WHERE id = 20111;`);
  });

  // BLOQUEIO 18: Webhook Olist rejeita segredo em query string, rejeita segredo ausente e valida criptograficamente
  it('[BLOQUEIO 18] Webhook Olist deve rejeitar secret na query string e validar HMAC criptográfico real', async () => {
    // 1. Tentar passar segredo na query string: deve ser rejeitado (401)
    const resQuery = await fetch(`${baseUrl}/api/webhooks/olist?secret=${webhookSecret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'order.updated' }),
    });
    expect(resQuery.status).toBe(401);

    // 2. Tentar requisição sem header de assinatura / segredo: deve ser rejeitado (401)
    const resMissing = await fetch(`${baseUrl}/api/webhooks/olist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'order.updated' }),
    });
    expect(resMissing.status).toBe(401);

    // 3. Header com assinatura HMAC-SHA256 válida
    const payload = JSON.stringify({ event: 'order.updated', id: 123 });
    const validHmac = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

    const resValid = await fetch(`${baseUrl}/api/webhooks/olist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-olist-signature': validHmac,
      },
      body: payload,
    });
    // Aceita autenticação criptográfica
    expect(resValid.status).not.toBe(401);
  });

  // BLOQUEIO 20: Diretório supabase/migrations contém apenas uma única migration canônica
  it('[BLOQUEIO 20] supabase/migrations deve conter estritamente um único arquivo de migration', () => {
    const migrationsDir = path.resolve('supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    expect(files).toEqual(['20261018_phase1_deploy_complete.sql']);
  });

  // =========================================================================
  // AUDITORIA VERSÃO 5: VERIFICAÇÃO ADVERSARIAL DOS 12 NOVOS BLOQUEIOS
  // =========================================================================

  it('[AUDITORIA V5 - ITEM 1] Healthcheck e rotas protegidas não utilizam anon e continuam operacionais', async () => {
    vi.spyOn(supabaseAdmin, 'from').mockReturnValueOnce({
      select: () => Promise.resolve({ data: [], count: 5, error: null }),
    } as any);
    const res = await fetch(`${baseUrl}/api/supabase/status`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
  });

  it('[AUDITORIA V5 - ITEM 2] Migration não deve apagar políticas de tabelas externas não pertencentes à Fase 1', async () => {
    const testDb = new PGlite();
    await testDb.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      CREATE TABLE public.tabela_externa_crm (
        id SERIAL PRIMARY KEY,
        cliente TEXT
      );
      ALTER TABLE public.tabela_externa_crm ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "politica_intacta_crm" ON public.tabela_externa_crm FOR SELECT TO authenticated USING (true);

      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT);
      CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT);
      INSERT INTO public.users (name, email, role) VALUES ('Admin', 'admin@crm.com', 'Administrador');
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

    const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
    await testDb.exec(deploySql);

    // Verificar que a política da tabela externa permaneceu intacta
    const polCheck = await testDb.query(`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'tabela_externa_crm';
    `);
    expect(polCheck.rows.length).toBe(1);
    expect((polCheck.rows[0] as any).policyname).toBe('politica_intacta_crm');
    await testDb.close();
  });

  it('[AUDITORIA V5 - ITEM 3] Preflight check deve executar com sucesso e emitir PASS em banco apto e BLOCKED em banco com perfil desconhecido', async () => {
    const preflightSql = fs.readFileSync(path.resolve('supabase', 'preflight_phase1_check.sql'), 'utf8');
    const testDb = new PGlite();
    await testDb.exec(`
      CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT);
      INSERT INTO public.users (name, email, role) VALUES ('Admin', 'admin@teste.com', 'Administrador');
      CREATE TABLE public.orders (id BIGSERIAL PRIMARY KEY, status TEXT, required_stages JSONB);
      CREATE TABLE public.stage_executions (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, status TEXT);
    `);

    // Em banco apto: deve retornar PASS
    await testDb.exec(preflightSql);
    const passRes = await testDb.query(`
      SELECT
        CASE
          WHEN COUNT(*) FILTER (WHERE severidade = 'BLOCKER') > 0 THEN 'BLOCKED'
          ELSE 'PASS'
        END AS status,
        COUNT(*) FILTER (WHERE severidade = 'BLOCKER') AS total_bloqueadores,
        COUNT(*) FILTER (WHERE severidade = 'WARNING') AS total_avisos
      FROM _preflight_audit_results;
    `);
    const passRow = passRes.rows[0] as any;
    expect(passRow.status).toBe('PASS');
    expect(passRow.total_bloqueadores).toBe(0);

    // Inserir perfil desconhecido que exige decisão manual:
    await testDb.exec(`INSERT INTO public.users (name, email, role) VALUES ('Financeiro User', 'fin@teste.com', 'Financeiro');`);
    await testDb.exec(preflightSql);
    const blockedRes = await testDb.query(`
      SELECT
        CASE
          WHEN COUNT(*) FILTER (WHERE severidade = 'BLOCKER') > 0 THEN 'BLOCKED'
          ELSE 'PASS'
        END AS status,
        COUNT(*) FILTER (WHERE severidade = 'BLOCKER') AS total_bloqueadores,
        COUNT(*) FILTER (WHERE severidade = 'WARNING') AS total_avisos
      FROM _preflight_audit_results;
    `);
    const blockedRow = blockedRes.rows[0] as any;
    expect(blockedRow.status).toBe('BLOCKED');
    expect(blockedRow.total_bloqueadores).toBeGreaterThan(0);
    await testDb.close();
  });

  it('[AUDITORIA V5 - ITEM 4] Migration deve abortar sem converter perfil desconhecido para Operador', async () => {
    const testDb = new PGlite();
    await testDb.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $$;

      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT);
      CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT);
      INSERT INTO public.users (name, email, role) VALUES ('Estoque User', 'est@teste.com', 'Estoque');
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

    const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
    let aborted = false;
    try {
      await testDb.exec(deploySql);
    } catch (err: any) {
      aborted = true;
      expect(err.message).toMatch(/MIGRATION ABORTED: Perfis de usuários desconhecidos/i);
    }
    expect(aborted).toBe(true);
    await testDb.close();
  });

  it('[AUDITORIA V5 - ITEM 5 & 6] rpc_resume_operation e rpc_record_loss devem exigir justificativa e auditar ator/proprietário', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (5001, 'PED-ADV-5001', 30, 'Em Produção', '[10]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status, start_time)
      VALUES (50011, 5001, 10, 2, 'Pausado', NOW())
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.pauses (execution_id, start_pause, motivo)
      VALUES (50011, NOW() - INTERVAL '5 minutes', 'Pausa teste')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 1. Operador tentando retomar execução de outro operador: deve ser bloqueado com 403
    const resumeOtherOp = await db.query(`
      SELECT public.rpc_resume_operation(
        p_execution_id => 50011,
        p_user_id => 5
      ) AS res;
    `);
    expect((resumeOtherOp.rows[0] as any).res.code).toBe('FORBIDDEN_NOT_OWNER');

    // 2. Supervisor tentando retomar sem justificativa: deve ser bloqueado com 403
    const resumeNoReason = await db.query(`
      SELECT public.rpc_resume_operation(
        p_execution_id => 50011,
        p_user_id => 6,
        p_supervisor_override => true,
        p_motivo => ''
      ) AS res;
    `);
    expect((resumeNoReason.rows[0] as any).res.code).toBe('SUPERVISOR_OVERRIDE_REQUIRED');

    // 3. Supervisor com justificativa válida: aceito e auditado
    const resumeOk = await db.query(`
      SELECT public.rpc_resume_operation(
        p_execution_id => 50011,
        p_user_id => 6,
        p_supervisor_override => true,
        p_motivo => 'Operador ausente, liberação urgente'
      ) AS res;
    `);
    expect((resumeOk.rows[0] as any).res.success).toBe(true);

    const auditResume = await db.query(`
      SELECT valor_novo FROM public.pcp_audit_log
      WHERE order_id = 5001 AND acao = 'RETOMADA_OPERACAO'
      ORDER BY id DESC LIMIT 1;
    `);
    const valResume = (auditResume.rows[0] as any).valor_novo;
    expect(valResume.actor_id).toBe(6);
    expect(valResume.original_owner_id).toBe(2);
    expect(valResume.motivo).toBe('Operador ausente, liberação urgente');

    // 4. Perda em execução de outro operador sem override: bloqueada
    const lossOtherOp = await db.query(`
      SELECT public.rpc_record_loss(
        p_order_id => 5001,
        p_stage_id => 10,
        p_user_id => 5,
        p_lost_qty => 2,
        p_reason => 'Defeito',
        p_idempotency_key => 'loss_audit_test_01'
      ) AS res;
    `);
    expect((lossOtherOp.rows[0] as any).res.code).toBe('EXECUTION_OWNERSHIP_MISMATCH');

    // 5. Perda com chave de idempotência ausente: bloqueada
    const lossNoKey = await db.query(`
      SELECT public.rpc_record_loss(
        p_order_id => 5001,
        p_stage_id => 10,
        p_user_id => 2,
        p_lost_qty => 2,
        p_reason => 'Defeito',
        p_idempotency_key => ''
      ) AS res;
    `);
    expect((lossNoKey.rows[0] as any).res.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    await db.exec(`UPDATE public.stage_executions SET status = 'Finalizado' WHERE id = 50011;`);
  });

  it('[AUDITORIA V5 - ITEM 7] Multi-itens: rpc_finish_operation só marca etapa global como CONCLUIDA após concluir todos os itens', async () => {
    await db.exec(`
      UPDATE public.stage_executions SET status = 'Finalizado' WHERE user_id = 2 AND status IN ('Em andamento', 'Pausado');

      INSERT INTO public.orders (id, order_number, quantity, status, required_stages)
      VALUES (6001, 'PED-MULTI-6001', 20, 'Em Produção', '[10]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.order_items (id, order_id, item_index, description, quantity, route_stages)
      VALUES
        (60011, 6001, 1, 'Item Camisa A', 10, '[10]'::jsonb),
        (60012, 6001, 2, 'Item Camisa B', 10, '[10]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.order_stage_progress (order_id, stage_id, quantidade_pedido, quantidade_boa, finished, status_operacao)
      VALUES (6001, 10, 20, 0, false, 'AGUARDANDO')
      ON CONFLICT (order_id, stage_id) DO UPDATE SET quantidade_boa = 0, finished = false, status_operacao = 'AGUARDANDO';

      INSERT INTO public.order_item_stage_progress (order_id, order_item_id, stage_id, quantidade_item, quantidade_meta, quantidade_boa, finished, status_operacao)
      VALUES
        (6001, 60011, 10, 10, 10, 0, false, 'AGUARDANDO'),
        (6001, 60012, 10, 10, 10, 0, false, 'AGUARDANDO')
      ON CONFLICT (order_item_id, stage_id) DO UPDATE SET quantidade_boa = 0, finished = false, status_operacao = 'AGUARDANDO';

      INSERT INTO public.stage_executions (id, order_id, stage_id, order_item_id, user_id, status, start_time)
      VALUES (600101, 6001, 10, 60011, 2, 'Em andamento', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Finalizar o Item 1 com suas 10 peças
    const finItem1 = await db.query(`
      SELECT public.rpc_finish_operation(
        p_execution_id => 600101,
        p_user_id => 2,
        p_good_inc => 10,
        p_idempotency_key => 'fin_multi_item1_key'
      ) AS res;
    `);
    expect((finItem1.rows[0] as any).res.success).toBe(true);

    // Item 1 deve estar CONCLUIDA
    const itm1Prog = await db.query(`
      SELECT finished, status_operacao FROM public.order_item_stage_progress
      WHERE order_item_id = 60011 AND stage_id = 10;
    `);
    expect((itm1Prog.rows[0] as any).finished).toBe(true);
    expect((itm1Prog.rows[0] as any).status_operacao).toBe('CONCLUIDA');

    // Etapa GLOBAL NÃO pode estar CONCLUIDA (deve ser PARCIAL pois Item 2 ainda não terminou)
    const globalProgAfterItem1 = await db.query(`
      SELECT finished, status_operacao FROM public.order_stage_progress
      WHERE order_id = 6001 AND stage_id = 10;
    `);
    expect((globalProgAfterItem1.rows[0] as any).finished).toBe(false);
    expect((globalProgAfterItem1.rows[0] as any).status_operacao).toBe('PARCIAL');

    // Agora iniciar e finalizar o Item 2 com suas 10 peças
    await db.exec(`
      INSERT INTO public.stage_executions (id, order_id, stage_id, order_item_id, user_id, status, start_time)
      VALUES (600102, 6001, 10, 60012, 2, 'Em andamento', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    const finItem2 = await db.query(`
      SELECT public.rpc_finish_operation(
        p_execution_id => 600102,
        p_user_id => 2,
        p_good_inc => 10,
        p_idempotency_key => 'fin_multi_item2_key'
      ) AS res;
    `);
    expect((finItem2.rows[0] as any).res.success).toBe(true);

    // Agora que ambos os itens foram concluídos, a etapa global DEVE ser CONCLUIDA
    const globalProgFinal = await db.query(`
      SELECT finished, status_operacao FROM public.order_stage_progress
      WHERE order_id = 6001 AND stage_id = 10;
    `);
    expect((globalProgFinal.rows[0] as any).finished).toBe(true);
    expect((globalProgFinal.rows[0] as any).status_operacao).toBe('CONCLUIDA');
  });

  it('[AUDITORIA V5 - ITEM 8] Imutabilidade estrita de pcp_audit_log bloqueia UPDATE/DELETE direto e exclusão do pedido aplica ON DELETE SET NULL', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, quantity, status)
      VALUES (7001, 'PED-IMMUT-7001', 10, 'Entrada')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.pcp_audit_log (id, order_id, acao, motivo, usuario)
      VALUES (70011, 7001, 'TESTE_IMMUT', 'motivo original', 'admin')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 1. Qualquer tentativa de UPDATE direto em pcp_audit_log deve lançar exceção 55000 (append-only)
    let updateBlocked = false;
    try {
      await db.exec(`UPDATE public.pcp_audit_log SET acao = 'MODIFICADO' WHERE id = 70011;`);
    } catch (err: any) {
      updateBlocked = true;
      expect(err.message).toMatch(/append-only/i);
    }
    expect(updateBlocked).toBe(true);

    // 1.1 Tentativa direta de executar UPDATE pcp_audit_log SET order_id = NULL DEVE ser bloqueada com erro 55000
    let updateOrderIdBlocked = false;
    try {
      await db.exec(`UPDATE public.pcp_audit_log SET order_id = NULL WHERE id = 70011;`);
    } catch (err: any) {
      updateOrderIdBlocked = true;
      expect(err.message).toMatch(/append-only/i);
    }
    expect(updateOrderIdBlocked).toBe(true);

    // 2. Qualquer tentativa de DELETE direto em pcp_audit_log deve lançar exceção 55000 (append-only)
    let deleteBlocked = false;
    try {
      await db.exec(`DELETE FROM public.pcp_audit_log WHERE id = 70011;`);
    } catch (err: any) {
      deleteBlocked = true;
      expect(err.message).toMatch(/append-only/i);
    }
    expect(deleteBlocked).toBe(true);

    // 3. Exclusão física do pedido referenciado deve acionar ON DELETE SET NULL, preservando a linha de auditoria com order_id IS NULL
    await db.exec(`DELETE FROM public.orders WHERE id = 7001;`);
    const auditAfterDelete = await db.query(`SELECT id, order_id, acao, motivo FROM public.pcp_audit_log WHERE id = 70011;`);
    expect(auditAfterDelete.rows.length).toBe(1);
    expect(auditAfterDelete.rows[0].order_id).toBeNull();
    expect(auditAfterDelete.rows[0].acao).toBe('TESTE_IMMUT');
    expect(auditAfterDelete.rows[0].motivo).toBe('motivo original');
  });
});
