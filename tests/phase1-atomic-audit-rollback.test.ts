import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Auditoria V9 — Item 4: Transacionalidade Atômica entre Negócio e Auditoria (Atomic Rollback)', () => {
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
    `);

    const deploySql = fs.readFileSync(path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql'), 'utf8');
    await db.exec(deploySql);

    // Inserir registros base para testes
    await db.exec(`
      INSERT INTO public.users (id, name, email, role, active, allow_parallel_sessions)
      VALUES 
        (1, 'Admin Teste', 'admin@teste.com', 'Administrador', 1, true),
        (20, 'Operador Teste 20', 'op20.atomic@teste.com', 'Operador', 1, true),
        (21, 'Supervisor Teste 21', 'sup21.atomic@teste.com', 'Supervisor', 1, true),
        (22, 'Operador Teste 22', 'op22.atomic@teste.com', 'Operador', 1, true),
        (23, 'Operador Teste 23', 'op23.atomic@teste.com', 'Operador', 1, true),
        (24, 'Operador Teste 24', 'op24.atomic@teste.com', 'Operador', 1, true),
        (25, 'Operador Teste 25', 'op25.atomic@teste.com', 'Operador', 1, true)
      ON CONFLICT (id) DO UPDATE SET allow_parallel_sessions = true;

      INSERT INTO public.stages (id, name, calculation_type, active, sort_order)
      VALUES 
        (1, 'Corte', 'por_peca', 1, 1),
        (10, 'Etapa Operacional Teste', 'por_peca', 1, 1)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.orders (id, order_number, client_name, quantity, status, required_stages)
      VALUES 
        (500, 'PED-500', 'Cliente Atomic Test', 100, 'Entrada', '[10]'::jsonb),
        (601, 'PED-601', 'Cliente Atomic Ops 1', 50, 'Entrada', '[10]'::jsonb),
        (602, 'PED-602', 'Cliente Atomic Ops 2', 50, 'Entrada', '[10]'::jsonb),
        (603, 'PED-603', 'Cliente Atomic Ops 3', 50, 'Entrada', '[10]'::jsonb),
        (604, 'PED-604', 'Cliente Atomic Ops 4', 50, 'Entrada', '[10]'::jsonb),
        (605, 'PED-605', 'Cliente Atomic Ops 5', 50, 'Entrada', '[10]'::jsonb),
        (606, 'PED-606', 'Cliente Atomic Ops 6', 50, 'Entrada', '[10]'::jsonb),
        (701, 'PED-701', 'Cliente Cutting Test 1', 20, 'Entrada', '[1]'::jsonb),
        (702, 'PED-702', 'Cliente Cutting Test 2', 30, 'Entrada', '[1]'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      UPDATE public.orders
      SET 
        items = '[{"item_key":"CAM-AZUL-M","product_type":"Camiseta","color":"Azul","size":"M","qty_corte_allocated":0}]'::jsonb,
        stages_status = '[{"id":1,"name":"Corte","finished":false,"quantidade_pedido":20,"quantidade_boa":0,"quantidade_perdida":0}]'::jsonb
      WHERE id = 701;

      UPDATE public.orders
      SET 
        items = '[{"item_key":"CAM-AZUL-M","product_type":"Camiseta","color":"Azul","size":"M","qty_corte_allocated":0}]'::jsonb,
        stages_status = '[{"id":1,"name":"Corte","finished":false,"quantidade_pedido":30,"quantidade_boa":0,"quantidade_perdida":0}]'::jsonb
      WHERE id = 702;
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it('1. pcp_tx_recalcular_necessidades: sucesso confirma necessidades e auditoria; falha na auditoria reverte 100%', async () => {
    // 1.1 Sucesso
    const payload = JSON.stringify([
      {
        order_id: 500,
        order_number: 'PED-500',
        sku: 'SKU-ATOMIC-01',
        product_type: 'Camiseta',
        fabric: 'Meia Malha',
        color: 'Preto',
        size: 'M',
        qty_pedida: 10,
        qty_necessaria: 10,
        status: 'NECESSITA_NOVO_CORTE'
      }
    ]);

    const resSuccess = await db.query(`
      SELECT public.pcp_tx_recalcular_necessidades(
        $1::jsonb,
        'Admin Atomic',
        '{"total_pedidos": 1}'::jsonb
      ) AS result;
    `, [payload]);

    const rawResult = (resSuccess.rows[0] as any).result;
    const parsedSuccess = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
    expect(parsedSuccess.success).toBe(true);
    expect(parsedSuccess.total_recalculadas).toBe(1);

    // Verificar persistência
    const checkNec = await db.query(`SELECT COUNT(*) as count FROM public.producao_necessidades WHERE sku = 'SKU-ATOMIC-01';`);
    expect(Number(checkNec.rows[0].count)).toBe(1);

    const checkAudit = await db.query(`SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE acao = 'NECESSIDADES_RECALCULADAS';`);
    expect(Number(checkAudit.rows[0].count)).toBe(1);

    // 1.2 Instalar trigger de falha intencional na auditoria
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_nec()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'NECESSIDADES_RECALCULADAS' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE: Falha intencional na gravação da auditoria';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_nec
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_nec();
    `);

    // 1.3 Tentativa com novo SKU que DEVE sofrer rollback
    const payloadRollback = JSON.stringify([
      {
        order_id: 500,
        order_number: 'PED-500',
        sku: 'SKU-FAIL-ROLLBACK',
        product_type: 'Camiseta',
        size: 'G',
        qty_pedida: 20,
        qty_necessaria: 20,
        status: 'NECESSITA_NOVO_CORTE'
      }
    ]);

    let threwError = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_recalcular_necessidades(
          $1::jsonb,
          'Admin Atomic',
          '{"total_pedidos": 1}'::jsonb
        );
      `, [payloadRollback]);
    } catch (err: any) {
      threwError = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE');
    }
    expect(threwError).toBe(true);

    // 1.4 COMPROVAÇÃO DE ROLLBACK: O SKU novo NÃO pode existir no banco!
    const checkRollback = await db.query(`SELECT COUNT(*) as count FROM public.producao_necessidades WHERE sku = 'SKU-FAIL-ROLLBACK';`);
    expect(Number(checkRollback.rows[0].count)).toBe(0);

    // Remover trigger de teste
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_nec ON public.pcp_audit_log;`);
  });

  it('2. pcp_tx_criar_plano_corte: sucesso grava plano + vinculo + auditoria; falha na auditoria desfaz criação e vinculo', async () => {
    // 2.1 Criar necessidade para vínculo
    const necRes = await db.query(`
      INSERT INTO public.producao_necessidades (order_id, sku, product_type, qty_pedida, qty_necessaria, status)
      VALUES (500, 'SKU-PLANO-TEST', 'Polo', 15, 15, 'NECESSITA_NOVO_CORTE')
      RETURNING id;
    `);
    const necId = Number(necRes.rows[0].id);

    // 2.2 Sucesso na criação do plano
    const planoPayload = JSON.stringify({
      plano_numero: 'PC-2026-OK',
      fabric: 'Piquet',
      color: 'Marinho',
      qty_planejada: 15,
      pedidos_ids: [500]
    });

    const resOk = await db.query(`
      SELECT public.pcp_tx_criar_plano_corte(
        $1::jsonb,
        ARRAY[$2]::bigint[],
        'Admin Plano',
        '{"detalhe": "ok"}'::jsonb
      ) AS result;
    `, [planoPayload, necId]);

    const rawPlano = (resOk.rows[0] as any).result;
    const createdPlano = typeof rawPlano === 'string' ? JSON.parse(rawPlano) : rawPlano;
    expect(createdPlano.plano_numero).toBe('PC-2026-OK');

    // Verificar que necessidade foi atualizada para INCLUIDO_EM_PLANO
    const necUpdated = await db.query(`SELECT status, plano_corte_id FROM public.producao_necessidades WHERE id = $1;`, [necId]);
    expect(necUpdated.rows[0].status).toBe('INCLUIDO_EM_PLANO');
    expect(Number(necUpdated.rows[0].plano_corte_id)).toBe(Number(createdPlano.id));

    // 2.3 Instalar trigger de falha intencional para PLANO_CRIADO
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_plano()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'PLANO_CRIADO' AND (NEW.detalhes->>'plano_numero') = 'PC-2026-FAIL' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_PLANO: Falha proposital na auditoria do plano';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_plano
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_plano();
    `);

    // Criar outra necessidade que não deve ter seu status alterado
    const necFailRes = await db.query(`
      INSERT INTO public.producao_necessidades (order_id, sku, product_type, qty_pedida, qty_necessaria, status)
      VALUES (500, 'SKU-PLANO-FAIL', 'Polo', 30, 30, 'NECESSITA_NOVO_CORTE')
      RETURNING id;
    `);
    const necFailId = Number(necFailRes.rows[0].id);

    const failPlanoPayload = JSON.stringify({
      plano_numero: 'PC-2026-FAIL',
      fabric: 'Piquet',
      color: 'Branco',
      qty_planejada: 30,
      pedidos_ids: [500]
    });

    let threwError = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_criar_plano_corte(
          $1::jsonb,
          ARRAY[$2]::bigint[],
          'Admin Plano',
          '{"plano_numero": "PC-2026-FAIL"}'::jsonb
        );
      `, [failPlanoPayload, necFailId]);
    } catch (err: any) {
      threwError = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_PLANO');
    }
    expect(threwError).toBe(true);

    // 2.4 COMPROVAÇÃO DE ROLLBACK: Plano PC-2026-FAIL NÃO existe e necessidade continua NECESSITA_NOVO_CORTE
    const checkPlanoFail = await db.query(`SELECT COUNT(*) as count FROM public.planos_de_corte WHERE plano_numero = 'PC-2026-FAIL';`);
    expect(Number(checkPlanoFail.rows[0].count)).toBe(0);

    const checkNecFail = await db.query(`SELECT status, plano_corte_id FROM public.producao_necessidades WHERE id = $1;`, [necFailId]);
    expect(checkNecFail.rows[0].status).toBe('NECESSITA_NOVO_CORTE');
    expect(checkNecFail.rows[0].plano_corte_id).toBeNull();

    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_plano ON public.pcp_audit_log;`);
  });

  it('3. pcp_tx_aprovar_plano_corte: sucesso aprova plano + necessidades + auditoria; falha na auditoria reverte status', async () => {
    // 3.1 Criar necessidade e plano em RASCUNHO
    const necRes = await db.query(`
      INSERT INTO public.producao_necessidades (order_id, sku, product_type, qty_pedida, qty_necessaria, status)
      VALUES (500, 'SKU-APROVACAO', 'Brim', 40, 40, 'INCLUIDO_EM_PLANO')
      RETURNING id;
    `);
    const necId = Number(necRes.rows[0].id);

    const planoRes = await db.query(`
      INSERT INTO public.planos_de_corte (plano_numero, status, fabric, color, qty_planejada, necessidades_ids)
      VALUES ('PC-APROVAR-01', 'RASCUNHO', 'Brim Leve', 'Cinza', 40, jsonb_build_array($1::bigint))
      RETURNING id;
    `, [necId]);
    const planoId = Number(planoRes.rows[0].id);

    // 3.2 Instalar trigger de falha na auditoria de PLANO_APROVADO
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_aprov()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'PLANO_APROVADO' AND (NEW.detalhes->>'plano_id')::bigint = ${planoId} THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_APROV: Falha ao auditar aprovação';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_aprov
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_aprov();
    `);

    // 3.3 Tentar aprovar -> DEVE FALHAR E DAR ROLLBACK
    let threwError = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_aprovar_plano_corte(
          $1::bigint,
          40,
          'Supervisor Test',
          'idemp_aprov_fail_01'
        );
      `, [planoId]);
    } catch (err: any) {
      threwError = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_APROV');
    }
    expect(threwError).toBe(true);

    // 3.4 COMPROVAÇÃO DE ROLLBACK: Plano permanece RASCUNHO e necessidade permanece INCLUIDO_EM_PLANO
    const checkPlano = await db.query(`SELECT status, aprovado_por FROM public.planos_de_corte WHERE id = $1;`, [planoId]);
    expect(checkPlano.rows[0].status).toBe('RASCUNHO');
    expect(checkPlano.rows[0].aprovado_por).toBeNull();

    const checkNec = await db.query(`SELECT status FROM public.producao_necessidades WHERE id = $1;`, [necId]);
    expect(checkNec.rows[0].status).toBe('INCLUIDO_EM_PLANO');

    // 3.5 Remover trigger de falha e aprovar com sucesso
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_aprov ON public.pcp_audit_log;`);

    const resSuccess = await db.query(`
      SELECT public.pcp_tx_aprovar_plano_corte(
        $1::bigint,
        40,
        'Supervisor Test',
        'idemp_aprov_success_01'
      ) AS result;
    `, [planoId]);
    const rawSuccess = (resSuccess.rows[0] as any).result;
    const parsedSuccess = typeof rawSuccess === 'string' ? JSON.parse(rawSuccess) : rawSuccess;
    expect(parsedSuccess.success).toBe(true);

    const checkPlanoSuccess = await db.query(`SELECT status, aprovado_por FROM public.planos_de_corte WHERE id = $1;`, [planoId]);
    expect(checkPlanoSuccess.rows[0].status).toBe('APROVADO');
    expect(checkPlanoSuccess.rows[0].aprovado_por).toBe('Supervisor Test');

    const checkNecSuccess = await db.query(`SELECT status FROM public.producao_necessidades WHERE id = $1;`, [necId]);
    expect(checkNecSuccess.rows[0].status).toBe('PLANO_APROVADO');
  });

  it('4. pcp_tx_registrar_op: falha na auditoria reverte a inserção da OP', async () => {
    // Instalar trigger de falha intencional
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_op()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao IN ('OP_GERADA_TINY', 'OP_REGISTRADA_MANUAL') AND (NEW.detalhes->>'sku') = 'SKU-FAIL-OP' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_OP: Falha ao auditar OP';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_op
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_op();
    `);

    const opPayload = JSON.stringify({
      product_type: 'Camiseta',
      sku: 'SKU-FAIL-OP',
      qty_total: 50,
      status: 'PENDENTE_CADASTRO_TINY',
      observacao: 'Tentativa com falha'
    });

    let threwError = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_registrar_op(
          $1::jsonb,
          'OP_REGISTRADA_MANUAL',
          'Operador Test',
          '{"sku": "SKU-FAIL-OP"}'::jsonb
        );
      `, [opPayload]);
    } catch (err: any) {
      threwError = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_OP');
    }
    expect(threwError).toBe(true);

    // COMPROVAÇÃO DE ROLLBACK: OP NÃO existe na tabela
    const checkOp = await db.query(`SELECT COUNT(*) as count FROM public.ordens_de_producao WHERE sku = 'SKU-FAIL-OP';`);
    expect(Number(checkOp.rows[0].count)).toBe(0);

    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_op ON public.pcp_audit_log;`);
  });

  it('5. pcp_tx_registrar_numero_tiny_op: falha na auditoria reverte a atualização do número Tiny', async () => {
    // 5.1 Criar OP manual
    const opRes = await db.query(`
      INSERT INTO public.ordens_de_producao (product_type, sku, qty_total, status)
      VALUES ('Camisa', 'SKU-TINY-UPDATE', 25, 'PENDENTE_CADASTRO_TINY')
      RETURNING id;
    `);
    const opId = Number(opRes.rows[0].id);

    // 5.2 Instalar trigger de falha
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_tiny()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'OP_NUMERO_TINY_REGISTRADO' AND (NEW.detalhes->>'op_id')::bigint = ${opId} THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_TINY: Falha ao auditar registro do Tiny';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_tiny
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_tiny();
    `);

    // 5.3 Tentar atualizar Tiny
    let threwError = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_registrar_numero_tiny_op(
          $1::bigint,
          'TINY-12345',
          'TINY-ID-999',
          'PCP Test'
        );
      `, [opId]);
    } catch (err: any) {
      threwError = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_TINY');
    }
    expect(threwError).toBe(true);

    // 5.4 COMPROVAÇÃO DE ROLLBACK: Tiny NÃO foi gravado e status continua PENDENTE_CADASTRO_TINY
    const checkOp = await db.query(`SELECT tiny_op_numero, status FROM public.ordens_de_producao WHERE id = $1;`, [opId]);
    expect(checkOp.rows[0].tiny_op_numero).toBeNull();
    expect(checkOp.rows[0].status).toBe('PENDENTE_CADASTRO_TINY');

    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_tiny ON public.pcp_audit_log;`);
  });

  it('6. pcp_tx_bloquear_ordem: sucesso bloqueia e audita; falha na auditoria reverte 100% (pedido continua desbloqueado)', async () => {
    // Pedido 501
    await db.exec(`
      INSERT INTO public.orders (id, order_number, client_name, quantity, status, pcp_is_blocked, pcp_status)
      VALUES (501, 'PED-501', 'Cliente Bloqueio Test', 10, 'Entrada', false, 'AGUARDANDO LIBERAÇÃO')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Instalar trigger de falha intencional na auditoria de bloqueio
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_block()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'BLOQUEIO_PEDIDO' AND NEW.order_id = 501 THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_BLOCK: Falha ao gravar auditoria de bloqueio';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_block
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_block();
    `);

    let threw = false;
    try {
      await db.query(`SELECT public.pcp_tx_bloquear_ordem(501, 'Falta de Tecido', 'Aguardando fornecedor', 'Supervisor Test');`);
    } catch (err: any) {
      threw = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_BLOCK');
    }
    expect(threw).toBe(true);

    // COMPROVAÇÃO DE ROLLBACK: pcp_blocks NÃO tem registro e orders.pcp_is_blocked continua false
    const checkOrder = await db.query(`SELECT pcp_is_blocked, pcp_status FROM public.orders WHERE id = 501;`);
    expect(checkOrder.rows[0].pcp_is_blocked).toBe(false);
    expect(checkOrder.rows[0].pcp_status).toBe('AGUARDANDO LIBERAÇÃO');

    const checkBlocks = await db.query(`SELECT COUNT(*) as count FROM public.pcp_blocks WHERE order_id = 501;`);
    expect(Number(checkBlocks.rows[0].count)).toBe(0);

    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_block ON public.pcp_audit_log;`);

    // Agora executar com sucesso
    const resSuccess = await db.query(`SELECT public.pcp_tx_bloquear_ordem(501, 'Falta de Tecido', 'Aguardando fornecedor', 'Supervisor Test') as result;`);
    const parsed = typeof (resSuccess.rows[0] as any).result === 'string' ? JSON.parse((resSuccess.rows[0] as any).result) : (resSuccess.rows[0] as any).result;
    expect(parsed.success).toBe(true);

    const checkOrderBlocked = await db.query(`SELECT pcp_is_blocked, pcp_status FROM public.orders WHERE id = 501;`);
    expect(checkOrderBlocked.rows[0].pcp_is_blocked).toBe(true);
    expect(checkOrderBlocked.rows[0].pcp_status).toBe('BLOQUEADO');
  });

  it('7. pcp_tx_desbloquear_ordem: falha na auditoria reverte 100% (pedido continua bloqueado)', async () => {
    // Instalar trigger de falha
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_unblock()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'DESBLOQUEIO_PEDIDO' AND NEW.order_id = 501 THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_UNBLOCK: Falha ao gravar auditoria de desbloqueio';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_unblock
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_unblock();
    `);

    let threw = false;
    try {
      await db.query(`SELECT public.pcp_tx_desbloquear_ordem(501, 'Tecido chegou', 'Supervisor Test');`);
    } catch (err: any) {
      threw = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_UNBLOCK');
    }
    expect(threw).toBe(true);

    // COMPROVAÇÃO DE ROLLBACK: pedido continua bloqueado
    const checkOrder = await db.query(`SELECT pcp_is_blocked, pcp_status FROM public.orders WHERE id = 501;`);
    expect(checkOrder.rows[0].pcp_is_blocked).toBe(true);
    expect(checkOrder.rows[0].pcp_status).toBe('BLOQUEADO');

    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_unblock ON public.pcp_audit_log;`);

    // Sucesso
    const resSuccess = await db.query(`SELECT public.pcp_tx_desbloquear_ordem(501, 'Tecido chegou', 'Supervisor Test') as result;`);
    const parsed = typeof (resSuccess.rows[0] as any).result === 'string' ? JSON.parse((resSuccess.rows[0] as any).result) : (resSuccess.rows[0] as any).result;
    expect(parsed.success).toBe(true);

    const checkOrderUnblocked = await db.query(`SELECT pcp_is_blocked, pcp_status FROM public.orders WHERE id = 501;`);
    expect(checkOrderUnblocked.rows[0].pcp_is_blocked).toBe(false);
  });

  it('8. pcp_tx_alterar_prioridade: falha na auditoria reverte 100% (prioridade original preservada)', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, client_name, quantity, status, pcp_priority, pcp_priority_score)
      VALUES (502, 'PED-502', 'Cliente Prioridade Test', 5, 'Entrada', 'NORMAL', 100)
      ON CONFLICT (id) DO NOTHING;
    `);

    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_prio()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'ALTERACAO_PRIORIDADE_MANUAL' AND NEW.order_id = 502 THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_PRIO: Falha ao gravar auditoria de prioridade';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_prio
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_prio();
    `);

    let threw = false;
    try {
      await db.query(`SELECT public.pcp_tx_alterar_prioridade(502, 'CRÍTICA', 1000, 'Urgência cliente VIP', 'PCP Test');`);
    } catch (err: any) {
      threw = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_PRIO');
    }
    expect(threw).toBe(true);

    // COMPROVAÇÃO DE ROLLBACK: prioridade continua NORMAL, 100
    const checkOrder = await db.query(`SELECT pcp_priority, pcp_priority_score FROM public.orders WHERE id = 502;`);
    expect(checkOrder.rows[0].pcp_priority).toBe('NORMAL');
    expect(checkOrder.rows[0].pcp_priority_score).toBe(100);

    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_prio ON public.pcp_audit_log;`);

    // Sucesso
    await db.query(`SELECT public.pcp_tx_alterar_prioridade(502, 'ALTA', 500, 'Ajuste PCP', 'PCP Test');`);
    const checkOrderOk = await db.query(`SELECT pcp_priority, pcp_priority_score FROM public.orders WHERE id = 502;`);
    expect(checkOrderOk.rows[0].pcp_priority).toBe('ALTA');
    expect(checkOrderOk.rows[0].pcp_priority_score).toBe(500);
  });

  it('9. pcp_tx_reabrir_etapa: falha na auditoria reverte 100% (etapa continua finalizada)', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, client_name, quantity, status)
      VALUES (503, 'PED-503', 'Cliente Reabrir Test', 8, 'Pronto')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.order_stage_progress (order_id, stage_id, finished, quantidade_boa)
      VALUES (503, 1, true, 8)
      ON CONFLICT DO NOTHING;
    `);

    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_reopen()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'REABERTURA_ETAPA' AND NEW.order_id = 503 THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_REOPEN: Falha na auditoria de reabertura';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_reopen
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_reopen();
    `);

    let threw = false;
    try {
      await db.query(`SELECT public.pcp_tx_reabrir_etapa(503, 1, 'Revisão necessária', 'Supervisor Test');`);
    } catch (err: any) {
      threw = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_REOPEN');
    }
    expect(threw).toBe(true);

    // COMPROVAÇÃO DE ROLLBACK: order_stage_progress continua finished = true e quantidade_boa = 8
    const checkProg = await db.query(`SELECT finished, quantidade_boa FROM public.order_stage_progress WHERE order_id = 503 AND stage_id = 1;`);
    expect(checkProg.rows[0].finished).toBe(true);
    expect(checkProg.rows[0].quantidade_boa).toBe(8);

    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_reopen ON public.pcp_audit_log;`);
  });

  it('10. pcp_tx_expedir_ordem: falha na auditoria reverte 100% (pedido continua Pronto e não Entregue)', async () => {
    await db.exec(`
      INSERT INTO public.orders (id, order_number, client_name, quantity, status, pcp_status)
      VALUES (504, 'PED-504', 'Cliente Expedir Test', 12, 'Pronto', 'PRONTO')
      ON CONFLICT (id) DO NOTHING;
    `);

    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_expedir()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'EXPEDICAO_ENTREGA_CLIENTE' AND NEW.order_id = 504 THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_EXPEDIR: Falha na auditoria de expedição';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_expedir
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_expedir();
    `);

    let threw = false;
    try {
      await db.query(`SELECT public.pcp_tx_expedir_ordem(504, 'Coleta transportadora', 'Comercial Test');`);
    } catch (err: any) {
      threw = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_EXPEDIR');
    }
    expect(threw).toBe(true);

    // COMPROVAÇÃO DE ROLLBACK: pedido continua Pronto
    const checkOrder = await db.query(`SELECT status, pcp_status, delivered_at FROM public.orders WHERE id = 504;`);
    expect(checkOrder.rows[0].status).toBe('Pronto');
    expect(checkOrder.rows[0].pcp_status).toBe('PRONTO');
    expect(checkOrder.rows[0].delivered_at).toBeNull();

    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_expedir ON public.pcp_audit_log;`);

    // Sucesso
    const resSuccess = await db.query(`SELECT public.pcp_tx_expedir_ordem(504, 'Coleta transportadora', 'Comercial Test') as result;`);
    const parsed = typeof (resSuccess.rows[0] as any).result === 'string' ? JSON.parse((resSuccess.rows[0] as any).result) : (resSuccess.rows[0] as any).result;
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe('Entregue');

    const checkOrderDelivered = await db.query(`SELECT status, pcp_status FROM public.orders WHERE id = 504;`);
    expect(checkOrderDelivered.rows[0].status).toBe('Entregue');
    expect(checkOrderDelivered.rows[0].pcp_status).toBe('EXPEDIDO_ENTREGUE');
  });

  it('11. pcp_audit_log: imutabilidade append-only bloqueia UPDATE/DELETE direto, mas ON DELETE SET NULL de pedidos preserva os registros', async () => {
    // Inserir pedido 505 e gerar auditoria
    await db.exec(`
      INSERT INTO public.orders (id, order_number, client_name, quantity, status)
      VALUES (505, 'PED-505', 'Cliente Imutabilidade Test', 5, 'Entrada')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.pcp_audit_log (order_id, usuario, acao, quantidade)
      VALUES (505, 'Tester', 'TESTE_IMUTABILIDADE', 5);
    `);

    const auditRow = await db.query(`SELECT id, order_id, acao FROM public.pcp_audit_log WHERE order_id = 505;`);
    expect(auditRow.rows.length).toBe(1);
    const auditId = auditRow.rows[0].id;

    // Tentativa de UPDATE direto DEVE ser bloqueada
    let updateBlocked = false;
    try {
      await db.query(`UPDATE public.pcp_audit_log SET acao = 'HACKED' WHERE id = $1;`, [auditId]);
    } catch (err: any) {
      updateBlocked = true;
      expect(err.message).toContain('estritamente append-only');
    }
    expect(updateBlocked).toBe(true);

    // Tentativa direta de executar UPDATE pcp_audit_log SET order_id = NULL DEVE ser bloqueada com erro 55000
    let updateOrderIdBlocked = false;
    try {
      await db.query(`UPDATE public.pcp_audit_log SET order_id = NULL WHERE id = $1;`, [auditId]);
    } catch (err: any) {
      updateOrderIdBlocked = true;
      expect(err.message).toContain('estritamente append-only');
    }
    expect(updateOrderIdBlocked).toBe(true);

    // Tentativa de DELETE direto DEVE ser bloqueada
    let deleteBlocked = false;
    try {
      await db.query(`DELETE FROM public.pcp_audit_log WHERE id = $1;`, [auditId]);
    } catch (err: any) {
      deleteBlocked = true;
      expect(err.message).toContain('estritamente append-only');
    }
    expect(deleteBlocked).toBe(true);

    // Exclusão do pedido referenciado: aciona ON DELETE SET NULL no PostgreSQL
    // O registro de auditoria DEVE permanecer intacto com order_id = NULL
    await db.query(`DELETE FROM public.orders WHERE id = 505;`);

    const auditAfterOrderDelete = await db.query(`SELECT id, order_id, acao FROM public.pcp_audit_log WHERE id = $1;`, [auditId]);
    expect(auditAfterOrderDelete.rows.length).toBe(1);
    expect(auditAfterOrderDelete.rows[0].order_id).toBeNull();
    expect(auditAfterOrderDelete.rows[0].acao).toBe('TESTE_IMUTABILIDADE');
  });

  it('12. pcp_apply_stage_progress: falha na auditoria provoca rollback 100% de order_stage_progress', async () => {
    // 12.1 Instalar gatilho de falha na auditoria
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_prog()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'APONTAMENTO_PRODUCAO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_PROG: Falha induzida na auditoria de apontamento';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_prog
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_prog();
    `);

    // 12.2 Execução sob falha de auditoria
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_apply_stage_progress(
          p_order_id := 601,
          p_stage_id := 10,
          p_user_id := 20,
          p_good_inc := 5,
          p_idempotency_key := 'prog_key_fail'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_PROG');
    }
    expect(errorCaught).toBe(true);

    // 12.3 Comprovar rollback 100% (nenhuma quantidade apontada)
    const progAfterRollback = await db.query(`
      SELECT quantidade_boa FROM public.order_stage_progress WHERE order_id = 601 AND stage_id = 10;
    `);
    expect(progAfterRollback.rows.length === 0 || Number(progAfterRollback.rows[0].quantidade_boa) === 0).toBe(true);

    // 12.4 Remover gatilho de falha
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_prog ON public.pcp_audit_log;`);

    // 12.5 Reexecutar com sucesso
    const successRes = await db.query(`
      SELECT public.pcp_apply_stage_progress(
        p_order_id := 601,
        p_stage_id := 10,
        p_user_id := 20,
        p_good_inc := 5,
        p_idempotency_key := 'prog_key_success'
      ) AS res;
    `);
    const resJson = typeof successRes.rows[0].res === 'string' ? JSON.parse(successRes.rows[0].res) : successRes.rows[0].res;
    expect(resJson.success).toBe(true);

    // 12.6 Comprovar negócio e auditoria gravados juntos
    const progSuccess = await db.query(`
      SELECT quantidade_boa FROM public.order_stage_progress WHERE order_id = 601 AND stage_id = 10;
    `);
    expect(Number(progSuccess.rows[0].quantidade_boa)).toBe(5);

    const auditSuccess = await db.query(`
      SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE order_id = 601 AND acao = 'APONTAMENTO_PRODUCAO';
    `);
    expect(Number(auditSuccess.rows[0].count)).toBe(1);
  });

  it('13. rpc_start_operation: falha na auditoria de supervisor_override provoca rollback de stage_executions e status do pedido', async () => {
    // 13.1 Instalar gatilho de falha
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_start()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'SUPERVISOR_OVERRIDE_START' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_START: Falha induzida na auditoria de início com override';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_start
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_start();
    `);

    // 13.2 Execução sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.rpc_start_operation(
          p_order_id := 602,
          p_stage_id := 10,
          p_user_id := 21,
          p_supervisor_override := true,
          p_motivo := 'Início com override sob teste'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_START');
    }
    expect(errorCaught).toBe(true);

    // 13.3 Comprovar rollback (sem execução criada e status do pedido preservado em 'Entrada')
    const execAfterRollback = await db.query(`SELECT COUNT(*) as count FROM public.stage_executions WHERE order_id = 602;`);
    expect(Number(execAfterRollback.rows[0].count)).toBe(0);

    const orderAfterRollback = await db.query(`SELECT status FROM public.orders WHERE id = 602;`);
    expect(orderAfterRollback.rows[0].status).toBe('Entrada');

    // 13.4 Remover gatilho
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_start ON public.pcp_audit_log;`);

    // 13.5 Reexecutar com sucesso
    const successRes = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id := 602,
        p_stage_id := 10,
        p_user_id := 21,
        p_supervisor_override := true,
        p_motivo := 'Início com override liberado'
      ) AS res;
    `);
    const resJson = typeof successRes.rows[0].res === 'string' ? JSON.parse(successRes.rows[0].res) : successRes.rows[0].res;
    expect(resJson.success).toBe(true);

    // 13.6 Comprovar persistência de negócio e auditoria
    const execSuccess = await db.query(`SELECT COUNT(*) as count FROM public.stage_executions WHERE order_id = 602;`);
    expect(Number(execSuccess.rows[0].count)).toBe(1);

    const orderSuccess = await db.query(`SELECT status FROM public.orders WHERE id = 602;`);
    expect(orderSuccess.rows[0].status).toBe('Em Produção');

    const auditSuccess = await db.query(`
      SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE order_id = 602 AND acao = 'SUPERVISOR_OVERRIDE_START';
    `);
    expect(Number(auditSuccess.rows[0].count)).toBe(1);
  });

  it('14. rpc_pause_operation: falha na auditoria provoca rollback de pauses e status da execução', async () => {
    // 14.1 Iniciar execução válida para pedido 603 com operador 22 sem override
    const startRes = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id := 603,
        p_stage_id := 10,
        p_user_id := 22
      ) AS res;
    `);
    const startJson = typeof startRes.rows[0].res === 'string' ? JSON.parse(startRes.rows[0].res) : startRes.rows[0].res;
    const execId = Number(startJson.execution_id);
    expect(execId).toBeGreaterThan(0);

    // 14.2 Instalar gatilho de falha na pausa
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_pause()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'PAUSA_OPERACAO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_PAUSE: Falha induzida na auditoria de pausa';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_pause
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_pause();
    `);

    // 14.3 Tentar pausar sob falha de auditoria
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.rpc_pause_operation(
          p_execution_id := $1,
          p_user_id := 22,
          p_motivo := 'Pausa teste falha'
        );
      `, [execId]);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_PAUSE');
    }
    expect(errorCaught).toBe(true);

    // 14.4 Comprovar rollback (nenhuma pausa criada, execução não está em status 'Pausado')
    const pausesRollback = await db.query(`SELECT COUNT(*) as count FROM public.pauses WHERE execution_id = $1;`, [execId]);
    expect(Number(pausesRollback.rows[0].count)).toBe(0);

    const execRollback = await db.query(`SELECT status FROM public.stage_executions WHERE id = $1;`, [execId]);
    expect(execRollback.rows[0].status).not.toBe('Pausado');

    // 14.5 Remover gatilho
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_pause ON public.pcp_audit_log;`);

    // 14.6 Reexecutar pausa com sucesso
    const pauseSuccess = await db.query(`
      SELECT public.rpc_pause_operation(
        p_execution_id := $1,
        p_user_id := 22,
        p_motivo := 'Pausa teste sucesso'
      ) AS res;
    `, [execId]);
    const pauseJson = typeof pauseSuccess.rows[0].res === 'string' ? JSON.parse(pauseSuccess.rows[0].res) : pauseSuccess.rows[0].res;
    expect(pauseJson.success).toBe(true);

    // 14.7 Comprovar negócio e auditoria gravados juntos
    const pausesSuccess = await db.query(`SELECT COUNT(*) as count FROM public.pauses WHERE execution_id = $1;`, [execId]);
    expect(Number(pausesSuccess.rows[0].count)).toBe(1);

    const execStatus = await db.query(`SELECT status FROM public.stage_executions WHERE id = $1;`, [execId]);
    expect(execStatus.rows[0].status).toBe('Pausado');

    const auditPause = await db.query(`
      SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE order_id = 603 AND acao = 'PAUSA_OPERACAO';
    `);
    expect(Number(auditPause.rows[0].count)).toBe(1);
  });

  it('15. rpc_resume_operation: falha na auditoria provoca rollback da retomada e fim da pausa', async () => {
    // Obter execução do pedido 603 (que está pausada pelo teste anterior)
    const execRow = await db.query(`SELECT id FROM public.stage_executions WHERE order_id = 603 AND status = 'Pausado' LIMIT 1;`);
    const execId = Number(execRow.rows[0].id);

    // 15.1 Instalar gatilho de falha na retomada
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_resume()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'RETOMADA_OPERACAO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_RESUME: Falha induzida na auditoria de retomada';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_resume
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_resume();
    `);

    // 15.2 Tentar retomar sob falha de auditoria
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.rpc_resume_operation(
          p_execution_id := $1,
          p_user_id := 22
        );
      `, [execId]);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_RESUME');
    }
    expect(errorCaught).toBe(true);

    // 15.3 Comprovar rollback: execução continua 'Pausado' e pausa não foi encerrada
    const execRollback = await db.query(`SELECT status FROM public.stage_executions WHERE id = $1;`, [execId]);
    expect(execRollback.rows[0].status).toBe('Pausado');

    const pauseRollback = await db.query(`SELECT end_pause FROM public.pauses WHERE execution_id = $1 AND end_pause IS NULL;`, [execId]);
    expect(pauseRollback.rows.length).toBe(1);

    // 15.4 Remover gatilho
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_resume ON public.pcp_audit_log;`);

    // 15.5 Reexecutar retomada com sucesso
    const resumeSuccess = await db.query(`
      SELECT public.rpc_resume_operation(
        p_execution_id := $1,
        p_user_id := 22
      ) AS res;
    `, [execId]);
    const resumeJson = typeof resumeSuccess.rows[0].res === 'string' ? JSON.parse(resumeSuccess.rows[0].res) : resumeSuccess.rows[0].res;
    expect(resumeJson.success).toBe(true);

    // 15.6 Comprovar retomada e auditoria persistidas juntas
    const execResumed = await db.query(`SELECT status FROM public.stage_executions WHERE id = $1;`, [execId]);
    expect(execResumed.rows[0].status).not.toBe('Pausado');

    const auditResume = await db.query(`
      SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE order_id = 603 AND acao = 'RETOMADA_OPERACAO';
    `);
    expect(Number(auditResume.rows[0].count)).toBe(1);
  });

  it('16. rpc_finish_operation: falha na auditoria provoca rollback da conclusão da execução', async () => {
    // 16.1 Iniciar execução para pedido 604 com operador 23
    const startRes = await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id := 604,
        p_stage_id := 10,
        p_user_id := 23
      ) AS res;
    `);
    const startJson = typeof startRes.rows[0].res === 'string' ? JSON.parse(startRes.rows[0].res) : startRes.rows[0].res;
    const execId = Number(startJson.execution_id);
    expect(execId).toBeGreaterThan(0);

    // 16.2 Instalar gatilho de falha na finalização
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_finish()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao IN ('FIM_OPERACAO_CONCLUIDA', 'FIM_SESSAO_PARCIAL') THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_FINISH: Falha induzida na auditoria de conclusão';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_finish
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_finish();
    `);

    // 16.3 Tentar finalizar sob falha de auditoria
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.rpc_finish_operation(
          p_execution_id := $1,
          p_user_id := 23,
          p_good_inc := 10,
          p_partial := false
        );
      `, [execId]);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_FINISH');
    }
    expect(errorCaught).toBe(true);

    // 16.4 Comprovar rollback: execução NÃO foi finalizada (status diferente de 'Finalizado' e end_time IS NULL)
    const execRollback = await db.query(`SELECT status, end_time FROM public.stage_executions WHERE id = $1;`, [execId]);
    expect(execRollback.rows[0].status).not.toBe('Finalizado');
    expect(execRollback.rows[0].end_time).toBeNull();

    // 16.5 Remover gatilho
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_finish ON public.pcp_audit_log;`);

    // 16.6 Reexecutar finalização com sucesso
    const finishSuccess = await db.query(`
      SELECT public.rpc_finish_operation(
        p_execution_id := $1,
        p_user_id := 23,
        p_good_inc := 10,
        p_partial := false
      ) AS res;
    `, [execId]);
    const finishJson = typeof finishSuccess.rows[0].res === 'string' ? JSON.parse(finishSuccess.rows[0].res) : finishSuccess.rows[0].res;
    expect(finishJson.success).toBe(true);

    // 16.7 Comprovar persistência de negócio e auditoria
    const execFinal = await db.query(`SELECT status, end_time FROM public.stage_executions WHERE id = $1;`, [execId]);
    expect(execFinal.rows[0].status).toBe('Finalizado');
    expect(execFinal.rows[0].end_time).not.toBeNull();

    const auditFinish = await db.query(`
      SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE order_id = 604 AND acao IN ('FIM_OPERACAO_CONCLUIDA', 'FIM_SESSAO_PARCIAL');
    `);
    expect(Number(auditFinish.rows[0].count)).toBe(1);
  });

  it('17. rpc_record_production: falha na auditoria provoca rollback de apontamento e chave de idempotência', async () => {
    // Iniciar execução para pedido 605 com operador 24
    await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id := 605,
        p_stage_id := 10,
        p_user_id := 24
      );
    `);

    // 17.1 Instalar gatilho de falha
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_rec_prod()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'APONTAMENTO_PRODUCAO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_REC_PROD: Falha induzida na auditoria de record_production';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_rec_prod
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_rec_prod();
    `);

    // 17.2 Tentar registrar produção sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.rpc_record_production(
          p_order_id := 605,
          p_stage_id := 10,
          p_user_id := 24,
          p_idempotency_key := 'rec_prod_fail_key',
          p_good_inc := 12
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_REC_PROD');
    }
    expect(errorCaught).toBe(true);

    // 17.3 Comprovar rollback: quantidade apontada não persistiu
    const progRollback = await db.query(`
      SELECT quantidade_boa FROM public.order_stage_progress WHERE order_id = 605 AND stage_id = 10;
    `);
    expect(progRollback.rows.length === 0 || Number(progRollback.rows[0].quantidade_boa) === 0).toBe(true);

    // 17.4 Remover gatilho
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_rec_prod ON public.pcp_audit_log;`);

    // 17.5 Reexecutar com sucesso
    const prodSuccess = await db.query(`
      SELECT public.rpc_record_production(
        p_order_id := 605,
        p_stage_id := 10,
        p_user_id := 24,
        p_idempotency_key := 'rec_prod_success_key',
        p_good_inc := 12
      ) AS res;
    `);
    const prodJson = typeof prodSuccess.rows[0].res === 'string' ? JSON.parse(prodSuccess.rows[0].res) : prodSuccess.rows[0].res;
    expect(prodJson.success).toBe(true);

    // 17.6 Comprovar persistência conjunta
    const progSuccess = await db.query(`
      SELECT quantidade_boa FROM public.order_stage_progress WHERE order_id = 605 AND stage_id = 10;
    `);
    expect(Number(progSuccess.rows[0].quantidade_boa)).toBe(12);

    const auditSuccess = await db.query(`
      SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE order_id = 605 AND acao = 'APONTAMENTO_PRODUCAO';
    `);
    expect(Number(auditSuccess.rows[0].count)).toBe(1);
  });

  it('18. rpc_record_loss: falha na auditoria provoca rollback de order_loss_logs', async () => {
    // Iniciar execução para pedido 606 com operador 25
    await db.query(`
      SELECT public.rpc_start_operation(
        p_order_id := 606,
        p_stage_id := 10,
        p_user_id := 25
      );
    `);

    // 18.1 Instalar gatilho de falha
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_audit_loss()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'REGISTRAR_PERDA' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_LOSS: Falha induzida na auditoria de perdas';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_audit_loss
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_audit_loss();
    `);

    // 18.2 Tentar registrar perda sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.rpc_record_loss(
          p_order_id := 606,
          p_stage_id := 10,
          p_user_id := 25,
          p_lost_qty := 4,
          p_reason := 'Falha Tecido Atomic',
          p_idempotency_key := 'loss_fail_key'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_LOSS');
    }
    expect(errorCaught).toBe(true);

    // 18.3 Comprovar rollback: nenhum registro em order_loss_logs
    const lossRollback = await db.query(`
      SELECT COUNT(*) as count FROM public.order_loss_logs WHERE order_id = 606;
    `);
    expect(Number(lossRollback.rows[0].count)).toBe(0);

    // 18.4 Remover gatilho
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_loss ON public.pcp_audit_log;`);

    // 18.5 Reexecutar com sucesso
    const lossSuccess = await db.query(`
      SELECT public.rpc_record_loss(
        p_order_id := 606,
        p_stage_id := 10,
        p_user_id := 25,
        p_lost_qty := 4,
        p_reason := 'Falha Tecido Atomic',
        p_idempotency_key := 'loss_success_key'
      ) AS res;
    `);
    const lossJson = typeof lossSuccess.rows[0].res === 'string' ? JSON.parse(lossSuccess.rows[0].res) : lossSuccess.rows[0].res;
    expect(lossJson.success).toBe(true);

    // 18.6 Comprovar persistência conjunta
    const lossSuccessRows = await db.query(`
      SELECT COUNT(*) as count FROM public.order_loss_logs WHERE order_id = 606;
    `);
    expect(Number(lossSuccessRows.rows[0].count)).toBe(1);

    const auditLoss = await db.query(`
      SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE order_id = 606 AND acao = 'REGISTRAR_PERDA';
    `);
    expect(Number(auditLoss.rows[0].count)).toBe(1);
  });

  it('19. pcp_tx_register_consolidated_cutting: integridade transacional completa (ator do JWT, validação de itens/etapa, rollback atômico e idempotência)', async () => {
    // 19.1 Ator inválido ou inativo deve ser rejeitado com rollback
    let actorErrorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_register_consolidated_cutting(
          p_item_key := 'CAM-AZUL-M',
          p_quantidade_cortada := 10,
          p_idempotency_key := 'cut_fail_actor',
          p_user_id := 99999
        );
      `);
    } catch (err: any) {
      actorErrorCaught = true;
      expect(err.message).toMatch(/USER_NOT_FOUND_OR_INACTIVE|42501/);
    }
    expect(actorErrorCaught).toBe(true);

    // 19.2 Parâmetros inválidos (item_key vazio ou quantidade negativa) devem ser rejeitados
    let paramErrorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_register_consolidated_cutting(
          p_item_key := '',
          p_quantidade_cortada := 10,
          p_idempotency_key := 'cut_fail_param',
          p_user_id := 1
        );
      `);
    } catch (err: any) {
      paramErrorCaught = true;
      expect(err.message).toContain('INVALID_ITEM_KEY');
    }
    expect(paramErrorCaught).toBe(true);

    // 19.3 Falha forçada provocando ROLLBACK INTEGRAL de tudo (sem registros parciais)
    await db.exec(`
      CREATE OR REPLACE FUNCTION trg_fn_test_fail_cut()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.acao = 'CORTE_CONSOLIDADO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_CUT: Forcando rollback total do corte consolidado';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_test_fail_audit_cut ON public.pcp_audit_log;
      CREATE TRIGGER trg_test_fail_audit_cut
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trg_fn_test_fail_cut();
    `);

    let forcedRollbackCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_register_consolidated_cutting(
          p_item_key := 'CAM-AZUL-M',
          p_quantidade_cortada := 5,
          p_idempotency_key := 'cut_fail_forced_rollback',
          p_user_id := 1,
          p_allocations := '[{"order_id": 701, "quantidade_alocada": 5, "product_type": "Camiseta", "color": "Azul", "size": "M"}]'::jsonb
        );
      `);
    } catch (err: any) {
      forcedRollbackCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_CUT');
    }
    expect(forcedRollbackCaught).toBe(true);

    // Comprovar ausência de registros parciais após rollback
    const allocCountAfterFail = await db.query(`SELECT COUNT(*) as count FROM public.corte_allocations WHERE order_id = 701;`);
    expect(Number(allocCountAfterFail.rows[0].count)).toBe(0);

    const progLogAfterFail = await db.query(`SELECT COUNT(*) as count FROM public.order_progress_logs WHERE idempotency_key = 'cut_fail_forced_rollback';`);
    expect(Number(progLogAfterFail.rows[0].count)).toBe(0);

    const order701AfterFail = await db.query(`SELECT items FROM public.orders WHERE id = 701;`);
    const items701 = typeof order701AfterFail.rows[0].items === 'string' ? JSON.parse(order701AfterFail.rows[0].items) : order701AfterFail.rows[0].items;
    expect(items701[0].qty_corte_allocated).toBe(0);

    // Remover gatilho de falha
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_audit_cut ON public.pcp_audit_log;`);

    // 19.4 Sucesso completo e persistência conjunta
    const cutSuccessRes = await db.query(`
      SELECT public.pcp_tx_register_consolidated_cutting(
        p_item_key := 'CAM-AZUL-M',
        p_quantidade_cortada := 10,
        p_idempotency_key := 'cut_success_key_01',
        p_user_id := 1,
        p_allocations := '[{"order_id": 701, "quantidade_alocada": 10, "product_type": "Camiseta", "color": "Azul", "size": "M"}]'::jsonb
      ) AS res;
    `);

    const cutSuccessJson = typeof cutSuccessRes.rows[0].res === 'string' ? JSON.parse(cutSuccessRes.rows[0].res) : cutSuccessRes.rows[0].res;
    expect(cutSuccessJson.success).toBe(true);
    expect(cutSuccessJson.total_allocated).toBe(10);

    // Comprovar inserções conjuntas atômicas
    const allocCountSuccess = await db.query(`SELECT COUNT(*) as count FROM public.corte_allocations WHERE order_id = 701;`);
    expect(Number(allocCountSuccess.rows[0].count)).toBe(1);

    const progLogSuccess = await db.query(`SELECT COUNT(*) as count FROM public.order_progress_logs WHERE idempotency_key = 'cut_success_key_01';`);
    expect(Number(progLogSuccess.rows[0].count)).toBe(1);

    const auditCutSuccess = await db.query(`SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE acao = 'CORTE_CONSOLIDADO' AND order_id = 701;`);
    expect(Number(auditCutSuccess.rows[0].count)).toBe(1);

    // 19.5 Duplo clique / Prevenção de duplicação por idempotency_key
    const cutDuplicateRes = await db.query(`
      SELECT public.pcp_tx_register_consolidated_cutting(
        p_item_key := 'CAM-AZUL-M',
        p_quantidade_cortada := 10,
        p_idempotency_key := 'cut_success_key_01',
        p_user_id := 1,
        p_allocations := '[{"order_id": 701, "quantidade_alocada": 10, "product_type": "Camiseta", "color": "Azul", "size": "M"}]'::jsonb
      ) AS res;
    `);

    const cutDuplicateJson = typeof cutDuplicateRes.rows[0].res === 'string' ? JSON.parse(cutDuplicateRes.rows[0].res) : cutDuplicateRes.rows[0].res;
    expect(cutDuplicateJson.success).toBe(true);

    // Contadores não devem ter sido duplicados
    const allocCountDup = await db.query(`SELECT COUNT(*) as count FROM public.corte_allocations WHERE order_id = 701;`);
    expect(Number(allocCountDup.rows[0].count)).toBe(1);

    const progLogDup = await db.query(`SELECT COUNT(*) as count FROM public.order_progress_logs WHERE idempotency_key = 'cut_success_key_01';`);
    expect(Number(progLogDup.rows[0].count)).toBe(1);
  });

  it('20. pcp_tx_record_ramado_decision: integridade transacional completa (decisão, excedentes em producao_excedentes, auditoria e rollback)', async () => {
    // 20.1 Validação de Ator
    let actorErrorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_record_ramado_decision(
          p_model := 'Camiseta Teste',
          p_fabric := 'RAMADO',
          p_color := 'Azul',
          p_tipo_tecido := 'RAMADO',
          p_decision := 'APROVADO_OTIMIZADO',
          p_plano_exato := '{"total": 50}'::jsonb,
          p_plano_otimizado := '{"total": 60}'::jsonb,
          p_excedente_proposto := '{"M": 10}'::jsonb,
          p_excedente_total := 10,
          p_riscos_antes := 2,
          p_riscos_depois := 1,
          p_ganho_operacional := '{"economia_tecido": 15}'::jsonb,
          p_user_id := 99999
        );
      `);
    } catch (err: any) {
      actorErrorCaught = true;
      expect(err.message).toMatch(/USER_NOT_FOUND_OR_INACTIVE|42501/);
    }
    expect(actorErrorCaught).toBe(true);

    // 20.2 Sucesso completo com inserção atômica em ramado_decisions e producao_excedentes
    const ramadoSuccess = await db.query(`
      SELECT public.pcp_tx_record_ramado_decision(
        p_model := 'Camiseta Teste RAMADO',
        p_fabric := 'RAMADO',
        p_color := 'Preto',
        p_tipo_tecido := 'RAMADO',
        p_decision := 'APROVADO_OTIMIZADO',
        p_plano_exato := '{"total": 100}'::jsonb,
        p_plano_otimizado := '{"total": 120}'::jsonb,
        p_excedente_proposto := '{"G": 20}'::jsonb,
        p_excedente_total := 20,
        p_riscos_antes := 3,
        p_riscos_depois := 2,
        p_ganho_operacional := '{"economia_tecido": 25}'::jsonb,
        p_user_id := 1,
        p_idempotency_key := 'ramado_key_success_01'
      ) AS res;
    `);

    const ramadoJson = typeof ramadoSuccess.rows[0].res === 'string' ? JSON.parse(ramadoSuccess.rows[0].res) : ramadoSuccess.rows[0].res;
    expect(ramadoJson.success).toBe(true);
    expect(ramadoJson.decision.decision).toBe('APROVADO_OTIMIZADO');
    expect(ramadoJson.excedentes_gerados.length).toBe(1);

    // Comprovar persistência conjunta no banco
    const decRow = await db.query(`SELECT COUNT(*) as count FROM public.ramado_decisions WHERE model = 'Camiseta Teste RAMADO';`);
    expect(Number(decRow.rows[0].count)).toBe(1);

    const excRow = await db.query(`SELECT COUNT(*) as count FROM public.producao_excedentes WHERE model = 'Camiseta Teste RAMADO' AND size = 'G';`);
    expect(Number(excRow.rows[0].count)).toBe(1);

    const auditRow = await db.query(`SELECT COUNT(*) as count FROM public.pcp_audit_log WHERE acao = 'DECISAO_RAMADO';`);
    expect(Number(auditRow.rows[0].count)).toBe(1);

    // 20.3 Duplo clique / Idempotência
    const ramadoDup = await db.query(`
      SELECT public.pcp_tx_record_ramado_decision(
        p_model := 'Camiseta Teste RAMADO',
        p_fabric := 'RAMADO',
        p_color := 'Preto',
        p_tipo_tecido := 'RAMADO',
        p_decision := 'APROVADO_OTIMIZADO',
        p_plano_exato := '{"total": 100}'::jsonb,
        p_plano_otimizado := '{"total": 120}'::jsonb,
        p_excedente_proposto := '{"G": 20}'::jsonb,
        p_excedente_total := 20,
        p_riscos_antes := 3,
        p_riscos_depois := 2,
        p_ganho_operacional := '{"economia_tecido": 25}'::jsonb,
        p_user_id := 1,
        p_idempotency_key := 'ramado_key_success_01'
      ) AS res;
    `);

    const ramadoDupJson = typeof ramadoDup.rows[0].res === 'string' ? JSON.parse(ramadoDup.rows[0].res) : ramadoDup.rows[0].res;
    expect(ramadoDupJson.success).toBe(true);

    const decRowDup = await db.query(`SELECT COUNT(*) as count FROM public.ramado_decisions WHERE model = 'Camiseta Teste RAMADO';`);
    expect(Number(decRowDup.rows[0].count)).toBe(1);
  });

  it('21. pcp_tx_create_cut_plan: integridade transacional completa (falha na auditoria provoca rollback atômico e reexecução gera sequência correta)', async () => {
    // 21.1 Instalar gatilho de falha na auditoria
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_create_cut_plan()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'CRIAR_PLANO_CORTE' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_CREATE_PLAN: Falha forçada na auditoria do plano de corte';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_create_cut_plan
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_create_cut_plan();
    `);

    // 21.2 Tentativa sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_create_cut_plan(
          p_fabric := 'Algodao Teste 21',
          p_color := 'Azul',
          p_tipo_tecido := 'Malha',
          p_largura_util := '1.60',
          p_items := '[{"order_id":701,"order_number":"PED-701","sku":"SKU-701","product_type":"Camiseta Teste 21","size":"M","item_key":"CAM-701-M","quantity_planned":10}]'::jsonb,
          p_notes := 'Teste Rollback 21',
          p_user_id := 1,
          p_idempotency_key := 'cut_create_fail_21'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_CREATE_PLAN');
    }
    expect(errorCaught).toBe(true);

    // 21.3 Comprovar rollback 100% (nenhum plano, item ou movimento persistido)
    const planRollback = await db.query(`SELECT count(*) as count FROM public.cut_plans WHERE fabric = 'Algodao Teste 21';`);
    expect(Number(planRollback.rows[0].count)).toBe(0);

    const itemsRollback = await db.query(`SELECT count(*) as count FROM public.cut_plan_items WHERE product_type = 'Camiseta Teste 21';`);
    expect(Number(itemsRollback.rows[0].count)).toBe(0);

    const movRollback = await db.query(`SELECT count(*) as count FROM public.production_movements WHERE product_type = 'Camiseta Teste 21';`);
    expect(Number(movRollback.rows[0].count)).toBe(0);

    // 21.4 Remover trigger e executar com sucesso
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_create_cut_plan ON public.pcp_audit_log;`);

    const successRes = await db.query(`
      SELECT public.pcp_tx_create_cut_plan(
        p_fabric := 'Algodao Teste 21',
        p_color := 'Azul',
        p_tipo_tecido := 'Malha',
        p_largura_util := '1.60',
        p_items := '[{"order_id":701,"order_number":"PED-701","sku":"SKU-701","product_type":"Camiseta Teste 21","size":"M","item_key":"CAM-701-M","quantity_planned":10}]'::jsonb,
        p_notes := 'Teste Sucesso 21',
        p_user_id := 1,
        p_idempotency_key := 'cut_create_succ_21'
      ) AS res;
    `);
    const planJson = typeof successRes.rows[0].res === 'string' ? JSON.parse(successRes.rows[0].res) : successRes.rows[0].res;
    expect(planJson.success).toBe(true);
    expect(planJson.plan_number).toMatch(/^PC-\d{4}-\d{5}$/);

    const planCount = await db.query(`SELECT count(*) as count FROM public.cut_plans WHERE fabric = 'Algodao Teste 21';`);
    expect(Number(planCount.rows[0].count)).toBe(1);

    const auditCount = await db.query(`SELECT count(*) as count FROM public.pcp_audit_log WHERE acao = 'CRIAR_PLANO_CORTE';`);
    expect(Number(auditCount.rows[0].count)).toBe(1);
  });

  it('22. pcp_tx_release_cut_plan: falha na auditoria provoca rollback atômico e impede transição para CUT_RELEASED', async () => {
    // 22.1 Obter id do plano criado
    const planRes = await db.query(`SELECT id FROM public.cut_plans WHERE fabric = 'Algodao Teste 21' LIMIT 1;`);
    const planId = Number(planRes.rows[0].id);

    // 22.2 Instalar gatilho de falha na auditoria de release
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_release_cut_plan()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'LIBERAR_PLANO_CORTE' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_RELEASE_PLAN: Falha induzida na liberação do plano de corte';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_release_cut_plan
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_release_cut_plan();
    `);

    // 22.3 Executar sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_release_cut_plan(
          p_plan_id := ${planId},
          p_user_id := 1,
          p_idempotency_key := 'cut_rel_fail_22'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_RELEASE_PLAN');
    }
    expect(errorCaught).toBe(true);

    // 22.4 Comprovar rollback: plano e itens devem permanecer em PENDING_CUT
    const planAfterFail = await db.query(`SELECT status FROM public.cut_plans WHERE id = ${planId};`);
    expect(planAfterFail.rows[0].status).toBe('PENDING_CUT');

    const itemsAfterFail = await db.query(`SELECT status FROM public.cut_plan_items WHERE plan_id = ${planId};`);
    expect(itemsAfterFail.rows[0].status).toBe('PENDING_CUT');

    const movFail = await db.query(`SELECT count(*) as count FROM public.production_movements WHERE plan_id = ${planId} AND movement_type = 'CUT_RELEASED';`);
    expect(Number(movFail.rows[0].count)).toBe(0);

    // 22.5 Remover trigger e executar com sucesso
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_release_cut_plan ON public.pcp_audit_log;`);

    const relRes = await db.query(`
      SELECT public.pcp_tx_release_cut_plan(
        p_plan_id := ${planId},
        p_user_id := 1,
        p_idempotency_key := 'cut_rel_succ_22'
      ) AS res;
    `);
    const relJson = typeof relRes.rows[0].res === 'string' ? JSON.parse(relRes.rows[0].res) : relRes.rows[0].res;
    expect(relJson.success).toBe(true);
    expect(relJson.status).toBe('CUT_RELEASED');

    const planAfterSucc = await db.query(`SELECT status FROM public.cut_plans WHERE id = ${planId};`);
    expect(planAfterSucc.rows[0].status).toBe('CUT_RELEASED');

    const itemsAfterSucc = await db.query(`SELECT status FROM public.cut_plan_items WHERE plan_id = ${planId};`);
    expect(itemsAfterSucc.rows[0].status).toBe('CUT_RELEASED');

    const movSucc = await db.query(`SELECT count(*) as count FROM public.production_movements WHERE plan_id = ${planId} AND movement_type = 'CUT_RELEASED';`);
    expect(Number(movSucc.rows[0].count)).toBe(1);
  });

  it('23. pcp_tx_complete_cut_plan: falha na auditoria provoca rollback atômico e impede conclusão do corte', async () => {
    const planRes = await db.query(`SELECT id FROM public.cut_plans WHERE fabric = 'Algodao Teste 21' LIMIT 1;`);
    const planId = Number(planRes.rows[0].id);

    // 23.1 Instalar gatilho de falha
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_complete_cut()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'CONCLUIR_CORTE_PLANO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_COMPLETE_CUT: Falha induzida na conclusão do corte';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_complete_cut
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_complete_cut();
    `);

    // 23.2 Executar sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_complete_cut_plan(
          p_plan_id := ${planId},
          p_qty_cut_actual := 8,
          p_user_id := 1,
          p_notes := 'Corte parcial fail',
          p_idempotency_key := 'cut_comp_fail_23'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_COMPLETE_CUT');
    }
    expect(errorCaught).toBe(true);

    // 23.3 Rollback: status permanece CUT_RELEASED
    const planAfterFail = await db.query(`SELECT status, qty_cut FROM public.cut_plans WHERE id = ${planId};`);
    expect(planAfterFail.rows[0].status).toBe('CUT_RELEASED');
    expect(Number(planAfterFail.rows[0].qty_cut || 0)).toBe(0);

    // 23.4 Remover trigger e executar com sucesso
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_complete_cut ON public.pcp_audit_log;`);

    const compRes = await db.query(`
      SELECT public.pcp_tx_complete_cut_plan(
        p_plan_id := ${planId},
        p_qty_cut_actual := 10,
        p_user_id := 1,
        p_notes := 'Corte completo 10 peças',
        p_idempotency_key := 'cut_comp_succ_23'
      ) AS res;
    `);
    const compJson = typeof compRes.rows[0].res === 'string' ? JSON.parse(compRes.rows[0].res) : compRes.rows[0].res;
    expect(compJson.success).toBe(true);
    expect(compJson.status).toBe('CUT_COMPLETED');
    expect(Number(compJson.qty_cut)).toBe(10);
  });

  it('24. pcp_tx_send_cut_plan_sewing: falha na auditoria provoca rollback atômico e impede envio para costura', async () => {
    const planRes = await db.query(`SELECT id FROM public.cut_plans WHERE fabric = 'Algodao Teste 21' LIMIT 1;`);
    const planId = Number(planRes.rows[0].id);

    // 24.1 Instalar gatilho de falha
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_send_sewing()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'ENVIAR_COSTURA_PLANO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_SEND_SEWING: Falha induzida no envio para costura';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_send_sewing
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_send_sewing();
    `);

    // 24.2 Executar sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_send_cut_plan_sewing(
          p_plan_id := ${planId},
          p_qty_sewing := 10,
          p_user_id := 1,
          p_notes := 'Envio costura fail',
          p_idempotency_key := 'send_sew_fail_24'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_SEND_SEWING');
    }
    expect(errorCaught).toBe(true);

    // 24.3 Rollback: status permanece CUT_COMPLETED
    const planAfterFail = await db.query(`SELECT status FROM public.cut_plans WHERE id = ${planId};`);
    expect(planAfterFail.rows[0].status).toBe('CUT_COMPLETED');

    // 24.4 Remover trigger e executar com sucesso
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_send_sewing ON public.pcp_audit_log;`);

    const sendRes = await db.query(`
      SELECT public.pcp_tx_send_cut_plan_sewing(
        p_plan_id := ${planId},
        p_qty_sewing := 10,
        p_user_id := 1,
        p_notes := 'Enviado para facção',
        p_idempotency_key := 'send_sew_succ_24'
      ) AS res;
    `);
    const sendJson = typeof sendRes.rows[0].res === 'string' ? JSON.parse(sendRes.rows[0].res) : sendRes.rows[0].res;
    expect(sendJson.success).toBe(true);
    expect(sendJson.status).toBe('IN_SEWING');
  });

  it('25. pcp_tx_return_cut_plan_sewing: falha na auditoria provoca rollback atômico e impede avanço do retorno', async () => {
    const planRes = await db.query(`SELECT id FROM public.cut_plans WHERE fabric = 'Algodao Teste 21' LIMIT 1;`);
    const planId = Number(planRes.rows[0].id);

    // 25.1 Instalar gatilho de falha
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_return_sewing()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'RETORNO_COSTURA_PLANO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_RET_SEWING: Falha induzida no retorno da costura';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_return_sewing
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_return_sewing();
    `);

    // 25.2 Executar sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_return_cut_plan_sewing(
          p_plan_id := ${planId},
          p_qty_returned := 10,
          p_user_id := 1,
          p_notes := 'Retorno fail',
          p_idempotency_key := 'ret_sew_fail_25'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_RET_SEWING');
    }
    expect(errorCaught).toBe(true);

    // 25.3 Rollback: status permanece IN_SEWING e qty_sewing_done é 0
    const planAfterFail = await db.query(`SELECT status, qty_sewing_done FROM public.cut_plans WHERE id = ${planId};`);
    expect(planAfterFail.rows[0].status).toBe('IN_SEWING');
    expect(Number(planAfterFail.rows[0].qty_sewing_done || 0)).toBe(0);

    // 25.4 Remover trigger e executar com sucesso
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_return_sewing ON public.pcp_audit_log;`);

    const retRes = await db.query(`
      SELECT public.pcp_tx_return_cut_plan_sewing(
        p_plan_id := ${planId},
        p_qty_returned := 10,
        p_user_id := 1,
        p_notes := '100% retornado da costura',
        p_idempotency_key := 'ret_sew_succ_25'
      ) AS res;
    `);
    const retJson = typeof retRes.rows[0].res === 'string' ? JSON.parse(retRes.rows[0].res) : retRes.rows[0].res;
    expect(retJson.success).toBe(true);
    expect(retJson.status).toBe('SEWING_COMPLETED');
    expect(Number(retJson.qty_returned)).toBe(10);
  });

  it('26. pcp_tx_cancel_cut_plan: cancelamento transacional com rollback e restauração', async () => {
    // 26.1 Criar plano auxiliar para teste de cancelamento
    const newPlanRes = await db.query(`
      SELECT public.pcp_tx_create_cut_plan(
        p_fabric := 'Moletom Teste 26',
        p_color := 'Cinza',
        p_tipo_tecido := 'Moletom',
        p_largura_util := '1.80',
        p_items := '[{"order_id":702,"order_number":"PED-702","sku":"SKU-702","product_type":"Moletom 26","size":"G","item_key":"MOL-702-G","quantity_planned":15}]'::jsonb,
        p_notes := 'Plano para teste cancelamento',
        p_user_id := 1,
        p_idempotency_key := 'cut_create_succ_26'
      ) AS res;
    `);
    const newPlanJson = typeof newPlanRes.rows[0].res === 'string' ? JSON.parse(newPlanRes.rows[0].res) : newPlanRes.rows[0].res;
    const planId = Number(newPlanJson.id || newPlanJson.plan?.id);

    // 26.2 Instalar gatilho de falha na auditoria de cancelamento
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_cancel_plan()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'CANCELAR_PLANO_CORTE' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_CANCEL_PLAN: Falha induzida no cancelamento';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_cancel_plan
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_cancel_plan();
    `);

    // 26.3 Executar cancelamento sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_cancel_cut_plan(
          p_plan_id := ${planId},
          p_user_id := 1,
          p_reason := 'Motivo teste falha',
          p_idempotency_key := 'cut_canc_fail_26'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_CANCEL_PLAN');
    }
    expect(errorCaught).toBe(true);

    // Rollback: status permanece PENDING_CUT
    const planAfterFail = await db.query(`SELECT status FROM public.cut_plans WHERE id = ${planId};`);
    expect(planAfterFail.rows[0].status).toBe('PENDING_CUT');

    // 26.4 Remover trigger e cancelar com sucesso
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_cancel_plan ON public.pcp_audit_log;`);

    const cancRes = await db.query(`
      SELECT public.pcp_tx_cancel_cut_plan(
        p_plan_id := ${planId},
        p_user_id := 1,
        p_reason := 'Cancelamento aprovado',
        p_idempotency_key := 'cut_canc_succ_26'
      ) AS res;
    `);
    const cancJson = typeof cancRes.rows[0].res === 'string' ? JSON.parse(cancRes.rows[0].res) : cancRes.rows[0].res;
    expect(cancJson.success).toBe(true);
    expect(cancJson.status).toBe('CANCELLED');

    const planAfterSucc = await db.query(`SELECT status FROM public.cut_plans WHERE id = ${planId};`);
    expect(planAfterSucc.rows[0].status).toBe('CANCELLED');
  });

  it('27. pcp_tx_reset_production: integridade atômica com confirmação de perfil Administrador, texto explícito e rollback 100% diante de falha induzida', async () => {
    // 27.1 Inserir registros para reset
    await db.exec(`
      INSERT INTO public.stage_executions (id, order_id, stage_id, user_id, status) VALUES (9001, 500, 10, 1, 'Pausada') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.pauses (id, execution_id, start_pause) VALUES (9001, 9001, NOW()) ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.order_progress_logs (id, order_id, stage_id, user_id) VALUES (9001, 500, 10, 1) ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.order_loss_logs (id, order_id, stage_id, user_id, quantidade_perdida, motivo) VALUES (9001, 500, 10, 1, 2, 'Defeito Reset') ON CONFLICT (id) DO NOTHING;
      UPDATE public.orders SET total_time_seconds = 3600 WHERE id = 500;
    `);

    // 27.2 Validar bloqueio de não-administrador
    let nonAdminError = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_reset_production(
          p_confirmation_text := 'RESETAR_PRODUCAO_CONFIRMADO',
          p_user_id := 20
        );
      `);
    } catch (err: any) {
      nonAdminError = true;
      expect(err.message).toContain('INSUFFICIENT_ROLE');
    }
    expect(nonAdminError).toBe(true);

    // 27.3 Validar rejeição de texto de confirmação inválido
    let invalidTextError = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_reset_production(
          p_confirmation_text := 'TEXTO_ERRADO',
          p_user_id := 1
        );
      `);
    } catch (err: any) {
      invalidTextError = true;
      expect(err.message).toContain('CONFIRMATION_TEXT_INVALID');
    }
    expect(invalidTextError).toBe(true);

    // 27.4 Instalar gatilho de falha forçada no meio do reset (na auditoria)
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_reset_prod()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'RESET_PRODUCAO' THEN
          RAISE EXCEPTION 'INTENTIONAL_FAILURE_MID_RESET: Falha forçada no meio do reset para testar rollback integral';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_reset_prod
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_reset_prod();
    `);

    // 27.5 Executar tentativa de reset que falha
    let midResetError = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_reset_production(
          p_confirmation_text := 'RESETAR_PRODUCAO_CONFIRMADO',
          p_user_id := 1
        );
      `);
    } catch (err: any) {
      midResetError = true;
      expect(err.message).toContain('INTENTIONAL_FAILURE_MID_RESET');
    }
    expect(midResetError).toBe(true);

    // 27.6 COMPROVAR ROLLBACK 100%: nada foi apagado ou zerado
    const pauseCount = await db.query(`SELECT count(*) as count FROM public.pauses WHERE id = 9001;`);
    expect(Number(pauseCount.rows[0].count)).toBe(1);

    const progLogCount = await db.query(`SELECT count(*) as count FROM public.order_progress_logs WHERE id = 9001;`);
    expect(Number(progLogCount.rows[0].count)).toBe(1);

    const lossLogCount = await db.query(`SELECT count(*) as count FROM public.order_loss_logs WHERE id = 9001;`);
    expect(Number(lossLogCount.rows[0].count)).toBe(1);

    const orderTime = await db.query(`SELECT total_time_seconds FROM public.orders WHERE id = 500;`);
    expect(Number(orderTime.rows[0].total_time_seconds)).toBe(3600);

    // 27.7 Remover gatilho e executar reset com sucesso
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_reset_prod ON public.pcp_audit_log;`);

    const resetSuccess = await db.query(`
      SELECT public.pcp_tx_reset_production(
        p_confirmation_text := 'RESETAR_PRODUCAO_CONFIRMADO',
        p_user_id := 1
      ) AS res;
    `);
    const resetJson = typeof resetSuccess.rows[0].res === 'string' ? JSON.parse(resetSuccess.rows[0].res) : resetSuccess.rows[0].res;
    expect(resetJson.success).toBe(true);

    // Verificar que registros de produção foram zerados e auditoria gravada
    const pauseCountAfter = await db.query(`SELECT count(*) as count FROM public.pauses;`);
    expect(Number(pauseCountAfter.rows[0].count)).toBe(0);

    const orderTimeAfter = await db.query(`SELECT total_time_seconds FROM public.orders WHERE id = 500;`);
    expect(Number(orderTimeAfter.rows[0].total_time_seconds)).toBe(0);

    const auditReset = await db.query(`SELECT count(*) as count FROM public.pcp_audit_log WHERE acao = 'RESET_PRODUCAO';`);
    expect(Number(auditReset.rows[0].count)).toBe(1);
  });

  it('28. pcp_tx_cancel_order: cancelamento atômico de pedido com histórico, realocação, rollback integral e eliminação de falsificação de ator', async () => {
    // 28.1 Inserir pedido para cancelamento
    await db.exec(`
      INSERT INTO public.orders (id, order_number, client_name, quantity, status)
      VALUES (801, 'PED-CANCEL-801', 'Cliente Cancel Test', 50, 'Entrada')
      ON CONFLICT (id) DO UPDATE SET status = 'Entrada', deleted_at = NULL;
    `);

    // 28.2 Instalar gatilho de falha na auditoria de cancelamento
    await db.exec(`
      CREATE OR REPLACE FUNCTION trigger_fail_cancel_order()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.acao = 'CANCELAR_PEDIDO' THEN
          RAISE EXCEPTION 'INTENTIONAL_AUDIT_FAILURE_CANCEL_ORDER: Falha induzida no cancelamento do pedido';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_test_fail_cancel_order
      BEFORE INSERT ON public.pcp_audit_log
      FOR EACH ROW EXECUTE FUNCTION trigger_fail_cancel_order();
    `);

    // 28.3 Executar sob falha
    let errorCaught = false;
    try {
      await db.query(`
        SELECT public.pcp_tx_cancel_order(
          p_order_id := 801,
          p_user_id := 1,
          p_reason := 'Cancelamento teste falha',
          p_idempotency_key := 'ord_canc_fail_28'
        );
      `);
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('INTENTIONAL_AUDIT_FAILURE_CANCEL_ORDER');
    }
    expect(errorCaught).toBe(true);

    // Rollback: status do pedido permanece Entrada e nenhum order_history de cancelamento
    const orderFail = await db.query(`SELECT status FROM public.orders WHERE id = 801;`);
    expect(orderFail.rows[0].status).toBe('Entrada');

    const histFail = await db.query(`SELECT count(*) as count FROM public.order_history WHERE order_id = 801 AND acao = 'cancelou';`);
    expect(Number(histFail.rows[0].count)).toBe(0);

    // 28.4 Remover trigger e cancelar com sucesso usando Administrador autêntico
    await db.exec(`DROP TRIGGER IF EXISTS trg_test_fail_cancel_order ON public.pcp_audit_log;`);

    const cancRes = await db.query(`
      SELECT public.pcp_tx_cancel_order(
        p_order_id := 801,
        p_user_id := 1,
        p_reason := 'Cancelado pelo cliente',
        p_idempotency_key := 'ord_canc_succ_28'
      ) AS res;
    `);
    const cancJson = typeof cancRes.rows[0].res === 'string' ? JSON.parse(cancRes.rows[0].res) : cancRes.rows[0].res;
    expect(cancJson.success).toBe(true);
    expect(cancJson.status).toBe('Cancelado');

    // 28.5 Comprovar persistência atômica no banco
    const orderSucc = await db.query(`SELECT status, cancelled_by FROM public.orders WHERE id = 801;`);
    expect(orderSucc.rows[0].status).toBe('Cancelado');
    expect(orderSucc.rows[0].cancelled_by).toBe('Admin Teste');

    // 28.6 Comprovar histórico e auditoria com ator real (Anti-Spoofing comprovado)
    const histSucc = await db.query(`SELECT usuario, acao FROM public.order_history WHERE order_id = 801 AND acao = 'cancelou';`);
    expect(histSucc.rows.length).toBe(1);
    expect(histSucc.rows[0].usuario).toBe('Admin Teste'); // Nome real do banco, não spoofável

    const auditSucc = await db.query(`SELECT user_id, usuario, acao FROM public.pcp_audit_log WHERE acao = 'CANCELAR_PEDIDO' AND order_id = 801;`);
    expect(auditSucc.rows.length).toBe(1);
    expect(Number(auditSucc.rows[0].user_id)).toBe(1);
    expect(auditSucc.rows[0].usuario).toBe('Admin Teste');
  });
});
