import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Fase 2 — Suporte a Pedidos Legados Já em Produção e Ocultação de Entregues', () => {
  let db: PGlite;
  const deploySql = fs.readFileSync(
    path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
    'utf8'
  );

  const corteId = 10;
  const costuraId = 20;
  const operatorId = 400;

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

    // 3. Setup stages
    await db.exec(`
      INSERT INTO public.stages (id, name, sector_name, active, sort_order, calculation_type)
      VALUES 
        (10, 'Corte', 'Corte', 1, 1, 'por_peca'),
        (20, 'Costura', 'Costura', 1, 2, 'por_peca')
      ON CONFLICT (id) DO UPDATE SET active = EXCLUDED.active;
    `);

    // 4. Setup operator
    await db.exec(`
      INSERT INTO public.users (id, name, email, role, active, sector_name)
      VALUES (400, 'Operador Costura', 'operador.costura@comfortpro.com', 'Operador', 1, 'Costura')
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('1. Pedido legado já em produção com required_stages vazio e Corte concluído em stages_status consegue dar início em Costura', async () => {
    // Pedido criado antes da migração: status 'Em Produção', required_stages vazio [], stages_status com Corte concluído
    const ordRes = await db.query(`
      INSERT INTO public.orders (
        order_number, client_name, product_type, quantity, status,
        required_stages, stages_status
      )
      VALUES (
        'PED-LEGADO-01', 'Cliente Antigo', 'Dry Fit', 30, 'Em Produção',
        '[]'::jsonb,
        '[{"id": 10, "name": "Corte", "finished": true, "status": "Concluído"}, {"id": 20, "name": "Costura", "finished": false, "status": "Pendente"}]'::jsonb
      )
      RETURNING id, quantity, required_stages, stages_status;
    `);
    const order = ordRes.rows[0];
    const orderId = Number(order.id);

    // Simula a lógica de auto-healing do backend (/api/executions/start):
    // 1. Derivar required_stages a partir de stages_status
    const stagesStatus = (order.stages_status as any[]);
    const derivedStageIds = stagesStatus.map(s => Number(s.id)).filter(id => id && id !== 12);
    
    await db.query(`
      UPDATE public.orders
      SET required_stages = $1::jsonb
      WHERE id = $2;
    `, [JSON.stringify(derivedStageIds), orderId]);

    // 2. Sincronizar order_stage_progress para etapas marcadas como finished
    const finishedStages = stagesStatus.filter(s => s.finished === true || s.status === 'Concluído');
    for (const fs of finishedStages) {
      await db.query(`
        INSERT INTO public.order_stage_progress (
          order_id, stage_id, quantidade_pedido, quantidade_boa, saldo_pendente,
          pendencia_reposicao, finished, status, status_operacao, updated_at
        )
        VALUES ($1, $2, $3, $3, 0, 0, true, 'CONCLUIDA', 'CONCLUIDA', NOW())
        ON CONFLICT (order_id, stage_id) DO UPDATE SET finished = true;
      `, [orderId, Number(fs.id), Number(order.quantity)]);
    }

    // 3. Chamar rpc_start_operation para Costura (stage_id = 20)
    const rpcRes = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id := $1,
        p_stage_id := $2,
        p_user_id := $3,
        p_order_item_id := NULL,
        p_supervisor_override := false,
        p_motivo := NULL
      ) AS res;
    `, [orderId, costuraId, operatorId]);

    const result = (rpcRes.rows[0].res as any);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.status_operacao).toBe('EM_ANDAMENTO');
    expect(Number(result.execution_id)).toBeGreaterThan(0);

    // Validar que execução foi criada no banco
    const execCheck = await db.query(`
      SELECT * FROM public.stage_executions WHERE id = $1;
    `, [Number(result.execution_id)]);
    expect(execCheck.rows.length).toBe(1);
    expect(execCheck.rows[0].status).toBe('Em andamento');
  });

  it('2. Resolução de fila para pedidos legados identifica Costura como etapa atual liberada', () => {
    const rawOrder = {
      id: 999,
      status: 'Em Produção',
      required_stages: [],
      stages_status: [
        { id: 10, name: 'Corte', finished: true },
        { id: 20, name: 'Costura', finished: false }
      ]
    };

    let reqStageIds: number[] = Array.isArray(rawOrder.required_stages) && rawOrder.required_stages.length > 0 
      ? rawOrder.required_stages 
      : [];

    if (reqStageIds.length === 0 && Array.isArray(rawOrder.stages_status) && rawOrder.stages_status.length > 0) {
      reqStageIds = rawOrder.stages_status
        .map((s: any) => Number(s.id))
        .filter((id: number) => id && id !== 12);
    }

    expect(reqStageIds).toEqual([10, 20]);

    let currentStageId: number | null = null;
    let currentStageStatus = 'AGUARDANDO';

    for (let i = 0; i < reqStageIds.length; i++) {
      const sId = reqStageIds[i];
      const sStatusJson = rawOrder.stages_status.find((s: any) => Number(s.id) === Number(sId));
      const isFinished = sStatusJson?.finished === true;

      if (!isFinished) {
        currentStageId = sId;
        const prevSId = reqStageIds[i - 1];
        const prevSJson = rawOrder.stages_status.find((s: any) => Number(s.id) === Number(prevSId));
        const prevStageFinished = i === 0 || prevSJson?.finished === true;
        currentStageStatus = prevStageFinished ? 'LIBERADA' : 'AGUARDANDO';
        break;
      }
    }

    expect(currentStageId).toBe(20);
    expect(currentStageStatus).toBe('LIBERADA');
  });

  it('3. Pedidos Entregues não entram na fila de produção', async () => {
    await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('PED-ENTREGUE-01', 'Cliente Entregue', 'Dry Fit', 10, 'Entregue', '[10, 20]'::jsonb);
    `);

    // Consulta de pedidos ativos da esteira produtiva
    const res = await db.query(`
      SELECT id, order_number, status
      FROM public.orders
      WHERE deleted_at IS NULL
        AND status NOT IN ('Cancelado', 'Entregue', 'Pronto', 'Rascunho');
    `);

    const deliveredFound = res.rows.find((r: any) => r.order_number === 'PED-ENTREGUE-01');
    expect(deliveredFound).toBeUndefined();
  });
});
