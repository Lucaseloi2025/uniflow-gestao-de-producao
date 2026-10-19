import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Validação da Migration Consolidada — 20261018_phase1_deploy_complete.sql', () => {
  let db: PGlite;
  const deploySql = fs.readFileSync(
    path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
    'utf8'
  );

  // Helper para criar o schema legado (pré-Fase 1) exatamente como existia no banco
  async function setupLegacyDatabase(instance: PGlite) {
    await instance.exec(`
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

      -- Schema legado inicial
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
    `);
  }

  // 1. POVOAR DADOS HISTÓRICOS LEGADOS
  async function seedLegacyHistoricalData(instance: PGlite) {
    await instance.exec(`
      -- Etapas pré-existentes
      INSERT INTO public.stages (id, name, sort_order, active, calculation_type)
      VALUES
        (1, 'Corte & Enfesto', 1, 1, 'por_peca'),
        (2, 'Estamparia Silk', 2, 1, 'por_peca'),
        (3, 'Costura Geral', 3, 1, 'por_peca'),
        (4, 'Conferência & Embalagem', 4, 1, 'por_peca');

      -- Usuários legados com roles anteriores ('Admin', 'Produção')
      INSERT INTO public.users (id, name, email, role, active)
      VALUES
        (1, 'Gestor Antigo', 'admin.legado@test.com', 'Admin', 1),
        (2, 'Operador Antigo', 'op.legado@test.com', 'Produção', 1),
        (3, 'Supervisor Antigo', 'sup.legado@test.com', 'Supervisor', 1);

      -- Pedido histórico com itens em formato JSONB
      INSERT INTO public.orders (
        id, order_number, client_name, product_type, quantity, status,
        delivered_at, required_stages, items
      )
      VALUES (
        1001, 'PED-LEG-1001', 'Cliente Histórico', 'Camiseta Básica', 80, 'Entregue',
        NOW() - INTERVAL '5 days', '[1, 2, 3, 4]'::jsonb,
        '[{"sku": "SKU-CAM-01", "description": "Camiseta Azul M", "quantity": 80, "fabric": "Meia Malha", "color": "Azul"}]'::jsonb
      );

      -- Pedido ativo em produção
      INSERT INTO public.orders (
        id, order_number, client_name, product_type, quantity, status,
        required_stages, items
      )
      VALUES (
        1002, 'PED-LEG-1002', 'Cliente Ativo', 'Camisa Polo', 50, 'Entrada',
        '[1, 2]'::jsonb,
        '[{"sku": "SKU-POLO-01", "description": "Polo Branca G", "quantity": 50, "fabric": "Piquet", "color": "Branco"}]'::jsonb
      );
    `);
  }

  beforeAll(async () => {
    db = new PGlite();
    await setupLegacyDatabase(db);
    await seedLegacyHistoricalData(db);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('deve aplicar com sucesso a migration única 20261018_phase1_deploy_complete.sql sobre o banco legado', async () => {
    await db.exec(deploySql);

    // 1. Verificar migração de perfis legados
    const users = await db.query(`SELECT id, role FROM public.users ORDER BY id;`);
    expect((users.rows[0] as any).role).toBe('Administrador'); // 'Admin' migrado para 'Administrador'
    expect((users.rows[1] as any).role).toBe('Operador');      // 'Produção' migrado para 'Operador'
    expect((users.rows[2] as any).role).toBe('Supervisor');

    // 2. Verificar que users_role_check rejeita perfis legados
    let roleError = false;
    try {
      await db.exec(`INSERT INTO public.users (name, email, role) VALUES ('Teste', 't@t.com', 'Admin');`);
    } catch {
      roleError = true;
    }
    expect(roleError).toBe(true);

    // 3. Verificar backfill de order_items a partir do JSONB
    const items = await db.query(`SELECT * FROM public.order_items WHERE order_id = 1001;`);
    expect(items.rows.length).toBe(1);
    expect((items.rows[0] as any).sku).toBe('SKU-CAM-01');
    expect((items.rows[0] as any).quantity).toBe(80);

    // 4. Verificar backfill de production_finished_at
    const orderDelivered = await db.query(`SELECT production_finished_at FROM public.orders WHERE id = 1001;`);
    expect((orderDelivered.rows[0] as any).production_finished_at).not.toBeNull();

    // 5. Verificar que a tabela idempotency_requests existe
    const idempTable = await db.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'idempotency_requests';
    `);
    expect(idempTable.rows.length).toBe(1);

    // 6. Verificar que a tabela order_item_stage_progress existe
    const itemProgTable = await db.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'order_item_stage_progress';
    `);
    expect(itemProgTable.rows.length).toBe(1);

    // 7. Verificar índice parcial de operador único ativo
    const operatorIdx = await db.query(`
      SELECT indexname FROM pg_indexes WHERE indexname = 'idx_stage_executions_active_operator';
    `);
    expect(operatorIdx.rows.length).toBe(1);

    // 8. Verificar imutabilidade do pcp_audit_log (append-only)
    await db.exec(`
      INSERT INTO public.pcp_audit_log (id, acao, motivo, usuario)
      VALUES (9999, 'AUDIT_TEST', 'motivo', 'admin')
      ON CONFLICT (id) DO NOTHING;
    `);

    let auditMutationBlocked = false;
    try {
      await db.exec(`UPDATE public.pcp_audit_log SET motivo = 'hacked' WHERE id = 9999;`);
    } catch (err: any) {
      auditMutationBlocked = true;
      expect(err.message).toMatch(/append-only/i);
    }
    expect(auditMutationBlocked).toBe(true);
  });

  it('deve executar o fluxo operacional ponta a ponta com as novas RPCs no banco atualizado', async () => {
    // 1. Iniciar operação com rpc_start_operation
    const startRes = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id => 1002,
        p_stage_id => 1,
        p_user_id => 2
      ) AS res;
    `);
    const startData = (startRes.rows[0] as any).res;
    expect(startData.success).toBe(true);
    const execId = startData.execution_id;

    // 2. Apontamento de produção com idempotência obrigatória
    const prodRes1 = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => 1002,
        p_stage_id => 1,
        p_user_id => 2,
        p_idempotency_key => 'idem_deploy_test_01',
        p_good_inc => 50,
        p_transfer_inc => 50,
        p_next_stage_id => 2
      ) AS res;
    `);
    const prodData1 = (prodRes1.rows[0] as any).res;
    expect(prodData1.success).toBe(true);
    expect(prodData1.quantidade_boa).toBe(50);

    // 3. Replay idêntico devolve a mesma resposta sem duplicar produção
    const prodRes2 = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id => 1002,
        p_stage_id => 1,
        p_user_id => 2,
        p_idempotency_key => 'idem_deploy_test_01',
        p_good_inc => 50,
        p_transfer_inc => 50,
        p_next_stage_id => 2
      ) AS res;
    `);
    const prodData2 = (prodRes2.rows[0] as any).res;
    expect(prodData2.idempotent_replay).toBe(true);
    expect(prodData2.quantidade_boa).toBe(50);

    // 4. Finalizar operação com rpc_finish_operation -> muda para Pronto e não Entregue
    const finishRes = await db.query(`
      SELECT public.rpc_finish_operation(
        p_execution_id => ${execId},
        p_user_id => 2
      ) AS res;
    `);
    const finishData = (finishRes.rows[0] as any).res;
    expect(finishData.success).toBe(true);

    const orderRow = await db.query(`SELECT status, delivered_at FROM public.orders WHERE id = 1002;`);
    expect((orderRow.rows[0] as any).status).not.toBe('Entregue');
    expect((orderRow.rows[0] as any).delivered_at).toBeNull();
  });

  it('deve comprovar que uma falha a qualquer momento da migration provoca ROLLBACK INTEGRAL de toda a transação', async () => {
    // Criar uma instância separada e limpa do banco legado
    const dbRollback = new PGlite();
    await setupLegacyDatabase(dbRollback);
    await seedLegacyHistoricalData(dbRollback);

    // Injetar um erro forçado no meio da migration antes do COMMIT usando função replacer para não escapar $$
    const failingDeploySql = deploySql.replace(
      'COMMIT;',
      () => "DO $$ BEGIN RAISE EXCEPTION 'Simulação de erro crítico no meio da migração'; END $$;\nCOMMIT;"
    );

    let errorCaught = false;
    try {
      await dbRollback.exec(failingDeploySql);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('Simulação de erro crítico');
      await dbRollback.exec('ROLLBACK;');
    }
    expect(errorCaught).toBe(true);

    // Comprovar que o banco foi totalmente preservado pelo ROLLBACK da transação (nenhum artefato persistiu)
    // 1. Tabela idempotency_requests NÃO deve existir
    const idempCheck = await dbRollback.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'idempotency_requests';
    `);
    expect(idempCheck.rows.length).toBe(0);

    // 2. Coluna auth_user_id NÃO deve ter sido criada em users
    const colCheck = await dbRollback.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'auth_user_id';
    `);
    expect(colCheck.rows.length).toBe(0);

    // 3. Os usuários originais devem permanecer intactos ('Admin' e 'Produção' não foram alterados)
    const userOrig = await dbRollback.query(`SELECT id, role FROM public.users ORDER BY id;`);
    expect((userOrig.rows[0] as any).role).toBe('Admin');
    expect((userOrig.rows[1] as any).role).toBe('Produção');

    await dbRollback.close();
  });
});
