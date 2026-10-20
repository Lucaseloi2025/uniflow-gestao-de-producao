-- ============================================================================
-- PROCOMFORT - SCRIPT DE PRÉ-VALIDAÇÃO SOMENTE LEITURA PARA PRODUÇÃO (PREFLIGHT)
-- Arquivo: supabase/preflight_phase1_production.sql
-- Sistema: Comfort Uniformes (ProComfort / Uniflow)
-- Características: 100% SOMENTE LEITURA (ZERO INSERTS, UPDATES, DELETES OU DROPS)
-- Objetivo: Auditar o banco de dados antes da aplicação da migration consolidada da Fase 1.
-- ============================================================================

-- ============================================================================
-- 1. VERSÃO DO POSTGRESQL E AMBIENTE
-- ============================================================================
SELECT 
    '1. AMBIENTE' AS secao,
    version() AS postgres_version,
    current_setting('TIMEZONE') AS fuso_horario_atual,
    NOW() AS timestamp_utc,
    NOW() AT TIME ZONE 'America/Sao_Paulo' AS timestamp_sao_paulo,
    current_user AS usuario_db,
    session_user AS usuario_sessao;

-- ============================================================================
-- 2. TABELAS CRÍTICAS EXISTENTES NO SCHEMA PUBLIC
-- ============================================================================
SELECT 
    '2. TABELAS' AS secao,
    t.table_name,
    CASE 
        WHEN t.table_name IN ('orders', 'users', 'stages', 'stage_executions', 'order_stage_progress', 'pauses') THEN 'CRÍTICA LEGADA'
        WHEN t.table_name IN ('order_items', 'order_item_stage_progress', 'idempotency_requests', 'pcp_audit_log', 'pcp_settings', 'pcp_blocks', 'producao_necessidades', 'planos_de_corte', 'corte_allocations') THEN 'FASE 1'
        ELSE 'OUTRA'
    END AS tipo_tabela,
    (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.table_name) AS total_colunas
FROM information_schema.tables t
WHERE t.table_schema = 'public'
ORDER BY tipo_tabela DESC, t.table_name ASC;

-- ============================================================================
-- 3. MIGRATIONS ANTERIORMENTE REGISTRADAS NO SUPABASE
-- ============================================================================
SELECT 
    '3. HISTÓRICO DE MIGRATIONS' AS secao,
    version,
    statements,
    name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;

-- ============================================================================
-- 4. CONTAGEM ATUAL DE REGISTROS EM TABELAS CRÍTICAS (ANTES DA MIGRATION)
-- ============================================================================
SELECT 
    '4. CONTAGEM DE REGISTROS' AS secao,
    tabela,
    total_linhas
FROM (
    SELECT 'public.users' AS tabela, COUNT(*) AS total_linhas FROM public.users
    UNION ALL
    SELECT 'public.stages', COUNT(*) FROM public.stages
    UNION ALL
    SELECT 'public.orders', COUNT(*) FROM public.orders
    UNION ALL
    SELECT 'public.stage_executions', COUNT(*) FROM public.stage_executions
    UNION ALL
    SELECT 'public.order_stage_progress', COUNT(*) FROM public.order_stage_progress
    UNION ALL
    SELECT 'public.pauses', COUNT(*) FROM public.pauses
    UNION ALL
    SELECT 'auth.users', COUNT(*) FROM auth.users
) counts;

-- ============================================================================
-- 5. AUDITORIA DE USUÁRIOS (ROLES, DUPLICIDADES E VÍNCULO AUTH)
-- ============================================================================
-- 5.1 Usuários ativos com e-mail nulo, vazio ou duplicado
SELECT 
    '5.1 USUÁRIOS - VALIDAÇÃO DE EMAIL' AS secao,
    id,
    name,
    email,
    role,
    active,
    CASE 
        WHEN email IS NULL OR trim(email) = '' THEN 'BLOCKER: Email nulo ou vazio em usuário ativo'
        WHEN count(*) OVER(PARTITION BY lower(trim(email))) > 1 THEN 'BLOCKER: Email duplicado'
        ELSE 'OK'
    END AS status_validacao
FROM public.users
WHERE active = 1 AND (email IS NULL OR trim(email) = '' OR id IN (
    SELECT id FROM (
        SELECT id, count(*) OVER(PARTITION BY lower(trim(email))) as cnt FROM public.users WHERE active = 1
    ) sub WHERE cnt > 1
));

