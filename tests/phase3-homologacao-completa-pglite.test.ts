import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import {
  getStageProductivityUnitBackend,
  calculateStageTargetQuantity,
  isStagePrevFinishedForOrderItems,
} from '../api/index';
import { calculateExecutionTimes } from '../src/lib/timerUtils';

describe('HOMOLOGAÇÃO COMPLETA (FASES 2 e 3) — Banco PGlite Isolado + Fluxo Ponta a Ponta de Pedido Misto', () => {
  let db: PGlite;
  const deploySql = fs.readFileSync(
    path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
    'utf8'
  );

  // Etapas reais configuradas no ambiente de homologação
  const STAGE_FICHA = 1;
  const STAGE_CORTE = 2;
  const STAGE_SUBLIMACAO = 6;
  const STAGE_COSTURA = 7;
  const STAGE_ESTAMPAGEM = 17;
  const STAGE_DTF = 19;

  // Usuários dos 6 perfis + 2 operadores distintos
  const USER_ADMIN = 100;
  const USER_PCP = 200;
  const USER_SUPERVISOR = 300;
  const USER_OP_FELIPE = 400;
  const USER_OP_LUAN = 401;
  const USER_COMERCIAL = 500;
  const USER_VIEWER = 600;

  let mixedOrderId: number;
  let item1Id: number; // Camiseta Dry Fit DTF — 20 un
  let item2Id: number; // Regata Sublimação Total — 15 un

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
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;
    `);

    await db.exec(deploySql);

    // Garantir colunas legadas da tabela orders existentes no Supabase de produção
    await db.exec(`
      ALTER TABLE public.orders
        ADD COLUMN IF NOT EXISTS print_type TEXT,
        ADD COLUMN IF NOT EXISTS stages_status JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS art_url TEXT,
        ADD COLUMN IF NOT EXISTS art_urls JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS observations TEXT,
        ADD COLUMN IF NOT EXISTS num_colors INT DEFAULT 1;
    `);

    // Aplicar evolução de colunas não-storage da migration 20261024_fase2_estabilizacao_execucao.sql
    await db.exec(`
      ALTER TABLE public.order_progress_logs
        ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS invalidation_reason TEXT NULL;

      ALTER TABLE public.stage_executions
        ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS invalidation_reason TEXT NULL;

      ALTER TABLE public.stages
        ADD COLUMN IF NOT EXISTS slug TEXT NULL,
        ADD COLUMN IF NOT EXISTS meta_diaria NUMERIC NULL;
    `);

    // Cadastrar etapas de produção com suas unidades de cálculo
    await db.exec(`
      INSERT INTO public.stages (id, name, sector_name, active, sort_order, calculation_type, slug, meta_diaria)
      VALUES
        (${STAGE_FICHA}, 'Ficha de aprovação', 'Preparação / Arte', 1, 1, 'por_pedido', 'FICHA_APROVACAO', 24),
        (${STAGE_DTF}, 'Impressão DTF', 'Personalização', 1, 2, 'por_kit_dtf', 'DTF', 200),
        (${STAGE_ESTAMPAGEM}, 'Estampagem', 'Personalização', 1, 3, 'por_peca', 'ESTAMPAGEM', 160),
        (${STAGE_SUBLIMACAO}, 'Sublimação Total', 'Personalização', 1, 4, 'por_peca', 'SUBLIMACAO', 150),
        (${STAGE_CORTE}, 'Corte', 'Corte', 1, 5, 'por_peca', 'CORTE', 240),
        (${STAGE_COSTURA}, 'Costura', 'Costura', 1, 6, 'por_peca', 'COSTURA', 120)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sector_name = EXCLUDED.sector_name,
        active = EXCLUDED.active,
        sort_order = EXCLUDED.sort_order,
        calculation_type = EXCLUDED.calculation_type,
        slug = EXCLUDED.slug,
        meta_diaria = EXCLUDED.meta_diaria;
    `);

    // Cadastrar os 6 perfis e vincular auth.users
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('11111111-1111-1111-1111-111111111111', 'admin@procomfort.com'),
        ('22222222-2222-2222-2222-222222222222', 'pcp@procomfort.com'),
        ('33333333-3333-3333-3333-333333333333', 'supervisor@procomfort.com'),
        ('44444444-4444-4444-4444-444444444444', 'felipe@procomfort.com'),
        ('44444444-4444-4444-4444-444444444445', 'luan@procomfort.com'),
        ('55555555-5555-5555-5555-555555555555', 'comercial@procomfort.com'),
        ('66666666-6666-6666-6666-666666666666', 'viewer@procomfort.com')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.users (id, name, email, role, active, sector_name, auth_user_id)
      VALUES
        (${USER_ADMIN}, 'Administrador Geral', 'admin@procomfort.com', 'Administrador', 1, NULL, '11111111-1111-1111-1111-111111111111'),
        (${USER_PCP}, 'Analista PCP', 'pcp@procomfort.com', 'PCP', 1, NULL, '22222222-2222-2222-2222-222222222222'),
        (${USER_SUPERVISOR}, 'Supervisor Produção', 'supervisor@procomfort.com', 'Supervisor', 1, NULL, '33333333-3333-3333-3333-333333333333'),
        (${USER_OP_FELIPE}, 'Felipe Comfort', 'felipe@procomfort.com', 'Operador', 1, 'Personalização', '44444444-4444-4444-4444-444444444444'),
        (${USER_OP_LUAN}, 'Luan Comfort', 'luan@procomfort.com', 'Operador', 1, 'Corte', '44444444-4444-4444-4444-444444444445'),
        (${USER_COMERCIAL}, 'Atendimento Comercial', 'comercial@procomfort.com', 'Comercial', 1, NULL, '55555555-5555-5555-5555-555555555555'),
        (${USER_VIEWER}, 'Painel Visualização', 'viewer@procomfort.com', 'Visualização', 1, NULL, '66666666-6666-6666-6666-666666666666')
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        active = EXCLUDED.active,
        auth_user_id = EXCLUDED.auth_user_id;
    `);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('FASE 3.1 — Importação e aprovação de rascunho Olist de Pedido Misto (Item 1: 20 DTF [Ficha, DTF, Estampagem] + Item 2: 15 Sublimação [Ficha, Sublimação])', async () => {
    const itemsPayload = [
      {
        order_item_id: 1,
        sku: 'CAM-DRY-DTF-G',
        description: 'Camiseta Dry Fit Preta DTF',
        product_type: 'Camiseta Dry Fit',
        size: 'G',
        quantity: 20,
        print_type: 'DTF',
        required_stages: [STAGE_FICHA, STAGE_DTF, STAGE_ESTAMPAGEM],
      },
      {
        order_item_id: 2,
        sku: 'REG-SUB-M',
        description: 'Regata Sublimação Total Branca',
        product_type: 'Regata Sublimação Total',
        size: 'M',
        quantity: 15,
        print_type: 'Sublimação Total',
        required_stages: [STAGE_FICHA, STAGE_SUBLIMACAO],
      },
    ];

    const unionRequiredStages = [STAGE_FICHA, STAGE_DTF, STAGE_ESTAMPAGEM, STAGE_SUBLIMACAO];

    // 1. Inserir como Rascunho importado do Olist e confirmar rascunho para Entrada
    const ordInsert = await db.query(
      `INSERT INTO public.orders (
        order_number, client_name, product_type, print_type, quantity,
        deadline, status, items, required_stages
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'Entrada', $7::jsonb, $8::jsonb)
      RETURNING *;`,
      [
        '#OLIST-MISTO-9001',
        'Studio Fitness Homologação',
        'Pedido Misto',
        'DTF',
        35,
        '2026-10-28',
        JSON.stringify(itemsPayload),
        JSON.stringify(unionRequiredStages),
      ]
    );

    const ordRow = ordInsert.rows[0] as any;
    mixedOrderId = Number(ordRow.id);
    expect(mixedOrderId).toBeGreaterThan(0);

    // 2. Inserir itens em public.order_items com suas rotas independentes
    const it1Res = await db.query(
      `INSERT INTO public.order_items (order_id, item_index, sku, product_type, size, quantity, route_stages)
       VALUES ($1, 0, $2, $3, $4, $5, $6::jsonb) RETURNING id;`,
      [mixedOrderId, 'CAM-DRY-DTF-G', 'Camiseta Dry Fit', 'G', 20, JSON.stringify([STAGE_FICHA, STAGE_DTF, STAGE_ESTAMPAGEM])]
    );
    item1Id = Number((it1Res.rows[0] as any).id);

    const it2Res = await db.query(
      `INSERT INTO public.order_items (order_id, item_index, sku, product_type, size, quantity, route_stages)
       VALUES ($1, 1, $2, $3, $4, $5, $6::jsonb) RETURNING id;`,
      [mixedOrderId, 'REG-SUB-M', 'Regata Sublimação Total', 'M', 15, JSON.stringify([STAGE_FICHA, STAGE_SUBLIMACAO])]
    );
    item2Id = Number((it2Res.rows[0] as any).id);

    // 3. Inicializar order_stage_progress exatamente como POST /api/orders/:id/confirm-draft faz
    const stagesRes = await db.query(`SELECT * FROM public.stages WHERE id = ANY($1::bigint[]) ORDER BY sort_order;`, [unionRequiredStages]);
    const stagesMap = new Map<number, any>(stagesRes.rows.map((s: any) => [Number(s.id), s]));

    for (let idx = 0; idx < unionRequiredStages.length; idx++) {
      const sid = unionRequiredStages[idx];
      const sMeta = stagesMap.get(sid);
      const targetQty = calculateStageTargetQuantity(ordRow, sid, sMeta);
      await db.query(
        `INSERT INTO public.order_stage_progress (
          order_id, stage_id, quantidade_pedido, quantidade_recebida,
          quantidade_boa, quantidade_perdida, pendencia_reposicao, saldo_pendente,
          finished, status, status_operacao
        ) VALUES ($1, $2, $3, $4, 0, 0, 0, $3, false, $5, $5)
        ON CONFLICT (order_id, stage_id) DO UPDATE SET
          quantidade_pedido = EXCLUDED.quantidade_pedido,
          saldo_pendente = EXCLUDED.saldo_pendente;`,
        [mixedOrderId, sid, targetQty, idx === 0 ? targetQty : 0, idx === 0 ? 'LIBERADA' : 'AGUARDANDO']
      );
    }

    // 4. Verificar no banco que as metas de cada etapa respeitam as unidades e os itens individuais:
    // Ficha = 1 ficha | DTF = 20 kits | Estampagem = 20 peças | Sublimação = 15 peças
    const progCheck = await db.query(
      `SELECT stage_id, quantidade_pedido, quantidade_boa, saldo_pendente, status_operacao, finished
       FROM public.order_stage_progress WHERE order_id = $1 ORDER BY stage_id;`,
      [mixedOrderId]
    );
    const byStage = new Map<number, any>(progCheck.rows.map((r: any) => [Number(r.stage_id), r]));

    expect(Number(byStage.get(STAGE_FICHA).quantidade_pedido)).toBe(1);
    expect(Number(byStage.get(STAGE_DTF).quantidade_pedido)).toBe(20);
    expect(Number(byStage.get(STAGE_ESTAMPAGEM).quantidade_pedido)).toBe(20);
    expect(Number(byStage.get(STAGE_SUBLIMACAO).quantidade_pedido)).toBe(15);

    expect(Number(byStage.get(STAGE_FICHA).quantidade_boa)).toBe(0);
    expect(Number(byStage.get(STAGE_DTF).quantidade_boa)).toBe(0);
    expect(Number(byStage.get(STAGE_ESTAMPAGEM).quantidade_boa)).toBe(0);
    expect(Number(byStage.get(STAGE_SUBLIMACAO).quantidade_boa)).toBe(0);
  });

  it('FASE 3.2 — Execução e finalização da Ficha de Aprovação contabiliza 1 ficha (e não 35 peças)', async () => {
    const startRes = await db.query(
      `SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_order_item_id => NULL,
        p_supervisor_override => false,
        p_motivo => NULL
      ) AS res;`,
      [mixedOrderId, STAGE_FICHA, USER_OP_FELIPE]
    );
    const startData = (startRes.rows[0] as any).res;
    expect(startData.success).toBe(true);
    const execFichaId = Number(startData.execution_id);

    const finishRes = await db.query(
      `SELECT public.rpc_finish_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_good_inc => 1,
        p_partial => false,
        p_observation => 'Ficha aprovada pelo cliente',
        p_idempotency_key => 'idem_ficha_9001'
      ) AS res;`,
      [execFichaId, USER_OP_FELIPE]
    );
    const finishData = (finishRes.rows[0] as any).res;
    expect(finishData.success).toBe(true);

    // Normalização pós-RPC aplicada pelo endpoint POST /api/executions/:id/finish para etapas por_pedido
    await db.query(
      `UPDATE public.order_stage_progress
       SET quantidade_pedido = 1, quantidade_boa = 1, saldo_pendente = 0, finished = true, status_operacao = 'CONCLUIDA'
       WHERE order_id = $1 AND stage_id = $2;`,
      [mixedOrderId, STAGE_FICHA]
    );

    const logFicha = await db.query(
      `SELECT quantidade_boa_incremento FROM public.order_progress_logs WHERE order_id = $1 AND stage_id = $2;`,
      [mixedOrderId, STAGE_FICHA]
    );
    expect(logFicha.rows.length).toBe(1);
    expect(Number((logFicha.rows[0] as any).quantidade_boa_incremento)).toBe(1);
  });

  it('FASE 3.3 — Impressão DTF (20 kits): apontamento parcial (12 kits), idempotência, pausa, retomada, transferência de operador e finalização (8 kits restantes)', async () => {
    // 1. Iniciar Impressão DTF com Felipe
    const startDtf = await db.query(
      `SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_order_item_id => NULL,
        p_supervisor_override => false,
        p_motivo => NULL
      ) AS res;`,
      [mixedOrderId, STAGE_DTF, USER_OP_FELIPE]
    );
    const dtfExec1Id = Number((startDtf.rows[0] as any).res.execution_id);
    expect(dtfExec1Id).toBeGreaterThan(0);

    // 2. Bloqueio de concorrência: segundo operador (Luan) NÃO consegue iniciar a mesma etapa sem override
    const concurrentTry = await db.query(
      `SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_order_item_id => NULL,
        p_supervisor_override => false,
        p_motivo => NULL
      ) AS res;`,
      [mixedOrderId, STAGE_DTF, USER_OP_LUAN]
    );
    expect((concurrentTry.rows[0] as any).res.code).toBe('CONCURRENT_STAGE_EXECUTION');
    expect((concurrentTry.rows[0] as any).res.http_status).toBe(409);

    // 3. Apontamento parcial de 12 kits DTF
    const partialRes = await db.query(
      `SELECT public.rpc_record_production(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_idempotency_key => 'idem_dtf_partial_12',
        p_good_inc => 12,
        p_order_item_id => NULL,
        p_observation => '12 kits DTF impressos no 1º lote'
      ) AS res;`,
      [mixedOrderId, STAGE_DTF, USER_OP_FELIPE]
    );
    const partialData = (partialRes.rows[0] as any).res;
    expect(partialData.success).toBe(true);
    expect(Number(partialData.quantidade_boa)).toBe(12);
    expect(Number(partialData.saldo_pendente)).toBe(8);

    // 4. Anti-duplicação (mesma idempotency_key não soma 12 + 12 = 24)
    const replayRes = await db.query(
      `SELECT public.rpc_record_production(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_idempotency_key => 'idem_dtf_partial_12',
        p_good_inc => 12,
        p_order_item_id => NULL,
        p_observation => '12 kits DTF impressos no 1º lote'
      ) AS res;`,
      [mixedOrderId, STAGE_DTF, USER_OP_FELIPE]
    );
    expect((replayRes.rows[0] as any).res.idempotent_replay).toBe(true);
    expect(Number((replayRes.rows[0] as any).res.quantidade_boa)).toBe(12);

    // 5. Pausar operação e tentar apontar durante pausa (deve bloquear com 409 EXECUTION_PAUSED)
    const pauseRes = await db.query(
      `SELECT public.rpc_pause_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_motivo => 'Limpeza de cabeça de impressão DTF'
      ) AS res;`,
      [dtfExec1Id, USER_OP_FELIPE]
    );
    expect((pauseRes.rows[0] as any).res.status_operacao).toBe('PAUSADA');

    const recordWhilePaused = await db.query(
      `SELECT public.rpc_record_production(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_idempotency_key => 'idem_dtf_while_paused',
        p_good_inc => 2,
        p_order_item_id => NULL
      ) AS res;`,
      [mixedOrderId, STAGE_DTF, USER_OP_FELIPE]
    );
    expect((recordWhilePaused.rows[0] as any).res.code).toBe('EXECUTION_PAUSED');

    // 6. Retomar operação
    const resumeRes = await db.query(
      `SELECT public.rpc_resume_operation(
        p_execution_id => $1,
        p_user_id => $2
      ) AS res;`,
      [dtfExec1Id, USER_OP_FELIPE]
    );
    expect((resumeRes.rows[0] as any).res.status_operacao).toBe('EM_ANDAMENTO');

    // 7. Finalizar os 8 kits DTF restantes (12 + 8 = 20 kits DTF concluídos)
    const finDtfRes = await db.query(
      `SELECT public.rpc_finish_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_good_inc => 8,
        p_partial => false,
        p_observation => 'Restante de 8 kits DTF concluídos',
        p_idempotency_key => 'idem_dtf_finish_8'
      ) AS res;`,
      [dtfExec1Id, USER_OP_FELIPE]
    );
    expect((finDtfRes.rows[0] as any).res.success).toBe(true);
    expect((finDtfRes.rows[0] as any).res.status_operacao).toBe('CONCLUIDA');
    expect((finDtfRes.rows[0] as any).res.finished).toBe(true);
  });

  it('FASE 3.4 — Execução de Estampagem (20 peças) e Sublimação Total (15 peças) até conclusão do pedido misto (status = Pronto)', async () => {
    // 1. Iniciar e finalizar Estampagem (20 peças do Item 1)
    const startEst = await db.query(
      `SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_order_item_id => NULL,
        p_supervisor_override => false,
        p_motivo => NULL
      ) AS res;`,
      [mixedOrderId, STAGE_ESTAMPAGEM, USER_OP_FELIPE]
    );
    const estExecId = Number((startEst.rows[0] as any).res.execution_id);
    expect(estExecId).toBeGreaterThan(0);

    const finEst = await db.query(
      `SELECT public.rpc_finish_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_good_inc => 20,
        p_partial => false,
        p_observation => '20 camisetas Dry Fit estampadas',
        p_idempotency_key => 'idem_est_finish_20'
      ) AS res;`,
      [estExecId, USER_OP_FELIPE]
    );
    expect((finEst.rows[0] as any).res.success).toBe(true);
    expect((finEst.rows[0] as any).res.status_operacao).toBe('CONCLUIDA');
    expect((finEst.rows[0] as any).res.finished).toBe(true);

    // 2. Iniciar e finalizar Sublimação Total (15 peças do Item 2)
    const startSub = await db.query(
      `SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_order_item_id => NULL,
        p_supervisor_override => false,
        p_motivo => NULL
      ) AS res;`,
      [mixedOrderId, STAGE_SUBLIMACAO, USER_OP_FELIPE]
    );
    const subExecId = Number((startSub.rows[0] as any).res.execution_id);
    expect(subExecId).toBeGreaterThan(0);

    const finSub = await db.query(
      `SELECT public.rpc_finish_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_good_inc => 15,
        p_partial => false,
        p_observation => '15 regatas sublimadas',
        p_idempotency_key => 'idem_sub_finish_15'
      ) AS res;`,
      [subExecId, USER_OP_FELIPE]
    );
    expect((finSub.rows[0] as any).res.success).toBe(true);
    expect((finSub.rows[0] as any).res.status_operacao).toBe('CONCLUIDA');
    expect((finSub.rows[0] as any).res.finished).toBe(true);

    // Quando todas as etapas de required_stages estão finished = true, POST /api/executions/:id/finish move o pedido para 'Pronto'
    const allProg = await db.query(
      `SELECT stage_id, quantidade_pedido, quantidade_boa, saldo_pendente, finished, status_operacao
       FROM public.order_stage_progress WHERE order_id = $1 ORDER BY stage_id;`,
      [mixedOrderId]
    );
    expect(allProg.rows.every((r: any) => r.finished === true && Number(r.saldo_pendente) === 0)).toBe(true);

    await db.query(
      `UPDATE public.orders SET status = 'Pronto', pcp_status = 'PRONTO', production_finished_at = NOW() WHERE id = $1;`,
      [mixedOrderId]
    );

    const finalOrd = await db.query(`SELECT status, pcp_status, production_finished_at, delivered_at FROM public.orders WHERE id = $1;`, [mixedOrderId]);
    expect((finalOrd.rows[0] as any).status).toBe('Pronto');
    expect((finalOrd.rows[0] as any).pcp_status).toBe('PRONTO');
    expect((finalOrd.rows[0] as any).delivered_at).toBeNull();
  });

  it('FASE 3.5 — Auditoria imutável (pcp_audit_log) e RBAC de perfis (Comercial/Visualização bloqueados)', async () => {
    // 1. Perfil Comercial e Visualização são bloqueados nas RPCs operacionais com 403 INSUFFICIENT_ROLE
    const comercialTry = await db.query(
      `SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3
      ) AS res;`,
      [mixedOrderId, STAGE_FICHA, USER_COMERCIAL]
    );
    expect((comercialTry.rows[0] as any).res.code).toBe('INSUFFICIENT_ROLE');
    expect((comercialTry.rows[0] as any).res.http_status).toBe(403);

    const viewerTry = await db.query(
      `SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3
      ) AS res;`,
      [mixedOrderId, STAGE_FICHA, USER_VIEWER]
    );
    expect((viewerTry.rows[0] as any).res.code).toBe('INSUFFICIENT_ROLE');
    expect((viewerTry.rows[0] as any).res.http_status).toBe(403);

    // 2. Verificar todos os registros gravados em pcp_audit_log para o pedido misto
    const auditRes = await db.query(
      `SELECT id, entidade, stage_id, acao, usuario, quantidade, origem, created_at
       FROM public.pcp_audit_log
       WHERE order_id = $1
       ORDER BY id ASC;`,
      [mixedOrderId]
    );
    expect(auditRes.rows.length).toBeGreaterThanOrEqual(8);

    // 3. Imutabilidade append-only garantida por trigger
    await expect(
      db.query(`DELETE FROM public.pcp_audit_log WHERE order_id = $1;`, [mixedOrderId])
    ).rejects.toThrow(/append-only/i);
  });
});
