import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { writeAuditLogStore } from '../api/index';

/**
 * AUDITORIA V8 — ITEM 1: TESTE DOS PAYLOADS REAIS DO BACKEND CONTRA PCP_AUDIT_LOG
 * 
 * Valida que nenhuma coluna inexistente (plano_id, op_id, produto, sku, qty_calculada, qty_aprovada)
 * é enviada como coluna direta e que todos os 6 payloads de rotas PCP são gravados com sucesso
 * através de writeAuditLogStore no schema canônico criado pela migration da Fase 1.
 */
describe('Auditoria V8 — Item 1: Payloads Reais do Backend contra pcp_audit_log', () => {
  let db: PGlite;

  // Adaptador simples para simular o cliente Supabase compatível com writeAuditLogStore
  const makeDbClient = (pg: PGlite) => ({
    from: (table: string) => ({
      insert: (payload: any) => ({
        select: async () => {
          const keys = Object.keys(payload);
          const cols = keys.map((k) => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map((k) => {
            const v = payload[k];
            if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
              return JSON.stringify(v);
            }
            return v;
          });
          const sql = `INSERT INTO public."${table}" (${cols}) VALUES (${placeholders}) RETURNING *;`;
          try {
            const res = await pg.query(sql, values);
            return { data: res.rows, error: null };
          } catch (err: any) {
            return { data: null, error: err };
          }
        },
      }),
    }),
  });

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
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT, active INT DEFAULT 1);
      INSERT INTO public.stages (id, name, active) VALUES (1, 'Corte', 1);

      CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT, active INT DEFAULT 1);
      INSERT INTO public.users (name, email, role, active) VALUES ('Admin', 'admin@empresa.com', 'Administrador', 1);

      CREATE TABLE public.orders (id BIGSERIAL PRIMARY KEY, order_number TEXT, quantity INT DEFAULT 1, status TEXT DEFAULT 'Entrada');
      INSERT INTO public.orders (id, order_number, quantity, status) VALUES (101, 'PED-101', 10, 'Entrada');
      CREATE TABLE public.order_stage_progress (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT);
      CREATE TABLE public.stage_executions (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, status TEXT, start_time TIMESTAMPTZ);
      CREATE TABLE public.pauses (id BIGSERIAL PRIMARY KEY, execution_id BIGINT, start_pause TIMESTAMPTZ);
      CREATE TABLE public.order_progress_logs (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT);
      CREATE TABLE public.order_loss_logs (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, quantidade_perdida INT, motivo TEXT, etapa_reentrada_id BIGINT, created_at TIMESTAMPTZ);
      CREATE TABLE public.pcp_settings (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.pcp_blocks (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.pcp_audit_log (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.pcp_producao_necessidades (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.order_history (id BIGSERIAL PRIMARY KEY);
    `);

    const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
    await db.exec(deploySql);
  });

  afterAll(async () => {
    await db.close();
  });

  it('1. Deve gravar com sucesso o payload de NECESSIDADES_RECALCULADAS via writeAuditLogStore', async () => {
    const client = makeDbClient(db);
    const result = await writeAuditLogStore(client, {
      entidade: 'producao_necessidades',
      acao: 'NECESSIDADES_RECALCULADAS',
      usuario: 'pcp.analista@empresa.com',
      quantidade: 24,
      valor_novo: {
        total_pedidos: 12,
        estoque_via_tiny: 8,
        token_disponivel: true,
      },
      detalhes: {
        total_pedidos: 12,
        estoque_via_tiny: 8,
        token_disponivel: true,
        consultado_em: new Date().toISOString(),
      },
      origem: 'API',
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const check = await db.query(`
      SELECT entidade, acao, usuario, quantidade, detalhes, valor_novo, valor_anterior, valor_antigo
      FROM public.pcp_audit_log
      WHERE acao = 'NECESSIDADES_RECALCULADAS'
      ORDER BY id DESC LIMIT 1;
    `);
    expect(check.rows.length).toBe(1);
    const row = check.rows[0] as any;
    expect(row.entidade).toBe('producao_necessidades');
    expect(row.usuario).toBe('pcp.analista@empresa.com');
    expect(Number(row.quantidade)).toBe(24);
    const det = typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes;
    expect(det.total_pedidos).toBe(12);
  });

  it('2. Deve gravar com sucesso o payload de PLANO_CRIADO com mapeamento para quantidade e detalhes', async () => {
    const client = makeDbClient(db);
    const result = await writeAuditLogStore(client, {
      entidade: 'planos_de_corte',
      acao: 'PLANO_CRIADO',
      usuario: 'pcp.planejador@empresa.com',
      quantidade: 120,
      valor_novo: {
        status: 'CRIADO',
        plano_id: 55,
        plano_numero: 'PC-2026-0055',
        fabric: 'Malha PV',
        color: 'Marinho',
        qty_planejada: 120,
      },
      detalhes: {
        plano_id: 55,
        plano_numero: 'PC-2026-0055',
        fabric: 'Malha PV',
        color: 'Marinho',
      },
      origem: 'API',
    });

    expect(result.success).toBe(true);
    const check = await db.query(`
      SELECT acao, quantidade, detalhes, valor_novo
      FROM public.pcp_audit_log
      WHERE acao = 'PLANO_CRIADO'
      ORDER BY id DESC LIMIT 1;
    `);
    expect(check.rows.length).toBe(1);
    const row = check.rows[0] as any;
    expect(Number(row.quantidade)).toBe(120);
    const det = typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes;
    expect(det.plano_id).toBe(55);
    expect(det.plano_numero).toBe('PC-2026-0055');
  });

  it('3. Deve gravar com sucesso o payload de PLANO_APROVADO com valor_anterior e valor_novo', async () => {
    const client = makeDbClient(db);
    const result = await writeAuditLogStore(client, {
      entidade: 'planos_de_corte',
      acao: 'PLANO_APROVADO',
      usuario: 'supervisor.producao@empresa.com',
      quantidade: 120,
      valor_anterior: { status: 'CRIADO' },
      valor_novo: { status: 'PLANO_APROVADO', plano_id: 55, qty_aprovada: 120 },
      detalhes: { plano_id: 55, idempotency_key: 'idemp-plano-55-aprov' },
      origem: 'API',
    });

    expect(result.success).toBe(true);
    const check = await db.query(`
      SELECT acao, quantidade, valor_anterior, valor_antigo, valor_novo, detalhes
      FROM public.pcp_audit_log
      WHERE acao = 'PLANO_APROVADO'
      ORDER BY id DESC LIMIT 1;
    `);
    expect(check.rows.length).toBe(1);
    const row = check.rows[0] as any;
    expect(Number(row.quantidade)).toBe(120);
    const vAnt = typeof row.valor_anterior === 'string' ? JSON.parse(row.valor_anterior) : row.valor_anterior;
    expect(vAnt.status).toBe('CRIADO');
    // Verifica simetria com valor_antigo
    const vOld = typeof row.valor_antigo === 'string' ? JSON.parse(row.valor_antigo) : row.valor_antigo;
    expect(vOld.status).toBe('CRIADO');
    const det = typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes;
    expect(det.idempotency_key).toBe('idemp-plano-55-aprov');
  });

  it('4. Deve gravar com sucesso o payload de OP_GERADA_TINY com metadados de OP', async () => {
    const client = makeDbClient(db);
    const result = await writeAuditLogStore(client, {
      entidade: 'ordens_de_producao',
      acao: 'OP_GERADA_TINY',
      usuario: 'pcp.operador@empresa.com',
      quantidade: 80,
      valor_novo: { op_id: 201, status: 'GERADA', tiny_op_id: 'TINY-9988' },
      detalhes: {
        plano_id: 55,
        op_id: 201,
        produto: 'Camiseta Básica',
        sku: 'CAM-BAS-MAR-G',
        tiny_attempted: true,
        tiny_op_id: 'TINY-9988',
        status: 'GERADA',
      },
      origem: 'API',
    });

    expect(result.success).toBe(true);
    const check = await db.query(`
      SELECT acao, quantidade, detalhes
      FROM public.pcp_audit_log
      WHERE acao = 'OP_GERADA_TINY'
      ORDER BY id DESC LIMIT 1;
    `);
    expect(check.rows.length).toBe(1);
    const row = check.rows[0] as any;
    expect(Number(row.quantidade)).toBe(80);
    const det = typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes;
    expect(det.sku).toBe('CAM-BAS-MAR-G');
    expect(det.tiny_op_id).toBe('TINY-9988');
  });

  it('5. Deve gravar com sucesso o payload de OP_REGISTRADA_MANUAL', async () => {
    const client = makeDbClient(db);
    const result = await writeAuditLogStore(client, {
      entidade: 'ordens_de_producao',
      acao: 'OP_REGISTRADA_MANUAL',
      usuario: 'pcp.operador@empresa.com',
      quantidade: 35,
      valor_novo: { op_id: 202, status: 'MANUAL', tiny_op_id: null },
      detalhes: {
        plano_id: null,
        op_id: 202,
        produto: 'Calça Cargo',
        sku: 'CALC-CAR-PR-M',
        tiny_attempted: false,
        tiny_op_id: null,
        status: 'MANUAL',
      },
      origem: 'API',
    });

    expect(result.success).toBe(true);
    const check = await db.query(`
      SELECT acao, quantidade, detalhes
      FROM public.pcp_audit_log
      WHERE acao = 'OP_REGISTRADA_MANUAL'
      ORDER BY id DESC LIMIT 1;
    `);
    expect(check.rows.length).toBe(1);
    const row = check.rows[0] as any;
    expect(Number(row.quantidade)).toBe(35);
    const det = typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes;
    expect(det.sku).toBe('CALC-CAR-PR-M');
    expect(det.tiny_op_id).toBeNull();
  });

  it('6. Deve gravar com sucesso o payload de OP_NUMERO_TINY_REGISTRADO', async () => {
    const client = makeDbClient(db);
    const result = await writeAuditLogStore(client, {
      entidade: 'ordens_de_producao',
      acao: 'OP_NUMERO_TINY_REGISTRADO',
      usuario: 'supervisor.producao@empresa.com',
      valor_novo: {
        op_id: 202,
        tiny_op_numero: 'TINY-OP-7788',
        tiny_op_id: 'TINY-OP-7788',
        status: 'ABERTA',
      },
      detalhes: {
        op_id: 202,
        tiny_op_numero: 'TINY-OP-7788',
        tiny_op_id: 'TINY-OP-7788',
      },
      origem: 'API',
    });

    expect(result.success).toBe(true);
    const check = await db.query(`
      SELECT acao, detalhes, valor_novo
      FROM public.pcp_audit_log
      WHERE acao = 'OP_NUMERO_TINY_REGISTRADO'
      ORDER BY id DESC LIMIT 1;
    `);
    expect(check.rows.length).toBe(1);
    const row = check.rows[0] as any;
    const det = typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes;
    expect(det.op_id).toBe(202);
    expect(det.tiny_op_numero).toBe('TINY-OP-7788');
  });
});
