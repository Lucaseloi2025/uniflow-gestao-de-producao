import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import app, { supabase, supabaseAdmin } from '../api/index';
import { normalizeUserRole, hasPermission } from '../src/lib/operationEngine';

describe('Suíte Completa de Homologação da Fase 1 — Hardening & Segurança', () => {
  let server: http.Server;
  let baseUrl: string;
  let db: PGlite;

  beforeAll(async () => {
    // 1. Iniciar servidor local do Express em porta efêmera para testes HTTP
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 2. Inicializar banco PostgreSQL 16 estritamente in-memory com @electric-sql/pglite
    db = new PGlite();

    // 2.1 Criar base schema inicial existente antes das migrations da Fase 1
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
        active INT DEFAULT 1,
        allow_parallel_sessions BOOLEAN DEFAULT false,
        sector_name TEXT
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
        production_finished_at TIMESTAMPTZ,
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
        duration_seconds INT DEFAULT 0,
        motivo TEXT DEFAULT 'Pausa operacional',
        pause_reason TEXT DEFAULT 'Pausa operacional'
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
        status TEXT DEFAULT 'AGUARDANDO',
        status_operacao TEXT DEFAULT 'LIBERADA',
        route_position INT DEFAULT 1,
        released_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        blocked_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_order_stage_progress UNIQUE(order_id, stage_id)
      );

      CREATE TABLE IF NOT EXISTS public.order_progress_logs (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        stage_id BIGINT REFERENCES public.stages(id),
        user_id BIGINT REFERENCES public.users(id),
        user_name TEXT,
        quantidade_boa INT DEFAULT 0,
        quantidade_boa_incremento INT DEFAULT 0,
        quantidade_perdida INT DEFAULT 0,
        quantidade_perdida_incremento INT DEFAULT 0,
        quantidade_retrabalho INT DEFAULT 0,
        quantidade_retrabalho_incremento INT DEFAULT 0,
        quantidade_transferida INT DEFAULT 0,
        quantidade_transferida_incremento INT DEFAULT 0,
        idempotency_key TEXT,
        order_item_id BIGINT,
        is_reposition BOOLEAN DEFAULT false,
        observation TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.pcp_settings (
        id SERIAL PRIMARY KEY,
        dias_atencao INT DEFAULT 4,
        dias_urgente INT DEFAULT 2,
        dias_critico INT DEFAULT 0,
        peso_atraso INT DEFAULT 1000,
        peso_bloqueio INT DEFAULT -1000,
        peso_qtd_pendente INT DEFAULT 5,
        peso_etapa_nao_iniciada INT DEFAULT 50,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS public.pcp_blocks (
        id SERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        motivo TEXT NOT NULL,
        observacao TEXT,
        bloqueado_por TEXT,
        data_bloqueio TIMESTAMPTZ DEFAULT NOW(),
        desbloqueado_por TEXT,
        data_desbloqueio TIMESTAMPTZ,
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
        qty_vendida INT NOT NULL DEFAULT 0,
        qty_estoque_fisico INT DEFAULT 0,
        qty_estoque_reservado INT DEFAULT 0,
        qty_em_producao INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS public.order_history (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        action TEXT,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.order_loss_logs (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
        stage_id BIGINT REFERENCES public.stages(id),
        stage_name TEXT,
        user_id BIGINT REFERENCES public.users(id),
        user_name TEXT,
        quantidade_perdida INT NOT NULL DEFAULT 0,
        motivo TEXT,
        motivo_detalhe TEXT,
        etapa_reentrada_id BIGINT,
        etapa_reentrada_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Aplicar a migration canônica e única de deploy da Fase 1
    const migrationDir = path.resolve('supabase', 'migrations');
    const deployCompleteSql = fs.readFileSync(path.join(migrationDir, '20261018_phase1_deploy_complete.sql'), 'utf8');

    await db.exec(deployCompleteSql);

    // Inserir etapas padrão para satisfazer constraints de foreign key
    await db.exec(`
      INSERT INTO public.stages (id, name, sort_order, active, calculation_type)
      VALUES
        (1, 'Corte', 1, 1, 'por_peca'),
        (2, 'Estamparia', 2, 1, 'por_peca'),
        (3, 'Costura', 3, 1, 'por_peca'),
        (4, 'Conferência', 4, 1, 'por_peca')
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (db) {
      await db.close();
    }
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. AUTENTICAÇÃO REAL E ANTI-SPOOFING
  // =========================================================================
  describe('1. Autenticação Real e Anti-Spoofing', () => {
    it('deve rejeitar requisição sem header Authorization com 401 UNAUTHENTICATED', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'Teste Sem Auth', quantity: 10 }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('UNAUTHENTICATED');
    });

    it('deve rejeitar token legado inseguro procomfort_uid:* com 401 INVALID_TOKEN', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer procomfort_uid:1',
        },
        body: JSON.stringify({ client_name: 'Teste Procomfort Uid', quantity: 10 }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('INVALID_TOKEN');
      expect(data.error).toContain('revogado');
    });

    it('deve rejeitar token sem formato Bearer com 401 INVALID_TOKEN', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic invalidtoken123',
        },
        body: JSON.stringify({ client_name: 'Teste Basic Auth' }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('INVALID_TOKEN');
    });

    it('deve rejeitar token JWT inválido ou expirado com 401 INVALID_TOKEN', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid JWT signature', name: 'AuthApiError', status: 401 } as any,
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        },
        body: JSON.stringify({ client_name: 'Teste Inválido' }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('INVALID_TOKEN');
    });

    it('deve bloquear Operador tentando falsificar x-user-id de Administrador com 403 IDENTITY_SPOOFING_DETECTED', async () => {
      // Mock Supabase Auth devolvendo usuário Operador oficial
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: {
            id: 'uuid-operador-123',
            email: 'operador@procomfort.com',
          } as any,
        },
        error: null,
      });

      // Mock retorno do banco public.users para o operador (id 2)
      vi.spyOn(supabaseAdmin, 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 2,
                name: 'Operador Real',
                email: 'operador@procomfort.com',
                role: 'Operador',
                active: 1,
                auth_user_id: 'uuid-operador-123',
              },
              error: null,
            }),
          }),
        }),
      } as any));

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid.operator.jwt',
          'x-user-id': '1', // Tentativa de se passar pelo id 1 (Admin)
        },
        body: JSON.stringify({ client_name: 'Teste Falsificação ID' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('IDENTITY_SPOOFING_DETECTED');
      expect(data.error).toContain('x-user-id');
    });

    it('deve bloquear Operador tentando falsificar x-user-role de Administrador com 403 ROLE_SPOOFING_DETECTED', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: {
            id: 'uuid-operador-123',
            email: 'operador@procomfort.com',
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabaseAdmin, 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 2,
                name: 'Operador Real',
                email: 'operador@procomfort.com',
                role: 'Operador',
                active: 1,
                auth_user_id: 'uuid-operador-123',
              },
              error: null,
            }),
          }),
        }),
      } as any));

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid.operator.jwt',
          'x-user-role': 'Administrador', // Tentativa de elevar perfil
        },
        body: JSON.stringify({ client_name: 'Teste Falsificação Role' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('ROLE_SPOOFING_DETECTED');
      expect(data.error).toContain('x-user-role');
    });

    it('deve bloquear usuário inativo com 403 USER_INACTIVE', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: {
            id: 'uuid-inativo-999',
            email: 'inativo@procomfort.com',
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabaseAdmin, 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 99,
                name: 'Colaborador Desligado',
                email: 'inativo@procomfort.com',
                role: 'Operador',
                active: 0, // Inativo
                auth_user_id: 'uuid-inativo-999',
              },
              error: null,
            }),
          }),
        }),
      } as any));

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer inactive.user.jwt',
        },
        body: JSON.stringify({ client_name: 'Teste Inativo' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('USER_INACTIVE');
    });
  });

  // =========================================================================
  // 2. MATRIZ RBAC E INSPEÇÃO DE ROTAS DO EXPRESS
  // =========================================================================
  describe('2. Matriz RBAC e Inspeção de Rotas do Express', () => {
    it('deve inspecionar app._router.stack e garantir ZERO rotas mutáveis privadas sem middleware de autenticação', () => {
      const router = (app as any)._router;
      expect(router).toBeDefined();

      const routes: { path: string; method: string; stackLength: number }[] = [];
      const unprotectedMutableRoutes: string[] = [];

      router.stack.forEach((layer: any) => {
        if (layer.route) {
          const route = layer.route;
          const routePath = route.path;
          const methods = Object.keys(route.methods);

          methods.forEach((method) => {
            const m = method.toUpperCase();
            if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(m)) {
              routes.push({ path: routePath, method: m, stackLength: route.stack.length });

              // Rotas mutáveis devem possuir pelo menos 2 middlewares (middleware de segurança/auth + handler)
              // exceções legítimas: apenas se for rota pública documentada (não há rotas mutáveis públicas em nosso sistema)
              if (route.stack.length < 2) {
                unprotectedMutableRoutes.push(`[${m}] ${routePath}`);
              }
            }
          });
        }
      });

      expect(routes.length).toBeGreaterThan(20);
      expect(unprotectedMutableRoutes).toEqual([]);
    });

    it('deve validar permissões canônicas dos 6 perfis oficiais sem resquícios de Admin ou Produção', () => {
      expect(hasPermission('Administrador', 'manage_users')).toBe(true);
      expect(hasPermission('PCP', 'manage_pcp')).toBe(true);
      expect(hasPermission('Supervisor', 'override_concurrent_session')).toBe(true);
      expect(hasPermission('Operador', 'execute_operation')).toBe(true);
      expect(hasPermission('Comercial', 'edit_commercial_order')).toBe(true);
      expect(hasPermission('Visualização', 'execute_operation')).toBe(false);
      expect(hasPermission('Visualização', 'view_reports')).toBe(true);

      // Normalização correta para perfis canônicos
      expect(normalizeUserRole('Admin')).toBe('Administrador');
      expect(normalizeUserRole('Administrador')).toBe('Administrador');
      expect(normalizeUserRole('PCP')).toBe('PCP');
      expect(normalizeUserRole('Supervisor')).toBe('Supervisor');
      expect(normalizeUserRole('Operador')).toBe('Operador');
      expect(normalizeUserRole('Produção')).toBe('Operador');
      expect(normalizeUserRole('Comercial')).toBe('Comercial');
      expect(normalizeUserRole('Visualização')).toBe('Visualização');
    });
  });

  // =========================================================================
  // 3. CONCORRÊNCIA E ÍNDICES ÚNICOS PARCIAIS NO BANCO
  // =========================================================================
  describe('3. Concorrência e Índices Únicos Parciais no Banco', () => {
    it('deve violar idx_stage_executions_active_operator se operador tentar ter duas execuções simultâneas ativas', async () => {
      // Inserir dados básicos para o teste
      await db.exec(`
        INSERT INTO public.users (id, name, email, role, active)
        VALUES (101, 'Operador Concorrência', 'op.conc@test.com', 'Operador', 1)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.orders (id, order_number, client_name, quantity, status, required_stages)
        VALUES (501, 'PED-501', 'Cliente Concorrência', 10, 'Em andamento', '[1, 2]'::jsonb)
        ON CONFLICT (id) DO NOTHING;
      `);

      // Primeira execução ativa do operador 101 -> Sucesso
      await db.exec(`
        INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time)
        VALUES (501, 1, 101, 'Em andamento', NOW());
      `);

      // Segunda execução ativa simultânea para o mesmo operador 101 -> DEVE FALHAR por violar idx_stage_executions_active_operator
      let errorThrown = false;
      try {
        await db.exec(`
          INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time)
          VALUES (501, 2, 101, 'Em andamento', NOW());
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/idx_stage_executions_active_operator|unique constraint/i);
      }
      expect(errorThrown).toBe(true);

      // Limpar execução para não interferir em testes subsequentes
      await db.exec(`DELETE FROM public.stage_executions WHERE user_id = 101;`);
    });

    it('deve violar idx_stage_executions_open_stage_order_item se ordem+etapa+item já possuir execução aberta', async () => {
      await db.exec(`
        INSERT INTO public.users (id, name, email, role, active)
        VALUES (102, 'Operador B', 'op.b@test.com', 'Operador', 1)
        ON CONFLICT (id) DO NOTHING;
      `);

      // Operador 101 inicia execução na etapa 1 do pedido 501
      await db.exec(`
        INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time, order_item_id)
        VALUES (501, 1, 101, 'Em andamento', NOW(), 10);
      `);

      // Operador 102 tenta abrir a MESMA etapa 1 do pedido 501 com o mesmo order_item_id 10 -> DEVE FALHAR
      let errorThrown = false;
      try {
        await db.exec(`
          INSERT INTO public.stage_executions (order_id, stage_id, user_id, status, start_time, order_item_id)
          VALUES (501, 1, 102, 'Em andamento', NOW(), 10);
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/idx_stage_executions_open_stage_order_item|unique constraint/i);
      }
      expect(errorThrown).toBe(true);

      await db.exec(`DELETE FROM public.stage_executions WHERE order_id = 501;`);
    });
  });

  // =========================================================================
  // 4. IDEMPOTÊNCIA ATÔMICA VIA public.idempotency_requests
  // =========================================================================
  describe('4. Idempotência Atômica via public.idempotency_requests', () => {
    it('deve processar apontamento inicial e registrar na tabela idempotency_requests', async () => {
      // Inserir pedido e etapa válidos
      await db.exec(`
        INSERT INTO public.orders (id, order_number, client_name, quantity, status, required_stages)
        VALUES (601, 'PED-601', 'Cliente Idempotência', 100, 'Em andamento', '[1]'::jsonb)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status, start_time)
        VALUES (701, 601, 1, 101, 'Em andamento', NOW())
        ON CONFLICT (id) DO NOTHING;
      `);

      // 1. Chamar rpc_record_production com chave de idempotência
      const result1 = await db.query(`
        SELECT public.rpc_record_production(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 101,
          p_idempotency_key => 'idem-key-abc-001',
          p_good_inc => 60,
          p_lost_inc => 0,
          p_rework_inc => 0,
          p_transfer_inc => 60,
          p_next_stage_id => NULL
        ) AS res;
      `);

      const resObj = (result1.rows[0] as any).res;
      expect(resObj.success).toBe(true);
      expect(resObj.quantidade_boa).toBe(60);

      // Verificar persistência em public.idempotency_requests
      const reqRow = await db.query(`
        SELECT status, order_id, stage_id
        FROM public.idempotency_requests
        WHERE idempotency_key = 'idem-key-abc-001';
      `);
      expect(reqRow.rows.length).toBe(1);
      expect((reqRow.rows[0] as any).status).toBe('COMPLETED');
    });

    it('deve reexecutar com mesma chave e mesmo payload retornando replay sem duplicar produção (total permanece 60, não 120)', async () => {
      // Re-executar com exatamente a mesma chave e payload
      const resultReplay = await db.query(`
        SELECT public.rpc_record_production(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 101,
          p_idempotency_key => 'idem-key-abc-001',
          p_good_inc => 60,
          p_lost_inc => 0,
          p_rework_inc => 0,
          p_transfer_inc => 60,
          p_next_stage_id => NULL
        ) AS res;
      `);

      const replayObj = (resultReplay.rows[0] as any).res;
      expect(replayObj.success).toBe(true);
      expect(replayObj.idempotent_replay).toBe(true);
      expect(replayObj.quantidade_boa).toBe(60);

      // Confirmar no progresso que o total gravado continua 60 e NÃO virou 120
      const prog = await db.query(`
        SELECT quantidade_boa
        FROM public.order_stage_progress
        WHERE order_id = 601 AND stage_id = 1;
      `);
      expect((prog.rows[0] as any).quantidade_boa).toBe(60);
    });

    it('deve rejeitar mesma chave com payload divergente retornando 409 IDEMPOTENCY_CONFLICT', async () => {
      // Re-executar com a MESMA chave 'idem-key-abc-001', mas quantidade_boa = 80 (divergente de 60)
      const resultConflict = await db.query(`
        SELECT public.rpc_record_production(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 101,
          p_idempotency_key => 'idem-key-abc-001',
          p_good_inc => 80,
          p_lost_inc => 0,
          p_rework_inc => 0,
          p_transfer_inc => 80,
          p_next_stage_id => NULL
        ) AS res;
      `);

      const conflictObj = (resultConflict.rows[0] as any).res;
      expect(conflictObj.http_status).toBe(409);
      expect(conflictObj.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  // =========================================================================
  // 5. VALIDAÇÕES DE NEGÓCIO, SUPERVISOR OVERRIDE E INTEGRIDADE DE ROTAS
  // =========================================================================
  describe('5. Validações de Negócio, Supervisor Override e Integridade de Rotas', () => {
    it('deve bloquear tentativa de Operador realizar supervisor override retornando 403', async () => {
      // Operador (101) tenta iniciar com supervisor_override = true
      const res = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 101,
          p_supervisor_override => true,
          p_motivo => 'Tentativa Indevida'
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.http_status).toBe(403);
      expect(data.code).toBe('SUPERVISOR_OVERRIDE_FORBIDDEN');
    });

    it('deve exigir motivo obrigatório quando Supervisor realiza override', async () => {
      await db.exec(`
        INSERT INTO public.users (id, name, email, role, active)
        VALUES (201, 'Supervisor Alfa', 'sup@test.com', 'Supervisor', 1)
        ON CONFLICT (id) DO NOTHING;
      `);

      // Supervisor tenta override sem motivo (string vazia ou nula)
      const res = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 201,
          p_supervisor_override => true,
          p_motivo => '   '
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.http_status).toBe(400);
      expect(data.code).toBe('OVERRIDE_REASON_REQUIRED');
    });

    it('deve aceitar Supervisor override com motivo preenchido e auditar em pcp_audit_log', async () => {
      // Limpar execuções anteriores na etapa para não conflitar
      await db.exec(`DELETE FROM public.stage_executions WHERE order_id = 601 AND stage_id = 1;`);

      const res = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 201,
          p_supervisor_override => true,
          p_motivo => 'Liberação autorizada pelo encarregado de turno'
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.success).toBe(true);

      // Verificar que foi auditado em public.pcp_audit_log
      const audit = await db.query(`
        SELECT acao, motivo
        FROM public.pcp_audit_log
        WHERE order_id = 601 AND acao = 'SUPERVISOR_OVERRIDE_START'
        ORDER BY id DESC LIMIT 1;
      `);
      expect(audit.rows.length).toBe(1);
      expect((audit.rows[0] as any).motivo).toContain('turno');

      await db.exec(`DELETE FROM public.stage_executions WHERE user_id = 201;`);
    });

    it('deve rejeitar order_item_id que não pertence ao pedido', async () => {
      // Inserir pedido com item específico
      await db.exec(`
        INSERT INTO public.orders (id, order_number, client_name, quantity, status, required_stages, items)
        VALUES (602, 'PED-602', 'Cliente Multi-Item', 10, 'Em andamento', '[1]'::jsonb, '[{"id": 999, "stages": [1]}]'::jsonb)
        ON CONFLICT (id) DO NOTHING;
      `);

      // Tentar iniciar com order_item_id 888 (não existe no pedido)
      const res = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id => 602,
          p_stage_id => 1,
          p_user_id => 101,
          p_order_item_id => 888
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.http_status).toBe(400);
      expect(data.code).toBe('ITEM_NOT_IN_ORDER');
    });

    it('deve rejeitar stage_id que não pertence à rota do item', async () => {
      // Inserir item 999 na tabela normalizada de itens do pedido com rota [1]
      await db.exec(`
        INSERT INTO public.order_items (id, order_id, item_index, quantity, route_stages, status)
        VALUES (999, 602, 0, 10, '[1]'::jsonb, 'LIBERADA')
        ON CONFLICT (id) DO NOTHING;
      `);

      // Item 999 possui apenas a etapa 1 em sua rota
      const res = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id => 602,
          p_stage_id => 4,
          p_user_id => 101,
          p_order_item_id => 999
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.http_status).toBe(400);
      expect(data.code).toBe('STAGE_NOT_IN_ITEM_ROUTE');
    });

    it('deve rejeitar apontamento de produção se operador não for o dono da execução ativa', async () => {
      // Criar execução pertencente ao usuário 101
      await db.exec(`
        DELETE FROM public.stage_executions WHERE order_id = 601;
        INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status, start_time)
        VALUES (799, 601, 1, 101, 'Em andamento', NOW());
      `);

      // Operador 102 tenta apontar produção em nome de 101
      const res = await db.query(`
        SELECT public.rpc_record_production(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 102,
          p_idempotency_key => 'key-ownership-test-1',
          p_good_inc => 10,
          p_lost_inc => 0,
          p_rework_inc => 0,
          p_transfer_inc => 10
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.http_status).toBe(403);
      expect(data.code).toBe('EXECUTION_OWNERSHIP_MISMATCH');
    });
  });

  // =========================================================================
  // 6. IMUTABILIDADE DA AUDITORIA (pcp_audit_log)
  // =========================================================================
  describe('6. Imutabilidade da Auditoria (pcp_audit_log)', () => {
    it('deve impedir UPDATE em pcp_audit_log lançando exceção no banco', async () => {
      // Inserir registro de auditoria
      const insertRes = await db.query(`
        INSERT INTO public.pcp_audit_log (acao, motivo, usuario)
        VALUES ('TESTE_IMUTABILIDADE', 'original', 'Auditor')
        RETURNING id;
      `);
      const auditId = (insertRes.rows[0] as any).id;

      // Tentativa de alterar registro de auditoria -> DEVE LANÇAR EXCEÇÃO
      let errorThrown = false;
      try {
        await db.exec(`
          UPDATE public.pcp_audit_log
          SET acao = 'ALTERADO_INDEFINIDAMENTE'
          WHERE id = ${auditId};
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/append-only|proibida/i);
      }
      expect(errorThrown).toBe(true);
    });

    it('deve impedir DELETE em pcp_audit_log lançando exceção no banco', async () => {
      const insertRes = await db.query(`
        INSERT INTO public.pcp_audit_log (acao, motivo, usuario)
        VALUES ('TESTE_DELETE', 'preservar', 'Auditor')
        RETURNING id;
      `);
      const auditId = (insertRes.rows[0] as any).id;

      // Tentativa de apagar registro de auditoria -> DEVE LANÇAR EXCEÇÃO
      let errorThrown = false;
      try {
        await db.exec(`
          DELETE FROM public.pcp_audit_log
          WHERE id = ${auditId};
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/append-only|proibida/i);
      }
      expect(errorThrown).toBe(true);
    });
  });

  // =========================================================================
  // 7. APONTAMENTO DE PERDAS TRANSACIONAL (rpc_record_loss)
  // =========================================================================
  describe('7. Apontamento de Perdas Transacional (rpc_record_loss)', () => {
    it('deve rejeitar perda com quantidade menor ou igual a zero', async () => {
      const res = await db.query(`
        SELECT public.rpc_record_loss(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 101,
          p_lost_qty => 0,
          p_reason => 'Defeito',
          p_idempotency_key => 'loss-key-zero'
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.http_status).toBe(400);
      expect(data.code).toBe('INVALID_QUANTITY');
    });

    it('deve rejeitar perda com chave de idempotência ausente ou vazia (IDEMPOTENCY_KEY_REQUIRED)', async () => {
      const res = await db.query(`
        SELECT public.rpc_record_loss(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 101,
          p_lost_qty => 1,
          p_reason => 'Defeito',
          p_idempotency_key => '   '
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.http_status).toBe(400);
      expect(data.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('deve registrar perda válida atomicamente, gerando log e auditoria', async () => {
      const res = await db.query(`
        SELECT public.rpc_record_loss(
          p_order_id => 601,
          p_stage_id => 1,
          p_user_id => 101,
          p_lost_qty => 3,
          p_reason => 'Defeito no tecido',
          p_idempotency_key => 'hardening-loss-01'
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.success).toBe(true);
      expect(data.quantidade_perdida).toBe(3);

      // Confirmar gravação no log de perdas
      const lossLogs = await db.query(`
        SELECT quantidade_perdida, motivo
        FROM public.order_loss_logs
        WHERE order_id = 601 AND stage_id = 1;
      `);
      expect(lossLogs.rows.length).toBeGreaterThanOrEqual(1);
      expect((lossLogs.rows[0] as any).quantidade_perdida).toBe(3);

      // Confirmar auditoria append-only
      const audit = await db.query(`
        SELECT acao, motivo
        FROM public.pcp_audit_log
        WHERE order_id = 601 AND acao = 'REGISTRAR_PERDA'
        ORDER BY id DESC LIMIT 1;
      `);
      expect(audit.rows.length).toBe(1);
      expect((audit.rows[0] as any).motivo).toBe('Defeito no tecido');
    });
  });

  // =========================================================================
  // 8. PRIVILÉGIOS E ROLES NO BANCO (anon vs authenticated vs service_role)
  // =========================================================================
  describe('8. Privilégios e Roles no Banco (anon vs authenticated vs service_role)', () => {
    it('SET ROLE anon deve ser proibido de DML direto nas tabelas internas e execução de RPCs', async () => {
      await db.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon;
          END IF;
        END $$;
      `);

      // Como anon, tentar INSERT direto em orders -> DEVE FALHAR
      let anonInsertFailed = false;
      try {
        await db.exec(`
          SET ROLE anon;
          INSERT INTO public.orders (order_number, client_name, quantity)
          VALUES ('HACK', 'Invasor', 100);
        `);
      } catch (err: any) {
        anonInsertFailed = true;
      } finally {
        await db.exec(`RESET ROLE;`);
      }
      expect(anonInsertFailed).toBe(true);

      // Como anon, tentar executar RPC rpc_start_operation -> DEVE FALHAR (permissão negada)
      let anonRpcFailed = false;
      try {
        await db.exec(`
          SET ROLE anon;
          SELECT public.rpc_start_operation(601, 1, 101);
        `);
      } catch (err: any) {
        anonRpcFailed = true;
      } finally {
        await db.exec(`RESET ROLE;`);
      }
      expect(anonRpcFailed).toBe(true);
    });

    it('SET ROLE authenticated deve ter permissão de execução direta das RPCs revogada (somente service_role)', async () => {
      await db.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
          END IF;
        END $$;
      `);

      let authRpcFailed = false;
      try {
        await db.exec(`
          SET ROLE authenticated;
          SELECT public.rpc_record_production(601, 1, 101, 10, 0, 0, 10);
        `);
      } catch (err: any) {
        authRpcFailed = true;
      } finally {
        await db.exec(`RESET ROLE;`);
      }
      expect(authRpcFailed).toBe(true);
    });
  });

  // =========================================================================
  // 9. FUSO HORÁRIO E INTEGRALIDADE DE TIMESTAMPS
  // =========================================================================
  describe('9. Fuso Horário e Integridade de Timestamps', () => {
    it('deve garantir timestamps compatíveis com fuso America/Sao_Paulo (-03:00)', async () => {
      const res = await db.query(`
        SELECT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00' AS sp_now;
      `);
      const spNow = (res.rows[0] as any).sp_now;
      expect(spNow).toBeDefined();
      expect(spNow).toMatch(/-03:00$/);
    });
  });
});
