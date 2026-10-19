-- ============================================================================
-- PROCOMFORT - SCRIPT DE DIAGNÓSTICO E PREFLIGHT DA FASE 1 (DIAGNÓSTICO NÃO PERSISTENTE)
-- Arquivo: supabase/preflight_phase1_check.sql
-- Sistema: Comfort Uniformes (Uniflow / ProComfort)
-- Características: Não realiza alterações persistentes nos dados de negócio (utiliza tabelas temporárias descartáveis de sessão), resiliente a schemas pré-existentes/legados
-- Resultado final garantido: PASS ou BLOCKED com detalhamento de impeditivos.
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'INICIANDO AUDITORIA PREFLIGHT RESILIENTE - PROCOMFORT FASE 1';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE '============================================================';
END $$;

-- 1. Diagnóstico do Ambiente PostgreSQL e Fuso Horário
SELECT
  version() AS postgres_version,
  current_setting('TIMEZONE') AS current_timezone,
  NOW() AS current_timestamp_utc,
  NOW() AT TIME ZONE 'America/Sao_Paulo' AS current_timestamp_sp;

-- 2. Tabela Temporária para Acúmulo de Impeditivos (não realiza alterações persistentes nos dados de negócio)
CREATE TEMP TABLE IF NOT EXISTS _preflight_audit_results (
  id SERIAL PRIMARY KEY,
  categoria TEXT NOT NULL,
  severidade TEXT NOT NULL, -- 'BLOCKER' ou 'WARNING'
  descricao TEXT NOT NULL,
  detalhes JSONB
) ON COMMIT PRESERVE ROWS;

TRUNCATE _preflight_audit_results;

-- 3. Verificação Resiliente: Papéis de Usuários (public.users)
-- Regra: Apenas valores legados mapeáveis são permitidos. Qualquer perfil desconhecido (ex: Financeiro, Estoque) bloqueia.
DO $$
DECLARE
  v_rec RECORD;
  v_unknown_roles TEXT[] := '{}';
  v_users_json JSONB := '[]'::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    FOR v_rec IN (
      SELECT id, name, role
      FROM public.users
      WHERE role NOT IN (
        'Administrador', 'PCP', 'Supervisor', 'Operador', 'Comercial', 'Visualização',
        'Admin', 'admin', 'ADMIN',
        'Produção', 'producao', 'Producao', 'Operador de Produção', 'OP', 'OPERADOR',
        'Visualizacao', 'Viewer', 'Leitura'
      )
      AND role NOT ILIKE 'admin%'
      AND role NOT ILIKE 'produ%'
      AND role NOT ILIKE 'supervis%'
      AND role NOT ILIKE 'pcp%'
      AND role NOT ILIKE 'comercial%'
      AND role NOT ILIKE 'visuali%'
    ) LOOP
      v_unknown_roles := array_append(v_unknown_roles, v_rec.role);
      v_users_json := v_users_json || jsonb_build_object('id', v_rec.id, 'name', v_rec.name, 'role', v_rec.role);
    END LOOP;

    IF array_length(v_unknown_roles, 1) > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'PERFIS_USUARIOS',
        'BLOCKER',
        format('Existem %s usuários com perfis desconhecidos que exigem decisão manual antes da migration.', jsonb_array_length(v_users_json)),
        v_users_json
      );
    END IF;
  ELSE
    INSERT INTO _preflight_audit_results (categoria, severidade, descricao)
    VALUES ('TABELA_USERS', 'BLOCKER', 'Tabela public.users não encontrada no banco.');
  END IF;
END $$;

