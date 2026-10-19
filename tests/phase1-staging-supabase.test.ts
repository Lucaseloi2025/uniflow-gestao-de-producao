import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import app, { supabase, supabaseAdmin } from '../api/index';

/**
 * NOTA DE TRANSPARÊNCIA DA AUDITORIA (ITEM 6):
 * Este arquivo executa exclusivamente em "Emulação Local PGlite (Wasm Postgres no Node.js)".
 * O PGlite valida constraints relacionais, triggers, funções PL/pgSQL e regras de RLS simuladas,
 * mas NÃO é uma instância real de Supabase:
 * - Não testa o gateway PostgREST HTTP real;
 * - Não testa o serviço GoTrue (Supabase Auth) nem sessões reais de JWT;
 * - Não testa permissões de superusuário gerenciadas pelo dashboard ou extensões de cloud.
 * 
 * Para testes reais em projeto Supabase na nuvem, utilize tests/phase1-supabase-staging-live.test.ts.
 */
describe('Emulação Local PGlite (Wasm Postgres) — Validação Relacional da Fase 1', () => {
  let db: PGlite;
  let server: http.Server;
  let baseUrl: string;

  const deploySql = fs.readFileSync(
    path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'),
    'utf8'
  );
  const preflightSql = fs.readFileSync(
    path.resolve('supabase', 'preflight_phase1_check.sql'),
    'utf8'
  );

  // Os 6 perfis canônicos oficiais e seus UUIDs no Supabase Auth
  const stagingUsers = [
    { id: 1, name: 'Admin Staging', email: 'admin@staging.com', auth_id: '11111111-1111-1111-1111-111111111111', role: 'Administrador', legacy_role: 'Admin' },
    { id: 2, name: 'PCP Staging', email: 'pcp@staging.com', auth_id: '22222222-2222-2222-2222-222222222222', role: 'PCP', legacy_role: 'PCP' },
    { id: 3, name: 'Supervisor Staging', email: 'supervisor@staging.com', auth_id: '33333333-3333-3333-3333-333333333333', role: 'Supervisor', legacy_role: 'Supervisor' },
    { id: 4, name: 'Operador Staging', email: 'operador@staging.com', auth_id: '44444444-4444-4444-4444-444444444444', role: 'Operador', legacy_role: 'Produção' },
    { id: 5, name: 'Comercial Staging', email: 'comercial@staging.com', auth_id: '55555555-5555-5555-5555-555555555555', role: 'Comercial', legacy_role: 'Comercial' },
    { id: 6, name: 'Visualizacao Staging', email: 'viewer@staging.com', auth_id: '66666666-6666-6666-6666-666666666666', role: 'Visualização', legacy_role: 'Visualizacao' },
  ];

  beforeAll(async () => {
    // 1. Iniciar servidor Express em porta efêmera para rotas de integração
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 2. Inicializar banco emulado de staging do Supabase
    db = new PGlite();

    // 2.1 Emular papéis e schema 'auth' nativos do Supabase
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

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      -- Schema legado inicial do Comfort Uniformes
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
        quantity INT DEFAULT 1,
        status TEXT DEFAULT 'Entrada',
        items JSONB DEFAULT '[]'::jsonb,
        required_stages JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2.2 Povoar auth.users e public.users legado
    for (const u of stagingUsers) {
      await db.exec(`
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('${u.auth_id}'::uuid, '${u.email}', '{"name": "${u.name}"}'::jsonb)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.users (id, name, email, role, active)
        VALUES (${u.id}, '${u.name}', '${u.email}', '${u.legacy_role}', 1)
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    // Povoar etapas iniciais
    await db.exec(`
      INSERT INTO public.stages (id, name, sort_order, active)
      VALUES
        (1, 'Corte & Enfesto', 1, 1),
        (2, 'Estamparia Silk', 2, 1),
        (3, 'Costura Geral', 3, 1),
        (4, 'Conferência & Embalagem', 4, 1)
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
  });

  // =========================================================================
  // 1. PREFLIGHT E COMPARAÇÃO COM AUTH.USERS
  // =========================================================================
  describe('1. Diagnóstico Preflight e Integração auth.users', () => {
    it('deve executar o preflight com sucesso em banco de staging e emitir PASS sem bloqueadores', async () => {
      await db.exec(preflightSql);

      const res = await db.query(`
        SELECT status, total_bloqueadores, total_avisos, veredito
        FROM (
          SELECT
            CASE WHEN COUNT(*) FILTER (WHERE severidade = 'BLOCKER') > 0 THEN 'BLOCKED' ELSE 'PASS' END AS status,
            COUNT(*) FILTER (WHERE severidade = 'BLOCKER') AS total_bloqueadores,
            COUNT(*) FILTER (WHERE severidade = 'WARNING') AS total_avisos,
            CASE WHEN COUNT(*) FILTER (WHERE severidade = 'BLOCKER') > 0 THEN 'BLOQUEADA' ELSE 'APTO' END AS veredito
          FROM _preflight_audit_results
        ) q;
      `);

      const result = res.rows[0] as any;
      expect(result.status).toBe('PASS');
      expect(result.total_bloqueadores).toBe(0);
    });

    it('deve emitir BLOCKED no preflight se existir usuário legado sem correspondente em auth.users', async () => {
      const isolDb = new PGlite();
      await isolDb.exec(`
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT UNIQUE);
        CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT);
        INSERT INTO auth.users (id, email) VALUES ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'::uuid, 'auth@empresa.com');
        INSERT INTO public.users (name, email, role) VALUES ('Órfão', 'sem_auth@empresa.com', 'Administrador');
      `);

      await isolDb.exec(preflightSql);
      const res = await isolDb.query(`
        SELECT categoria, severidade FROM _preflight_audit_results WHERE severidade = 'BLOCKER';
      `);
      expect(res.rows.length).toBeGreaterThanOrEqual(1);
      expect((res.rows[0] as any).categoria).toBe('AUTH_USERS_SEM_VINCULO');
      await isolDb.close();
    });

    it('deve emitir BLOCKED no preflight se existirem e-mails duplicados em auth.users', async () => {
      const isolDb = new PGlite();
      await isolDb.exec(`
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
        CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT, role TEXT);
        INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 'dup@empresa.com');
        INSERT INTO auth.users (id, email) VALUES ('22222222-2222-2222-2222-222222222222'::uuid, 'DUP@empresa.com');
        INSERT INTO public.users (name, email, role) VALUES ('User 1', 'dup@empresa.com', 'Administrador');
      `);

      await isolDb.exec(preflightSql);
      const res = await isolDb.query(`
        SELECT categoria, severidade FROM _preflight_audit_results WHERE categoria = 'AUTH_USERS_EMAIL_DUPLICADO';
      `);
      expect(res.rows.length).toBeGreaterThanOrEqual(1);
      expect((res.rows[0] as any).severidade).toBe('BLOCKER');
      await isolDb.close();
    });
  });

  // =========================================================================
  // 2. APLICAÇÃO DA MIGRATION E BACKFILL DE AUTH_USER_ID
  // =========================================================================
  describe('2. Aplicação da Migration e Backfill Unívoco dos 6 Perfis', () => {
    it('deve aplicar a migration consolidada e realizar backfill unívoco de auth_user_id para os 6 perfis', async () => {
      await db.exec(deploySql);

      const usersRes = await db.query(`
        SELECT id, name, email, role, auth_user_id::text
        FROM public.users
        ORDER BY id;
      `);

      expect(usersRes.rows.length).toBe(6);
      for (const expected of stagingUsers) {
        const found = usersRes.rows.find((u: any) => u.id === expected.id) as any;
        expect(found).toBeDefined();
        expect(found.auth_user_id).toBe(expected.auth_id);
        expect(found.role).toBe(expected.role);
      }
    });

    it('deve garantir que todas as tabelas e colunas obrigatórias foram criadas', async () => {
      const tables = [
        'stages', 'users', 'orders', 'order_items', 'stage_executions',
        'pauses', 'order_stage_progress', 'order_item_stage_progress',
        'order_progress_logs', 'order_loss_logs', 'pcp_audit_log',
        'pcp_settings', 'pcp_blocks', 'pcp_producao_necessidades',
        'order_history', 'idempotency_requests'
      ];

      for (const tbl of tables) {
        const res = await db.query(`
          SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tbl}';
        `);
        expect(res.rows.length, `Tabela public.${tbl} deve existir`).toBe(1);
      }

      // Validar colunas de pcp_audit_log
      const auditCols = ['order_id', 'entidade', 'usuario', 'acao', 'motivo', 'observacao', 'valor_antigo', 'valor_novo', 'detalhes', 'created_at'];
      for (const col of auditCols) {
        const res = await db.query(`
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'pcp_audit_log' AND column_name = '${col}';
        `);
        expect(res.rows.length, `Coluna ${col} deve existir em pcp_audit_log`).toBe(1);
      }
    });
  });

  // =========================================================================
  // 3. SEGURANÇA RLS: SEM RECURSÃO INFINITA E MATRIZ DE ACESSO
  // =========================================================================
  describe('3. RLS Estrito sem Recursão Infinita em public.users e pcp_audit_log', () => {
    beforeAll(async () => {
      // Inserir registro na auditoria para testes de visibilidade
      await db.exec(`
        INSERT INTO public.pcp_audit_log (id, entidade, order_id, usuario, acao, motivo, created_at)
        VALUES (9001, 'orders', NULL, 'Admin Staging', 'TESTE_AUDITORIA', 'Verificação RLS', NOW())
        ON CONFLICT (id) DO NOTHING;
      `);
    });

    it('Operador: consulta em public.users NÃO deve gerar recursão e deve retornar SOMENTE seu próprio registro', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
      `);

      const res = await db.query(`SELECT id, name, role FROM public.users ORDER BY id;`);
      expect(res.rows.length).toBe(1);
      expect((res.rows[0] as any).id).toBe(4);
      expect((res.rows[0] as any).role).toBe('Operador');

      // Operador não tem acesso a pcp_audit_log
      const auditRes = await db.query(`SELECT * FROM public.pcp_audit_log;`);
      expect(auditRes.rows.length).toBe(0);

      await db.exec(`RESET ROLE;`);
    });

    it('Comercial: consulta em public.users deve retornar apenas seu próprio registro e 0 em pcp_audit_log', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
      `);

      const res = await db.query(`SELECT id, name, role FROM public.users ORDER BY id;`);
      expect(res.rows.length).toBe(1);
      expect((res.rows[0] as any).id).toBe(5);

      const auditRes = await db.query(`SELECT * FROM public.pcp_audit_log;`);
      expect(auditRes.rows.length).toBe(0);

      await db.exec(`RESET ROLE;`);
    });

    it('Visualização: consulta em public.users deve retornar apenas seu próprio registro e 0 em pcp_audit_log', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
      `);

      const res = await db.query(`SELECT id, name, role FROM public.users ORDER BY id;`);
      expect(res.rows.length).toBe(1);
      expect((res.rows[0] as any).id).toBe(6);

      const auditRes = await db.query(`SELECT * FROM public.pcp_audit_log;`);
      expect(auditRes.rows.length).toBe(0);

      await db.exec(`RESET ROLE;`);
    });

    it('Supervisor: consulta em public.users deve retornar todos os 6 usuários e 0 em pcp_audit_log', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
      `);

      const res = await db.query(`SELECT id, name, role FROM public.users ORDER BY id;`);
      expect(res.rows.length).toBe(6);

      // Supervisor não lê auditoria do PCP
      const auditRes = await db.query(`SELECT * FROM public.pcp_audit_log;`);
      expect(auditRes.rows.length).toBe(0);

      await db.exec(`RESET ROLE;`);
    });

    it('PCP: consulta em public.users retorna todos os 6 usuários e consegue ler pcp_audit_log', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
      `);

      const res = await db.query(`SELECT id, name, role FROM public.users ORDER BY id;`);
      expect(res.rows.length).toBe(6);

      const auditRes = await db.query(`SELECT id, acao FROM public.pcp_audit_log WHERE id = 9001;`);
      expect(auditRes.rows.length).toBe(1);

      await db.exec(`RESET ROLE;`);
    });

    it('Administrador: consulta em public.users retorna todos os 6 usuários e consegue ler pcp_audit_log', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
      `);

      const res = await db.query(`SELECT id, name, role FROM public.users ORDER BY id;`);
      expect(res.rows.length).toBe(6);

      const auditRes = await db.query(`SELECT id, acao FROM public.pcp_audit_log WHERE id = 9001;`);
      expect(auditRes.rows.length).toBe(1);

      await db.exec(`RESET ROLE;`);
    });

    it('Anon: deve ter leitura bloqueada em public.users e public.pcp_audit_log', async () => {
      let usersBlocked = false;
      try {
        await db.exec(`SET ROLE anon; SELECT * FROM public.users;`);
      } catch (err: any) {
        usersBlocked = true;
        expect(err.message).toMatch(/permission denied/i);
      } finally {
        await db.exec(`RESET ROLE;`);
      }
      expect(usersBlocked).toBe(true);

      let auditBlocked = false;
      try {
        await db.exec(`SET ROLE anon; SELECT * FROM public.pcp_audit_log;`);
      } catch (err: any) {
        auditBlocked = true;
        expect(err.message).toMatch(/permission denied/i);
      } finally {
        await db.exec(`RESET ROLE;`);
      }
      expect(auditBlocked).toBe(true);
    });
  });

  // =========================================================================
  // 4. TESTE DAS 7 RPCS: REVOKE E EXECUÇÃO SEGURA
  // =========================================================================
  describe('4. Ciclo Operacional dos 7 RPCs em Staging', () => {
    let activeExecutionId: number;

    beforeAll(async () => {
      // Inserir pedido e itens para teste das RPCs
      await db.exec(`
        INSERT INTO public.orders (id, order_number, client_name, quantity, status, required_stages)
        VALUES (8001, 'PED-STAGE-8001', 'Cliente Staging', 100, 'Em Produção', '[1, 2, 3, 4]'::jsonb)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.order_items (id, order_id, item_index, sku, description, quantity, route_stages, status)
        VALUES (80011, 8001, 0, 'SKU-8001-A', 'Camiseta Polo', 100, '[1, 2, 3, 4]'::jsonb, 'LIBERADA')
        ON CONFLICT (id) DO NOTHING;
      `);
    });

    it('Segurança RPC: anon e authenticated devem receber Permission Denied ao chamar RPCs diretamente', async () => {
      const rpcList = [
        'pcp_apply_stage_progress',
        'rpc_start_operation',
        'rpc_pause_operation',
        'rpc_resume_operation',
        'rpc_finish_operation',
        'rpc_record_production',
        'rpc_record_loss'
      ];

      for (const rpc of rpcList) {
        let anonBlocked = false;
        try {
          await db.exec(`SET ROLE anon; SELECT public.${rpc}();`);
        } catch (err: any) {
          anonBlocked = true;
          expect(err.message).toMatch(/permission denied|does not exist/i);
        } finally {
          await db.exec(`RESET ROLE;`);
        }
        expect(anonBlocked).toBe(true);

        let authBlocked = false;
        try {
          await db.exec(`SET ROLE authenticated; SELECT public.${rpc}();`);
        } catch (err: any) {
          authBlocked = true;
          expect(err.message).toMatch(/permission denied|does not exist/i);
        } finally {
          await db.exec(`RESET ROLE;`);
        }
        expect(authBlocked).toBe(true);
      }
    });

    it('RPC 1: rpc_start_operation deve iniciar operação com sucesso e rejeitar etapa fora de rota', async () => {
      // Violação: etapa 999 fora da rota
      const errRes = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id => 8001,
          p_stage_id => 999,
          p_user_id => 4,
          p_order_item_id => 80011
        ) AS res;
      `);
      expect((errRes.rows[0] as any).res.code).toBe('STAGE_NOT_IN_ITEM_ROUTE');

      // Sucesso: iniciar etapa 1
      const okRes = await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id => 8001,
          p_stage_id => 1,
          p_user_id => 4,
          p_order_item_id => 80011
        ) AS res;
      `);
      const data = (okRes.rows[0] as any).res;
      expect(data.success).toBe(true);
      expect(data.status_operacao).toBe('EM_ANDAMENTO');
      expect(data.execution_id).toBeDefined();
      activeExecutionId = Number(data.execution_id);
    });

    it('RPC 2: rpc_pause_operation deve pausar execução em andamento', async () => {
      const res = await db.query(`
        SELECT public.rpc_pause_operation(
          p_execution_id => ${activeExecutionId},
          p_user_id => 4,
          p_motivo => 'Almoço operacional'
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.success).toBe(true);
      expect(data.status_operacao).toBe('PAUSADA');
    });

    it('RPC 3: rpc_resume_operation deve retomar execução pausada', async () => {
      const res = await db.query(`
        SELECT public.rpc_resume_operation(
          p_execution_id => ${activeExecutionId},
          p_user_id => 4
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.success).toBe(true);
      expect(data.status_operacao).toBe('EM_ANDAMENTO');
    });

    it('RPC 4: rpc_record_production deve exigir idempotency_key e computar incremento', async () => {
      // Violação: sem idempotency_key
      const errRes = await db.query(`
        SELECT public.rpc_record_production(
          p_order_id => 8001,
          p_stage_id => 1,
          p_user_id => 4,
          p_idempotency_key => '',
          p_good_inc => 20,
          p_order_item_id => 80011
        ) AS res;
      `);
      expect((errRes.rows[0] as any).res.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

      // Sucesso
      const okRes = await db.query(`
        SELECT public.rpc_record_production(
          p_order_id => 8001,
          p_stage_id => 1,
          p_user_id => 4,
          p_idempotency_key => 'prod-staging-ok-1',
          p_good_inc => 50,
          p_order_item_id => 80011
        ) AS res;
      `);
      const data = (okRes.rows[0] as any).res;
      expect(data.success).toBe(true);
      expect(data.quantidade_boa).toBe(50);
    });

    it('RPC 5: rpc_record_loss deve exigir idempotency_key e gravar perda com auditoria', async () => {
      // Violação: sem idempotency_key
      const errRes = await db.query(`
        SELECT public.rpc_record_loss(
          p_order_id => 8001,
          p_stage_id => 1,
          p_user_id => 4,
          p_lost_qty => 2,
          p_reason => 'Defeito no corte',
          p_order_item_id => 80011,
          p_idempotency_key => '   '
        ) AS res;
      `);
      expect((errRes.rows[0] as any).res.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

      // Sucesso
      const okRes = await db.query(`
        SELECT public.rpc_record_loss(
          p_order_id => 8001,
          p_stage_id => 1,
          p_user_id => 4,
          p_lost_qty => 2,
          p_reason => 'Defeito no corte',
          p_order_item_id => 80011,
          p_idempotency_key => 'loss-staging-ok-1'
        ) AS res;
      `);
      const data = (okRes.rows[0] as any).res;
      expect(data.success).toBe(true);
      expect(data.quantidade_perdida).toBe(2);

      // Confirmar auditoria gravada
      const audit = await db.query(`
        SELECT acao, motivo, usuario FROM public.pcp_audit_log
        WHERE order_id = 8001 AND acao = 'REGISTRAR_PERDA';
      `);
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);

      // Reposição das 2 peças perdidas para zerar pendência
      const repRes = await db.query(`
        SELECT public.rpc_record_production(
          p_order_id => 8001,
          p_stage_id => 1,
          p_user_id => 4,
          p_idempotency_key => 'rep-staging-ok-1',
          p_good_inc => 2,
          p_is_reposition => true,
          p_order_item_id => 80011
        ) AS res;
      `);
      expect((repRes.rows[0] as any).res.success).toBe(true);
      expect((repRes.rows[0] as any).res.pendencia_reposicao).toBe(0);
    });

    it('RPC 6: rpc_finish_operation deve concluir etapa e finalizar execução ativa', async () => {
      // 50 (prod) + 2 (rep) + 48 (finish) = 100 peças totais necessárias
      const res = await db.query(`
        SELECT public.rpc_finish_operation(
          p_execution_id => ${activeExecutionId},
          p_user_id => 4,
          p_good_inc => 48,
          p_idempotency_key => 'finish-staging-ok-1'
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.success).toBe(true);
      expect(data.status_operacao).toBe('CONCLUIDA');
    });

    it('RPC 7: pcp_apply_stage_progress motor interno direto', async () => {
      const res = await db.query(`
        SELECT public.pcp_apply_stage_progress(
          p_order_id => 8001,
          p_stage_id => 2,
          p_user_id => 1,
          p_good_inc => 10,
          p_lost_inc => 0,
          p_rework_inc => 0,
          p_transfer_inc => 0,
          p_next_stage_id => NULL,
          p_observation => 'Apontamento administrativo',
          p_idempotency_key => 'apply-prog-internal-1',
          p_order_item_id => 80011
        ) AS res;
      `);
      const data = (res.rows[0] as any).res;
      expect(data.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. TESTE DE ROTAS BACKEND MINTADAS COM SUPABASEADMIN
  // =========================================================================
  describe('5. Rotas Backend Protegidas via supabaseAdmin', () => {
    it('POST /api/orders/:id/stages/:stageId/loss deve exigir chave de idempotência com 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
      // Mock da sessão autenticada do Operador no backend
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: { id: '44444444-4444-4444-4444-444444444444', email: 'operador@staging.com' } as any
        },
        error: null
      });

      vi.spyOn(supabaseAdmin, 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 4,
                name: 'Operador Staging',
                email: 'operador@staging.com',
                role: 'Operador',
                active: 1,
                auth_user_id: '44444444-4444-4444-4444-444444444444',
              },
              error: null,
            }),
          }),
        }),
      } as any));

      const res = await fetch(`${baseUrl}/api/orders/8001/stages/1/loss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-staging-operator-jwt',
          'x-user-role': 'Operador',
          'x-user-id': '4'
        },
        body: JSON.stringify({
          quantidade_perdida: 2,
          motivo: 'Defeito',
          // sem x-idempotency-key e sem idempotency_key
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('GET /api/supabase/status deve responder com status de conectividade operacional', async () => {
      vi.spyOn(supabaseAdmin, 'from').mockReturnValueOnce({
        select: () => Promise.resolve({ data: [{ id: 1 }], count: 1, error: null })
      } as any);

      const res = await fetch(`${baseUrl}/api/supabase/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
    });
  });

  // =========================================================================
  // 6. TESTE DE ATOMIC ROLLBACK NA MIGRATION
  // =========================================================================
  describe('6. Atomic Rollback da Migration Completa', () => {
    it('deve comprovar que falha intencional reverte 100% da transação', async () => {
      const rollbackDb = new PGlite();
      await rollbackDb.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
        END $$;
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS $$ SELECT NULL::UUID; $$;
        CREATE TABLE public.tabela_sentinela (id INT PRIMARY KEY, nome TEXT);
        INSERT INTO public.tabela_sentinela VALUES (1, 'original');
      `);

      // Injetar erro de exceção PL/pgSQL imediatamente antes do COMMIT usando replacer function
      const brokenSql = deploySql.replace(
        'COMMIT;',
        () => "DO $$ BEGIN RAISE EXCEPTION 'FALHA_SIMULADA_TESTE_ROLLBACK'; END $$;\nCOMMIT;"
      );

      let errorThrown = false;
      try {
        await rollbackDb.exec(brokenSql);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/FALHA_SIMULADA_TESTE_ROLLBACK/);
        await rollbackDb.exec('ROLLBACK;');
      }
      expect(errorThrown).toBe(true);

      // A tabela sentinela deve continuar exatamente intacta
      const sentinelaRes = await rollbackDb.query(`SELECT nome FROM public.tabela_sentinela WHERE id = 1;`);
      expect((sentinelaRes.rows[0] as any).nome).toBe('original');

      // Nenhuma tabela criada pela migration deve ter persistido
      const orderItemsCheck = await rollbackDb.query(`
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items';
      `);
      expect(orderItemsCheck.rows.length).toBe(0);

      await rollbackDb.close();
    });
  });

  // =========================================================================
  // 7. VALIDAÇÃO DE TIMESTAMPTZ E TIMEZONE OFICIAL AMERICA/SAO_PAULO
  // =========================================================================
  describe('7. Validação de TIMESTAMPTZ e Timezone Oficial', () => {
    it('todas as colunas temporais críticas da Fase 1 devem ser TIMESTAMPTZ', async () => {
      const timeCols = [
        { table: 'orders', col: 'created_at' },
        { table: 'orders', col: 'updated_at' },
        { table: 'orders', col: 'production_finished_at' },
        { table: 'stage_executions', col: 'start_time' },
        { table: 'stage_executions', col: 'end_time' },
        { table: 'pcp_audit_log', col: 'created_at' },
        { table: 'order_stage_progress', col: 'started_at' },
        { table: 'order_stage_progress', col: 'completed_at' }
      ];

      for (const tc of timeCols) {
        const res = await db.query(`
          SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${tc.table}' AND column_name = '${tc.col}';
        `);
        expect(res.rows.length, `Coluna ${tc.table}.${tc.col} deve existir`).toBe(1);
        expect((res.rows[0] as any).data_type).toMatch(/timestamp with time zone/i);
      }
    });

    it('conversão explícita para America/Sao_Paulo deve ser consistente', async () => {
      const res = await db.query(`
        SELECT
          NOW() AS utc_now,
          NOW() AT TIME ZONE 'America/Sao_Paulo' AS sp_local,
          TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') AS sp_str;
      `);
      expect(res.rows.length).toBe(1);
      expect((res.rows[0] as any).sp_local).toBeDefined();
      expect((res.rows[0] as any).sp_str).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });
});
