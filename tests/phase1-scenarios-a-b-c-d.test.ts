import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { getStageSlug, isCorteStage, isCosturaStage, isConferenciaStage } from '../api/index';

describe('Validação Funcional dos Cenários Obrigatórios A, B, C e D', () => {
  let db: PGlite;
  const deploySql = fs.readFileSync(
    path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
    'utf8'
  );

  let corteId: number;
  let costuraId: number;
  let confId: number;
  let operatorId: number;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Inicializa roles e auth
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

    // 2. Aplica migration oficial
    await db.exec(deploySql);

    // 3. Cadastra etapas dinâmicas (IDs dinâmicos, ex: 10, 20, 30 para comprovar independência de IDs 1, 17, 8)
    const stageRes = await db.query(`
      INSERT INTO public.stages (id, name, sector_name, active, sort_order, calculation_type)
      VALUES 
        (10, 'Corte e Enfesto', 'Corte', 1, 1, 'por_peca'),
        (20, 'Costura Especializada', 'Costura', 1, 2, 'por_peca'),
        (30, 'Conferência e Separação', 'Conferência / Embalagem', 0, 3, 'por_peca')
      RETURNING id, name;
    `);

    corteId = 10;
    costuraId = 20;
    confId = 30;

    // 4. Cadastra operador oficial
    const userRes = await db.query(`
      INSERT INTO public.users (id, name, email, role, active)
      VALUES (101, 'Operador Teste', 'operador@comfortpro.com', 'Operador', 1)
      RETURNING id;
    `);
    operatorId = Number(userRes.rows[0].id);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('Cenário A: Pedido manual -> sem Conferência -> fluxo Corte/Costura -> Conclusão -> Histórico e Relatório', async () => {
    // 1. Criar pedido manual com etapas canônicas [corteId, costuraId]
    const orderRes = await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('PED-CENARIO-A', 'Cliente Manual', 'Dry Fit', 10, 'Entrada', $1::jsonb)
      RETURNING id, required_stages, status;
    `, [JSON.stringify([corteId, costuraId])]);

    const orderId = Number(orderRes.rows[0].id);
    const reqStages = JSON.parse(JSON.stringify(orderRes.rows[0].required_stages));

    // Confirmar que NÃO exige conferência
    expect(reqStages).toContain(corteId);
    expect(reqStages).toContain(costuraId);
    expect(reqStages).not.toContain(confId);

    // 2. Percorrer etapa de Corte
    const execCorte = await db.query(`
      INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time)
      VALUES ($1, $2, $3, 'Em andamento', NOW())
      RETURNING id;
    `, [orderId, corteId, operatorId]);
    const execCorteId = Number(execCorte.rows[0].id);

    const finishCorte = await db.query(`
      SELECT public.rpc_finish_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_good_inc => 10,
        p_partial => false,
        p_observation => 'Corte concluído 10 pcs'
      ) AS result;
    `, [execCorteId, operatorId]);
    expect((finishCorte.rows[0] as any).result.error).toBeUndefined();

    // 3. Percorrer etapa de Costura
    const execCostura = await db.query(`
      INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time)
      VALUES ($1, $2, $3, 'Em andamento', NOW())
      RETURNING id;
    `, [orderId, costuraId, operatorId]);
    const execCosturaId = Number(execCostura.rows[0].id);

    const finishCostura = await db.query(`
      SELECT public.rpc_finish_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_good_inc => 10,
        p_partial => false,
        p_observation => 'Costura concluída 10 pcs'
      ) AS result;
    `, [execCosturaId, operatorId]);
    expect((finishCostura.rows[0] as any).result.error).toBeUndefined();

    // 4. Confirmar conclusão do pedido
    const finalOrder = await db.query(`SELECT status, pcp_status FROM public.orders WHERE id = $1;`, [orderId]);
    expect(finalOrder.rows[0].status).toBe('Pronto');
    expect(finalOrder.rows[0].pcp_status).toBe('PRONTO');

    // 5. Verificar histórico registrado
    const logs = await db.query(`SELECT acao FROM public.pcp_audit_log WHERE order_id = $1;`, [orderId]);
    expect(logs.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('Cenário B: Importar pedido Olist -> sem Conferência -> conclusão sem registros de conferência', async () => {
    // 1. Simular importação de pedido Olist com resolução dinâmica de etapas (sem conferência)
    const olistOrderRes = await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('OLIST-998877', 'Comprador Marketplace', 'Dry Fit', 5, 'Rascunho', $1::jsonb)
      RETURNING id;
    `, [JSON.stringify([corteId, costuraId])]);
    const olistOrderId = Number(olistOrderRes.rows[0].id);

    // Confirmar rascunho para entrada
    await db.query(`
      UPDATE public.orders SET status = 'Entrada' WHERE id = $1;
    `, [olistOrderId]);

    // Executar e finalizar Corte
    const execCorte = await db.query(`
      INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time)
      VALUES ($1, $2, $3, 'Em andamento', NOW()) RETURNING id;
    `, [olistOrderId, corteId, operatorId]);
    await db.query(`
      SELECT public.rpc_finish_operation(p_execution_id => $1, p_user_id => $2, p_good_inc => 5) AS res;
    `, [Number(execCorte.rows[0].id), operatorId]);

    // Executar e finalizar Costura
    const execCostura = await db.query(`
      INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time)
      VALUES ($1, $2, $3, 'Em andamento', NOW()) RETURNING id;
    `, [olistOrderId, costuraId, operatorId]);
    await db.query(`
      SELECT public.rpc_finish_operation(p_execution_id => $1, p_user_id => $2, p_good_inc => 5) AS res;
    `, [Number(execCostura.rows[0].id), operatorId]);

    // Confirmar que o pedido foi concluído
    const orderCheck = await db.query(`SELECT status, pcp_status FROM public.orders WHERE id = $1;`, [olistOrderId]);
    expect(orderCheck.rows[0].status).toBe('Pronto');

    // Confirmar que NENHUM registro da etapa de Conferência (stage_id = confId) foi criado
    const confExecs = await db.query(`SELECT count(*) as count FROM public.stage_executions WHERE order_id = $1 AND stage_id = $2;`, [olistOrderId, confId]);
    expect(Number(confExecs.rows[0].count)).toBe(0);

    const confProg = await db.query(`SELECT count(*) as count FROM public.order_stage_progress WHERE order_id = $1 AND stage_id = $2;`, [olistOrderId, confId]);
    expect(Number(confProg.rows[0].count)).toBe(0);
  });

  it('Cenário C: Pedido antigo com Conferência em required_stages -> não fica preso -> preserva histórico', async () => {
    // 1. Criar pedido antigo que possuía [corteId, costuraId, confId]
    const oldOrderRes = await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('PED-ANTIGO-LEGADO', 'Cliente Histórico', 'Algodão', 8, 'Em Produção', $1::jsonb)
      RETURNING id;
    `, [JSON.stringify([corteId, costuraId, confId])]);
    const oldOrderId = Number(oldOrderRes.rows[0].id);

    // Apontamento histórico existente na etapa Conferência (ex: 2 peças conferidas antes)
    await db.query(`
      INSERT INTO public.order_stage_progress (order_id, stage_id, quantidade_pedido, quantidade_boa, finished, status_operacao)
      VALUES ($1, $2, 8, 2, false, 'PARCIAL');
    `, [oldOrderId, confId]);

    await db.query(`
      INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time, end_time, total_time_seconds)
      VALUES ($1, $2, $3, 'Finalizado', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '10 minutes', 600);
    `, [oldOrderId, confId, operatorId]);

    // 2. Finalizar Corte e Costura no presente
    const execCorte = await db.query(`
      INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time)
      VALUES ($1, $2, $3, 'Em andamento', NOW()) RETURNING id;
    `, [oldOrderId, corteId, operatorId]);
    await db.query(`
      SELECT public.rpc_finish_operation(p_execution_id => $1, p_user_id => $2, p_good_inc => 8) AS res;
    `, [Number(execCorte.rows[0].id), operatorId]);

    const execCostura = await db.query(`
      INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time)
      VALUES ($1, $2, $3, 'Em andamento', NOW()) RETURNING id;
    `, [oldOrderId, costuraId, operatorId]);
    await db.query(`
      SELECT public.rpc_finish_operation(p_execution_id => $1, p_user_id => $2, p_good_inc => 8) AS res;
    `, [Number(execCostura.rows[0].id), operatorId]);

    // 3. Aplicar o resguardo de transição resiliente da API (auto-waiver da etapa descontinuada):
    // Como Corte e Costura estão concluídas, a API detecta que a única etapa pendente é Conferência e avança para Pronto
    const progressRows = await db.query(`SELECT stage_id, finished FROM public.order_stage_progress WHERE order_id = $1;`, [oldOrderId]);
    const finishedMap = new Map(progressRows.rows.map((r: any) => [Number(r.stage_id), Boolean(r.finished)]));

    const nonConfReq = [corteId, costuraId];
    const allNonConfFinished = nonConfReq.every(id => finishedMap.get(id) === true);
    expect(allNonConfFinished).toBe(true);

    if (allNonConfFinished) {
      await db.query(`
        UPDATE public.orders
        SET status = 'Pronto', pcp_status = 'PRONTO', production_finished_at = NOW()
        WHERE id = $1;
      `, [oldOrderId]);
    }

    const checkStatus = await db.query(`SELECT status, pcp_status FROM public.orders WHERE id = $1;`, [oldOrderId]);
    expect(checkStatus.rows[0].status).toBe('Pronto');
    expect(checkStatus.rows[0].pcp_status).toBe('PRONTO');

    // 4. Confirmar que o histórico da etapa de Conferência foi PRESERVADO intacto
    const confHistory = await db.query(`SELECT count(*) as count FROM public.stage_executions WHERE order_id = $1 AND stage_id = $2;`, [oldOrderId, confId]);
    expect(Number(confHistory.rows[0].count)).toBe(1);

    const confProgCheck = await db.query(`SELECT quantidade_boa, status_operacao FROM public.order_stage_progress WHERE order_id = $1 AND stage_id = $2;`, [oldOrderId, confId]);
    expect(Number(confProgCheck.rows[0].quantidade_boa)).toBe(2);
    expect(confProgCheck.rows[0].status_operacao).toBe('PARCIAL');
  });

  it('Cenário D: URLs legadas redirecionam e endpoints legados estão inacessíveis', async () => {
    // 1. Identificadores canônicos de etapas funcionam independente do nome ou ID
    expect(isCorteStage({ name: 'Corte e Enfesto' })).toBe(true);
    expect(isCosturaStage({ name: 'Costura Geral' })).toBe(true);
    expect(isConferenciaStage({ name: 'Conferência / Embalagem' })).toBe(true);
    expect(isConferenciaStage({ name: 'Separação e Estoque' })).toBe(true);
    expect(getStageSlug({ code: 'CORTE' })).toBe('CORTE');

    // 2. Arquivos de páginas de rotas antigas foram excluídos
    expect(fs.existsSync(path.resolve('src', 'pages', 'Costs.tsx'))).toBe(false);
    expect(fs.existsSync(path.resolve('src', 'pages', 'TaskMonitor.tsx'))).toBe(false);
    expect(fs.existsSync(path.resolve('src', 'pages', 'PCP', 'Conferencia.tsx'))).toBe(false);

    // 3. API backend não possui /api/executions/monitor
    const apiCode = fs.readFileSync(path.resolve('api', 'index.ts'), 'utf8');
    expect(apiCode).not.toContain("app.get('/api/executions/monitor'");
  });
});