-- 4. Verificação Resiliente: Integridade de Usuários e E-mails em public.users
DO $$
DECLARE
  v_dup_email_count INT := 0;
  v_dup_email_json JSONB := '[]'::jsonb;
  v_empty_email_count INT := 0;
  v_empty_email_json JSONB := '[]'::jsonb;
  v_dup_auth_id_count INT := 0;
  v_dup_auth_id_json JSONB := '[]'::jsonb;
  v_has_auth_col BOOLEAN;
  v_has_active_col BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
    ) INTO v_has_auth_col;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'active'
    ) INTO v_has_active_col;

    -- 4.1 E-mails normalizados duplicados em public.users
    EXECUTE '
      SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
      FROM (
        SELECT LOWER(TRIM(email)) AS email_norm, COUNT(*) AS total, jsonb_agg(jsonb_build_object(''id'', id, ''name'', name)) AS users
        FROM public.users
        WHERE email IS NOT NULL AND TRIM(email) <> ''''
        GROUP BY LOWER(TRIM(email))
        HAVING COUNT(*) > 1
      ) sub'
    INTO v_dup_email_count, v_dup_email_json;

    IF v_dup_email_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'USUARIOS_EMAIL_DUPLICADO',
        'BLOCKER',
        format('Existem %s e-mails normalizados duplicados na tabela public.users.', v_dup_email_count),
        v_dup_email_json
      );
    END IF;

    -- 4.2 Usuários ativos com e-mail vazio ou nulo
    IF v_has_active_col THEN
      EXECUTE '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT id, name, role
          FROM public.users
          WHERE active = 1 AND (email IS NULL OR TRIM(email) = '''')
        ) sub'
      INTO v_empty_email_count, v_empty_email_json;
    ELSE
      EXECUTE '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT id, name, role
          FROM public.users
          WHERE email IS NULL OR TRIM(email) = ''''
        ) sub'
      INTO v_empty_email_count, v_empty_email_json;
    END IF;

    IF v_empty_email_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'USUARIOS_ATIVOS_EMAIL_VAZIO',
        'BLOCKER',
        format('Existem %s usuários ativos sem e-mail preenchido no cadastro.', v_empty_email_count),
        v_empty_email_json
      );
    END IF;

    -- 4.3 auth_user_id duplicado em public.users (se a coluna existir)
    IF v_has_auth_col THEN
      EXECUTE '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT auth_user_id, COUNT(*) AS total, jsonb_agg(jsonb_build_object(''id'', id, ''name'', name)) AS users
          FROM public.users
          WHERE auth_user_id IS NOT NULL
          GROUP BY auth_user_id
          HAVING COUNT(*) > 1
        ) sub'
      INTO v_dup_auth_id_count, v_dup_auth_id_json;

      IF v_dup_auth_id_count > 0 THEN
        INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
        VALUES (
          'AUTH_USER_ID_DUPLICADO',
          'BLOCKER',
          format('Existem %s auth_user_id duplicados na tabela users que violariam a unicidade.', v_dup_auth_id_count),
          v_dup_auth_id_json
        );
      END IF;
    END IF;
  END IF;
END $$;

-- 5. Verificação de Integração com Supabase Auth (auth.users)
DO $$
DECLARE
  v_dup_auth_email_count INT := 0;
  v_dup_auth_email_json JSONB := '[]'::jsonb;
  v_unlinked_active_count INT := 0;
  v_unlinked_active_json JSONB := '[]'::jsonb;
  v_unlinked_inactive_count INT := 0;
  v_unlinked_inactive_json JSONB := '[]'::jsonb;
  v_orphan_auth_count INT := 0;
  v_orphan_auth_json JSONB := '[]'::jsonb;
  v_has_active_col BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'active'
    ) INTO v_has_active_col;

    -- 5.1 E-mails duplicados em auth.users
    EXECUTE '
      SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
      FROM (
        SELECT LOWER(TRIM(email)) AS email_norm, COUNT(*) AS total
        FROM auth.users
        WHERE email IS NOT NULL AND TRIM(email) <> ''''
        GROUP BY LOWER(TRIM(email))
        HAVING COUNT(*) > 1
      ) sub'
    INTO v_dup_auth_email_count, v_dup_auth_email_json;

    IF v_dup_auth_email_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'AUTH_USERS_EMAIL_DUPLICADO',
        'BLOCKER',
        format('Existem %s e-mails duplicados em auth.users impedindo vínculo unívoco.', v_dup_auth_email_count),
        v_dup_auth_email_json
      );
    END IF;

    -- 5.2 Usuários ATIVOS sem correspondência única em auth.users (BLOCKER)
    IF v_has_active_col THEN
      EXECUTE '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT u.id, u.name, u.email, u.role
          FROM public.users u
          LEFT JOIN (
            SELECT LOWER(TRIM(email)) AS email_norm, COUNT(*) AS matches, (jsonb_agg(id))[0] AS auth_id
            FROM auth.users
            WHERE email IS NOT NULL AND TRIM(email) <> ''''
            GROUP BY LOWER(TRIM(email))
          ) au ON LOWER(TRIM(u.email)) = au.email_norm AND au.matches = 1
          WHERE u.active = 1 AND au.auth_id IS NULL
        ) sub'
      INTO v_unlinked_active_count, v_unlinked_active_json;
    ELSE
      EXECUTE '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT u.id, u.name, u.email, u.role
          FROM public.users u
          LEFT JOIN (
            SELECT LOWER(TRIM(email)) AS email_norm, COUNT(*) AS matches, (jsonb_agg(id))[0] AS auth_id
            FROM auth.users
            WHERE email IS NOT NULL AND TRIM(email) <> ''''
            GROUP BY LOWER(TRIM(email))
          ) au ON LOWER(TRIM(u.email)) = au.email_norm AND au.matches = 1
          WHERE au.auth_id IS NULL
        ) sub'
      INTO v_unlinked_active_count, v_unlinked_active_json;
    END IF;

    IF v_unlinked_active_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'AUTH_USERS_SEM_VINCULO',
        'BLOCKER',
        format('Existem %s usuários ativos sem conta correspondente unívoca em auth.users.', v_unlinked_active_count),
        v_unlinked_active_json
      );
    END IF;

    -- 5.3 Usuários INATIVOS sem correspondência em auth.users (WARNING permitido pela migração)
    IF v_has_active_col THEN
      EXECUTE '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT u.id, u.name, u.email, u.role
          FROM public.users u
          LEFT JOIN auth.users au ON LOWER(TRIM(u.email)) = LOWER(TRIM(au.email))
          WHERE u.active = 0 AND au.id IS NULL
        ) sub'
      INTO v_unlinked_inactive_count, v_unlinked_inactive_json;

      IF v_unlinked_inactive_count > 0 THEN
        INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
        VALUES (
          'AUTH_USERS_INATIVOS_SEM_VINCULO',
          'WARNING',
          format('Existem %s usuários inativos sem conta no Supabase Auth (permitido pela migration).', v_unlinked_inactive_count),
          v_unlinked_inactive_json
        );
      END IF;
    END IF;

    -- 5.4 Usuários órfãos em auth.users
    EXECUTE '
      SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
      FROM (
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN public.users u ON LOWER(TRIM(au.email)) = LOWER(TRIM(u.email))
        WHERE u.id IS NULL
      ) sub'
    INTO v_orphan_auth_count, v_orphan_auth_json;

    IF v_orphan_auth_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'AUTH_USERS_ORFAOS',
        'WARNING',
        format('Existem %s contas em auth.users sem cadastro na tabela public.users.', v_orphan_auth_count),
        v_orphan_auth_json
      );
    END IF;

  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO _preflight_audit_results (categoria, severidade, descricao)
    VALUES (
      'AUTH_USERS_SCHEMA_AUSENTE',
      'WARNING',
      'Tabela auth.users não detectada no ambiente atual (esperada em ambientes gerenciados Supabase).'
    );
  END IF;
