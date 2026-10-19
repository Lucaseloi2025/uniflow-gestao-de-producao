import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { logOrderHistory, writeAuditLogStore, recordPcpAuditLog } from '../api/index';

describe('Auditoria V7 — Itens 2 e 3: Padronização Canônica de order_history e pcp_audit_log', () => {
  let db: PGlite;

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

      CREATE TABLE public.stages (id BIGINT PRIMARY KEY, name TEXT);
      CREATE TABLE public.users (id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT, active INT DEFAULT 1);
      INSERT INTO public.users (name, email, role, active) VALUES ('Admin Teste', 'admin@teste.com', 'Administrador', 1);
      CREATE TABLE public.orders (id BIGSERIAL PRIMARY KEY, order_number TEXT, client_name TEXT, quantity INT DEFAULT 1, status TEXT DEFAULT 'Entrada');
      CREATE TABLE public.order_stage_progress (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT);
      CREATE TABLE public.stage_executions (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, status TEXT, start_time TIMESTAMPTZ);
      CREATE TABLE public.pauses (id BIGSERIAL PRIMARY KEY, execution_id BIGINT, start_pause TIMESTAMPTZ);
      CREATE TABLE public.order_progress_logs (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT);
      CREATE TABLE public.order_loss_logs (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, quantidade_perdida INT, motivo TEXT, etapa_reentrada_id BIGINT, created_at TIMESTAMPTZ);
      CREATE TABLE public.pcp_settings (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.pcp_blocks (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.pcp_audit_log (id BIGSERIAL PRIMARY KEY, order_id BIGINT, stage_id BIGINT, user_id BIGINT, acao TEXT, created_at TIMESTAMPTZ);
      CREATE TABLE public.pcp_producao_necessidades (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE public.order_history (id BIGSERIAL PRIMARY KEY);
    `);

    const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
    await db.exec(deploySql);

    // Inserir um pedido de teste para os testes de auditoria
    await db.exec(`
      INSERT INTO public.orders (id, order_number, client_name, quantity, status)
      VALUES (101, 'PED-101', 'Cliente Auditoria', 50, 'Entrada')
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  // Adapter simulando cliente Supabase sobre PGlite
  function makeSupabaseAdapter(pgInstance: PGlite) {
    return {
      from(table: string) {
        return {
          insert(payload: any) {
            return {
              async select() {
                const keys = Object.keys(payload);
                const cols = keys.map(k => `"${k}"`).join(', ');
                const vals = keys.map((_, i) => `$${i + 1}`).join(', ');
                const params = keys.map(k => {
                  const v = payload[k];
                  if (v !== null && typeof v === 'object') return JSON.stringify(v);
                  return v;
                });
                try {
                  const sql = `INSERT INTO public."${table}" (${cols}) VALUES (${vals}) RETURNING *;`;
                  const res = await pgInstance.query(sql, params);
                  return { data: res.rows, error: null };
                } catch (err: any) {
                  return { data: null, error: err };
                }
              }
            };
          }
        };
      }
    };
  }

  describe('Item 2: Padronização e Validação Real de order_history', () => {
    it('deve inserir com sucesso e persistir todos os campos canônicos e legados em order_history', async () => {
      const adapter = makeSupabaseAdapter(db);
      const res = await logOrderHistory(adapter, {
        order_id: 101,
        usuario: 'Administrador Teste',
        acao: 'editou',
        antes: { status: 'Entrada', quantity: 50 },
        depois: { status: 'Em Produção', quantity: 60 },
        detalhes: 'Edição de quantidade pelo administrador',
      });

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();

      // Verificar persistência no banco relacional
      const dbCheck = await db.query(`
        SELECT order_id, usuario, acao, antes, depois, detalhes, action, details, created_at
        FROM public.order_history
        WHERE order_id = 101 AND acao = 'editou'
        ORDER BY id DESC LIMIT 1;
      `);
      expect(dbCheck.rows.length).toBe(1);
      const row: any = dbCheck.rows[0];
      expect(Number(row.order_id)).toBe(101);
      expect(row.usuario).toBe('Administrador Teste');
      expect(row.acao).toBe('editou');
      expect(row.action).toBe('editou');
      expect(row.detalhes).toBe('Edição de quantidade pelo administrador');
      expect(row.created_at).toBeTruthy();
    });

    it('deve persistir exatamente todos os payloads utilizados pelas rotas do api/index.ts', async () => {
      const adapter = makeSupabaseAdapter(db);

      // Payload 1: Importação Olist
      const p1 = await logOrderHistory(adapter, {
        order_id: 101,
        usuario: 'Olist Integrator (Auto)',
        acao: 'importou_olist',
        antes: null,
        depois: { olist_id: 998877, status: 'Rascunho', items: [{ id: 1, name: 'Item Teste' }] },
        detalhes: 'Importação automática via Olist',
      });
      expect(p1.success).toBe(true);

      // Payload 2: Reprocessamento de normalização
      const p2 = await logOrderHistory(adapter, {
        order_id: 101,
        acao: 'reprocessou_normalizacao',
        detalhes: 'Reprocessamento automático da normalização de modelos, tecidos, cores e tamanhos',
        usuario: 'Sistema (Reprocessamento Olist)',
        antes: { items: [{ raw: 'Camisa P' }] },
        depois: { items: [{ normalized: 'Camiseta P Azul' }] },
      });
      expect(p2.success).toBe(true);

      // Payload 3: Confirmação de rascunho
      const p3 = await logOrderHistory(adapter, {
        order_id: 101,
        usuario: 'Admin Comercial',
        acao: 'confirmou_rascunho',
        antes: { status: 'Rascunho' },
        depois: { status: 'Entrada' },
        detalhes: 'Confirmação de rascunho de pedido',
      });
      expect(p3.success).toBe(true);

      // Payload 4: Exclusão lógica (soft delete)
      const p4 = await logOrderHistory(adapter, {
        order_id: 101,
        usuario: 'Diretor',
        acao: 'excluiu',
        antes: { id: 101, status: 'Entrada' },
        depois: null,
        detalhes: 'Exclusão lógica do pedido',
      });
      expect(p4.success).toBe(true);

      // Payload 5: Edição DTF
      const p5 = await logOrderHistory(adapter, {
        order_id: 101,
        usuario: 'Operador Estamparia',
        acao: 'editou',
        antes: { dtf_complete: false, dtf_location: 'Gaveta A' },
        depois: { dtf_complete: true, dtf_location: 'Gaveta B' },
        detalhes: 'Edição de status/localização DTF',
      });
      expect(p5.success).toBe(true);

      // Payload 6: Cancelamento
      const p6 = await logOrderHistory(adapter, {
        order_id: 101,
        usuario: 'Gerente PCP',
        acao: 'cancelou',
        antes: { status: 'Em Produção' },
        depois: { status: 'Cancelado', cancelled_at: new Date().toISOString(), cancelled_by: 'Gerente PCP' },
        detalhes: 'Cancelamento do pedido',
      });
      expect(p6.success).toBe(true);

      // Validar que todas as 6 ações foram gravadas com sucesso
      const allHist = await db.query(`
        SELECT count(*) as total FROM public.order_history WHERE order_id = 101;
      `);
      expect(Number((allHist.rows[0] as any).total)).toBeGreaterThanOrEqual(7);
    });

    it('não deve ignorar silenciosamente erro de inserção em order_history', async () => {
      // Simular erro passando tabela/coluna inválida
      const failingAdapter = {
        from() {
          return {
            insert() {
              return {
                async select() {
                  return { data: null, error: new Error('Simulated DB connection failure') };
                }
              };
            }
          };
        }
      };

      const res = await logOrderHistory(failingAdapter, {
        order_id: 101,
        usuario: 'Admin',
        acao: 'teste_erro',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('Item 3: Padronização e Validação Real de pcp_audit_log', () => {
    it('deve chamar writeAuditLogStore com payload real e confirmar persistência com valor_anterior canônico e todas as colunas', async () => {
      const adapter = makeSupabaseAdapter(db);

      const res = await writeAuditLogStore(adapter, {
        entidade: 'orders',
        order_id: 101,
        stage_id: 1,
        user_id: 1,
        usuario: 'Supervisor Produção',
        acao: 'APONTAMENTO_PARCIAL',
        quantidade: 15,
        motivo: 'Apontamento do turno matutino',
        observacao: 'Produção normal sem intercorrências',
        valor_anterior: { quantidade_boa: 10, quantidade_perdida: 0 },
        valor_novo: { quantidade_boa: 25, quantidade_perdida: 0, status_operacao: 'EM_ANDAMENTO' },
        detalhes: { turno: 'Manhã', maquina: 'M01' },
        origem: 'WEB',
      });

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();

      // Validar no banco se todas as colunas canônicas foram persistidas
      const auditCheck = await db.query(`
        SELECT entidade, order_id, stage_id, user_id, usuario, acao, quantidade, motivo,
               observacao, valor_anterior, valor_antigo, valor_novo, detalhes, origem, created_at
        FROM public.pcp_audit_log
        WHERE order_id = 101 AND acao = 'APONTAMENTO_PARCIAL'
        ORDER BY id DESC LIMIT 1;
      `);
      expect(auditCheck.rows.length).toBe(1);
      const row: any = auditCheck.rows[0];

      expect(row.entidade).toBe('orders');
      expect(Number(row.order_id)).toBe(101);
      expect(Number(row.stage_id)).toBe(1);
      expect(Number(row.user_id)).toBe(1);
      expect(row.usuario).toBe('Supervisor Produção');
      expect(row.acao).toBe('APONTAMENTO_PARCIAL');
      expect(Number(row.quantidade)).toBe(15);
      expect(row.motivo).toBe('Apontamento do turno matutino');
      expect(row.observacao).toBe('Produção normal sem intercorrências');
      expect(row.origem).toBe('WEB');
      expect(row.created_at).toBeTruthy();

      // Validar que tanto valor_anterior (canônico) quanto valor_antigo (compat) contêm o dado
      const valAnt = typeof row.valor_anterior === 'string' ? JSON.parse(row.valor_anterior) : row.valor_anterior;
      expect(valAnt.quantidade_boa).toBe(10);

      const valAntigo = typeof row.valor_antigo === 'string' ? JSON.parse(row.valor_antigo) : row.valor_antigo;
      expect(valAntigo.quantidade_boa).toBe(10);
    });

    it('recordPcpAuditLog deve ser um alias idêntico para writeAuditLogStore', () => {
      expect(recordPcpAuditLog).toBe(writeAuditLogStore);
    });

    it('não deve ignorar erro silenciosamente ao falhar inserção em pcp_audit_log', async () => {
      const failingAdapter = {
        from(table: string) {
          return {
            insert() {
              return {
                async select() {
                  return { data: null, error: new Error(`DB Error on ${table}`) };
                }
              };
            }
          };
        }
      };

      const res = await writeAuditLogStore(failingAdapter, {
        order_id: 101,
        usuario: 'Operador',
        acao: 'TESTE_FALHA',
        valor_anterior: { qtd: 0 },
        valor_novo: { qtd: 5 },
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
