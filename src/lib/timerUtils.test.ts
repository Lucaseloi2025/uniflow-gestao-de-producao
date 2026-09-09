import assert from 'node:assert';
import { calculateExecutionTimes, ExecutionRecord, PauseRecord } from './timerUtils.js';

console.log('--- Iniciando Suíte de Testes do Timer ---');

// 1. Definição dos instantes de tempo (timestamps fixos)
const T0_START = new Date('2026-07-28T10:00:00Z').getTime(); // Início da etapa
const T1_PAUSE_1 = T0_START + 10 * 60 * 1000;                // Pausa após 10 minutos (600s)
const T2_RESUME_1 = T1_PAUSE_1 + 60 * 60 * 1000;             // Retomada 1 hora depois
const T3_RUNNING_2 = T2_RESUME_1 + 5 * 60 * 1000;            // 5 minutos após retomada (300s de sessão 2)
const T4_PAUSE_2 = T3_RUNNING_2;                             // Segunda pausa ativada
const T5_FINISH = T4_PAUSE_2 + 10 * 1000;                    // Finalização da etapa

// 2. Teste Estado 1: Em andamento na Sessão 1 (após 5 min de trabalho)
{
  const exec: ExecutionRecord = {
    id: 1,
    start_time: new Date(T0_START).toISOString(),
    status: 'Em andamento'
  };
  const res = calculateExecutionTimes(exec, [], T0_START + 5 * 60 * 1000);
  assert.strictEqual(res.totalAccumulatedSeconds, 300, 'Sessão 1 decorrida deve ser 300s');
  assert.strictEqual(res.currentSessionSeconds, 300, 'Sessão atual deve ser 300s');
  assert.strictEqual(res.isPaused, false, 'Não deve estar pausado');
  console.log('✔ Teste 1 Passou: Início de execução (Sessão 1 em andamento)');
}

// 3. Teste Estado 2: Primeiro Pausar (Pausa 1 ativada)
const pause1: PauseRecord = {
  id: 101,
  execution_id: 1,
  start_pause: new Date(T1_PAUSE_1).toISOString(),
  end_pause: null,
  duration_seconds: null
};

{
  const exec: ExecutionRecord = {
    id: 1,
    start_time: new Date(T0_START).toISOString(),
    status: 'Pausado'
  };
  // Verificar no momento da pausa
  const resAtPause = calculateExecutionTimes(exec, [pause1], T1_PAUSE_1);
  assert.strictEqual(resAtPause.totalAccumulatedSeconds, 600, 'Total acumulado na pausa deve ser 600s');
  assert.strictEqual(resAtPause.currentSessionSeconds, 0, 'Sessão atual deve ser 0 quando pausado');
  assert.strictEqual(resAtPause.isPaused, true, 'Deve estar pausado');

  // Verificar 1 hora depois, AINDA PAUSADO (o tempo deve permanecer CONGELADO em 600s!)
  const res1HourLater = calculateExecutionTimes(exec, [pause1], T2_RESUME_1);
  assert.strictEqual(res1HourLater.totalAccumulatedSeconds, 600, 'Tempo total DEVE PERMANECER CONGELADO em 600s durante a pausa!');
  assert.strictEqual(res1HourLater.currentSessionSeconds, 0, 'Sessão atual DEVE SER 0');
  console.log('✔ Teste 2 Passou: Primeira pausa (Tempo congelado durante 1h de pausa)');
}

// 4. Teste Estado 3: Retomada (Sessão 2 em andamento)
const completedPause1: PauseRecord = {
  ...pause1,
  end_pause: new Date(T2_RESUME_1).toISOString(),
  duration_seconds: 3600 // 1 hora de pausa
};

{
  const exec: ExecutionRecord = {
    id: 1,
    start_time: new Date(T0_START).toISOString(),
    status: 'Em andamento'
  };

  // 5 minutos após retomar
  const resRunning2 = calculateExecutionTimes(exec, [completedPause1], T3_RUNNING_2);
  assert.strictEqual(resRunning2.currentSessionSeconds, 300, 'Sessão 2 deve ter 300s decorridos');
  assert.strictEqual(resRunning2.totalAccumulatedSeconds, 900, 'Total acumulado deve ser 600s (sessão 1) + 300s (sessão 2) = 900s');
  assert.strictEqual(resRunning2.isPaused, false);
  console.log('✔ Teste 3 Passou: Retomada (Sessão 2 soma corretamente com a Sessão 1)');
}

// 5. Teste Estado 4: Segunda Pausa e Finalização
const completedPause2: PauseRecord = {
  id: 102,
  execution_id: 1,
  start_pause: new Date(T4_PAUSE_2).toISOString(),
  end_pause: new Date(T4_PAUSE_2 + 5000).toISOString(),
  duration_seconds: 5
};

{
  const execFinal: ExecutionRecord = {
    id: 1,
    start_time: new Date(T0_START).toISOString(),
    end_time: new Date(T5_FINISH).toISOString(),
    status: 'Finalizado',
    total_time_seconds: 900
  };

  const resFinal = calculateExecutionTimes(execFinal, [completedPause1, completedPause2], T5_FINISH);
  assert.strictEqual(resFinal.totalAccumulatedSeconds, 900, 'Execução finalizada deve retornar exatamente 900s');
  assert.strictEqual(resFinal.currentSessionSeconds, 0);
  console.log('✔ Teste 4 Passou: Finalização (Tempo total registrado corretamente)');
}

console.log('--- Todos os Testes do Timer Passaram com Sucesso! ---');
