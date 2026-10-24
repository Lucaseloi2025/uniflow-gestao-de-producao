-- ============================================================================
-- MIGRATION ADITIVA E NÃO-DESTRUTIVA DE HOMOLOGAÇÃO (FASE 2 / MÉTRICAS E ETAPAS)
-- Segurança: Nenhuma tabela ou dado existente é removido. Apenas adiciona
-- colunas ausentes com IF NOT EXISTS e atualiza as RPCs de saldo por etapa.
-- ============================================================================

BEGIN;

-- 1. Colunas aditivas em public.stages (slug e meta_diaria)
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS slug TEXT NULL,
  ADD COLUMN IF NOT EXISTS meta_diaria NUMERIC NULL;

-- 2. Colunas aditivas de invalidação auditada (caso ainda não aplicadas)
ALTER TABLE public.order_progress_logs
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invalidated_by BIGINT NULL,
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT NULL;

ALTER TABLE public.stage_executions
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invalidated_by BIGINT NULL,
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT NULL;

-- 3. Garantir que Ficha de aprovação utilize calculation_type = 'por_pedido'
UPDATE public.stages
SET calculation_type = 'por_pedido',
    slug = COALESCE(slug, 'FICHA_APROVACAO')
WHERE (LOWER(name) LIKE '%ficha%' OR LOWER(name) LIKE '%aprova%')
  AND COALESCE(calculation_type, '') <> 'por_pedido';

-- 4. Garantir que etapas DTF utilizem calculation_type = 'por_kit_dtf' e estejam ativas
UPDATE public.stages
SET calculation_type = 'por_kit_dtf',
    slug = COALESCE(slug, 'DTF'),
    active = 1
WHERE LOWER(name) LIKE '%dtf%';

COMMIT;
