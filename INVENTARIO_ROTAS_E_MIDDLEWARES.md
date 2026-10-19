# INVENTÁRIO COMPLETO DE ROTAS, MIDDLEWARES E POLÍTICAS RLS — PROCOMFORT

**Data de Emissão:** 18 de Outubro de 2026  
**Sistema:** ProComfort (Gestão de Produção / PCP)  
**Total de Rotas Mapeadas:** 116 rotas  
**Status de Segurança:** 100% das rotas privadas protegidas com Autenticação Real (Bearer JWT) e RBAC rigoroso  
**Banco de Dados:** Zero DML direto permitido a `anon` e `authenticated`. Todas as mutações centralizadas via RPCs protegidas e backend com `service_role`.

---

## 1. Arquitetura de Segurança e Middlewares

O backend Express utiliza o middleware central **`verifyAuthAndRole`** e middlewares especializados baseados nos 6 perfis oficiais canônicos (`Administrador`, `PCP`, `Supervisor`, `Operador`, `Comercial`, `Visualização`):

| Middleware | Propósito e Regra de Acesso | Perfis Autorizados |
|---|---|---|
| **`isAuthenticated`** | Exige Bearer JWT válido do Supabase Auth vinculado ao `auth_user_id` em `public.users`. Usuário deve estar ativo (`active = 1`). | Todos os 6 perfis autenticados |
| **`isAdmin`** | Acesso irrestrito de gestão e configurações críticas do sistema. | Somente `Administrador` |
| **`isAuditReader`** | Consulta restrita da trilha de auditoria e logs de conformidade. Bloqueia qualquer outro perfil com HTTP 403. | `Administrador`, `PCP` |
| **`isPcpOrSupervisorOrAdmin`** | Operações de PCP, facções, planejamento de corte, bloqueios e prioridades. | `Administrador`, `PCP`, `Supervisor` |
| **`canOperateProduction`** | Operações produtivas (início, pausa, retomada, finalização, perdas, corte). Bloqueia irrevogavelmente perfis não operacionais. | `Administrador`, `PCP`, `Supervisor`, `Operador` (*Visualização e Comercial bloqueados*) |
| **`isAdminOrComercial`** | Cadastro e edição de pedidos, clientes e acompanhamento comercial. | `Administrador`, `Comercial` |
| **`verifyOlistWebhookSecret`** | Validação criptográfica de assinatura de webhooks externos do Olist via HMAC-SHA256 (`crypto.timingSafeEqual`). Rejeita query string e exige segredo via variável de ambiente. | Header `x-olist-signature` ou `x-webhook-secret` |

> **Garantia Anti-Spoofing:** O middleware `verifyAuthAndRole` valida a identidade diretamente no Supabase Auth via JWT e consulta `public.users` por `auth_user_id`. Headers como `x-user-id`, `x-user-role` ou propriedades forjadas no body que divirjam do token resultam em bloqueio imediato com **HTTP 403 (`IDENTITY_SPOOFING_DETECTED` ou `ROLE_SPOOFING_DETECTED`)**.

---

## 2. Inventário Completo das Rotas (116 Rotas)

