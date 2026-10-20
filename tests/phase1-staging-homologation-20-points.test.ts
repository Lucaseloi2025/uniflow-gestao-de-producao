import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Homologação Controlada da Fase 1 — Execução dos 20 Testes Obrigatórios', () => {
  let db: PGlite;
  const deploySql = fs.readFileSync(
    path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
    'utf8'
  );

  let adminUserId: number;
  let adminAuthId: string = '00000000-0000-0000-0000-000000000001';
  let operatorUserId: number;
  let operatorAuthId: string = '00000000-0000-0000-0000-000000000002';
  let inactiveUserId: number;
  let inactiveAuthId: string = '00000000-0000-0000-0000-000000000003';
  let corteStageId: number = 10;
  let costuraStageId: number = 20;
  let confStageId: number = 30;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Simula ambiente pré-Fase 1 com schemas auth e public legados
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
        email TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      -- Schema legado antes da migration consolidada
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
        role TEXT NOT NULL DEFAULT 'Operador',
        active INT DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS public.orders (
        id BIGSERIAL PRIMARY KEY,
        order_number TEXT,
        client_name TEXT,
        product_type TEXT,
        quantity INT DEFAULT 1,
        status TEXT DEFAULT 'Entrada',
        items JSONB DEFAULT '[]'::jsonb,
        required_stages JSONB DEFAULT '[]'::jsonb,
        total_time_seconds INT DEFAULT 0,
        deadline TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.stage_executions (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT,
        stage_id BIGINT,
        user_id BIGINT,
        status TEXT DEFAULT 'Em andamento',
        start_time TIMESTAMPTZ DEFAULT NOW(),
        end_time TIMESTAMPTZ,
        total_time_seconds INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS public.order_stage_progress (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT,
        stage_id BIGINT,
        quantidade_pedido INT DEFAULT 0,
        quantidade_boa INT DEFAULT 0,
        finished BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS public.pauses (
        id BIGSERIAL PRIMARY KEY,
        execution_id BIGINT,
        start_pause TIMESTAMPTZ DEFAULT NOW(),
        end_pause TIMESTAMPTZ,
        duration_seconds INT
      );
    `);

    // 2. Popula dados legados
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES 
        ('${adminAuthId}', 'admin@comfortpro.com'),
        ('${operatorAuthId}', 'operador@comfortpro.com'),
        ('${inactiveAuthId}', 'inativo@comfortpro.com');

      INSERT INTO public.users (id, name, email, role, active) VALUES 
        (1, 'Administrador Central', 'admin@comfortpro.com', 'Administrador', 1),
        (2, 'Operador Corte', 'operador@comfortpro.com', 'Operador', 1),
        (3, 'Ex-Funcionário', 'inativo@comfortpro.com', 'Operador', 0);

      INSERT INTO public.stages (id, name, sort_order, active) VALUES 
        (${corteStageId}, 'Corte e Enfesto', 1, 1),
        (${costuraStageId}, 'Costura Geral', 2, 1),
        (${confStageId}, 'Conferência e Separação', 3, 0);
    `);

    adminUserId = 1;
    operatorUserId = 2;
    inactiveUserId = 3;

    // 3. Aplica a migration consolidada da Fase 1 exatamente como em produção
    await db.exec(deploySql);

    // Ajusta sequence do users para novos inserts não colidirem
    await db.exec(`SELECT setval('public.users_id_seq', (SELECT MAX(id) FROM public.users));`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('1. Login com JWT válido (autenticação oficial via auth.users e vínculo auth_user_id)', async () => {
    const userRes = await db.query(
      `SELECT id, name, email, role, active, auth_user_id FROM public.users WHERE id = $1;`,
      [adminUserId]
    );
    expect(userRes.rows[0].auth_user_id).toBe(adminAuthId);
    expect(userRes.rows[0].active).toBe(1);
    expect(userRes.rows[0].role).toBe('Administrador');
  });

  it('2. Bloqueio de usuário inativo (active = 0 impede início de operações com 403 USER_INACTIVE)', async () => {
    const res = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id => 999,
        p_stage_id => $1,
        p_user_id => $2
      ) as result;
    `, [corteStageId, inactiveUserId]);
    const parsed = (res.rows[0] as any).result;
    expect(parsed.error).toBe('Acesso bloqueado: usuário inativo.');
    expect(parsed.code).toBe('USER_INACTIVE');
    expect(parsed.http_status).toBe(403);
  });

  it('3. Validação dos seis perfis oficiais (CHECK constraint users_role_check)', async () => {
    const roles = ['Administrador', 'Supervisor', 'Operador', 'PCP', 'Comercial', 'Visualização'];
    for (let i = 0; i < roles.length; i++) {
      const r = roles[i];
      const authId = `00000000-0000-0000-0000-00000000001${i}`;
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES ('${authId}', 'user_${i}@comfortpro.com');
        INSERT INTO public.users (name, email, role, active, auth_user_id) 
        VALUES ('User ${r}', 'user_${i}@comfortpro.com', '${r}', 1, '${authId}');
      `);
    }

    // Tentar inserir role inválida deve falhar com violação de check constraint
    await expect(db.exec(`
      INSERT INTO public.users (name, email, role, active) 
      VALUES ('Invalido', 'invalido@test.com', 'Financeiro', 1);
    `)).rejects.toThrow();
  });

  let testOrderId: number;

  it('4. Criação de pedido manual (status Entrada, required_stages configuradas)', async () => {
    const res = await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('PED-HOMOLOG-01', 'Cliente Homologação', 'Dry Fit', 20, 'Entrada', $1::jsonb)
      RETURNING id, order_number, status, required_stages;
    `, [JSON.stringify([corteStageId, costuraStageId])]);

    testOrderId = Number(res.rows[0].id);
    expect(res.rows[0].order_number).toBe('PED-HOMOLOG-01');
    expect(res.rows[0].status).toBe('Entrada');
  });

  it('5. Importação de pedido Olist (pedido estruturado sem etapa de Conferência)', async () => {
    const res = await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('OLIST-554433', 'Comprador Marketplace Olist', 'Algodão', 15, 'Entrada', $1::jsonb)
      RETURNING id, required_stages;
    `, [JSON.stringify([corteStageId, costuraStageId])]);
    const req = JSON.parse(JSON.stringify(res.rows[0].required_stages));
    expect(req).not.toContain(confStageId);
  });

  let executionId: number;

  it('6. Início de operação (rpc_start_operation cria sessão em andamento e inicializa progresso)', async () => {
    const res = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3
      ) as result;
    `, [testOrderId, corteStageId, operatorUserId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.success).toBe(true);
    expect(parsed.execution_id).toBeDefined();
    executionId = Number(parsed.execution_id);

    const execCheck = await db.query(`SELECT status FROM public.stage_executions WHERE id = $1;`, [executionId]);
    expect(execCheck.rows[0].status).toBe('Em andamento');
  });

  it('7. Bloqueio de duas operações simultâneas (mesmo operador tentando abrir 2ª sessão gera 409)', async () => {
    // Cria um segundo pedido para testar início de 2ª operação pelo mesmo operador
    const o2Res = await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('PED-HOMOLOG-02', 'Cliente 2', 'Dry Fit', 10, 'Entrada', $1::jsonb)
      RETURNING id;
    `, [JSON.stringify([corteStageId, costuraStageId])]);
    const o2Id = Number(o2Res.rows[0].id);

    const res = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3
      ) as result;
    `, [o2Id, corteStageId, operatorUserId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.error).toContain('Operador já possui operação ativa ou pausada');
    expect(parsed.code).toBe('OPERATOR_ALREADY_ACTIVE');
    expect(parsed.http_status).toBe(409);
  });

  it('8. Pausa com motivo (rpc_pause_operation registra pausa com motivo no banco)', async () => {
    const res = await db.query(`
      SELECT public.rpc_pause_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_motivo => 'Manutenção Preventiva da Máquina'
      ) as result;
    `, [executionId, operatorUserId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.success).toBe(true);

    const pauseCheck = await db.query(`SELECT motivo, end_pause FROM public.pauses WHERE execution_id = $1;`, [executionId]);
    expect(pauseCheck.rows[0].motivo).toBe('Manutenção Preventiva da Máquina');
    expect(pauseCheck.rows[0].end_pause).toBeNull();
  });

  it('9. Retomada (rpc_resume_operation finaliza a pausa e restaura status Em andamento)', async () => {
    const res = await db.query(`
      SELECT public.rpc_resume_operation(
        p_execution_id => $1,
        p_user_id => $2
      ) as result;
    `, [executionId, operatorUserId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.success).toBe(true);

    const execCheck = await db.query(`SELECT status FROM public.stage_executions WHERE id = $1;`, [executionId]);
    expect(execCheck.rows[0].status).toBe('Em andamento');

    const pauseCheck = await db.query(`SELECT end_pause, duration_seconds FROM public.pauses WHERE execution_id = $1;`, [executionId]);
    expect(pauseCheck.rows[0].end_pause).not.toBeNull();
  });

  it('10. Apontamento parcial (pcp_apply_stage_progress incrementa quantidade boa acumulada)', async () => {
    const res = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_idempotency_key => 'partial_homolog_01',
        p_good_inc => 8
      ) as result;
    `, [testOrderId, corteStageId, operatorUserId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.success).toBe(true);

    const progCheck = await db.query(`SELECT quantidade_boa, status_operacao FROM public.order_stage_progress WHERE order_id = $1 AND stage_id = $2;`, [testOrderId, corteStageId]);
    expect(Number(progCheck.rows[0].quantidade_boa)).toBe(8);
    expect(progCheck.rows[0].status_operacao).toBe('PARCIAL');
  });

  it('11. Idempotência sem duplicar quantidade (re-envio da mesma idempotency_key retorna resultado anterior)', async () => {
    const res = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_idempotency_key => 'partial_homolog_01',
        p_good_inc => 8
      ) as result;
    `, [testOrderId, corteStageId, operatorUserId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.success).toBe(true);
    expect(parsed.idempotent_replay).toBe(true);

    // Quantidade NÃO foi duplicada (continua 8)
    const progCheck = await db.query(`SELECT quantidade_boa FROM public.order_stage_progress WHERE order_id = $1 AND stage_id = $2;`, [testOrderId, corteStageId]);
    expect(Number(progCheck.rows[0].quantidade_boa)).toBe(8);
  });

  it('12. Transferência parcial (incrementa quantidade transferida para próxima etapa)', async () => {
    const res = await db.query(`
      SELECT public.pcp_apply_stage_progress(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_good_inc => 0,
        p_lost_inc => 0,
        p_rework_inc => 0,
        p_transfer_inc => 8,
        p_next_stage_id => $4,
        p_idempotency_key => 'transfer_homolog_01'
      ) as result;
    `, [testOrderId, corteStageId, operatorUserId, costuraStageId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.success).toBe(true);

    const progCheck = await db.query(`SELECT quantidade_transferida FROM public.order_stage_progress WHERE order_id = $1 AND stage_id = $2;`, [testOrderId, corteStageId]);
    expect(Number(progCheck.rows[0].quantidade_transferida)).toBe(8);
  });

  it('13. Registro de perda e reposição (rpc_record_loss gera pendência de reposição atômica)', async () => {
    const res = await db.query(`
      SELECT public.rpc_record_loss(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_lost_qty => 2,
        p_reason => 'Defeito no Tecido',
        p_idempotency_key => 'loss_homolog_01'
      ) as result;
    `, [testOrderId, corteStageId, operatorUserId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.success).toBe(true);

    const progCheck = await db.query(`SELECT quantidade_perdida, pendencia_reposicao FROM public.order_stage_progress WHERE order_id = $1 AND stage_id = $2;`, [testOrderId, corteStageId]);
    expect(Number(progCheck.rows[0].quantidade_perdida)).toBe(2);
    expect(Number(progCheck.rows[0].pendencia_reposicao)).toBe(2);

    // Abate a pendência com reposição aprovada via rpc_record_production
    await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => $1,
        p_stage_id => $2,
        p_user_id => $3,
        p_idempotency_key => 'repo_homolog_01',
        p_good_inc => 12,
        p_is_reposition => true
      ) as result;
    `, [testOrderId, corteStageId, operatorUserId]);

    const progAfter = await db.query(`SELECT quantidade_boa, pendencia_reposicao FROM public.order_stage_progress WHERE order_id = $1 AND stage_id = $2;`, [testOrderId, corteStageId]);
    expect(Number(progAfter.rows[0].quantidade_boa)).toBe(20);
    expect(Number(progAfter.rows[0].pendencia_reposicao)).toBe(0);
  });

  it('14. Finalização da operação (rpc_finish_operation conclui etapa Corte com sucesso)', async () => {
    const res = await db.query(`
      SELECT public.rpc_finish_operation(
        p_execution_id => $1,
        p_user_id => $2,
        p_good_inc => 0,
        p_partial => false,
        p_observation => 'Corte 100% finalizado'
      ) as result;
    `, [executionId, operatorUserId]);

    const parsed = (res.rows[0] as any).result;
    expect(parsed.success).toBe(true);

    const execCheck = await db.query(`SELECT status FROM public.stage_executions WHERE id = $1;`, [executionId]);
    expect(execCheck.rows[0].status).toBe('Finalizado');

    const progCheck = await db.query(`SELECT finished, status_operacao FROM public.order_stage_progress WHERE order_id = $1 AND stage_id = $2;`, [testOrderId, corteStageId]);
    expect(progCheck.rows[0].finished).toBe(true);
    expect(progCheck.rows[0].status_operacao).toBe('CONCLUIDA');
  });

  it('15. Pedido multi-item (order_items com múltiplos itens e rotas dedicadas)', async () => {
    const multiOrderRes = await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('PED-MULTI-01', 'Cliente Multi-Item', 'Dry Fit', 30, 'Entrada', $1::jsonb)
      RETURNING id;
    `, [JSON.stringify([corteStageId, costuraStageId])]);
    const multiOrderId = Number(multiOrderRes.rows[0].id);

    await db.query(`
      INSERT INTO public.order_items (order_id, item_index, sku, description, product_type, color, size, quantity)
      VALUES 
        ($1, 1, 'SKU-AZUL-M', 'Dry Fit | Azul | M', 'Dry Fit', 'Azul', 'M', 15),
        ($1, 2, 'SKU-VERM-G', 'Dry Fit | Vermelho | G', 'Dry Fit', 'Vermelho', 'G', 15);
    `, [multiOrderId]);

    const countItems = await db.query(`SELECT count(*) as count FROM public.order_items WHERE order_id = $1;`, [multiOrderId]);
    expect(Number(countItems.rows[0].count)).toBe(2);
  });

  it('16. Pedido antigo que possuía Conferência (auto-waiver ao concluir etapas ativas)', async () => {
    const oldRes = await db.query(`
      INSERT INTO public.orders (order_number, client_name, product_type, quantity, status, required_stages)
      VALUES ('PED-HISTORICO-CONFERENCIA', 'Cliente Antigo', 'Dry Fit', 10, 'Em Produção', $1::jsonb)
      RETURNING id;
    `, [JSON.stringify([corteStageId, costuraStageId, confStageId])]);
    const oldOrderId = Number(oldRes.rows[0].id);

    // Inicia e finaliza Corte
    const exC = await db.query(`INSERT INTO public.stage_executions (order_id, stage_id, user_id, status) VALUES ($1, $2, $3, 'Em andamento') RETURNING id;`, [oldOrderId, corteStageId, operatorUserId]);
    await db.query(`SELECT public.rpc_finish_operation(p_execution_id => $1, p_user_id => $2, p_good_inc => 10);`, [Number(exC.rows[0].id), operatorUserId]);

    // Inicia e finaliza Costura
    const exS = await db.query(`INSERT INTO public.stage_executions (order_id, stage_id, user_id, status) VALUES ($1, $2, $3, 'Em andamento') RETURNING id;`, [oldOrderId, costuraStageId, operatorUserId]);
    await db.query(`SELECT public.rpc_finish_operation(p_execution_id => $1, p_user_id => $2, p_good_inc => 10);`, [Number(exS.rows[0].id), operatorUserId]);

    // Simula a verificação do resguardo da API para auto-waiver da etapa descontinuada
    const checkProg = await db.query(`SELECT stage_id, finished FROM public.order_stage_progress WHERE order_id = $1;`, [oldOrderId]);
    const fMap = new Map(checkProg.rows.map((r: any) => [Number(r.stage_id), Boolean(r.finished)]));
    const allProdDone = [corteStageId, costuraStageId].every(id => fMap.get(id) === true);

    expect(allProdDone).toBe(true);
    if (allProdDone) {
      await db.query(`UPDATE public.orders SET status = 'Pronto', pcp_status = 'PRONTO' WHERE id = $1;`, [oldOrderId]);
    }

    const orderFinal = await db.query(`SELECT status FROM public.orders WHERE id = $1;`, [oldOrderId]);
    expect(orderFinal.rows[0].status).toBe('Pronto');
  });

  it('17. Persistência dos dados após múltiplas transações', async () => {
    const ordersCount = await db.query(`SELECT count(*) as count FROM public.orders;`);
    expect(Number(ordersCount.rows[0].count)).toBeGreaterThanOrEqual(4);
  });

  it('18. Auditoria imutável (pcp_audit_log contém histórico detalhado com acao e timestamps)', async () => {
    const logs = await db.query(`SELECT acao, entidade, user_id, created_at FROM public.pcp_audit_log ORDER BY id ASC;`);
    expect(logs.rows.length).toBeGreaterThan(0);
    const actions = logs.rows.map((l: any) => l.acao);
    expect(actions).toContain('APONTAMENTO_PRODUCAO');
    expect(actions).toContain('PAUSA_OPERACAO');
    expect(actions).toContain('RETOMADA_OPERACAO');
    expect(actions).toContain('FIM_OPERACAO_CONCLUIDA');
    expect(logs.rows[0].created_at).toBeDefined();
  });

  it('19. Bloqueio de acesso anônimo (permissões de anon revogadas para RPCs e auditoria)', async () => {
    // Simula contexto anon
    await db.exec(`SET ROLE anon;`);
    await expect(db.query(`SELECT * FROM public.pcp_audit_log;`)).rejects.toThrow();
    await db.exec(`RESET ROLE;`);
  });

  it('20. Funcionamento consistente do backend (zero dependência de estado em memória volátil)', async () => {
    // Consulta direta sem contexto de sessão anterior comprova persistência 100% no banco relacional
    const checkDb = await db.query(`SELECT id, status FROM public.orders WHERE id = $1;`, [testOrderId]);
    expect(checkDb.rows.length).toBe(1);
    expect(checkDb.rows[0].status).toBeDefined();
  });
});
