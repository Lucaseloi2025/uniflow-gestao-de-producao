import { describe, it, expect } from 'vitest';
import { isOrderCompleted } from '../src/lib/utils';

describe('Regra de Ocultação de Pedidos Finalizados da Lista de Entrada e Impressão', () => {
  it('1. Deve identificar status "Pronto" como concluído', () => {
    const order = { id: 1, status: 'Pronto', stages_status: [] };
    expect(isOrderCompleted(order)).toBe(true);
  });

  it('2. Deve identificar status "Entregue" como concluído', () => {
    const order = { id: 2, status: 'Entregue', stages_status: [] };
    expect(isOrderCompleted(order)).toBe(true);
  });

  it('3. Deve identificar status "Cancelado" como concluído', () => {
    const order = { id: 3, status: 'Cancelado', stages_status: [] };
    expect(isOrderCompleted(order)).toBe(true);
  });

  it('4. Deve identificar como concluído quando todas as etapas em stages_status estiverem finalizadas', () => {
    const order = {
      id: 4,
      status: 'Em Produção',
      stages_status: [
        { id: 1, name: 'Corte', finished: true },
        { id: 2, name: 'Estampagem', finished: true },
        { id: 3, name: 'Costura', finished: true },
      ],
    };
    expect(isOrderCompleted(order)).toBe(true);
  });

  it('5. Não deve identificar como concluído quando houver etapas pendentes', () => {
    const order = {
      id: 5,
      status: 'Em Produção',
      stages_status: [
        { id: 1, name: 'Corte', finished: true },
        { id: 2, name: 'Estampagem', finished: false },
        { id: 3, name: 'Costura', finished: false },
      ],
    };
    expect(isOrderCompleted(order)).toBe(false);
  });

  it('6. Não deve identificar como concluído pedidos novos em "Entrada"', () => {
    const order = {
      id: 6,
      status: 'Entrada',
      stages_status: [
        { id: 1, name: 'Corte', finished: false },
      ],
    };
    expect(isOrderCompleted(order)).toBe(false);
  });

  it('7. Filtro padrão (showCompletedOrders = false) deve excluir pedidos finalizados', () => {
    const orders = [
      { id: 101, order_number: 'PED-101', client_name: 'Alpha', status: 'Entrada', stages_status: [{ id: 1, finished: false }] },
      { id: 102, order_number: 'PED-102', client_name: 'Beta', status: 'Em Produção', stages_status: [{ id: 1, finished: true }, { id: 2, finished: false }] },
      { id: 103, order_number: 'PED-103', client_name: 'Gamma (Pronto)', status: 'Pronto', stages_status: [{ id: 1, finished: true }] },
      { id: 104, order_number: 'PED-104', client_name: 'Delta (Entregue)', status: 'Entregue', stages_status: [{ id: 1, finished: true }] },
      { id: 105, order_number: 'PED-105', client_name: 'Epsilon (Todas etapas finalizadas)', status: 'Em Produção', stages_status: [{ id: 1, finished: true }, { id: 2, finished: true }] },
    ];

    const showCompletedOrders = false;
    const filteredOrders = orders.filter(o => {
      if (showCompletedOrders) return true;
      return !isOrderCompleted(o);
    });

    // Somente PED-101 e PED-102 devem aparecer na fila/lista de entrada
    expect(filteredOrders.map(o => o.id)).toEqual([101, 102]);
    expect(filteredOrders.find(o => o.id === 103)).toBeUndefined();
    expect(filteredOrders.find(o => o.id === 104)).toBeUndefined();
    expect(filteredOrders.find(o => o.id === 105)).toBeUndefined();
  });

  it('8. Quando showCompletedOrders = true, deve permitir visualizar todos os pedidos', () => {
    const orders = [
      { id: 101, status: 'Entrada', stages_status: [] },
      { id: 102, status: 'Pronto', stages_status: [] },
      { id: 103, status: 'Entregue', stages_status: [] },
    ];

    const showCompletedOrders = true;
    const filteredOrders = orders.filter(o => {
      if (showCompletedOrders) return true;
      return !isOrderCompleted(o);
    });

    expect(filteredOrders.length).toBe(3);
  });
});