| ID | Método | Rota | Middleware Aplicado | Nível de Acesso / Perfis |
|---|---|---|---|---|
| 1 | `GET` | `/api/supabase/status` | Nenhum (Público) | Público |
| 2 | `GET` | `/api/dashboard/stats` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 3 | `GET` | `/api/config` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 4 | `PATCH` | `/api/config` | `isAdmin` | `Administrador` |
| 5 | `GET` | `/api/reports` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 6 | `GET` | `/api/integrations/olist/debug` | `isAdmin` | `Administrador` |
| 7 | `POST` | `/api/integrations/olist/sync` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 8 | `POST` | `/api/integrations/olist/reprocess-normalization` | `isAdmin` | `Administrador` |
| 9 | `POST` | `/api/webhooks/olist` | `verifyOlistWebhookSecret` | Olist Webhook Secret (HMAC-SHA256) |
| 10 | `GET` | `/api/orders/drafts` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 11 | `DELETE` | `/api/orders/drafts/:id` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 12 | `POST` | `/api/orders/drafts/cleanup` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 13 | `POST` | `/api/orders/:id/confirm-draft` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 14 | `GET` | `/api/order-templates` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 15 | `POST` | `/api/order-templates` | `isAdmin` | `Administrador` |
| 16 | `PATCH` | `/api/order-templates/:id` | `isAdmin` | `Administrador` |
| 17 | `DELETE` | `/api/order-templates/:id` | `isAdmin` | `Administrador` |
| 18 | `GET` | `/api/orders/delivery-forecast` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 19 | `GET` | `/api/orders` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 20 | `GET` | `/api/orders/:id/stage-observations` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 21 | `POST` | `/api/orders` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 22 | `DELETE` | `/api/orders/:id` | `isAdmin` | `Administrador` |
| 23 | `POST` | `/api/orders/:id/images` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 24 | `PATCH` | `/api/orders/:id/status` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 25 | `PATCH` | `/api/orders/:id/dtf` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 26 | `PATCH` | `/api/orders/:id` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 27 | `PATCH` | `/api/orders/:id/cancel` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 28 | `GET` | `/api/orders/:id/history` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 29 | `GET` | `/api/cutting/consolidated-demand` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 30 | `POST` | `/api/cutting/register-consolidated` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 31 | `GET` | `/api/cutting/allocations` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 32 | `POST` | `/api/cutting/optitex-risco` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 33 | `GET` | `/api/cutting/optitex-riscos` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 34 | `POST` | `/api/cutting/approved-plans` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 35 | `GET` | `/api/cutting/approved-plans` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 36 | `POST` | `/api/cutting/ramado-decision` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 37 | `GET` | `/api/cutting/ramado-decisions` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 38 | `GET` | `/api/cutting/producao-excedentes` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 39 | `GET` | `/api/stages` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 40 | `POST` | `/api/stages` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 41 | `PATCH` | `/api/stages/:id` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 42 | `DELETE` | `/api/stages/:id` | `isAdmin` | `Administrador` |
| 43 | `GET` | `/api/loss-reasons` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 44 | `PATCH` | `/api/loss-reasons` | `isAdmin` | `Administrador` |
| 45 | `GET` | `/api/orders/:id/stage-progress` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 46 | `POST` | `/api/orders/:id/stages/:stageId/progress` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 47 | `POST` | `/api/orders/:id/stages/:stageId/loss` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 48 | `GET` | `/api/reports/losses` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 49 | `GET` | `/api/collaborator-goals` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 50 | `POST` | `/api/collaborator-goals` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 51 | `DELETE` | `/api/collaborator-goals/:id` | `isAdmin` | `Administrador` |
| 52 | `GET` | `/api/executions/monitor` | `isAdmin` | `Administrador` |
| 53 | `GET` | `/api/executions/active/:userId` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 54 | `GET` | `/api/orders/:id/executions` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 55 | `POST` | `/api/executions/start` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 56 | `POST` | `/api/executions/pause-all` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 57 | `GET` | `/api/admin/debug-orders` | `isAdmin` | `Administrador` |
| 58 | `POST` | `/api/admin/reset-production` | `isAdmin` | `Administrador` |
| 59 | `POST` | `/api/executions/auto-pause` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 60 | `POST` | `/api/executions/:id/pause` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 61 | `POST` | `/api/executions/:id/resume` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 62 | `POST` | `/api/executions/:id/finish` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 63 | `POST` | `/api/orders/:id/stages/:stageId/reopen` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 64 | `GET` | `/api/config/producao` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 65 | `PATCH` | `/api/config/producao` | `isAdmin` | `Administrador` |
| 66 | `GET` | `/api/users` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 67 | `POST` | `/api/users` | `isAdmin` | `Administrador` |
| 68 | `PATCH` | `/api/users/:id` | `isAdmin` | `Administrador` |
| 69 | `GET` | `/api/clients` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 70 | `POST` | `/api/clients` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 71 | `GET` | `/api/reports/delays` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 72 | `GET` | `/api/reports/delivery` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 73 | `GET` | `/api/reports/operational` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 74 | `GET` | `/api/reports/profiles` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 75 | `GET` | `/api/reports/goals-productivity` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 76 | `POST` | `/api/orders/:id/tracking-token` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 77 | `GET` | `/api/public/orders/:token` | Nenhum (Público) | Público |
| 78 | `GET` | `/api/pcp/necessidades` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 79 | `POST` | `/api/pcp/necessidades/recalcular` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 80 | `GET` | `/api/pcp/planos` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 81 | `POST` | `/api/pcp/planos` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 82 | `POST` | `/api/pcp/planos/:id/aprovar` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 83 | `GET` | `/api/pcp/ops` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 84 | `POST` | `/api/pcp/ops` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 85 | `POST` | `/api/pcp/ops/:id/registrar-tiny` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 86 | `GET` | `/api/pcp/summary` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 87 | `POST` | `/api/stock/sync` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 88 | `GET` | `/api/cut-plans` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 89 | `GET` | `/api/cut-plans/committed-quantities` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 90 | `GET` | `/api/cut-plans/:id` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 91 | `POST` | `/api/cut-plans` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 92 | `POST` | `/api/cut-plans/:id/release` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 93 | `POST` | `/api/cut-plans/:id/complete-cut` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 94 | `POST` | `/api/cut-plans/:id/send-sewing` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 95 | `POST` | `/api/cut-plans/:id/return-sewing` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |
| 96 | `POST` | `/api/cut-plans/:id/cancel` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 97 | `GET` | `/api/cut-plans/:id/movements` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 98 | `GET` | `/api/orders/:id/production-status` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 99 | `GET` | `/api/pcp-phase1/dashboard` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 100 | `GET` | `/api/pcp-phase1/necessidades` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 101 | `GET` | `/api/pcp-phase1/prioridades` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 102 | `GET` | `/api/pcp-phase1/bloqueados` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 103 | `POST` | `/api/pcp-phase1/ordens/:id/bloqueio` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 104 | `POST` | `/api/pcp-phase1/ordens/:id/desbloqueio` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 105 | `POST` | `/api/pcp-phase1/ordens/:id/prioridade_manual` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 106 | `GET` | `/api/pcp-phase1/config` | `isAuthenticated` | Todos os 6 perfis autenticados |
| 107 | `GET` | `/api/pcp-phase1/audit-log` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 108 | `POST` | `/api/orders/:id/expedir` | `isAdminOrComercial` | `Administrador`, `Comercial` |
| 109 | `GET` | `/api/pcp/faccoes` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 110 | `POST` | `/api/pcp/faccoes` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 111 | `PATCH` | `/api/pcp/faccoes/:id` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 112 | `GET` | `/api/pcp/faccao-prices` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 113 | `POST` | `/api/pcp/faccao-prices` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 114 | `DELETE` | `/api/pcp/faccao-prices/:id` | `isAdmin` | `Administrador` |
| 115 | `PATCH` | `/api/cut-plans/:id/pay-sewing` | `isPcpOrSupervisorOrAdmin` | `Administrador`, `PCP`, `Supervisor` |
| 116 | `POST` | `/api/production/record` | `canOperateProduction` | `Administrador`, `PCP`, `Supervisor`, `Operador` |

