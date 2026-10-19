# GUIA OFICIAL DE HOMOLOGAÇÃO E APLICAÇÃO DAS MIGRATIONS DA FASE 1 — PROCOMFORT

**Sistema:** Comfort Uniformes (ProComfort / Uniflow)  
**Fuso Horário Oficial:** `America/Sao_Paulo` (-03:00)  
**Arquivo Canônico de Migração:** `supabase/migrations/20261018_phase1_deploy_complete.sql` (100% autocontido)  
**Script Diagnóstico de Integridade:** `supabase/preflight_phase1_check.sql` (Tabelas temporárias em transação segura)  
**Status do Supabase Principal:** Nenhuma migration da Fase 1 foi executada em produção.  
**Status Atual da Fase 1:** `FASE 1 TECNICAMENTE HOMOLOGADA EM STAGING — AGUARDANDO AUDITORIA FINAL DO PACOTE E PREFLIGHT DA PRODUÇÃO`  

---

## ⛔ REGRA DE OURO E PROIBIÇÃO ABSOLUTA

> **PROIBIÇÃO EXPRESSA:** É terminantemente proibido aplicar qualquer script ou migration no **Supabase Principal (Produção)** antes que um **Projeto Supabase Separado e Descartável de Staging** tenha sido criado, migrado e 100% homologado via `npm run test:staging-live` com **0 testes pulados (0 skipped)**.

---

## 1. Passo 0: Provisionamento do Projeto de Staging Descartável

Antes de qualquer ação em ambiente corporativo:

1. Acesse o Supabase ([https://supabase.com/dashboard](https://supabase.com/dashboard));
2. Crie um **novo projeto isolado** exclusivamente para homologação (ex.: `uniflow-staging-temp`);
3. Obtenha as credenciais do projeto de staging:
   - `URL do Projeto` (ex.: `https://xyzcompany.supabase.co`);
   - `anon public key` (chave anônima do cliente);
   - `service_role secret key` (chave administrativa restrita).
4. Guarde essas chaves para a configuração das variáveis de ambiente de teste:
   ```bash
   STAGING_SUPABASE_URL="https://xyzcompany.supabase.co"
   STAGING_SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role"
   STAGING_SUPABASE_ANON_KEY="sua_chave_anon"
   ```

---

## 2. Passo 1: Execução do Preflight Diagnóstico de Integridade

Abra o **SQL Editor** do Supabase de Staging (e futuramente no de Produção) e execute o script:
```
supabase/preflight_phase1_check.sql
```

### Como o Preflight funciona:
- **Tabelas Temporárias em Transação:** O preflight utiliza tabelas temporárias (`CREATE TEMP TABLE ... ON COMMIT PRESERVE ROWS`) para registrar e consolidar os diagnósticos dentro da sessão. Ele **NÃO altera, NÃO remove e NÃO corrompe dados permanentes** das tabelas de produção.
- **Forma de Aplicação:** Abra o arquivo no editor de código, copie todo o conteúdo e **cole diretamente no SQL Editor do painel do Supabase**. Nunca utilize comandos de terminal como `\i` que dependem de sistema de arquivos local do psql.
- **Diagnóstico Rigoroso (PASS ou BLOCKED):**
  - Emite `BLOCKED` se houver usuários legados ativos sem correspondência em `auth.users`;
  - Emite `BLOCKED` se houver e-mails ambíguos, vazios ou duplicados;
  - Emite `BLOCKED` se existirem duplicidades em chaves únicas produtivas (`order_stage_progress`, `order_items`, `order_item_stage_progress`, `order_progress_logs.idempotency_key`, `stage_executions` com sessões abertas simultâneas);
  - Emite `WARNING` caso existam usuários inativos sem auth (permitidos pela migração);
  - Emite `PASS` apenas quando o banco está 100% apto a receber as constraints da migração.

---

## 3. Passo 2: Aplicação da Migration Canônica Única no Staging

Com o resultado `PASS` emitido pelo preflight, execute a migração consolidada:
```
supabase/migrations/20261018_phase1_deploy_complete.sql
```

### Características e Garantias do Script:
1. **100% Autocontido e Transacional:** Envolvido em bloco `BEGIN; ... COMMIT;`. Cria todas as tabelas produtivas (`orders`, `order_items`, `stages`, `stage_executions`, `pauses`, `order_stage_progress`, `order_item_stage_progress`, `order_loss_logs`, `order_progress_logs`, `pcp_settings`, `pcp_blocks`, `pcp_audit_log`, `pcp_producao_necessidades`, `producao_necessidades`, `planos_de_corte`, `ordens_de_producao`, `order_history`, `idempotency_requests`, `users`, `cut_plans`, `cut_plan_items`, `production_movements`).
2. **Backfill e Trava Transacional de Autenticação:** Realiza o backfill de `auth_user_id` por e-mail normalizado e executa trava imediata: se qualquer usuário ativo permanecer sem `auth_user_id`, a migration lança `RAISE EXCEPTION` e executa rollback integral.
3. **RLS Não-Recursivo e Menor Privilégio:** Helpers `is_management_user()` e `is_audit_reader()` com `SECURITY DEFINER` e `search_path` protegido. DML direto revogado de `anon` e `authenticated`. Apenas `service_role` possui acesso de escrita.
4. **27 RPCs Transacionais Atômicas de Negócio e Auditoria:**
   - 10 RPCs PCP: `pcp_tx_recalcular_necessidades`, `pcp_tx_criar_plano_corte`, `pcp_tx_aprovar_plano_corte`, `pcp_tx_registrar_op`, `pcp_tx_registrar_numero_tiny_op`, `pcp_tx_bloquear_ordem`, `pcp_tx_desbloquear_ordem`, `pcp_tx_alterar_prioridade`, `pcp_tx_reabrir_etapa`, `pcp_tx_expedir_ordem`.
   - 2 RPCs de Corte Otimizado e Consolidado: `pcp_tx_register_consolidated_cutting`, `pcp_tx_record_ramado_decision`.
   - 6 RPCs de Planos de Corte (`cut_plans`): `pcp_tx_create_cut_plan`, `pcp_tx_release_cut_plan`, `pcp_tx_complete_cut_plan`, `pcp_tx_send_cut_plan_sewing`, `pcp_tx_return_cut_plan_sewing`, `pcp_tx_cancel_cut_plan`.
   - 1 RPC Administrativa de Reset Total: `pcp_tx_reset_production`.
   - 1 RPC de Cancelamento de Pedido com Realocação: `pcp_tx_cancel_order`.
   - 7 RPCs de Chão de Fábrica: `pcp_apply_stage_progress`, `rpc_start_operation`, `rpc_pause_operation`, `rpc_resume_operation`, `rpc_finish_operation`, `rpc_record_production`, `rpc_record_loss`.
   Garantem que qualquer erro na gravação da auditoria ou negócio reverte 100% das alterações no banco (Atomic Rollback).
5. **Auditoria Imutável e Integridade Relacional (ON DELETE SET NULL):**
   A tabela `pcp_audit_log` é estritamente append-only (bloqueio 55000 para UPDATE/DELETE direto). A foreign key para `orders` utiliza `ON DELETE SET NULL`, preservando perenemente o histórico de auditoria mesmo se o pedido pai for legitimamente expurgado.
6. **Forma de Aplicação:** Copie a totalidade do arquivo `supabase/migrations/20261018_phase1_deploy_complete.sql` e cole no **SQL Editor** do Supabase. Pressione **Run**.

---

## 4. Passo 3: Homologação Real em Staging (`npm run test:staging-live`)

Com as variáveis de staging preenchidas no ambiente local, execute:
```bash
npm run test:staging-live
```

### Critérios Obrigatórios para Aprovação:
- O runner valida que nenhuma credencial está ausente (sai com código 1 caso falte);
- O runner conecta ao projeto Supabase de staging real;
- Testa o fluxo E2E real: login no GoTrue -> obtenção de JWT real -> envio com `Authorization: Bearer <token>` para o backend -> validação pelo backend -> chamada da RPC por `service_role` -> persistência no banco e conferência da identidade no `pcp_audit_log`;
- Testa o bloqueio de RPC direta para `anon` e `authenticated`;
- Testa o isolamento de RLS entre dois operadores distintos (Operador 1 não vê Operador 2);
- Testa que o log de auditoria só é acessível por Administrador e PCP (invisível para Supervisor, Operador, Comercial e Visualização);
- Testa a prevenção de duplicação em duplo clique (idempotência real);
- **CRÍTICO:** O script falhará com erro (exit code 1) se houver qualquer teste pulado (`skipped`). A homologação só é considerada válida se apresentar **0 skipped**.

---

## 5. Passo 4: Autorização e Liberação para o Supabase Principal

A liberação e execução dos scripts no Supabase Principal só é permitida após o cumprimento estrito dos seguintes passos:
1. Suíte de testes locais completa aprovada:
   - **170 testes locais automatizados** em 20 arquivos executados com 100% de sucesso via PGlite / Vitest (0 falhas);
   - Build de produção validado com e sem variáveis de ambiente (`npm run build`);
   - Lint estático sem erros (`npm run lint`).
2. Execução da homologação em Staging (`npm run test:staging-live`) concluída com **código 0 e 0 testes pulados**;
3. Execução do Preflight no Supabase Principal retornando veredito **PASS**;
4. Aplicação do arquivo `supabase/migrations/20261018_phase1_deploy_complete.sql` no SQL Editor do Supabase Principal com sucesso.
