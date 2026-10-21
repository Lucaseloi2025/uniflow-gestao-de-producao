import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Homologação Completa da Fase 2 — Execução Operacional e 6 Perfis', () => {
  let db: PGlite;
  const deploySql = fs.readFileSync(
    path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
    'utf8'
  );

  let corteId: number;
  let costuraId: number;
  let adminId: number;
  let pcpId: number;
  let supervisorId: number;
  let operatorId: number;
  let operator2Id: number;
  let commercialId: number;
  let viewerId: number;

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
        (20, 'Costura', 'Costura', 1, 2, 'por_peca'),
        (30, 'Conferência', 'Conferência', 0, 3, 'por_peca')
      ON CONFLICT (id) DO UPDATE SET active = EXCLUDED.active;
    `);
    corteId = 10;
    costuraId = 20;

    // 4. Create Users for all 6 Roles
    const uRes = await db.query(`
      INSERT INTO public.users (id, name, email, role, active, sector_name)
      VALUES 
        (100, 'Admin Usuário', 'admin@comfortpro.com', 'Administrador', 1, NULL),
        (200, 'PCP Usuário', 'pcp@comfortpro.com', 'PCP', 1, NULL),
        (300, 'Supervisor Usuário', 'supervisor@comfortpro.com', 'Supervisor', 1, NULL),
        (400, 'Operador Corte', 'operador.corte@comfortpro.com', 'Operador', 1, 'Corte'),
        (401, 'Operador Costura', 'operador.costura@comfortpro.com', 'Operador', 1, 'Costura'),
        (402, 'Operador Fluxo', 'operador.fluxo@comfortpro.com', 'Operador', 1, 'Corte'),
        (500, 'Comercial Usuário', 'comercial@comfortpro.com', 'Comercial', 1, NULL),
        (600, 'Viewer Usuário', 'viewer@comfortpro.com', 'Visualização', 1, NULL)
      RETURNING id, role;
    `);

    adminId = 100;
    pcpId = 200;
    supervisorId = 300;
    operatorId = 400;
    operator2Id = 401;
    commercialId = 500;
    viewerId = 600;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  describe('1. Validação dos 6 Perfis (RBAC)', () => {
    it('Operador pode iniciar operação em etapa liberada', async () => {
      // Criar pedido
      const ordRes = await db.query(`
        INSERT INTO public.orders (order_number, client_name, product_type, quantity, deadline, status, required_stages)
        VALUES ('PED-OP-01', 'Cliente Op', 'Dry Fit', 20, '2026-10-25', 'Entrada', '[10, 20]'::jsonb)
        RETURNING id;
      `);
      const orderId = Number(ordRes.rows[0].id);

      const rpcRes = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := $1,
          p_stage_id := $2,
          p_user_id := $3,
          p_order_item_id := NULL,
          p_supervisor_override := false,
          p_motivo := NULL
        ) AS res;
      `, [orderId, corteId, operatorId]);

      const data = (rpcRes.rows[0].res as any);
      expect(data.error).toBeUndefined();
      expect(data.status_operacao).toBe('EM_ANDAMENTO');
      expect(Number(data.execution_id)).toBeGreaterThan(0);
    });

    it('Operador NÃO consegue iniciar pedido bloqueado pelo PCP', async () => {
      const ordRes = await db.query(`
        INSERT INTO public.orders (order_number, client_name, product_type, quantity, deadline, status, required_stages, pcp_is_blocked)
        VALUES ('PED-BLOCKED-01', 'Cliente Blocked', 'Dry Fit', 15, '2026-10-25', 'Entrada', '[10, 20]'::jsonb, true)
        RETURNING id;
      `);
      const orderId = Number(ordRes.rows[0].id);

      const rpcRes = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := $1,
          p_stage_id := $2,
          p_user_id := $3,
          p_order_item_id := NULL,
          p_supervisor_override := false,
          p_motivo := NULL
        ) AS res;
      `, [orderId, corteId, operatorId]);

      const data = (rpcRes.rows[0].res as any);
      expect(data.error).toBeDefined();
      expect(data.code).toBe('ORDER_BLOCKED');
      expect(data.http_status).toBe(400);
    });

    it('Visualização e Comercial NÃO possuem permissão para iniciar operações', async () => {
      const ordRes = await db.query(`
        INSERT INTO public.orders (order_number, client_name, product_type, quantity, deadline, status, required_stages)
        VALUES ('PED-RBAC-01', 'Cliente RBAC', 'Algodão', 30, '2026-10-26', 'Entrada', '[10, 20]'::jsonb)
        RETURNING id;
      `);
      const orderId = Number(ordRes.rows[0].id);

      // Comercial
      const resCom = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := $1, p_stage_id := $2, p_user_id := $3,
          p_order_item_id := NULL, p_supervisor_override := false, p_motivo := NULL
        ) AS res;
      `, [orderId, corteId, commercialId]);
      expect((resCom.rows[0].res as any).code).toBe('INSUFFICIENT_ROLE');

      // Visualização
      const resView = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := $1, p_stage_id := $2, p_user_id := $3,
          p_order_item_id := NULL, p_supervisor_override := false, p_motivo := NULL
        ) AS res;
      `, [orderId, corteId, viewerId]);
      expect((resView.rows[0].res as any).code).toBe('INSUFFICIENT_ROLE');
    });

    it('Supervisor e Admin conseguem realizar override com motivo obrigatório', async () => {
      const ordRes = await db.query(`
        INSERT INTO public.orders (order_number, client_name, product_type, quantity, deadline, status, required_stages)
        VALUES ('PED-OVERRIDE-01', 'Cliente Override', 'Dry Fit', 10, '2026-10-28', 'Entrada', '[10, 20]'::jsonb)
        RETURNING id;
      `);
      const orderId = Number(ordRes.rows[0].id);

      // Tentar iniciar etapa 20 (Costura) antes da etapa 10 (Corte) SEM override -> deve falhar
      const failRes = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := $1, p_stage_id := $2, p_user_id := $3,
          p_order_item_id := NULL, p_supervisor_override := false, p_motivo := NULL
        ) AS res;
      `, [orderId, costuraId, supervisorId]);
      expect((failRes.rows[0].res as any).code).toBe('PREVIOUS_STAGE_NOT_READY');

      // Tentar com override COM motivo válido -> sucesso
      const successRes = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := $1, p_stage_id := $2, p_user_id := $3,
          p_order_item_id := NULL, p_supervisor_override := true, p_motivo := 'Adiantamento emergencial de costura aprovado pelo PCP'
        ) AS res;
      `, [orderId, costuraId, supervisorId]);
      expect((successRes.rows[0].res as any).error).toBeUndefined();
      expect((successRes.rows[0].res as any).status_operacao).toBe('EM_ANDAMENTO');
    });
  });

  describe('2. Ciclo Operacional Completo: Iniciar -> Pausar -> Retomar -> Apontar -> Perda -> Finalizar', () => {
    it('Executa o fluxo completo e valida persistência de auditoria e status Pronto', async () => {
      // 1. Criar pedido
      const ordRes = await db.query(`
        INSERT INTO public.orders (order_number, client_name, product_type, quantity, deadline, status, required_stages)
        VALUES ('PED-FLUXO-01', 'Cliente Fluxo', 'Dry Fit', 50, '2026-10-22', 'Entrada', '[10, 20]'::jsonb)
        RETURNING id;
      `);
      const orderId = Number(ordRes.rows[0].id);

      // 2. Iniciar Corte
      const operatorFluxoId = 402;
      const startRes = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := $1, p_stage_id := $2, p_user_id := $3,
          p_order_item_id := NULL, p_supervisor_override := false, p_motivo := NULL
        ) AS res;
      `, [orderId, corteId, operatorFluxoId]);
      const execId = Number((startRes.rows[0].res as any).execution_id);
      expect(execId).toBeGreaterThan(0);

      // 3. Pausar Corte
      const pauseRes = await db.query(`
        SELECT public.rpc_pause_operation(
          p_execution_id := $1,
          p_user_id := $2,
          p_motivo := 'Troca de bobina de tecido',
          p_supervisor_override := false
        ) AS res;
      `, [execId, operatorFluxoId]);
      expect((pauseRes.rows[0].res as any).status_operacao).toBe('PAUSADA');

      // 4. Retomar Corte
      const resumeRes = await db.query(`
        SELECT public.rpc_resume_operation(
          p_execution_id := $1,
          p_user_id := $2,
          p_supervisor_override := false,
          p_motivo := NULL
        ) AS res;
      `, [execId, operatorFluxoId]);
      expect((resumeRes.rows[0].res as any).status_operacao).toBe('EM_ANDAMENTO');

      // 5. Apontar parcial de 48 peças boas
      await db.query(`
        INSERT INTO public.order_progress_logs (order_id, stage_id, user_id, user_name, quantidade_boa_incremento, idempotency_key, created_at)
        VALUES ($1, $2, $3, 'Operador Fluxo', 48, 'idem-prog-01', NOW());
      `, [orderId, corteId, operatorFluxoId]);

      // Atualizar progresso acumulado
      await db.query(`
        UPDATE public.order_stage_progress
        SET quantidade_boa = 48, saldo_pendente = 2
        WHERE order_id = $1 AND stage_id = $2;
      `, [orderId, corteId]);

      // 6. Registrar perda de 2 peças com reposição cortada
      await db.query(`
        INSERT INTO public.order_loss_logs (order_id, stage_id, user_id, user_name, quantidade_perdida, motivo, etapa_reentrada_id, created_at)
        VALUES ($1, $2, $3, 'Operador Fluxo', 2, 'Defeito de corte', $2, NOW());
      `, [orderId, corteId, operatorFluxoId]);

      // Reposição produzida: quantidade boa atinge 50 e pendência de reposição zerada
      await db.query(`
        UPDATE public.order_stage_progress
        SET quantidade_boa = 50, quantidade_perdida = 2, pendencia_reposicao = 0, saldo_pendente = 0
        WHERE order_id = $1 AND stage_id = $2;
      `, [orderId, corteId]);

      // 7. Finalizar Corte
      const finishCorteRes = await db.query(`
        SELECT public.rpc_finish_operation(
          p_execution_id := $1,
          p_user_id := $2,
          p_good_inc := 0,
          p_partial := false,
          p_observation := 'Corte finalizado com 48 boas e 2 perdas',
          p_idempotency_key := NULL,
          p_supervisor_override := false
        ) AS res;
      `, [execId, operatorFluxoId]);
      expect((finishCorteRes.rows[0].res as any).status_operacao).toBeDefined();

      // 8. Iniciar e Finalizar Costura (última etapa produtiva)
      const startCosturaRes = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := $1, p_stage_id := $2, p_user_id := $3,
          p_order_item_id := NULL, p_supervisor_override := false, p_motivo := NULL
        ) AS res;
      `, [orderId, costuraId, operator2Id]);
      const execCosturaId = Number((startCosturaRes.rows[0].res as any).execution_id);
      expect(execCosturaId).toBeGreaterThan(0);

      // Registrar produção em Costura
      await db.query(`
        UPDATE public.order_stage_progress
        SET quantidade_boa = 50, saldo_pendente = 0
        WHERE order_id = $1 AND stage_id = $2;
      `, [orderId, costuraId]);

      const finishCosturaRes = await db.query(`
        SELECT public.rpc_finish_operation(
          p_execution_id := $1,
          p_user_id := $2,
          p_good_inc := 0,
          p_partial := false,
          p_observation := 'Costura concluída',
          p_idempotency_key := NULL,
          p_supervisor_override := false
        ) AS res;
      `, [execCosturaId, operator2Id]);
      expect((finishCosturaRes.rows[0].res as any).status_operacao).toBeDefined();

      // 9. Verificar Status do Pedido: DEVE SER 'Pronto' (NÃO 'Entregue'!)
      const checkOrder = await db.query(`
        SELECT status, pcp_status FROM public.orders WHERE id = $1;
      `, [orderId]);
      const orderRow = checkOrder.rows[0];

      expect(orderRow.status).toBe('Pronto');
      expect(orderRow.pcp_status).toBe('PRONTO');

      // 10. Verificar Auditoria Imutável
      const auditRes = await db.query(`
        SELECT count(*) as total FROM public.pcp_audit_log WHERE order_id = $1;
      `, [orderId]);
      expect(Number(auditRes.rows[0].total)).toBeGreaterThan(0);
    });
  });

  describe('3. Validação de Segurança do Bundle Frontend', () => {
    it('service_role NUNCA deve estar presente em arquivos do frontend ou bundle dist/', () => {
      const distDir = path.resolve('dist');
      if (fs.existsSync(distDir)) {
        const checkDirectory = (dir: string) => {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
              checkDirectory(fullPath);
            } else if (file.endsWith('.js') || file.endsWith('.html')) {
              const content = fs.readFileSync(fullPath, 'utf8');
              expect(content.includes('service_role')).toBe(false);
              expect(content.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
            }
          }
        };
        checkDirectory(distDir);
      }
    });
  });
});