-- 5.2 Perfis de Usuário (Roles Legadas vs 6 Perfis Oficiais)
SELECT 
    '5.2 USUÁRIOS - MAPEAMENTO DE ROLES' AS secao,
    role AS role_atual,
    COUNT(*) AS total_usuarios,
    CASE 
        WHEN role IN ('Administrador', 'Supervisor', 'Operador', 'PCP', 'Comercial', 'Visualização') THEN 'OFICIAL'
        WHEN role IN ('Admin', 'admin', 'ADMIN', 'Produção', 'producao', 'Producao', 'Operador de Produção', 'OP', 'OPERADOR', 'Visualizacao', 'Viewer', 'Leitura') THEN 'LEGADO_COMPATIVEL'
        ELSE 'BLOCKER: ROLE DESCONHECIDA'
    END AS conformidade
FROM public.users
GROUP BY role
ORDER BY conformidade ASC, total_usuarios DESC;

-- 5.3 Vínculo de Usuários com auth.users
SELECT 
    '5.3 USUÁRIOS - VÍNCULO AUTH' AS secao,
    COUNT(CASE WHEN u.active = 1 AND au.id IS NOT NULL THEN 1 END) AS ativos_com_auth_user,
    COUNT(CASE WHEN u.active = 1 AND au.id IS NULL THEN 1 END) AS ativos_sem_auth_user,
    COUNT(CASE WHEN u.active = 0 AND au.id IS NULL THEN 1 END) AS inativos_sem_auth_user
FROM public.users u
LEFT JOIN auth.users au ON lower(trim(u.email)) = lower(trim(au.email));

-- ============================================================================
-- 6. AUDITORIA DE ETAPAS (DUPLICIDADES, CÓDIGO/SLUG E SETORES)
-- ============================================================================
SELECT 
    '6. ETAPAS - ANÁLISE DE CONFORMIDADE' AS secao,
    s.id,
    s.name,
    s.sector_name,
    s.sort_order,
    s.active,
    CASE 
        WHEN s.name ILIKE '%corte%' THEN 'CORTE'
        WHEN s.name ILIKE '%costura%' THEN 'COSTURA'
        WHEN s.name ILIKE '%confer%' OR s.name ILIKE '%separa%' THEN 'CONFERENCIA (DESCONTINUADA)'
        ELSE 'OUTRA'
    END AS slug_identificado,
    CASE 
        WHEN count(*) OVER(PARTITION BY lower(trim(s.name))) > 1 THEN 'WARNING: Nome de etapa duplicado'
        ELSE 'OK'
    END AS status_duplicidade
FROM public.stages s
ORDER BY s.sort_order ASC;

-- ============================================================================
-- 7. AUDITORIA DE SESSÕES PRODUTIVAS ABERTAS E CONFLITOS DE ÍNDICES ÚNICOS
-- ============================================================================
-- 7.1 Operadores com mais de uma sessão em andamento simultânea
SELECT 
    '7.1 SESSÕES - DUPLICIDADE POR OPERADOR' AS secao,
    se.user_id,
    u.name AS nome_operador,
    COUNT(*) AS total_sessoes_em_andamento,
    jsonb_agg(jsonb_build_object('execution_id', se.id, 'order_id', se.order_id, 'stage_id', se.stage_id, 'start_time', se.start_time)) AS detalhes_sessoes
FROM public.stage_executions se
LEFT JOIN public.users u ON u.id = se.user_id
WHERE se.status = 'Em andamento'
GROUP BY se.user_id, u.name
HAVING COUNT(*) > 1;

-- 7.2 Conflito potencial com índice único em order_stage_progress (order_id, stage_id)
SELECT 
    '7.2 PROCESSO - DUPLICIDADE EM ORDER_STAGE_PROGRESS' AS secao,
    order_id,
    stage_id,
    COUNT(*) AS total_duplicatas,
    jsonb_agg(jsonb_build_object('quantidade_pedido', quantidade_pedido, 'quantidade_boa', quantidade_boa, 'finished', finished)) AS linhas_duplicadas
FROM public.order_stage_progress
GROUP BY order_id, stage_id
HAVING COUNT(*) > 1;

-- 7.3 Apontamentos em stage_executions sem operador cadastrado
SELECT 
    '7.3 EXECUÇÕES - ÓRFÃS DE OPERADOR' AS secao,
    COUNT(*) AS total_execucoes_sem_usuario_valido
FROM public.stage_executions se
LEFT JOIN public.users u ON u.id = se.user_id
WHERE u.id IS NULL;

-- ============================================================================
-- 8. AUDITORIA DE PEDIDOS ANTIGOS DEPENDENTES DE CONFERÊNCIA
-- ============================================================================
SELECT 
    '8. PEDIDOS - DEPENDÊNCIA DE CONFERÊNCIA' AS secao,
    COUNT(DISTINCT o.id) AS total_pedidos_com_etapa_conferencia,
    COUNT(DISTINCT CASE WHEN o.status NOT IN ('Entregue', 'Cancelado', 'Pronto') THEN o.id END) AS pedidos_ativos_afetados,
    COUNT(DISTINCT CASE WHEN o.status IN ('Entregue', 'Pronto') THEN o.id END) AS pedidos_concluidos_com_conferencia
