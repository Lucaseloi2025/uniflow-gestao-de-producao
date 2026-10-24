-- =====================================================================================
-- MIGRAÇÃO: 20261024_fase2_estabilizacao_execucao.sql
-- OBJETIVO: Estabilização da execução da Fase 2 (Fonte Única de Verdade, Bloqueio de
--           Duplicidade, Saldo Parcial, Slugs Canônicos de Etapas e Bucket 'artes').
-- =====================================================================================

BEGIN;

-- 1. Colunas de invalidação auditável (sem exclusão física de histórico)
ALTER TABLE public.order_progress_logs
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT NULL;

ALTER TABLE public.stage_executions
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT NULL;

-- 2. Coluna slug canônico nas etapas produtivas
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS slug TEXT NULL;

UPDATE public.stages
SET slug = CASE
  WHEN id = 1 OR UPPER(name) LIKE '%FICHA%' OR UPPER(name) LIKE '%APROVA%' THEN 'FICHA_APROVACAO'
  WHEN id = 15 OR UPPER(name) LIKE '%CORTE%' THEN 'CORTE'
  WHEN id = 16 OR UPPER(name) LIKE '%SUBLIMA%' THEN 'SUBLIMACAO'
  WHEN id = 17 OR UPPER(name) LIKE '%ESTAMPA%' THEN 'ESTAMPAGEM'
  WHEN id = 2 OR UPPER(name) LIKE '%SILK%' OR UPPER(name) LIKE '%SERIGRAFIA%' THEN 'SILK'
  WHEN id = 19 OR UPPER(name) LIKE '%DTF%' THEN 'DTF'
  WHEN id = 3 OR UPPER(name) LIKE '%BORDADO%' THEN 'BORDADO'
  WHEN id = 6 OR UPPER(name) LIKE '%COSTURA%' THEN 'COSTURA'
  WHEN id = 11 OR UPPER(name) LIKE '%REVIS%' OR UPPER(name) LIKE '%ACABAMENTO%' THEN 'REVISAO'
  WHEN id = 9 OR UPPER(name) LIKE '%EMBALAGEM%' OR UPPER(name) LIKE '%EXPEDI%' THEN 'EMBALAGEM'
  WHEN id = 12 OR UPPER(name) LIKE '%CONFER%' THEN 'CONFERENCIA'
  ELSE UPPER(REGEXP_REPLACE(name, '[^A-Za-z0-9]+', '_', 'g'))
END
WHERE slug IS NULL OR slug = '';

-- 3. Garantir bucket 'artes' no Supabase Storage e políticas de leitura/upload
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artes',
  'artes',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artes_public_select'
  ) THEN
    CREATE POLICY artes_public_select ON storage.objects
      FOR SELECT USING (bucket_id = 'artes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artes_auth_insert'
  ) THEN
    CREATE POLICY artes_auth_insert ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'artes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artes_auth_update'
  ) THEN
    CREATE POLICY artes_auth_update ON storage.objects
      FOR UPDATE USING (bucket_id = 'artes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artes_auth_delete'
  ) THEN
    CREATE POLICY artes_auth_delete ON storage.objects
      FOR DELETE USING (bucket_id = 'artes');
  END IF;
END $$;

COMMIT;
