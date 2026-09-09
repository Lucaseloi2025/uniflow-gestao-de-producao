-- ============================================================================
-- MIGRATION: Add Tables for RAMADO Strategic Surplus Decision Logs & Surplus Inventory
-- ============================================================================
-- Description:
-- Creates tables ramado_decisions and producao_excedentes to track human approvals/rejections
-- of strategic surplus cutting plans and separate surplus production pieces from order allocations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ramado_decisions (
    id BIGSERIAL PRIMARY KEY,
    model TEXT NOT NULL,
    fabric TEXT NOT NULL,
    color TEXT,
    tipo_tecido TEXT NOT NULL DEFAULT 'RAMADO',
    decision TEXT NOT NULL, -- 'APROVADO_OTIMIZADO' | 'MANTIDO_EXATO'
    plano_exato JSONB NOT NULL,
    plano_otimizado JSONB,
    excedente_proposto JSONB, -- e.g. {"G": 1, "GG": 1}
    excedente_total INT DEFAULT 0,
    riscos_antes INT,
    riscos_depois INT,
    ganho_operacional TEXT,
    user_id BIGINT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS producao_excedentes (
    id BIGSERIAL PRIMARY KEY,
    decision_id BIGINT REFERENCES ramado_decisions(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    fabric TEXT NOT NULL,
    color TEXT,
    size TEXT NOT NULL,
    quantidade INT NOT NULL CHECK (quantidade > 0),
    origem TEXT NOT NULL DEFAULT 'EXCEDENTE_DE_PRODUCAO',
    destino TEXT NOT NULL DEFAULT 'ESTOQUE', -- 'ESTOQUE', 'REPOSICAO', 'SOBRA_DE_CORTE'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit lookups
CREATE INDEX IF NOT EXISTS idx_ramado_decisions_model ON ramado_decisions(model);
CREATE INDEX IF NOT EXISTS idx_ramado_decisions_created_at ON ramado_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_producao_excedentes_model ON producao_excedentes(model);
