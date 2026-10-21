# Plano de Execução — Fase 2: Execução Operacional

**Branch Oficial:** `feature/fase2-execucao-operacional`  
**Data:** 20/10/2026  
**Status:** Em Planejamento / Início da Implementação  

---

## 1. Decisões do Portão Socrático (Alinhamento de Requisitos)

1. **Acesso e Redirecionamento:**
   - Usuários com perfil **Operador** caem diretamente na tela **"Minha Fila"** ao fazer login.
   - Perfis **Administrador**, **Supervisor** e **PCP** continuam com tela padrão (Dashboard/Kanban), mas possuem acesso à tela "Minha Fila" pelo menu lateral e podem filtrar por qualquer operador.
2. **Critério de Priorização da Fila:**
   - 1º Nível: Prazo crítico (atrasados e entregas mais próximas no topo).
   - 2º Nível: Prioridade do PCP (`ALTA` > `NORMAL` > `BAIXA`).
   - Justificativa explícita no cartão: selo indicando o motivo da prioridade (ex: *"1º na fila: Vence hoje • Prioridade Alta"*).
3. **Tratamento de Ordens Bloqueadas:**
   - Seção dedicada com alerta visual vermelho (**"Etapas Bloqueadas pelo PCP"**) no final da tela.
   - Motivo do bloqueio visível e botões de ação desabilitados com tooltip explicativo.

---

## 2. Divisão de Tarefas da Fase 2

### [x] Preparação de Ambiente
- Branch dedicada `feature/fase2-execucao-operacional` criada e ativa.

### [x] Tarefa 2.1: Endpoint e Serviços de Dados de Fila (`/api/pcp-phase1/minha-fila`)
- Endpoint otimizado que retorna as ordens prontas para o operador ou setor atual.
- Filtro por status liberados (`AGUARDANDO`, `LIBERADA`, `EM_ANDAMENTO`, `PAUSADA`).
- Agrupamento de itens bloqueados com metadados do bloqueio.
- Algoritmo matemático estrito de pontuação por prazo crítico e prioridade PCP com quebra de empate.

### [x] Tarefa 2.2: Criação do Componente Frontend `src/pages/MinhaFila.tsx`
- Indicadores superiores:
  - Peças Pendentes na Fila
  - Operação Ativa / Pausada no Momento
  - Peças Produzidas Hoje
  - Tempo Produtivo Registrado Hoje
- Bloco de Ação em Foco (Hero Card): Tarefa em andamento com cronômetro em tempo real, miniatura da arte, dados do pedido e botões de toque (`PAUSAR`/`RETOMAR`, `APONTAR PARCIAL`, `FINALIZAR`).
- Lista da Fila Priorizada: Cartões visuais enxutos com foto da arte, detalhes de tamanho/cor, justificativa da posição e botão `INICIAR ETAPA`.
- Seção de Bloqueadas: Alerta visual vermelho com motivo do bloqueio e desabilitação segura de ações.

### [x] Tarefa 2.3: Integração de Navegação e Redirecionamento por Papel
- Adicionada aba e ícone `Minha Fila` na sidebar (`src/components/Sidebar.tsx` e `src/App.tsx`).
- Redirecionamento automático do perfil `Operador` para `activeTab = 'minha-fila'` logo após o login.
- Filtro de seleção de operador disponível para perfis gerenciais (`Administrador`, `Supervisor`, `PCP`).

### [x] Tarefa 2.4: Separação Conclusão Produtiva (`Pronto`) x Entrega (`Entregue`)
- Garantido que a finalização da última etapa de produção mova o pedido para status `Pronto`.
- Mensagem de sucesso atualizada para "Produção concluída! Pedido movido para Pronto."
- Status `Entregue` preservado exclusivamente para a baixa de expedição.

### [x] Tarefa 2.5: Verificação, Build e Testes Automatizados
- Criada suíte de testes automatizados `tests/phase2-minha-fila.test.ts` (100% aprovada).
- Validado `tsc --noEmit` (zero erros).
- Validado `npm run build` (build Vite concluído com sucesso em 11.88s).
