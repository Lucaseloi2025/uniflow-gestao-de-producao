-- ============================================================================
-- SCRIPT DE PÓS-VALIDAÇÃO DA FASE 1 — 100% SOMENTE LEITURA
-- Arquivo: supabase/postcheck_phase1_production.sql
-- Propósito: Verificar a integridade do banco após a aplicação da migration
-- 20261018_phase1_deploy_complete.sql no Supabase de Produção.
-- ============================================================================

-- 1. VERIFICAÇÃO DE TABELAS CRÍTICAS DA FASE 1
WITH required_tables AS (
  SELECT unnest(ARRAY[
    'users', 'orders', 'stages', 'stage_executions', 'order_stage_progress',
    'order_items', 'order_item_stage_progress', 'idempotency_requests',
    'pcp_audit_log', 'order_progress_logs', 'order_loss_logs', 'pauses'
  ]) AS table_name
),
table_check AS (
  SELECT 
    rt.table_name,
    EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = rt.table_name
    ) AS table_exists
  FROM required_tables rt
)
SELECT '1. TABELAS CRÍTICAS' AS secao, table_name, table_exists
FROM table_check;

-- 2. VERIFICAÇÃO DAS 6 RPCS OFICIAIS DA FASE 1
WITH required_rpcs AS (
  SELECT unnest(ARRAY[
    'rpc_start_operation',
    'rpc_pause_operation',
    'rpc_resume_operation',
    'rpc_record_production',
    'rpc_finish_operation',
    'rpc_record_loss'
  ]) AS rpc_name
),
rpc_check AS (
  SELECT 
    rr.rpc_name,
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = rr.rpc_name
    ) AS rpc_exists
  FROM required_rpcs rr
)
SELECT '2. RPCS OFICIAIS' AS secao, rpc_name, rpc_exists
FROM rpc_check;

-- 3. VERIFICAÇÃO DO CONSTRAINT DOS SEIS PERFIS EM USERS
SELECT '3. CONSTRAINT DE ROLES' AS secao,
       conname AS constraint_name,
       pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'users' AND c.conname = 'users_role_check';

-- 4. VERIFICAÇÃO DE PERMISSÕES REST Guard (ANON NÃO DEVE EXECUTAR RPCS)
SELECT '4. PERMISSÕES ANON EM RPCS' AS secao,
       p.proname AS rpc_name,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'rpc_start_operation', 'rpc_pause_operation', 'rpc_resume_operation',
  'rpc_record_production', 'rpc_finish_operation', 'rpc_record_loss'
);

-- 5. VERIFICAÇÃO DE RLS NAS TABELAS CRÍTICAS
SELECT '5. STATUS DO RLS' AS secao,
       tablename,
       rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'orders', 'stage_executions', 'order_stage_progress', 'pcp_audit_log', 'idempotency_requests'
);

-- 6. CONTAGENS ATUAIS PÓS-MIGRATION
SELECT '6. CONTAGENS PÓS-MIGRATION' AS secao, 'users' AS tabela, count(*)::bigint AS total FROM public.users
UNION ALL
SELECT '6. CONTAGENS PÓS-MIGRATION', 'orders', count(*)::bigint FROM public.orders
UNION ALL
SELECT '6. CONTAGENS PÓS-MIGRATION', 'stages', count(*)::bigint FROM public.stages
UNION ALL
SELECT '6. CONTAGENS PÓS-MIGRATION', 'stage_executions', count(*)::bigint FROM public.stage_executions
UNION ALL
SELECT '6. CONTAGENS PÓS-MIGRATION', 'order_items', count(*)::bigint FROM public.order_items
UNION ALL
SELECT '6. CONTAGENS PÓS-MIGRATION', 'pcp_audit_log', count(*)::bigint FROM public.pcp_audit_log;

-- 7. VEREDITO CONSOLIDADO DO PÓS-CHECK
WITH checks AS (
  SELECT 
    -- Todas as tabelas existem?
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (
      'users', 'orders', 'stages', 'stage_executions', 'order_stage_progress',
      'order_items', 'idempotency_requests', 'pcp_audit_log'
    )) = 8 AS all_tables_exist,
    -- Todas as RPCs existem?
    (SELECT count(DISTINCT p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname IN (
      'rpc_start_operation', 'rpc_pause_operation', 'rpc_resume_operation',
      'rpc_record_production', 'rpc_finish_operation', 'rpc_record_loss'
    )) = 6 AS all_rpcs_exist,
    -- users_role_check existe?
    EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = 'users' AND c.conname = 'users_role_check') AS role_constraint_exists,
    -- Anon bloqueado em rpc_start_operation?
    NOT has_function_privilege('anon', 'public.rpc_start_operation(bigint,bigint,bigint,bigint,boolean,text)'::regprocedure, 'EXECUTE') AS anon_blocked_start
)
SELECT 
  '7. VEREDITO PÓS-CHECK' AS secao,
  CASE 
    WHEN all_tables_exist AND all_rpcs_exist AND role_constraint_exists AND anon_blocked_start THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  CASE 
    WHEN all_tables_exist AND all_rpcs_exist AND role_constraint_exists AND anon_blocked_start 
    THEN 'SUCESSO: ESTRUTURA DA FASE 1 TOTALMENTE APLICADA E VALIDADA COM RLS E PRIVILÉGIOS CORRETOS.'
    ELSE 'FALHA: UMA OU MAIS VERIFICAÇÕES PÓS-MIGRATION NÃO PASSARAM.'
  END AS mensagem
FROM checks;
