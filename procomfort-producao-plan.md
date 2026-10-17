# Plano de Evolução ProComfort — Gestão de Produção (Comfort Uniformes)

## Visão Geral
Evolução estrutural e operacional do sistema **ProComfort** (React + TypeScript + Express/Vercel + Supabase + Tiny/Olist) em 4 fases incrementais, preservando todos os dados históricos e funcionalidades existentes.

- **Project Type:** WEB + BACKEND + DATABASE (Full-Stack)
- **Fuso Horário Oficial:** `America/Sao_Paulo`

---

## Fase 1 — Diagnóstico e Fundação (CONCLUÍDA)
- [x] **Tarefa 1.0 (`project-planner`):** Diagnóstico completo do repositório, API e banco de dados Supabase.
- [x] **Tarefa 1.1 (`database-architect`):** Criar migração incremental e reversível `supabase/migrations/20261017_phase1_foundation.sql` (evolução de `stages`, `order_items`, `order_stage_progress`, `pauses`, `users`, `pcp_audit_log`, índices únicos de concorrência e RPCs transacionais).
- [x] **Tarefa 1.2 (`database-architect`):** Inicializar configurações e backfill seguro no Supabase (`pcp_settings`, `order_stage_progress`).
- [x] **Tarefa 1.3 (`backend-specialist`):** Eliminar estados mutáveis em memória (`_lossStageProgressStore`, `_lossLogsStore`, `_progressLogsStore`, `_lossReasonSettingsStore`) de `api/index.ts`, usando exclusivamente o Supabase como fonte oficial.
- [x] **Tarefa 1.4 (`security-auditor` + `backend-specialist`):** Implementar validação real de permissões no backend para os 6 perfis (`Admin`, `PCP`, `Supervisor`, `Operador`/`Produção`, `Comercial`, `Visualização`), proteção contra clique duplo/sessão dupla por operador, máquina de estados explícita (`AGUARDANDO`, `LIBERADA`, `EM_ANDAMENTO`, `PAUSADA`, `PARCIAL`, `BLOQUEADA`, `CONCLUIDA`, `CANCELADA`), transferência parcial entre etapas e auditoria imutável (`pcp_audit_log`), além de corrigir a posição do `app.all("/api/*")` que bloqueava as rotas `/api/pcp-phase1/*`.
- [x] **Tarefa 1.5 (`frontend-specialist`):** Atualizar `src/types.ts` e `src/components/modals/UserModal.tsx` com os 6 perfis e os 8 status padronizados de operação.
- [x] **Tarefa 1.6 (`test-engineer`):** Criar e executar testes automatizados da Fase 1 (`src/lib/operationEngine.test.ts`), validar `tsc --noEmit` e `npm run build`.

---

## Fase 2 — Execução Operacional (Próxima Fase)
- [ ] **Tarefa 2.1:** Criar tela **"Minha Fila" (`Minha Produção`)** para o operador com indicadores do topo, filtros completos, cartões enxutos, seção separada **"Bloqueadas"** e justificativa automática da posição na fila.
- [ ] **Tarefa 2.2:** Implementar botões operacionais grandes (`INICIAR`, `PAUSAR` com motivo, `RETOMAR`, `REGISTRAR PRODUÇÃO` com bom/perda/retrabalho e transferência parcial 60/100 + 40/100, `FINALIZAR`, `INFORMAR PROBLEMA`).
- [ ] **Tarefa 2.3:** Separar conclusão produtiva (`Pronto` / Estoque) de entrega/expedição (`Entregue`).
- [ ] **Tarefa 2.4:** Integrar tela do **PCP e Supervisor** (filas por setor, atrasos, bloqueios, prioridades auditadas, gargalos e drill-down de números).

---

## Fase 3 — Relatórios Explicativos
- [ ] **Tarefa 3.1:** Relatório por Operador (dias trabalhados, horas produtivas, pausas, setup, boa/perda/retrabalho, peças/hora, % meta e detalhamento diário).
- [ ] **Tarefa 3.2:** Relatório por Setor (unidades separadas, fila atual, WIP, tempo médio de espera/execução, capacidade e gargalos).
- [ ] **Tarefa 3.3:** Relatório Geral da Fábrica sem contagem duplicada (contabilizando produção final apenas na última operação obrigatória do item) + modal **"Ver Composição"** e fórmulas explícitas em todos os indicadores.

---

## Fase 4 — Integração Tiny/Olist e Refinamento Final
- [ ] **Tarefa 4.1:** Sincronização incremental idempotente do Tiny/Olist sem limite fixo de 5 pedidos, atualizando prazos/quantidades/cancelamentos e sinalizando divergências ao PCP sem apagar apontamentos.
- [ ] **Tarefa 4.2:** Paginação, índices de performance e validação completa dos 20 testes obrigatórios.
