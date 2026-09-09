-- ============================================================================
-- MIGRATION: Add Table for Optitex Validated Risks History & Efficiency Learning
-- ============================================================================
-- Description:
-- Creates table optitex_riscos_validados to store real length, Optitex efficiency,
-- and history for learned risk composition scoring.
-- ============================================================================

CREATE TABLE IF NOT EXISTS optitex_riscos_validados (
    id BIGSERIAL PRIMARY KEY,
    model TEXT NOT NULL,
    fabric TEXT NOT NULL,
    largura_util TEXT NOT NULL,
    tipo_tecido TEXT NOT NULL DEFAULT 'RAMADO',
    sizes JSONB NOT NULL, -- e.g. ["P", "M", "G"]
    composicao JSONB NOT NULL, -- e.g. {"P": 2, "M": 4, "G": 2}
    comprimento_real_metros NUMERIC(6,2) NOT NULL,
    eficiencia_optitex_pct NUMERIC(5,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'VALIDADO',
    user_name TEXT,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_optitex_riscos_model ON optitex_riscos_validados(model);
CREATE INDEX IF NOT EXISTS idx_optitex_riscos_fabric ON optitex_riscos_validados(fabric);
