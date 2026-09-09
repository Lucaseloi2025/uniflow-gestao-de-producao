import assert from 'node:assert';
import {
  calculateWorkedDays,
  getGoalStatus,
  resolveGoal,
  GoalConfig,
  ExecutionActivity
} from './goalsUtils.js';

console.log('--- Iniciando Suíte de Testes de Metas e Produtividade ---');

// 1. Teste de status de meta
{
  assert.strictEqual(getGoalStatus(1.2), 'verde');
  assert.strictEqual(getGoalStatus(1.0), 'verde');
  assert.strictEqual(getGoalStatus(0.95), 'amarelo');
  assert.strictEqual(getGoalStatus(0.7), 'amarelo');
  assert.strictEqual(getGoalStatus(0.69), 'vermelho');
  assert.strictEqual(getGoalStatus(0.0), 'vermelho');
  assert.strictEqual(getGoalStatus(null), 'sem_meta');
  console.log('✔ Teste 1 Passou: Classificação de status de metas');
}

// 2. Teste de resolução de metas (herança vs override)
{
  const overrides: GoalConfig[] = [
    { stage_id: 1, user_id: 10, meta_diaria: 50 },
    { stage_id: 2, user_id: 10, meta_diaria: null },
    { stage_id: 1, user_id: 11, meta_diaria: 30 }
  ];

  // Herda do setor
  assert.strictEqual(resolveGoal(25, overrides, 12, 1), 25);
  // Override do colaborador
  assert.strictEqual(resolveGoal(25, overrides, 10, 1), 50);
  // Override com nulo (deve voltar para a padrão do setor)
  assert.strictEqual(resolveGoal(25, overrides, 10, 2), 25);
  console.log('✔ Teste 2 Passou: Resolução de metas (herança padrão e override individual)');
}

// 3. Teste de cálculo de dias úteis com atividade (proxy de dias trabalhados)
{
  const activities: ExecutionActivity[] = [
    { user_id: 1, stage_id: 1, end_time: '2026-07-28T10:00:00Z', quantity: 5 },
    { user_id: 1, stage_id: 1, end_time: '2026-07-28T15:00:00Z', quantity: 10 },
    { user_id: 1, stage_id: 2, end_time: '2026-07-29T09:00:00Z', quantity: 2 },
    { user_id: 2, stage_id: 1, end_time: '2026-07-28T11:00:00Z', quantity: 8 },
    { user_id: 1, stage_id: 1, end_time: '2026-07-31T18:00:00Z', quantity: 12 }
  ];

  // Filtra de 2026-07-28 a 2026-07-30
  // User 1 ativo em 28/07 e 29/07 -> 2 dias ativos
  const workedDaysUser1 = calculateWorkedDays(activities, 1, '2026-07-28T00:00:00Z', '2026-07-30T23:59:59Z');
  assert.strictEqual(workedDaysUser1, 2, 'User 1 deve ter 2 dias trabalhados no período');

  // User 2 ativo apenas em 28/07 -> 1 dia ativo
  const workedDaysUser2 = calculateWorkedDays(activities, 2, '2026-07-28T00:00:00Z', '2026-07-30T23:59:59Z');
  assert.strictEqual(workedDaysUser2, 1, 'User 2 deve ter 1 dia trabalhado no período');

  // Sem atividades -> retorna 1 (fallback proxy)
  const workedDaysNoActivity = calculateWorkedDays(activities, 3, '2026-07-28T00:00:00Z', '2026-07-30T23:59:59Z');
  assert.strictEqual(workedDaysNoActivity, 1, 'Falta de atividade deve retornar fallback de 1 dia para evitar divisão por 0');

  console.log('✔ Teste 3 Passou: Cálculo de dias trabalhados ativos');
}

console.log('--- Todos os Testes de Metas Passaram com Sucesso! ---');