---

## 3. Inventário Real de Políticas de Segurança (RLS) no Banco de Dados

### 3.1 Limpeza Pré-Existente e Princípio de Privilégio Mínimo
- A migration `20261018_phase1_deploy_complete.sql` itera dinamicamente sobre `pg_policies` e **remove todas as políticas pré-existentes** no schema `public`.
- **DML Direto Revogado:** `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`
- **Leitura Controlada:** `GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;`
- **Bypass Exclusivo do Backend:** `GRANT ALL ON ALL TABLES/SEQUENCES/ROUTINES TO service_role;`

### 3.2 Políticas RLS Ativas (Schema `public`)

| Tabela | RLS Habilitado | Política Ativa | Comando | Role | Expressão USING / WITH CHECK |
|---|---|---|---|---|---|
| `public.orders` | SIM | `authenticated_select_orders` | `SELECT` | `authenticated` | `(true)` |
| `public.order_items` | SIM | `authenticated_select_order_items` | `SELECT` | `authenticated` | `(true)` |
| `public.stages` | SIM | `authenticated_select_stages` | `SELECT` | `authenticated` | `(true)` |
| `public.stage_executions` | SIM | `authenticated_select_stage_executions` | `SELECT` | `authenticated` | `(true)` |
| `public.order_stage_progress` | SIM | `authenticated_select_order_stage_progress` | `SELECT` | `authenticated` | `(true)` |
| `public.order_item_stage_progress` | SIM | `authenticated_select_order_item_stage_progress` | `SELECT` | `authenticated` | `(true)` |
| `public.order_loss_logs` | SIM | `authenticated_select_order_loss_logs` | `SELECT` | `authenticated` | `(true)` |
| `public.order_progress_logs` | SIM | `authenticated_select_order_progress_logs` | `SELECT` | `authenticated` | `(true)` |
| `public.pcp_settings` | SIM | `authenticated_select_pcp_settings` | `SELECT` | `authenticated` | `public.is_management()` |
| `public.pcp_audit_log` | SIM | `authenticated_select_pcp_audit_log` | `SELECT` | `authenticated` | `public.is_audit_reader()` |
| `public.order_history` | SIM | `authenticated_select_order_history` | `SELECT` | `authenticated` | `public.is_management_or_commercial()` |
| `public.users` | SIM | `authenticated_select_users` | `SELECT` | `authenticated` | `(true)` |
| `public.cut_plans` | SIM | RLS Estrito (Service Role) | `ALL` | `service_role` | Acesso exclusivo via backend/RPC |
| `public.cut_plan_items` | SIM | RLS Estrito (Service Role) | `ALL` | `service_role` | Acesso exclusivo via backend/RPC |
| `public.production_movements` | SIM | RLS Estrito (Service Role) | `ALL` | `service_role` | Acesso exclusivo via backend/RPC |
| `public.corte_allocations` | SIM | RLS Estrito (Service Role) | `ALL` | `service_role` | Acesso exclusivo via backend/RPC |
| `public.producao_excedentes` | SIM | RLS Estrito (Service Role) | `ALL` | `service_role` | Acesso exclusivo via backend/RPC |
| `public.ramado_decisions` | SIM | RLS Estrito (Service Role) | `ALL` | `service_role` | Acesso exclusivo via backend/RPC |
| `public.approved_enfesto_plans` | SIM | RLS Estrito (Service Role) | `ALL` | `service_role` | Acesso exclusivo via backend/RPC |
| `public.optitex_riscos_validados` | SIM | RLS Estrito (Service Role) | `ALL` | `service_role` | Acesso exclusivo via backend/RPC |

