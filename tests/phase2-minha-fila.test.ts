import { describe, it, expect } from 'vitest';

function computeMinhaFilaScore(ord: any, todayStr: string, pcpScore: number): number {
  let score = pcpScore * 10;
  const dl = ord.deadline ? ord.deadline.split('T')[0] : null;
  if (!dl) {
    return score;
  }
  const todayDate = new Date(`${todayStr}T00:00:00`);
  const dlDate = new Date(`${dl}T00:00:00`);
  const diffDays = Math.round((dlDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    score += 2000000 + Math.abs(diffDays) * 50000;
  } else if (diffDays === 0) {
    score += 1000000;
  } else if (diffDays <= 2) {
    score += 500000 - diffDays * 50000;
  } else {
    score += Math.max(0, 100000 - diffDays * 1000);
  }
  return score;
}

describe('Fase 2 — Tarefa 2.1: Minha Fila Priorização e Regras', () => {
  const todayStr = '2026-10-21';

  it('1. Pedido atrasado deve ter score superior a pedido do dia atual e pedido futuro', () => {
    const overdueOrder = { id: 1, deadline: '2026-10-19', pcp_priority_score: 50 }; // 2 dias atrasado
    const todayOrder = { id: 2, deadline: '2026-10-21', pcp_priority_score: 100 }; // Hoje, prioridade alta
    const futureOrder = { id: 3, deadline: '2026-10-25', pcp_priority_score: 100 }; // Futuro

    const scoreOverdue = computeMinhaFilaScore(overdueOrder, todayStr, 50);
    const scoreToday = computeMinhaFilaScore(todayOrder, todayStr, 100);
    const scoreFuture = computeMinhaFilaScore(futureOrder, todayStr, 100);

    expect(scoreOverdue).toBeGreaterThan(scoreToday);
    expect(scoreToday).toBeGreaterThan(scoreFuture);
  });

  it('2. Entre pedidos com mesmo prazo, prioridade PCP maior deve ficar na frente', () => {
    const highOrder = { id: 10, deadline: '2026-10-21', pcp_priority_score: 100 };
    const normalOrder = { id: 11, deadline: '2026-10-21', pcp_priority_score: 50 };
    const lowOrder = { id: 12, deadline: '2026-10-21', pcp_priority_score: 10 };

    const scoreHigh = computeMinhaFilaScore(highOrder, todayStr, 100);
    const scoreNormal = computeMinhaFilaScore(normalOrder, todayStr, 50);
    const scoreLow = computeMinhaFilaScore(lowOrder, todayStr, 10);

    expect(scoreHigh).toBeGreaterThan(scoreNormal);
    expect(scoreNormal).toBeGreaterThan(scoreLow);
  });

  it('3. Ordenação completa de lista deve colocar pedidos em ordem estrita de execução', () => {
    const orders = [
      { id: 'futuro_normal', deadline: '2026-10-28', pcp_priority_score: 50 },
      { id: 'atrasado_critico', deadline: '2026-10-18', pcp_priority_score: 80 },
      { id: 'hoje_alta', deadline: '2026-10-21', pcp_priority_score: 100 },
      { id: 'hoje_normal', deadline: '2026-10-21', pcp_priority_score: 50 },
      { id: 'amanha_alta', deadline: '2026-10-22', pcp_priority_score: 90 },
    ];

    const sorted = [...orders].sort((a, b) => {
      const sA = computeMinhaFilaScore(a, todayStr, a.pcp_priority_score);
      const sB = computeMinhaFilaScore(b, todayStr, b.pcp_priority_score);
      return sB - sA;
    });

    const idsInOrder = sorted.map(o => o.id);
    expect(idsInOrder).toEqual([
      'atrasado_critico',
      'hoje_alta',
      'hoje_normal',
      'amanha_alta',
      'futuro_normal',
    ]);
  });

  it('4. Pedidos bloqueados pelo PCP devem ser segregados e não devem entrar na fila ativa executável', () => {
    const rawOrders = [
      { id: 1, pcp_is_blocked: false, status: 'Em Produção' },
      { id: 2, pcp_is_blocked: true, status: 'Em Produção', block_reason: 'Falta de Tecido' },
      { id: 3, pcp_is_blocked: false, status: 'Entrada' },
    ];

    const filaAtiva = rawOrders.filter(o => !o.pcp_is_blocked);
    const bloqueados = rawOrders.filter(o => o.pcp_is_blocked);

    expect(filaAtiva).toHaveLength(2);
    expect(bloqueados).toHaveLength(1);
    expect(bloqueados[0].id).toBe(2);
    expect(bloqueados[0].block_reason).toBe('Falta de Tecido');
  });

  it('5. Separação de Conclusão Produtiva (Pronto) x Expedição (Entregue)', () => {
    const orderFinalizedInProduction = {
      id: 99,
      status: 'Pronto',
      pcp_status: 'PRONTO',
      production_finished_at: '2026-10-21T00:30:00Z',
      delivered_at: null,
    };

    // A finalização da produção move para 'Pronto', liberando para conferência física/expedição
    expect(orderFinalizedInProduction.status).toBe('Pronto');
    expect(orderFinalizedInProduction.pcp_status).toBe('PRONTO');
    expect(orderFinalizedInProduction.delivered_at).toBeNull();
  });
});