END $$;

-- 6. Verificação Resiliente: Duplicidades que Impedem Constraints Únicas da Fase 1

-- 6.1 order_stage_progress duplicado por (order_id, stage_id)
DO $$
DECLARE
  v_count INT := 0;
  v_json JSONB;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_stage_progress') THEN
    EXECUTE '
      SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
      FROM (
        SELECT order_id, stage_id, COUNT(*) AS total, jsonb_agg(id) AS ids
        FROM public.order_stage_progress
        GROUP BY order_id, stage_id
        HAVING COUNT(*) > 1
      ) sub'
    INTO v_count, v_json;

    IF v_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'ORDER_STAGE_PROGRESS_DUPLICADO',
        'BLOCKER',
        format('Existem %s pares (order_id, stage_id) duplicados em order_stage_progress que violam uq_order_stage_progress.', v_count),
        v_json
      );
    END IF;
  END IF;
END $$;

-- 6.2 order_items duplicado por (order_id, item_index)
DO $$
DECLARE
  v_count INT := 0;
  v_json JSONB;
  v_has_idx BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'item_index'
    ) INTO v_has_idx;

    IF v_has_idx THEN
      EXECUTE '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT order_id, item_index, COUNT(*) AS total, jsonb_agg(id) AS ids
          FROM public.order_items
          WHERE order_id IS NOT NULL AND item_index IS NOT NULL
          GROUP BY order_id, item_index
          HAVING COUNT(*) > 1
        ) sub'
      INTO v_count, v_json;

      IF v_count > 0 THEN
        INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
        VALUES (
          'ORDER_ITEMS_DUPLICADO',
          'BLOCKER',
          format('Existem %s pares (order_id, item_index) duplicados em order_items que violam uq_order_items_order_index.', v_count),
          v_json
        );
      END IF;
    END IF;
  END IF;
