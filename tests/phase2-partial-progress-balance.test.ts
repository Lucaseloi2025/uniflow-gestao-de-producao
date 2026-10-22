import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Fase 2 — Regra Única de Cálculo: Apontamento Parcial e Abatimento de Saldo (152 Peças)', () => {
  let db: PGlite;
  const deploySql = fs.readFileSync(
    path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
    'utf8'
  );

  const estampagemStageId = 17;
  const operatorFelipeId = 15;
  const orderId = 3224;
  const totalQuantity = 152;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Roles & Schema
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;
    `);

    // 2. Official schema
    await db.exec(deploySql);

    // 3. Setup stages Ficha de aprovação e Estampagem
    await db.exec(`
      INSERT INTO public.stages (id, name, sector_name, active, sort_order, calculation_type)
      VALUES 
        (1, 'Ficha de aprovação', 'Preparação / Arte', 1, 1, 'por_pedido'),
        (17, 'Estampagem', 'Personalização', 1, 13, 'por_peca')
      ON CONFLICT (id) DO UPDATE SET active = EXCLUDED.active;
    `);

    // 4. Setup operator Felipe
    await db.exec(`
      INSERT INTO public.users (id, name, email, role, active, sector_name)
      VALUES 
        (15, 'Felipe comfort', 'felipe@comfortpro.com', 'Operador', 1, 'Estampagem')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 5. Setup test order (#OLIST-1093 com 152 peças)
    await db.exec(`
      INSERT INTO public.orders (id, order_number, client_name, quantity, status, required_stages, stages_status)
      VALUES (
        ${orderId},
        'OLIST-1093',
        'Studio Pilates Ventura',
        ${totalQuantity},
        'Em Produção',
        '[17]'::jsonb,
        jsonb_build_array(
          jsonb_build_object('id', 17, 'name', 'Estampagem', 'finished', false, 'quantidade_boa', 0, 'saldo_pendente', ${totalQuantity})
        )
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('1. Iniciar etapa de Estampagem deve criar execução ativa sem duplicidade', async () => {
    const res = await db.query<{ rpc_start_operation: any }>(`
      SELECT public.rpc_start_operation(
        p_order_id := ${orderId}::BIGINT,
        p_stage_id := ${estampagemStageId}::BIGINT,
        p_user_id := ${operatorFelipeId}::BIGINT
      ) as rpc_start_operation;
    `);

    const result = res.rows[0].rpc_start_operation;
    expect(result.success).toBe(true);
    expect(result.execution_id).toBeDefined();

    const execRow = await db.query<{ id: number; status: string }>(`
      SELECT id, status FROM public.stage_executions WHERE order_id = ${orderId} AND stage_id = ${estampagemStageId};
    `);
    expect(execRow.rows.length).toBe(1);
    expect(execRow.rows[0].status).toBe('Em andamento');
  });

  it('2. Apontamento parcial de 148 peças deve abater o saldo para 4 e marcar status PARCIAL', async () => {
    const res = await db.query<{ rpc_record_production: any }>(`
      SELECT public.rpc_record_production(
        p_order_id := ${orderId}::BIGINT,
        p_stage_id := ${estampagemStageId}::BIGINT,
        p_user_id := ${operatorFelipeId}::BIGINT,
        p_idempotency_key := 'prog_1093_148'::TEXT,
        p_good_inc := 148
      ) as rpc_record_production;
    `);

    const result = res.rows[0].rpc_record_production;
    expect(result.success).toBe(true);
    expect(result.quantidade_boa).toBe(148);
    expect(result.saldo_pendente).toBe(4);
    expect(result.status_operacao).toBe('PARCIAL');
    expect(result.finished).toBe(false);

    // Validação na tabela order_stage_progress
    const progRow = await db.query<{ quantidade_boa: number; saldo_pendente: number; finished: boolean; status_operacao: string }>(`
      SELECT quantidade_boa, saldo_pendente, finished, status_operacao
      FROM public.order_stage_progress
      WHERE order_id = ${orderId} AND stage_id = ${estampagemStageId};
    `);
    expect(progRow.rows[0].quantidade_boa).toBe(148);
    expect(progRow.rows[0].saldo_pendente).toBe(4);
    expect(progRow.rows[0].finished).toBe(false);
    expect(progRow.rows[0].status_operacao).toBe('PARCIAL');
  });

  it('3. Pausar a etapa deve preservar o saldo restante de 4 e o progresso acumulado de 148', async () => {
    const execRow = await db.query<{ id: number }>(`
      SELECT id FROM public.stage_executions WHERE order_id = ${orderId} AND stage_id = ${estampagemStageId} AND status = 'Em andamento';
    `);
    const execId = execRow.rows[0].id;

    const res = await db.query<{ rpc_pause_operation: any }>(`
      SELECT public.rpc_pause_operation(
        p_execution_id := ${execId}::BIGINT,
        p_user_id := ${operatorFelipeId}::BIGINT,
        p_motivo := 'Pausa para almoço'::TEXT
      ) as rpc_pause_operation;
    `);
    expect(res.rows[0].rpc_pause_operation.success).toBe(true);

    // Confirma que order_stage_progress mantém 148 concluídas e 4 de saldo
    const progRow = await db.query<{ quantidade_boa: number; saldo_pendente: number; status_operacao: string }>(`
      SELECT quantidade_boa, saldo_pendente, status_operacao
      FROM public.order_stage_progress
      WHERE order_id = ${orderId} AND stage_id = ${estampagemStageId};
    `);
    expect(progRow.rows[0].quantidade_boa).toBe(148);
    expect(progRow.rows[0].saldo_pendente).toBe(4);
  });

  it('4. Retomar e apontar as 4 peças restantes deve atingir 152 peças, saldo 0 e status CONCLUIDA', async () => {
    const execRow = await db.query<{ id: number }>(`
      SELECT id FROM public.stage_executions WHERE order_id = ${orderId} AND stage_id = ${estampagemStageId} AND status = 'Pausado';
    `);
    const execId = execRow.rows[0].id;

    // Retoma
    const resumeRes = await db.query<{ rpc_resume_operation: any }>(`
      SELECT public.rpc_resume_operation(
        p_execution_id := ${execId}::BIGINT,
        p_user_id := ${operatorFelipeId}::BIGINT
      ) as rpc_resume_operation;
    `);
    expect(resumeRes.rows[0].rpc_resume_operation.success).toBe(true);

    // Aponta as 4 peças restantes
    const finalProgRes = await db.query<{ rpc_record_production: any }>(`
      SELECT public.rpc_record_production(
        p_order_id := ${orderId}::BIGINT,
        p_stage_id := ${estampagemStageId}::BIGINT,
        p_user_id := ${operatorFelipeId}::BIGINT,
        p_idempotency_key := 'prog_1093_final_4'::TEXT,
        p_good_inc := 4
      ) as rpc_record_production;
    `);

    const finalProg = finalProgRes.rows[0].rpc_record_production;
    expect(finalProg.success).toBe(true);
    expect(finalProg.quantidade_boa).toBe(152);
    expect(finalProg.saldo_pendente).toBe(0);
    expect(finalProg.status_operacao).toBe('CONCLUIDA');
    expect(finalProg.finished).toBe(true);

    // Finaliza a execução
    const finishRes = await db.query<{ rpc_finish_operation: any }>(`
      SELECT public.rpc_finish_operation(
        p_execution_id := ${execId}::BIGINT,
        p_user_id := ${operatorFelipeId}::BIGINT,
        p_idempotency_key := 'fin_1093_exec'::TEXT,
        p_good_inc := 0,
        p_partial := false
      ) as rpc_finish_operation;
    `);
    expect(finishRes.rows[0].rpc_finish_operation.success).toBe(true);
  });

  it('5. Indicador diário e logs devem contabilizar estritamente 148 + 4 = 152 peças sem inflação', async () => {
    const logsRes = await db.query<{ total_boa: string; qtd_logs: string }>(`
      SELECT 
        COALESCE(SUM(quantidade_boa_incremento), 0) as total_boa,
        COUNT(*) as qtd_logs
      FROM public.order_progress_logs
      WHERE order_id = ${orderId} AND stage_id = ${estampagemStageId};
    `);

    expect(Number(logsRes.rows[0].total_boa)).toBe(152);
    expect(Number(logsRes.rows[0].qtd_logs)).toBe(2); // 1º log com 148 + 2º log com 4

    // Confirma que pcp_audit_log gravou os dois apontamentos com os deltas exatos
    const auditRes = await db.query<{ acao: string; quantidade: number }>(`
      SELECT acao, quantidade
      FROM public.pcp_audit_log
      WHERE order_id = ${orderId} AND stage_id = ${estampagemStageId}
      ORDER BY id ASC;
    `);

    expect(auditRes.rows.length).toBeGreaterThanOrEqual(2);
    const prodAudits = auditRes.rows.filter(a => a.acao === 'APONTAMENTO_PRODUCAO');
    expect(prodAudits[0].quantidade).toBe(148);
    expect(prodAudits[1].quantidade).toBe(4);
  });

  it('6. Deve validar a aplicação do script de reconciliação 20261022_reconciliacao_olist_1093.sql e seu rollback', async () => {
    const reconcileSql = fs.readFileSync(
      path.resolve('supabase', 'migrations', '20261022_reconciliacao_olist_1093.sql'),
      'utf8'
    );
    const rollbackSql = fs.readFileSync(
      path.resolve('supabase', 'migrations', '20261022_reconciliacao_olist_1093_rollback.sql'),
      'utf8'
    );

    // Reseta o estado para simular o cenário exato antes da reconciliação:
    // 148 peças apontadas na etapa 1 e 0 na etapa 17
    await db.exec(`
      DELETE FROM public.order_progress_logs WHERE order_id = ${orderId};
      DELETE FROM public.order_stage_progress WHERE order_id = ${orderId};

      INSERT INTO public.order_stage_progress (order_id, stage_id, quantidade_pedido, quantidade_boa, saldo_pendente, status_operacao, finished)
      VALUES 
        (${orderId}, 1, 152, 148, 4, 'PARCIAL', true),
        (${orderId}, 17, 152, 0, 152, 'LIBERADA', false);

      INSERT INTO public.order_progress_logs (order_id, stage_id, user_id, quantidade_boa_incremento, idempotency_key, observation)
      VALUES (${orderId}, 1, ${operatorFelipeId}, 148, 'test_felipe_148', 'Apontamento inicial 148');
    `);

    // Aplica o script de reconciliação
    await db.exec(reconcileSql);

    // Verifica etapa 17 (Estampagem)
    const prog17 = await db.query<{ quantidade_boa: number; saldo_pendente: number; status_operacao: string; finished: boolean }>(`
      SELECT quantidade_boa, saldo_pendente, status_operacao, finished
      FROM public.order_stage_progress
      WHERE order_id = ${orderId} AND stage_id = 17;
    `);
    expect(prog17.rows[0].quantidade_boa).toBe(148);
    expect(prog17.rows[0].saldo_pendente).toBe(4);
    expect(prog17.rows[0].status_operacao).toBe('PARCIAL');
    expect(prog17.rows[0].finished).toBe(false);

    // Verifica etapa 1 (Ficha)
    const prog1 = await db.query<{ quantidade_pedido: number; quantidade_boa: number; saldo_pendente: number; status_operacao: string; finished: boolean }>(`
      SELECT quantidade_pedido, quantidade_boa, saldo_pendente, status_operacao, finished
      FROM public.order_stage_progress
      WHERE order_id = ${orderId} AND stage_id = 1;
    `);
    expect(prog1.rows[0].quantidade_pedido).toBe(1);
    expect(prog1.rows[0].quantidade_boa).toBe(1);
    expect(prog1.rows[0].saldo_pendente).toBe(0);
    expect(prog1.rows[0].status_operacao).toBe('CONCLUIDA');
    expect(prog1.rows[0].finished).toBe(true);

    // Verifica log transferido
    const log17 = await db.query<{ stage_id: number; quantidade_boa_incremento: number }>(`
      SELECT stage_id, quantidade_boa_incremento
      FROM public.order_progress_logs
      WHERE order_id = ${orderId};
    `);
    expect(log17.rows[0].stage_id).toBe(17);
    expect(log17.rows[0].quantidade_boa_incremento).toBe(148);

    // Verifica pcp_audit_log
    const auditReconcile = await db.query<{ acao: string; quantidade: number }>(`
      SELECT acao, quantidade
      FROM public.pcp_audit_log
      WHERE order_id = ${orderId} AND acao = 'RECONCILIACAO_APONTAMENTO_PARCIAL';
    `);
    expect(auditReconcile.rows.length).toBe(1);
    expect(auditReconcile.rows[0].quantidade).toBe(148);

    // Testa o Rollback do script
    await db.exec(rollbackSql);

    const rollbackProg17 = await db.query<{ quantidade_boa: number; saldo_pendente: number }>(`
      SELECT quantidade_boa, saldo_pendente
      FROM public.order_stage_progress
      WHERE order_id = ${orderId} AND stage_id = 17;
    `);
    expect(rollbackProg17.rows[0].quantidade_boa).toBe(0);
    expect(rollbackProg17.rows[0].saldo_pendente).toBe(152);

    const rollbackLog = await db.query<{ stage_id: number }>(`
      SELECT stage_id FROM public.order_progress_logs WHERE order_id = ${orderId};
    `);
    expect(rollbackLog.rows[0].stage_id).toBe(1);
  });
});