FROM public.orders o
WHERE o.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(to_jsonb(o.required_stages)) elem
    JOIN public.stages s ON s.id::TEXT = elem
    WHERE s.name ILIKE '%confer%' OR s.name ILIKE '%separa%' OR s.sector_name ILIKE '%confer%'
  );

-- ============================================================================
-- 9. AUDITORIA DE ITENS DE PEDIDOS (ORDER_ITEMS)
-- ============================================================================
SELECT 
    '9. PEDIDOS - ESTRUTURA DE ITENS' AS secao,
    COUNT(CASE WHEN o.items IS NULL OR jsonb_array_length(to_jsonb(o.items)) = 0 THEN 1 END) AS pedidos_sem_itens_json,
    COUNT(CASE WHEN o.items IS NOT NULL AND jsonb_array_length(to_jsonb(o.items)) > 0 THEN 1 END) AS pedidos_com_itens_json,
    COUNT(*) AS total_pedidos
FROM public.orders o
WHERE o.deleted_at IS NULL;

-- ============================================================================
-- 10. ASSINATURAS DE RPCS EXISTENTES (DETECÇÃO DE CONFLITOS DE POLIMORFISMO)
-- ============================================================================
SELECT 
    '10. RPCS EXISTENTES' AS secao,
    p.proname AS nome_funcao,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos,
    pg_catalog.pg_get_function_result(p.oid) AS tipo_retorno,
    CASE 
        WHEN p.proname IN ('rpc_start_operation', 'rpc_pause_operation', 'rpc_resume_operation', 'rpc_finish_operation', 'pcp_apply_stage_progress', 'rpc_record_loss') THEN 'RPC_FASE_1'
        ELSE 'OUTRA'
    END AS categoria
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'rpc_start_operation', 'rpc_pause_operation', 'rpc_resume_operation', 
    'rpc_finish_operation', 'pcp_apply_stage_progress', 'rpc_record_loss',
    'get_orders_with_stages', 'pcp_tx_criar_plano_corte', 'pcp_tx_aprovar_plano_corte'
  )
ORDER BY p.proname ASC;

-- ============================================================================
-- 11. DIAGNÓSTICO CONSOLIDADO SOMENTE LEITURA
-- ============================================================================
WITH audit_summary AS (
    SELECT 
        -- Blocker: usuários ativos sem email ou com email duplicado
        (SELECT count(*) FROM public.users WHERE active = 1 AND (email IS NULL OR trim(email) = '')) AS count_users_sem_email,
        -- Blocker: usuários com role desconhecida
        (SELECT count(*) FROM public.users WHERE active = 1 AND role NOT IN (
            'Administrador', 'Supervisor', 'Operador', 'PCP', 'Comercial', 'Visualização',
            'Admin', 'admin', 'ADMIN', 'Produção', 'producao', 'Producao', 'Operador de Produção',
            'OP', 'OPERADOR', 'Visualizacao', 'Viewer', 'Leitura'
        )) AS count_roles_invalidas,
        -- Warning: sessões duplicadas em andamento
        (SELECT count(*) FROM (
            SELECT user_id FROM public.stage_executions WHERE status = 'Em andamento' GROUP BY user_id HAVING count(*) > 1
        ) sub_sessoes) AS count_operadores_sessao_dupla,
        -- Blocker: duplicidades em order_stage_progress
        (SELECT count(*) FROM (
            SELECT order_id, stage_id FROM public.order_stage_progress GROUP BY order_id, stage_id HAVING count(*) > 1
        ) sub_prog) AS count_duplicatas_progress
)
SELECT 
    '11. VEREDICTO PREFLIGHT' AS secao,
    CASE 
        WHEN count_users_sem_email > 0 THEN 'BLOCKED: Existem usuários ativos sem e-mail cadastrado.'
        WHEN count_roles_invalidas > 0 THEN 'BLOCKED: Existem papéis/roles não reconhecidos em public.users.'
        WHEN count_duplicatas_progress > 0 THEN 'BLOCKED: Existem duplicidades na tabela order_stage_progress que impedem criação de índice único.'
        WHEN count_operadores_sessao_dupla > 0 THEN 'WARNING: Existem operadores com mais de uma sessão aberta em andamento.'
        ELSE 'PASS: NENHUM IMPEDITIVO CRÍTICO ENCONTRADO. BANCO PRONTO PARA A MIGRATION FASE 1.'
    END AS veredicto,
    count_users_sem_email,
    count_roles_invalidas,
    count_operadores_sessao_dupla,
    count_duplicatas_progress
FROM audit_summary;