END $$;

-- 6.3 order_item_stage_progress duplicado por (order_item_id, stage_id)
DO $$
DECLARE
  v_count INT := 0;
  v_json JSONB;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_item_stage_progress') THEN
    EXECUTE '
      SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
      FROM (
        SELECT order_item_id, stage_id, COUNT(*) AS total, jsonb_agg(id) AS ids
        FROM public.order_item_stage_progress
        GROUP BY order_item_id, stage_id
        HAVING COUNT(*) > 1
      ) sub'
    INTO v_count, v_json;

    IF v_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'ORDER_ITEM_STAGE_PROGRESS_DUPLICADO',
        'BLOCKER',
        format('Existem %s pares (order_item_id, stage_id) duplicados em order_item_stage_progress que violam uq_order_item_stage_progress.', v_count),
        v_json
      );
    END IF;
  END IF;
END $$;

-- 6.4 order_progress_logs com idempotency_key duplicada
DO $$
DECLARE
  v_count INT := 0;
  v_json JSONB;
  v_has_idemp BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_progress_logs') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'order_progress_logs' AND column_name = 'idempotency_key'
    ) INTO v_has_idemp;

    IF v_has_idemp THEN
      EXECUTE '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT idempotency_key, COUNT(*) AS total, jsonb_agg(id) AS ids
          FROM public.order_progress_logs
          WHERE idempotency_key IS NOT NULL AND TRIM(idempotency_key) <> ''''
          GROUP BY idempotency_key
          HAVING COUNT(*) > 1
        ) sub'
      INTO v_count, v_json;

      IF v_count > 0 THEN
        INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
        VALUES (
          'ORDER_PROGRESS_LOGS_IDEMPOTENCY_DUPLICADO',
          'BLOCKER',
          format('Existem %s idempotency_key duplicadas em order_progress_logs que violam o índice único.', v_count),
          v_json
        );
      END IF;
    END IF;
  END IF;
END $$;

-- 6.5 stage_executions com múltiplas sessões ativas para o mesmo operador
DO $$
DECLARE
  v_conc_count INT := 0;
  v_conc_json JSONB;
  v_query TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stage_executions') THEN
    v_query := '
      SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
      FROM (
        SELECT user_id, COUNT(*) AS open_count, jsonb_agg(id) AS execution_ids
        FROM public.stage_executions
        WHERE status IN (''Em andamento'', ''Pausado'')
        GROUP BY user_id
        HAVING COUNT(*) > 1
      ) sub';

    EXECUTE v_query INTO v_conc_count, v_conc_json;

    IF v_conc_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'STAGE_EXECUTIONS_OPERADOR_DUPLICADO',
        'BLOCKER',
        format('Existem %s operadores com múltiplas execuções ativas/pausadas simultâneas.', v_conc_count),
        v_conc_json
      );
    END IF;
  END IF;
END $$;

-- 6.6 stage_executions com múltiplas sessões ativas para o mesmo pedido + etapa + item
DO $$
DECLARE
  v_stage_item_count INT := 0;
  v_stage_item_json JSONB;
  v_has_item_col BOOLEAN;
  v_query TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stage_executions') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stage_executions' AND column_name = 'order_item_id'
    ) INTO v_has_item_col;

    IF v_has_item_col THEN
      v_query := '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT order_id, stage_id, COALESCE(order_item_id, -1) AS item_ref, COUNT(*) AS open_count, jsonb_agg(id) AS execution_ids
          FROM public.stage_executions
          WHERE status IN (''Em andamento'', ''Pausado'')
          GROUP BY order_id, stage_id, COALESCE(order_item_id, -1)
          HAVING COUNT(*) > 1
        ) sub';
    ELSE
      v_query := '
        SELECT COUNT(*), COALESCE(jsonb_agg(sub), ''[]''::jsonb)
        FROM (
          SELECT order_id, stage_id, -1 AS item_ref, COUNT(*) AS open_count, jsonb_agg(id) AS execution_ids
          FROM public.stage_executions
          WHERE status IN (''Em andamento'', ''Pausado'')
          GROUP BY order_id, stage_id
          HAVING COUNT(*) > 1
        ) sub';
    END IF;

    EXECUTE v_query INTO v_stage_item_count, v_stage_item_json;

    IF v_stage_item_count > 0 THEN
      INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
      VALUES (
        'STAGE_EXECUTIONS_ETAPA_ITEM_DUPLICADO',
        'BLOCKER',
        format('Existem %s etapas/itens de pedidos com múltiplas execuções ativas/pausadas simultâneas.', v_stage_item_count),
        v_stage_item_json
      );
    END IF;
  END IF;
END $$;

-- 7. Verificação Resiliente: Pedidos com Rota Ausente ou Corrompida (WARNING)
DO $$
DECLARE
  v_invalid_routes INT := 0;
  v_invalid_json JSONB;
  v_has_del_at BOOLEAN;
  v_has_ord_num BOOLEAN;
  v_has_req_stages BOOLEAN;
  v_sql TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'deleted_at') INTO v_has_del_at;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_number') INTO v_has_ord_num;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'required_stages') INTO v_has_req_stages;

    IF v_has_req_stages THEN
      v_sql := '
        SELECT COUNT(*), jsonb_agg(sub)
        FROM (
          SELECT id, ' || CASE WHEN v_has_ord_num THEN 'order_number' ELSE 'id::text AS order_number' END || ', status
          FROM public.orders
          WHERE status NOT IN (''Cancelado'', ''Entregue'') '
          || CASE WHEN v_has_del_at THEN 'AND deleted_at IS NULL ' ELSE '' END ||
          'AND (required_stages IS NULL OR jsonb_typeof(to_jsonb(required_stages)) <> ''array'' OR jsonb_array_length(to_jsonb(required_stages)) = 0)
        ) sub';

      EXECUTE v_sql INTO v_invalid_routes, v_invalid_json;

      IF v_invalid_routes > 0 THEN
        INSERT INTO _preflight_audit_results (categoria, severidade, descricao, detalhes)
        VALUES (
          'ROTAS_PEDIDOS',
          'WARNING',
          format('Existem %s pedidos ativos sem required_stages configurado.', v_invalid_routes),
          v_invalid_json
        );
      END IF;
    END IF;
  END IF;
END $$;

-- 8. Verificação Resiliente: Pedidos Entregues sem data de conclusão (informativo / migração auto-corrige)
DO $$
DECLARE
  v_orders_no_date INT := 0;
  v_has_prod_fin BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'production_finished_at'
    ) INTO v_has_prod_fin;

    IF v_has_prod_fin THEN
      EXECUTE 'SELECT COUNT(*) FROM public.orders WHERE status = ''Entregue'' AND production_finished_at IS NULL'
      INTO v_orders_no_date;

      IF v_orders_no_date > 0 THEN
        INSERT INTO _preflight_audit_results (categoria, severidade, descricao)
        VALUES (
          'PEDIDOS_ENTREGUES_DATA',
          'WARNING',
          format('%s pedidos entregues sem production_finished_at (a migration preencherá via COALESCE automaticamente).', v_orders_no_date)
        );
      END IF;
    END IF;
  END IF;
END $$;

-- 9. Visualização Detalhada dos Apontamentos do Preflight
SELECT
  id,
  severidade,
  categoria,
  descricao,
  detalhes
FROM _preflight_audit_results
ORDER BY CASE WHEN severidade = 'BLOCKER' THEN 1 ELSE 2 END, id;

-- 10. RESULTADO FINAL DETERMINÍSTICO (PASS OU BLOCKED)
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE severidade = 'BLOCKER') > 0 THEN 'BLOCKED'
    ELSE 'PASS'
  END AS status,
  COUNT(*) FILTER (WHERE severidade = 'BLOCKER') AS total_bloqueadores,
  COUNT(*) FILTER (WHERE severidade = 'WARNING') AS total_avisos,
  CASE
    WHEN COUNT(*) FILTER (WHERE severidade = 'BLOCKER') > 0
      THEN 'MIGRAÇÃO BLOQUEADA: Existem impedimentos impeditivos acima que requerem correção manual antes de executar a migration consolidada.'
    ELSE 'BANCO APTO PARA MIGRAÇÃO DA FASE 1: Nenhuma inconsistência impeditiva detectada.'
  END AS veredito,
  COALESCE(
    jsonb_agg(jsonb_build_object('categoria', categoria, 'descricao', descricao, 'detalhes', detalhes))
    FILTER (WHERE severidade = 'BLOCKER'),
    '[]'::jsonb
  ) AS detalhes_bloqueadores
FROM _preflight_audit_results;
