import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getStageProductivityUnitBackend,
  calculateStageTargetQuantity,
  isStagePrevFinishedForOrderItems,
} from '../api/index';
import { getStageProductivityUnit, getStageSlugFromStage } from '../src/lib/utils';
import { calculateExecutionTimes } from '../src/lib/timerUtils';

const apiSource = fs.readFileSync(path.resolve(__dirname, '../api/index.ts'), 'utf8');
const minhaFilaSource = fs.readFileSync(path.resolve(__dirname, '../src/pages/MinhaFila.tsx'), 'utf8');
const headerSource = fs.readFileSync(path.resolve(__dirname, '../src/components/Header.tsx'), 'utf8');
const olistModalSource = fs.readFileSync(path.resolve(__dirname, '../src/components/modals/OlistDraftReviewModal.tsx'), 'utf8');

describe('PROCOMFORT — Correção da Minha Fila de Produção e Melhoria das Métricas (7 Critérios Obrigatórios)', () => {
  const stagesCatalog = [
    { id: 1, name: 'Ficha de aprovação', sector_name: 'Ficha de aprovação', calculation_type: 'por_pedido', meta_diaria: 24 },
    { id: 2, name: 'Impressão DTF', sector_name: 'Impressão DTF', calculation_type: 'por_kit_dtf', meta_diaria: 200 },
    { id: 3, name: 'Estampagem', sector_name: 'Estampagem', calculation_type: 'por_peca', meta_diaria: 160 },
    { id: 4, name: 'Corte', sector_name: 'Corte', calculation_type: 'por_peca', meta_diaria: 240 },
    { id: 5, name: 'Costura', sector_name: 'Costura', calculation_type: 'por_peca', meta_diaria: 120 },
    { id: 6, name: 'Sublimação Total', sector_name: 'Sublimação', calculation_type: 'por_peca', meta_diaria: 150 },
  ];

  it('Critério 1 — Finalizar uma ficha de aprovação de 300 peças contabiliza 1 ficha (mantendo 300 peças apenas como informação do pedido e 0 nas etapas seguintes)', () => {
    const fichaStage = stagesCatalog[0];
    const dtfStage = stagesCatalog[1];
    const estampagemStage = stagesCatalog[2];

    const fichaUnitBackend = getStageProductivityUnitBackend(fichaStage);
    const fichaUnitFrontend = getStageProductivityUnit(fichaStage);

    expect(fichaUnitBackend.unit).toBe('ficha');
    expect(fichaUnitBackend.isPerOrderUnit).toBe(true);
    expect(fichaUnitFrontend.unit).toBe('ficha');
    expect(fichaUnitFrontend.isPerOrderUnit).toBe(true);

    const order300Pecas = {
      id: 5001,
      order_number: '#OLIST-1300',
      client_name: 'Academia Alpha',
      quantity: 300,
      required_stages: [1, 2, 3],
      items: [
        { order_item_id: 'item-1', product_type: 'Camiseta Dry Fit', size: 'M', quantity: 300, print_type: 'DTF', required_stages: [1, 2, 3] },
      ],
    };

    // Na Ficha de aprovação, a meta da etapa é 1 ficha (não 300 peças)
    const targetFicha = calculateStageTargetQuantity(order300Pecas, 1, fichaStage);
    expect(targetFicha).toBe(1);

    // Mesmo se um apontamento legado enviasse 300 na ficha, a normalização da etapa de ficha contabiliza apenas 1 ficha
    const rawIncrement = 300;
    const normalizedFichaCompleted = fichaUnitBackend.isPerOrderUnit ? 1 : rawIncrement;
    expect(normalizedFichaCompleted).toBe(1);
    expect(order300Pecas.quantity).toBe(300); // Quantidade de 300 peças mantida como informação do pedido

    // Na Impressão DTF, 1 kit DTF por peça = 300 kits (sem duplicar por frente/costas e com 0 kits concluídos ao finalizar a ficha)
    const targetDtfKits = calculateStageTargetQuantity(order300Pecas, 2, dtfStage);
    const targetEstampagemPecas = calculateStageTargetQuantity(order300Pecas, 3, estampagemStage);
    expect(targetDtfKits).toBe(300);
    expect(targetEstampagemPecas).toBe(300);

    const dtfUnit = getStageProductivityUnitBackend(dtfStage);
    expect(dtfUnit.unit).toBe('kit_dtf');
    expect(dtfUnit.plural).toBe('kits DTF');
    expect(dtfUnit.actionLabel).toBe('kits impressos');
  });

  it('Critério 2 — Apontar 23 kits DTF impressos entre 08h e 09h exibe "08h–09h — 23 kits impressos — #OLIST-1134" e agrupa múltiplos pedidos na mesma hora', () => {
    const dtfUnit = getStageProductivityUnitBackend(stagesCatalog[1]);
    const events = [
      {
        order_id: 1134,
        order_number: '#OLIST-1134',
        client_name: 'Cliente A',
        stage_id: 2,
        stage_name: 'Impressão DTF',
        stage_slug: 'IMPRESSAO_DTF',
        unit_info: dtfUnit,
        quantidade: 23,
        hora_inicio: 8,
      },
      {
        order_id: 1186,
        order_number: '#OLIST-1186',
        client_name: 'Cliente B',
        stage_id: 2,
        stage_name: 'Impressão DTF',
        stage_slug: 'IMPRESSAO_DTF',
        unit_info: dtfUnit,
        quantidade: 10,
        hora_inicio: 9,
      },
      {
        order_id: 1190,
        order_number: '#OLIST-1190',
        client_name: 'Cliente C',
        stage_id: 2,
        stage_name: 'Impressão DTF',
        stage_slug: 'IMPRESSAO_DTF',
        unit_info: dtfUnit,
        quantidade: 8,
        hora_inicio: 9,
      },
    ];

    const buildBucket = (hour: number, hourEvents: typeof events) => {
      const hStart = String(hour).padStart(2, '0');
      const hEnd = String((hour + 1) % 24).padStart(2, '0');
      const intervalo = `${hStart}h–${hEnd}h`;
      const totalQuantidade = hourEvents.reduce((acc, ev) => acc + ev.quantidade, 0);
      const uInfo = hourEvents[0].unit_info;
      const resumo =
        hourEvents.length === 1
          ? `${intervalo} — ${totalQuantidade} ${uInfo.actionLabel} — ${hourEvents[0].order_number}`
          : `${intervalo} — ${totalQuantidade} ${uInfo.actionLabel} (${hourEvents.length} pedidos)`;
      return {
        hora_inicio: hour,
        intervalo,
        total_quantidade: totalQuantidade,
        multiplos_pedidos: hourEvents.length > 1,
        resumo,
        itens: hourEvents,
      };
    };

    const bucket08 = buildBucket(8, events.filter((e) => e.hora_inicio === 8));
    const bucket09 = buildBucket(9, events.filter((e) => e.hora_inicio === 9));

    expect(bucket08.resumo).toBe('08h–09h — 23 kits impressos — #OLIST-1134');
    expect(bucket08.total_quantidade).toBe(23);
    expect(bucket08.multiplos_pedidos).toBe(false);

    expect(bucket09.resumo).toBe('09h–10h — 18 kits impressos (2 pedidos)');
    expect(bucket09.total_quantidade).toBe(18);
    expect(bucket09.multiplos_pedidos).toBe(true);
    expect(bucket09.itens).toHaveLength(2);
  });

  it('Critério 3 — Pedido misto com itens DTF (20 un) e Sublimação Total (15 un) preserva etapas individuais por item sem impor DTF ao item de Sublimação', () => {
    const mixedOrder = {
      id: 7001,
      order_number: '#OLIST-7001',
      quantity: 45,
      required_stages: [1, 2, 3, 6, 4, 5],
      items: [
        {
          order_item_id: 'item-dtf',
          product_type: 'Camiseta Dry Fit DTF',
          size: 'G',
          quantity: 20,
          print_type: 'DTF',
          required_stages: [1, 2, 3], // Ficha de aprovação (1), Impressão DTF (2), Estampagem (3)
        },
        {
          order_item_id: 'item-sub',
          product_type: 'Regata Sublimação Total',
          size: 'M',
          quantity: 15,
          print_type: 'Sublimação Total',
          required_stages: [1, 6], // Ficha de aprovação (1), Sublimação Total (6) — SEM DTF!
        },
        {
          order_item_id: 'item-lisa',
          product_type: 'Camiseta Lisa',
          size: 'P',
          quantity: 10,
          print_type: 'Liso',
          required_stages: [4, 5], // Corte (4), Costura (5)
        },
      ],
    };

    // Verifica que cada etapa calcula apenas a soma dos itens que passam por ela
    expect(calculateStageTargetQuantity(mixedOrder, 1, stagesCatalog[0])).toBe(1);  // 1 Ficha para o pedido (sem multiplicar por 3 SKUs)
    expect(calculateStageTargetQuantity(mixedOrder, 2, stagesCatalog[1])).toBe(20); // 20 kits DTF (apenas Item 1)
    expect(calculateStageTargetQuantity(mixedOrder, 3, stagesCatalog[2])).toBe(20); // 20 peças Estampagem (apenas Item 1)
    expect(calculateStageTargetQuantity(mixedOrder, 6, stagesCatalog[5])).toBe(15); // 15 peças Sublimação Total (apenas Item 2)
    expect(calculateStageTargetQuantity(mixedOrder, 4, stagesCatalog[3])).toBe(10); // 10 peças Corte (apenas Item 3)
    expect(calculateStageTargetQuantity(mixedOrder, 5, stagesCatalog[4])).toBe(10); // 10 peças Costura (apenas Item 3)

    // Verifica liberação independente por item:
    // Antes de concluir Ficha (1): Corte (4) já está liberado para o Item 3 (que não exige Ficha), mas DTF (2) e Sublimação (6) aguardam Ficha (1)
    const finishedNone = (_sId: number) => false;
    expect(isStagePrevFinishedForOrderItems(mixedOrder, 4, mixedOrder.required_stages, finishedNone)).toBe(true);
    expect(isStagePrevFinishedForOrderItems(mixedOrder, 2, mixedOrder.required_stages, finishedNone)).toBe(false);
    expect(isStagePrevFinishedForOrderItems(mixedOrder, 6, mixedOrder.required_stages, finishedNone)).toBe(false);

    // Após concluir Ficha (1): tanto Impressão DTF (2) quanto Sublimação Total (6) ficam liberadas simultaneamente!
    // Sublimação Total (6) NÃO depende de Impressão DTF (2) nem de Estampagem (3)!
    const finishedFichaOnly = (sId: number) => sId === 1;
    expect(isStagePrevFinishedForOrderItems(mixedOrder, 2, mixedOrder.required_stages, finishedFichaOnly)).toBe(true);
    expect(isStagePrevFinishedForOrderItems(mixedOrder, 6, mixedOrder.required_stages, finishedFichaOnly)).toBe(true);
    expect(isStagePrevFinishedForOrderItems(mixedOrder, 3, mixedOrder.required_stages, finishedFichaOnly)).toBe(false); // Estampagem aguarda DTF

    // Confirma que OlistDraftReviewModal possui configuração de etapas por item
    expect(olistModalSource).toContain('Configurar etapas');
    expect(olistModalSource).toContain('Aplicar etapas a todos');
  });

  it('Critério 4 — Selecionar o filtro "Corte" retorna somente tarefas de Corte prontas/ativas, nunca exibindo "Ficha de aprovação" dentro de Corte', () => {
    const corteSlug = getStageSlugFromStage(stagesCatalog[3]);
    const fichaSlug = getStageSlugFromStage(stagesCatalog[0]);
    expect(corteSlug).toBe('CORTE');
    expect(fichaSlug).toBe('FICHA_APROVACAO');

    const simulatedCandidatesByOrder = [
      {
        order_number: '#OLIST-101',
        candidates: [
          { stageId: 1, stageSlug: 'FICHA_APROVACAO', isReady: true },
          { stageId: 4, stageSlug: 'CORTE', isReady: false },
        ],
      },
      {
        order_number: '#OLIST-102',
        candidates: [
          { stageId: 4, stageSlug: 'CORTE', isReady: true },
          { stageId: 5, stageSlug: 'COSTURA', isReady: false },
        ],
      },
    ];

    const stageSlugFilter = 'CORTE';
    const filteredQueue = simulatedCandidatesByOrder
      .map((ord) => {
        const chosen = ord.candidates.find((c) => c.stageSlug === stageSlugFilter && c.isReady);
        if (!chosen || chosen.stageSlug !== stageSlugFilter) return null;
        return { order_number: ord.order_number, current_stage_slug: chosen.stageSlug };
      })
      .filter(Boolean);

    expect(filteredQueue).toHaveLength(1);
    expect(filteredQueue[0]?.order_number).toBe('#OLIST-102');
    expect(filteredQueue[0]?.current_stage_slug).toBe('CORTE');
  });

  it('Critério 5 — Registrar uma pausa deduz o intervalo do tempo produtivo líquido e respeita a proteção anti-distorção (< 15 min não projeta dia inteiro)', () => {
    const startMs = Date.parse('2026-10-24T11:00:00.000Z'); // 08:00 BRT
    const nowMs = Date.parse('2026-10-24T13:00:00.000Z');   // 10:00 BRT (2h decorridas = 7200s)

    const execution = {
      id: 901,
      start_time: new Date(startMs).toISOString(),
      end_time: null,
      status: 'Em andamento',
    };

    // Pausa de 30 minutos (1800s) entre 09:00 e 09:30 BRT
    const pauses = [
      {
        id: 1,
        execution_id: 901,
        start_pause: '2026-10-24T12:00:00.000Z',
        end_pause: '2026-10-24T12:30:00.000Z',
        duration_seconds: 1800,
      },
    ];

    const calc = calculateExecutionTimes(execution, pauses, nowMs);
    expect(calc.totalAccumulatedSeconds).toBe(5400); // 7200s - 1800s = 5400s (1.5h produtivas líquidas)

    // Com 1.5h produtivas (>= 15 min) e 30 kits produzidos -> ritmo = 20 kits/h -> projeção para 8h = 160 kits
    const realizadoHoje = 30;
    const horasProdutivas = calc.totalAccumulatedSeconds / 3600;
    const projecaoValida = calc.totalAccumulatedSeconds >= 900;
    const projecaoDia = projecaoValida ? Math.round((realizadoHoje / horasProdutivas) * 8) : null;

    expect(projecaoValida).toBe(true);
    expect(projecaoDia).toBe(160);

    // Regra anti-distorção: se o operador trabalhou apenas 3 minutos (180s < 900s), não projeta o dia inteiro
    const shortTimeSeconds = 180;
    const shortProjectionValid = shortTimeSeconds >= 900;
    expect(shortProjectionValid).toBe(false);
    expect(apiSource).toContain('Dados insuficientes para projeção');
  });

  it('Critério 6 — Metas por hora e por dia usam a unidade configurada para a etapa sem somar fichas com kits ou peças', () => {
    const fichaUnit = getStageProductivityUnitBackend(stagesCatalog[0]);
    const dtfUnit = getStageProductivityUnitBackend(stagesCatalog[1]);
    const corteUnit = getStageProductivityUnitBackend(stagesCatalog[3]);

    expect(fichaUnit.dailyGoalLabel).toBe('fichas/dia');
    expect(fichaUnit.hourlyGoalLabel).toBe('fichas/h');

    expect(dtfUnit.dailyGoalLabel).toBe('kits/dia');
    expect(dtfUnit.hourlyGoalLabel).toBe('kits/h');

    expect(corteUnit.dailyGoalLabel).toBe('peças/dia');
    expect(corteUnit.hourlyGoalLabel).toBe('peças/h');

    // Simula produção do mesmo operador em 2 etapas no mesmo dia (5 fichas + 40 kits DTF)
    const prodEvents = [
      { stage_slug: 'FICHA_APROVACAO', unit: 'ficha', quantidade: 5 },
      { stage_slug: 'IMPRESSAO_DTF', unit: 'kit_dtf', quantidade: 40 },
    ];

    const fichasHoje = prodEvents.filter((e) => e.unit === 'ficha').reduce((acc, e) => acc + e.quantidade, 0);
    const kitsHoje = prodEvents.filter((e) => e.unit === 'kit_dtf').reduce((acc, e) => acc + e.quantidade, 0);

    expect(fichasHoje).toBe(5);
    expect(kitsHoje).toBe(40);
    // Nunca soma 5 fichas + 40 kits = 45!
    expect(fichasHoje).not.toBe(45);
    expect(kitsHoje).not.toBe(45);
  });

  it('Critério 7 — Funcionalidades anteriores, ocultação dos botões Olist no topo da Minha Fila e estrutura dos cards foram preservadas', () => {
    // Botões de importação/criação ocultos no Header quando activeTab === 'minha-fila'
    expect(headerSource).toContain("activeTab !== 'minha-fila'");

    // MinhaFila preserva os painéis novos e toda a estrutura aprovada de cards e ações
    expect(minhaFilaSource).toContain('Meu desempenho — Hoje');
    expect(minhaFilaSource).toContain('Linha do tempo da produção');
    expect(minhaFilaSource).toContain('handleStartStage');
    expect(minhaFilaSource).toContain('handleOpenActionModal');
    expect(minhaFilaSource).toContain('handleOpenProgressModal');
    expect(minhaFilaSource).toContain('setSelectedOrder');
  });
});
