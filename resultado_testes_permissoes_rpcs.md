# Resultado dos Testes de Permissão Direta das RPCs — Fase 1 (ProComfort)
Data: 2026-10-17

---

## 1. Testes de Permissões Diretas no Banco de Dados (Suite 1.5)

| Operação Testada | Perfil Testado | Chamada SQL | Resultado Esperado | Resultado Obtido | Status |
|---|---|---|---|---|:---:|
| **Início de Operação** | `Visualização` | `rpc_start_operation(order, 1, vis_id, ...)` | Erro 403 `INSUFFICIENT_ROLE` | `{ code: 'INSUFFICIENT_ROLE', http_status: 403 }` | **PASS** |
| **Pausa de Operação** | `Visualização` | `rpc_pause_operation(exec_id, ..., 'Visualização', vis_id)` | Erro 403 `INSUFFICIENT_ROLE` | `{ code: 'INSUFFICIENT_ROLE', http_status: 403 }` | **PASS** |
| **Apontamento de Boas / Perdas** | `Visualização` | `rpc_record_production(order, 1, vis_id, ...)` | Erro 403 `INSUFFICIENT_ROLE` | `{ code: 'INSUFFICIENT_ROLE', http_status: 403 }` | **PASS** |
| **Finalização de Operação** | `Visualização` | `rpc_finish_operation(exec_id, ..., vis_id, 'Visualização')` | Erro 403 `INSUFFICIENT_ROLE` | `{ code: 'INSUFFICIENT_ROLE', http_status: 403 }` | **PASS** |
| **Apontamento de Boas / Perdas** | `Comercial` | `rpc_record_production(order, 1, com_id, ...)` | Erro 403 `INSUFFICIENT_ROLE` | `{ code: 'INSUFFICIENT_ROLE', http_status: 403 }` | **PASS** |
| **Operação Paralela (Mesmo Operador)** | `Operador` | `rpc_start_operation(order, stage2, op_id, ...)` | Erro 409 `OPERATOR_ALREADY_ACTIVE` | `{ code: 'OPERATOR_ALREADY_ACTIVE', http_status: 409 }` | **PASS** |
| **Operação Concorrente (Outro Operador)** | `Operador` | `rpc_start_operation(order, stage1, other_op_id, ...)` | Erro 409 `CONCURRENT_STAGE_EXECUTION` | `{ code: 'CONCURRENT_STAGE_EXECUTION', http_status: 409 }` | **PASS** |
| **Status da Última Etapa Concluída** | `Operador` | `rpc_finish_operation(exec_id_last, 20, false, ...)` | `order_status = 'Pronto'` | `order_status = 'Pronto'`, `pcp_status = 'PRONTO'`, `delivered_at = null` | **PASS** |

---

## 2. Testes de Camada de Rede PostgREST (Suite 3)

| Tipo de Acesso | Credencial | Chamada RPC | Código HTTP | Mensagem / Código | Status |
|---|---|---|:---:|---|:---:|
| **Acesso Anônimo** | `apikey: anon_key` | `rpc_start_operation` | **403** | `42501 permission denied` | **PASS** |
| **Acesso Autenticado Comum** | `apikey: authenticated_user_key` | `rpc_start_operation` | **403** | `42501 permission denied` | **PASS** |
| **Acesso Backend (Service Role)** | `apikey: service_role_key` | Todas as 5 RPCs | **200** | Sucesso em todas as transações atômicas | **PASS** |

---

## 3. Testes Anti-Spoofing na Camada API (Suite 4)

| Cenário de Falsificação | Tentativa | Resposta | Código de Erro | Status |
|---|---|:---:|---|:---:|
| **1. Header x-user-id Divergente** | Token Operador + `x-user-id: admin` | **403** | `IDENTITY_SPOOFING_DETECTED` | **PASS** |
| **2. Header x-user-email Divergente** | Token Operador + `x-user-email: admin@...` | **403** | `IDENTITY_SPOOFING_DETECTED` | **PASS** |
| **3. Header x-user-name Divergente** | Token Operador + `x-user-name: Admin` | **403** | `IDENTITY_SPOOFING_DETECTED` | **PASS** |
| **4. Header x-user-role Divergente** | Token Operador + `x-user-role: Administrador` | **403** | `ROLE_SPOOFING_DETECTED` | **PASS** |
| **5. Body user_id Divergente** | Token Operador + `body: { user_id: admin_id }` | **403** | `IDENTITY_SPOOFING_DETECTED` | **PASS** |
| **6. Usuário Inativo** | Token / ID de usuário com `active = 0` | **403** | `USER_INACTIVE` | **PASS** |
| **7. Sem Token / Cabeçalhos** | Requisição sem autenticação | **401** | `UNAUTHENTICATED` | **PASS** |

**Conclusão:** A identidade, permissões e registros de auditoria em `pcp_audit_log` são determinados **exclusivamente pelo token e pelo banco de dados**, com rejeição total a tentativas de falsificação e bloqueio estrito para perfis sem privilégios de produção.