### 3.3 Inventário Completo das 27 RPCs Transacionais (Funções SECURITY DEFINER)

Todas as mutações críticas de produção, apontamento, pausas, finalizações, cancelamentos, corte e reset foram blindadas:
1. `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;`
2. `GRANT EXECUTE ON FUNCTION ... TO service_role;`
3. Cada RPC executa validação forçada de identidade, travas de concorrência (`FOR UPDATE`), persistência de auditoria em `pcp_audit_log` e rollback integral em caso de qualquer falha.

| # | RPC | Parâmetros Canônicos | Proteção de Acesso | Idempotência e Transacionalidade |
|---|---|---|---|---|
| 1 | `rpc_start_operation` | `p_order_id`, `p_stage_id`, `p_user_id`, `p_order_item_id`, `p_supervisor_override`, `p_motivo` | `service_role` | Idempotente por sessão ativa; rollback integral |
| 2 | `rpc_pause_operation` | `p_execution_id`, `p_user_id`, `p_motivo`, `p_supervisor_override` | `service_role` | Idempotente se já pausado; rollback integral |
| 3 | `rpc_resume_operation` | `p_execution_id`, `p_user_id`, `p_supervisor_override`, `p_motivo` | `service_role` | Idempotente se já em andamento; rollback integral |
| 4 | `rpc_finish_operation` | `p_execution_id`, `p_user_id`, `p_good_inc`, `p_partial`, `p_observation`, `p_idempotency_key`, `p_supervisor_override` | `service_role` | Idempotente se já finalizado; rollback integral |
| 5 | `rpc_record_production` | `p_order_id`, `p_stage_id`, `p_user_id`, `p_idempotency_key`, `p_good_inc`, `p_lost_inc`, `p_rework_inc`, `p_transfer_inc`, `p_next_stage_id`, `p_observation`, `p_is_reposition`, `p_order_item_id`, `p_supervisor_override`, `p_override_reason` | `service_role` | Atômica via `idempotency_requests` |
| 6 | `rpc_record_loss` | `p_order_id`, `p_stage_id`, `p_user_id`, `p_lost_qty`, `p_reason`, `p_reason_detail`, `p_reentry_stage_id`, `p_order_item_id`, `p_idempotency_key`, `p_supervisor_override`, `p_override_reason` | `service_role` | Atômica via `idempotency_requests` |
| 7 | `pcp_apply_stage_progress` | `p_order_id`, `p_stage_id`, `p_user_id`, `p_good_inc`, `p_lost_inc`, `p_rework_inc`, `p_transfer_inc`, `p_next_stage_id`, `p_observation`, `p_is_reposition`, `p_order_item_id`, `p_idempotency_key`, `p_supervisor_override`, `p_override_reason` | `service_role` | Motor interno chamado pelas RPCs com auditoria atômica |
| 8 | `pcp_tx_recalcular_necessidades` | `p_payload`, `p_user_id` | `service_role` | Atômica; limpa e reavalia necessidades com auditoria |
| 9 | `pcp_tx_criar_plano_corte` | `p_plano`, `p_necessidades_ids`, `p_usuario`, `p_detalhes` | `service_role` | Atômica; cria plano, vincula necessidades e audita |
| 10 | `pcp_tx_aprovar_plano_corte` | `p_plano_id`, `p_qty_aprovada`, `p_usuario`, `p_idempotency_key` | `service_role` | Atômica; aprova plano e atualiza status das necessidades |
| 11 | `pcp_tx_registrar_op` | `p_op_data`, `p_acao`, `p_usuario`, `p_detalhes` | `service_role` | Atômica; cadastra OP e audita |
| 12 | `pcp_tx_registrar_numero_tiny_op` | `p_op_id`, `p_tiny_op_numero`, `p_tiny_op_id`, `p_usuario` | `service_role` | Atômica; vincula número da OP no Tiny e audita |
| 13 | `pcp_tx_bloquear_ordem` | `p_order_id`, `p_motivo`, `p_observacao`, `p_usuario`, `p_stage_id` | `service_role` | Atômica; cria bloqueio e atualiza status do pedido |
| 14 | `pcp_tx_desbloquear_ordem` | `p_order_id`, `p_motivo`, `p_usuario` | `service_role` | Atômica; encerra bloqueio e restaura pedido |
| 15 | `pcp_tx_alterar_prioridade` | `p_order_id`, `p_priority`, `p_score`, `p_motivo`, `p_usuario` | `service_role` | Atômica; atualiza prioridade com histórico e auditoria |
| 16 | `pcp_tx_reabrir_etapa` | `p_order_id`, `p_stage_id`, `p_motivo`, `p_usuario` | `service_role` | Atômica; reabre etapa finalizada e reajusta progresso |
| 17 | `pcp_tx_expedir_ordem` | `p_order_id`, `p_observacao`, `p_usuario` | `service_role` | Atômica; finaliza expedição e atualiza pedido para Entregue |
| 18 | `pcp_tx_register_consolidated_cutting` | `p_item_key`, `p_quantidade_cortada`, `p_user_id`, `p_allocations`, `p_idempotency_key` | `service_role` | Atômica; corte consolidado, realocação e progresso de corte |
| 19 | `pcp_tx_record_ramado_decision` | `p_model`, `p_fabric`, `p_color`, `p_tipo_tecido`, `p_decision`, `p_plano_exato`, `p_plano_otimizado`, `p_excedente_proposto`, `p_excedente_total`, `p_riscos_antes`, `p_riscos_depois`, `p_ganho_operacional`, `p_user_id`, `p_idempotency_key` | `service_role` | Atômica; registra decisão Ramado e excedentes propostos |
| 20 | `pcp_tx_create_cut_plan` | `p_fabric`, `p_color`, `p_tipo_tecido`, `p_largura_util`, `p_items`, `p_notes`, `p_user_id`, `p_idempotency_key` | `service_role` | Atômica; sequência segura `cut_plans_plan_number_seq`, snapshot, itens e movimentações |
| 21 | `pcp_tx_release_cut_plan` | `p_plan_id`, `p_user_id`, `p_idempotency_key` | `service_role` | Atômica; trava `FOR UPDATE`, transição `CUT_RELEASED`, itens e movimentação |
| 22 | `pcp_tx_complete_cut_plan` | `p_plan_id`, `p_qty_cut_actual`, `p_user_id`, `p_notes`, `p_item_quantities`, `p_idempotency_key` | `service_role` | Atômica; trava `FOR UPDATE`, transição `CUT_COMPLETED`, sobras pendentes e movimentações |
| 23 | `pcp_tx_send_cut_plan_sewing` | `p_plan_id`, `p_qty_sewing`, `p_user_id`, `p_faccao_id`, `p_notes`, `p_idempotency_key` | `service_role` | Atômica; trava `FOR UPDATE`, transição `IN_SEWING`, vínculo de facção e movimentações |
| 24 | `pcp_tx_return_cut_plan_sewing` | `p_plan_id`, `p_qty_returned`, `p_user_id`, `p_item_quantities`, `p_notes`, `p_idempotency_key` | `service_role` | Atômica; trava `FOR UPDATE`, transição `SEWING_COMPLETED`/`IN_SEWING`, progresso das ordens e movimentações |
| 25 | `pcp_tx_cancel_cut_plan` | `p_plan_id`, `p_user_id`, `p_reason`, `p_idempotency_key` | `service_role` | Atômica; trava `FOR UPDATE`, cancelamento e retorno para pendência |
| 26 | `pcp_tx_reset_production` | `p_confirmation_text`, `p_user_id` | `service_role` | Atômica; validação estrita de Administrador, texto explícito, exclusão e reset com rollback 100% |
| 27 | `pcp_tx_cancel_order` | `p_order_id`, `p_user_id`, `p_reason`, `p_idempotency_key` | `service_role` | Atômica; trava `FOR UPDATE`, cancelamento de pedido, `order_history`, realocações de corte e auditoria |
