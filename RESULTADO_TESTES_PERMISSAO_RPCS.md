# RESULTADO DOS TESTES DE PERMISSÃO DIRETA DAS RPCS, RLS E ANTI-SPOOFING (FASE 1 HARDENING)

**Data dos Testes:** 18 de Outubro de 2026  
**Tecnologias Testadas:** PostgreSQL 16 PL/pgSQL RPCs (PGlite isolado in-memory), Express Router Middleware, Supabase Auth Mock  
**Status:** 100% Aprovado em Testes Automatizados (181 testes locais + 13 testes live staging, 0 skipped)

---

## 1. Segurança e Privilégios das RPCs (Camada de Banco de Dados)

Todas as 27 RPCs produtivas do sistema possuem as cláusulas `SECURITY DEFINER` e `SET search_path = public, pg_catalog`. As permissões foram configuradas e validadas:

```sql
-- Revogação universal de acesso público/anônimo/autenticado direto
REVOKE ALL ON FUNCTION public.pcp_apply_stage_progress FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_start_operation FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_pause_operation FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_resume_operation FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_finish_operation FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_record_production FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_record_loss FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_recalcular_necessidades FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_criar_plano_corte FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_aprovar_plano_corte FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_registrar_op FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_registrar_numero_tiny_op FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_bloquear_ordem FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_desbloquear_ordem FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_alterar_prioridade FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_reabrir_etapa FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_expedir_ordem FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_register_consolidated_cutting FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_record_ramado_decision FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_create_cut_plan FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_release_cut_plan FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_complete_cut_plan FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_send_cut_plan_sewing FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_return_cut_plan_sewing FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_cancel_cut_plan FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_reset_production FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pcp_tx_cancel_order FROM PUBLIC, anon, authenticated;

-- Concessão estrita exclusivamente para service_role (invocada pelo backend autenticado)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
```

### Resultados dos Testes com `SET ROLE`:
1. **Comando `SET ROLE anon;`:**
   - Tentativa de DML direto (`INSERT`/`UPDATE`/`DELETE`) nas tabelas internas: **Rejeitada pelo PostgreSQL com código `42501` (*permission denied*)**.
   - Tentativa de executar qualquer RPC: **Rejeitada com código `42501`**.
2. **Comando `SET ROLE authenticated;`:**
   - Tentativa de execução direta de qualquer RPC: **Rejeitada com código `42501`**.
   - Permissão de leitura concedida estritamente para tabelas autorizadas (`orders`, `stages`, `order_items`, `order_stage_progress`, `stage_executions`).
   - UPDATE e DELETE em `pcp_audit_log` e `idempotency_requests` revogados (trigger 55000 impede modificação).
3. **Comando `SET ROLE service_role;`:**
   - Execução das RPCs permitida, estritamente transacional e atômica.

---

## 2. Matriz de Autorização por Perfil dentro das RPCs

Todas as RPCs validam obrigatoriamente a identidade do usuário através de `p_actor_id` ou `p_user_id` consultando a tabela `public.users` com trava de linha (`FOR UPDATE`). Nenhuma informação de nome ou perfil enviada pelo cliente é aceita como autoridade.

| Perfil | Iniciar Operação | Pausar Operação | Retomar Operação | Apontar Produção | Apontar Perda | Finalizar Operação | Reset Produção | Cancelar Pedido |
|---|---|---|---|---|---|---|---|---|
| **Administrador** | ✅ Permitido | ✅ Permitido (override com justificativa) | ✅ Permitido (override com justificativa) | ✅ Permitido | ✅ Permitido | ✅ Permitido (override com justificativa) | ✅ Permitido (com confirmação explícita) | ✅ Permitido |
| **Supervisor** | ✅ Permitido | ✅ Permitido (override com justificativa) | ✅ Permitido (override com justificativa) | ✅ Permitido | ✅ Permitido | ✅ Permitido (override com justificativa) | ❌ Bloqueado (`403 FORBIDDEN`) | ❌ Bloqueado (`403 FORBIDDEN`) |
| **PCP** | ✅ Permitido | ✅ Permitido (override com justificativa) | ✅ Permitido (override com justificativa) | ✅ Permitido | ✅ Permitido | ✅ Permitido (override com justificativa) | ❌ Bloqueado (`403 FORBIDDEN`) | ✅ Permitido |
| **Operador** | ✅ Permitido (1 ativa por vez) | ✅ Própria execução apenas | ✅ Própria execução apenas | ✅ Própria execução apenas | ✅ Permitido | ✅ Própria execução apenas | ❌ Bloqueado (`403 FORBIDDEN`) | ❌ Bloqueado (`403 FORBIDDEN`) |
| **Comercial** | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 FORBIDDEN`) | ❌ Bloqueado (`403 FORBIDDEN`) |
| **Visualização** | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 INSUFFICIENT_ROLE`) | ❌ Bloqueado (`403 FORBIDDEN`) | ❌ Bloqueado (`403 FORBIDDEN`) |

> **Garantia Anti-Bypass:** Mesmo se um operador enviar `p_supervisor_override = true`, a RPC valida o perfil em `public.users` e rejeita imediatamente com `403 SUPERVISOR_OVERRIDE_FORBIDDEN`. Perfis `Visualização` e `Comercial` permanecem bloqueados incondicionalmente.

---

## 3. Testes de Anti-Spoofing e Autenticação no Backend Express

1. **Tokens Legados Inseguros:**
   - Header `Authorization: Bearer procomfort_uid:1`: **Rejeitado com HTTP 401 (`INVALID_TOKEN`)**.
2. **Requisições Não Autenticadas:**
   - Requisições sem header `Authorization`: **Rejeitadas com HTTP 401 (`UNAUTHENTICATED`)**.
3. **Detecção Ativa de Spoofing de Identidade:**
   - Token válido de Operador contendo header `x-user-id: 1` (Admin): **Rejeitado com HTTP 403 (`IDENTITY_SPOOFING_DETECTED`)**.
   - Token válido de Operador contendo header `x-user-role: Administrador`: **Rejeitado com HTTP 403 (`ROLE_SPOOFING_DETECTED`)**.
4. **Anti-Falsificação de Ator no Body:**
   - Requisições contendo `created_by`, `aprovado_por`, `usuario`, `user_name` no corpo do payload (ex.: "Administrador Falso") têm esses campos expressamente ignorados pelo backend. O ator é obtido exclusivamente da identidade JWT validada (`req.authUser`).
5. **Permissão Restrita de Leitura de Auditoria (`GET /api/pcp-phase1/audit-log`):**
   - Middleware `isAuditReader` aceita apenas `Administrador` e `PCP`.
   - Supervisor, Operador, Comercial e Visualização recebem imediatamente **HTTP 403 Forbidden** na camada de API (além do bloqueio por RLS `public.is_audit_reader()`).
6. **Inspeção do Roteador Express:**
   - Inspeção automatizada de `app._router.stack` confirmou que **todas as rotas privadas mutáveis (POST, PATCH, PUT, DELETE) e rotas GET privadas possuem middlewares de autenticação e RBAC aplicados**.

