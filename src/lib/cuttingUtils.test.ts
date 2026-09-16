import {
  aggregateCuttingDemand,
  allocateCuttingPieces,
  reallocateOnCancellation,
  extractItemDetails,
  sortSizes,
  groupCuttingDemandByRawMaterial,
  formatDemandForCutPlan
} from './cuttingUtils';
import type { CorteAllocationLog } from '../types';

function runCuttingTests() {
  console.log("=== Running Unit Tests for cuttingUtils (Painel de Corte Consolidado) ===");
  let passed = 0;
  let failed = 0;

  const assertEqual = (actual: any, expected: any, testName: string) => {
    if (actual === expected || JSON.stringify(actual) === JSON.stringify(expected)) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      failed++;
    }
  };

  const logsStore: CorteAllocationLog[] = [];

  // Setup Mock Orders:
  // Order 101: Deadline 2026-08-20 (Earliest), Needs 4 Dry Fit Azul G
  // Order 102: Deadline 2026-08-22, Needs 3 Dry Fit Azul G
  // Order 103: Deadline 2026-08-25 (Latest), Needs 5 Dry Fit Azul G
  const mockOrders = [
    {
      id: 101,
      order_number: 'OLIST-101',
      client_name: 'Cliente A',
      deadline: '2026-08-20T12:00:00Z',
      product_type: 'Camiseta Básica',
      status: 'Em Produção',
      quantity: 4,
      total_via_corte: 4,
      stages_status: [
        { id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 4 }
      ],
      items: [
        { description: 'Camiseta Básica Dry Fit Azul G', fabric: 'Dry Fit', color: 'Azul', size: 'G', quantity: 4, qty_corte: 4, qty_corte_allocated: 0 }
      ]
    },
    {
      id: 102,
      order_number: 'OLIST-102',
      client_name: 'Cliente B',
      deadline: '2026-08-22T12:00:00Z',
      product_type: 'Camiseta Básica',
      status: 'Em Produção',
      quantity: 3,
      total_via_corte: 3,
      stages_status: [
        { id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 3 }
      ],
      items: [
        { description: 'Camiseta Básica Dry Fit Azul G', fabric: 'Dry Fit', color: 'Azul', size: 'G', quantity: 3, qty_corte: 3, qty_corte_allocated: 0 }
      ]
    },
    {
      id: 103,
      order_number: 'OLIST-103',
      client_name: 'Cliente C',
      deadline: '2026-08-25T12:00:00Z',
      product_type: 'Camiseta Básica',
      status: 'Em Produção',
      quantity: 5,
      total_via_corte: 5,
      stages_status: [
        { id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 5 }
      ],
      items: [
        { description: 'Camiseta Básica Dry Fit Azul G', fabric: 'Dry Fit', color: 'Azul', size: 'G', quantity: 5, qty_corte: 5, qty_corte_allocated: 0 }
      ]
    }
  ];

  // Test 1: Aggregation of Cutting Demand
  const aggregated = aggregateCuttingDemand(mockOrders);
  assertEqual(aggregated.length, 1, "Test 1.1: Aggregation should collapse into 1 item key line");
  assertEqual(aggregated[0].item_key, 'Camiseta Básica | Dry Fit | Azul | G', "Test 1.2: Item key format should be Modelo | Tecido | Cor | Tamanho");
  assertEqual(aggregated[0].total_necessario, 12, "Test 1.3: Total needed should be 4 + 3 + 5 = 12 pieces");
  assertEqual(aggregated[0].pedidos_count, 3, "Test 1.4: Should count 3 waiting orders");
  assertEqual(aggregated[0].prazo_mais_proximo, '2026-08-20T12:00:00Z', "Test 1.5: Earliest deadline should be Order 101 (2026-08-20)");
  assertEqual(aggregated[0].pedidos_waiting[0].order_id, 101, "Test 1.6: Priority queue 1st order must be Order 101");
  assertEqual(aggregated[0].pedidos_waiting[1].order_id, 102, "Test 1.7: Priority queue 2nd order must be Order 102");
  assertEqual(aggregated[0].pedidos_waiting[2].order_id, 103, "Test 1.8: Priority queue 3rd order must be Order 103");

  // Test 2: Partial Allocation (cut 6 pieces out of 12)
  const allocRes1 = allocateCuttingPieces(mockOrders, 'Camiseta Básica | Dry Fit | Azul | G', 6, 'Operator 1', 1, logsStore);
  assertEqual(allocRes1.success, true, "Test 2.1: Allocation call should succeed");
  assertEqual(allocRes1.total_allocated, 6, "Test 2.2: Total allocated should be 6");

  assertEqual(mockOrders[0].items[0].qty_corte_allocated, 4, "Test 2.3: Order 101 should receive 4 pieces");
  assertEqual(mockOrders[0].stages_status[0].quantidade_boa, 4, "Test 2.4: Order 101 Corte stage quantidade_boa should be 4");
  assertEqual(mockOrders[0].stages_status[0].finished, true, "Test 2.5: Order 101 Corte stage should be finished (4/4)");

  assertEqual(mockOrders[1].items[0].qty_corte_allocated, 2, "Test 2.6: Order 102 should receive 2 pieces");
  assertEqual(mockOrders[1].stages_status[0].quantidade_boa, 2, "Test 2.7: Order 102 Corte stage quantidade_boa should be 2");
  assertEqual(mockOrders[1].stages_status[0].finished, false, "Test 2.8: Order 102 Corte stage should NOT be finished (2/3)");

  assertEqual(mockOrders[2].items[0].qty_corte_allocated, 0, "Test 2.9: Order 103 should receive 0 pieces");

  // Test 3: Aggregation after partial allocation
  const aggAfterPartial = aggregateCuttingDemand(mockOrders);
  assertEqual(aggAfterPartial[0].total_necessario, 6, "Test 3.1: Remaining aggregated total needed should now be 6 (1 for 102 + 5 for 103)");
  assertEqual(aggAfterPartial[0].pedidos_count, 2, "Test 3.2: Remaining waiting orders count should be 2");
  assertEqual(aggAfterPartial[0].prazo_mais_proximo, '2026-08-22T12:00:00Z', "Test 3.3: New earliest deadline should be Order 102 (2026-08-22)");

  // Test 4: Complete Remaining Allocation (cut 6 pieces)
  const allocRes2 = allocateCuttingPieces(mockOrders, 'Camiseta Básica | Dry Fit | Azul | G', 6, 'Operator 1', 1, logsStore);

  assertEqual(allocRes2.total_allocated, 6, "Test 4.1: Second allocation should allocate remaining 6 pieces");
  assertEqual(mockOrders[1].stages_status[0].finished, true, "Test 4.2: Order 102 Corte stage should now be finished (3/3)");
  assertEqual(mockOrders[2].stages_status[0].finished, true, "Test 4.3: Order 103 Corte stage should now be finished (5/5)");

  const aggFinal = aggregateCuttingDemand(mockOrders);
  assertEqual(aggFinal.length, 0, "Test 4.4: Aggregated demand should now be empty (0 items pending)");

  // Test 5: Reallocation on Order Cancellation
  mockOrders[0].status = 'Cancelado';
  mockOrders[1].items[0].qty_corte_allocated = 2; // 1 piece still needed
  mockOrders[1].stages_status[0].finished = false;

  const reallocated = reallocateOnCancellation(101, mockOrders, logsStore);
  assertEqual(reallocated.length > 0, true, "Test 5.1: Reallocation on cancellation should trigger");
  assertEqual(mockOrders[1].items[0].qty_corte_allocated, 3, "Test 5.2: Order 102 should be completed via freed pieces from cancelled order");
  assertEqual(mockOrders[1].stages_status[0].finished, true, "Test 5.3: Order 102 stage should finish via reallocation");

  // Test 6: Olist Order with total_via_corte > 0 but undefined item-level qty_corte
  const olistOrder = {
    id: 104,
    order_number: 'OLIST-999',
    client_name: 'Cliente Olist ERP',
    deadline: '2026-08-19T12:00:00Z',
    product_type: 'Dry Fit',
    status: 'Rascunho',
    quantity: 8,
    total_via_corte: 8,
    observations: 'Importado do Olist ERP | ⚠️ 8 pçs sem estoque (precisam de Corte)',
    stages_status: [
      { id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 8 }
    ],
    items: [
      { description: 'Camiseta Dry Fit Azul G', size: 'G', quantity: 8 }
    ]
  };

  const aggOlist = aggregateCuttingDemand([olistOrder]);
  assertEqual(aggOlist.length, 1, "Test 6.1: Should capture Olist order missing pieces even without item-level qty_corte");
  assertEqual(aggOlist[0].total_necessario, 8, "Test 6.2: Total needed for Olist order should be 8 pieces");
  assertEqual(aggOlist[0].description, "Camiseta Dry Fit Azul G", "Test 6.3: Description should capture raw item description");

  // Test 7: MANDATORY REAL CASE REQ 8
  // "Camiseta Gola Redonda Dry Comfort Marrom - G2"
  const realItemReq8 = extractItemDetails({
    description: 'Camiseta Gola Redonda Dry Comfort Marrom - G2',
    sku: 'CM-GOL-MAR-G2',
    fabric: 'Dry Comfort',
    color: 'Marrom'
  });
  assertEqual(realItemReq8.product_type, 'Camiseta Gola Redonda', 'Test 7.1 (Req 8): Model correctly extracted as Camiseta Gola Redonda');
  assertEqual(realItemReq8.fabric, 'Dry Comfort', 'Test 7.2 (Req 8): Fabric correctly extracted as Dry Comfort');
  assertEqual(realItemReq8.color, 'Marrom', 'Test 7.3 (Req 8): Color correctly extracted as Marrom (Not Cor não informada)');
  assertEqual(realItemReq8.size, 'G2', 'Test 7.4 (Req 8): Size correctly extracted as G2 (Not Único or G)');
  assertEqual(realItemReq8.item_key, 'Camiseta Gola Redonda | Dry Comfort | Marrom | G2', 'Test 7.5 (Req 8): Item key formatted correctly');

  // Test 8: Mandatory Size Tests (Req 14)
  const itemPP = extractItemDetails({ description: 'Camiseta Dry Comfort Preto - PP' });
  assertEqual(itemPP.size, 'PP', 'Test 8.1: Size PP');

  const itemG = extractItemDetails({ description: 'Camiseta Dry Comfort Preto - G' });
  assertEqual(itemG.size, 'G', 'Test 8.2: Size G');

  const itemGG = extractItemDetails({ description: 'Camiseta Dry Comfort Preto - GG' });
  assertEqual(itemGG.size, 'GG', 'Test 8.3: Size GG');

  const itemG1 = extractItemDetails({ description: 'Camiseta Dry Comfort Marrom - G1' });
  assertEqual(itemG1.size, 'G1', 'Test 8.4: Size G1');

  const itemG3 = extractItemDetails({ description: 'Camiseta Dry Comfort Marrom - G3' });
  assertEqual(itemG3.size, 'G3', 'Test 8.5: Size G3');

  const itemG4 = extractItemDetails({ description: 'Camiseta Dry Comfort Marrom - G4' });
  assertEqual(itemG4.size, 'G4', 'Test 8.6: Size G4');

  const itemG5 = extractItemDetails({ description: 'Camiseta Dry Comfort Marrom - G5' });
  assertEqual(itemG5.size, 'G5', 'Test 8.7: Size G5');

  // Child Sizes
  const itemInf2 = extractItemDetails({ description: 'Camiseta Infantil Azul - Tam 2' });
  assertEqual(itemInf2.size, '2', 'Test 8.8: Child size 2');

  const itemInf10 = extractItemDetails({ description: 'Camiseta Infantil Azul - Tam 10' });
  assertEqual(itemInf10.size, '10', 'Test 8.9: Child size 10');

  const itemInf16 = extractItemDetails({ description: 'Camiseta Infantil Azul - Tam 16' });
  assertEqual(itemInf16.size, '16', 'Test 8.10: Child size 16');

  // False Positive Numeric Test: Camiseta Evento 2026 Azul - M
  const itemEvento = extractItemDetails({ description: 'Camiseta Evento 2026 Azul - M' });
  assertEqual(itemEvento.size, 'M', 'Test 8.11: Size should be M, ignoring year 2026 in title');

  // Test 9: Mandatory Color Tests (Req 15)
  const colorMarrom = extractItemDetails({ description: 'Dry Comfort Marrom - G2', color: 'Marrom' });
  assertEqual(colorMarrom.color, 'Marrom', 'Test 9.1: Color Marrom recognized');

  const colorPreto = extractItemDetails({ description: 'Dry Comfort Preto - GG', color: 'Preto' });
  assertEqual(colorPreto.color, 'Preto', 'Test 9.2: Color Preto recognized');

  const colorAzulMarinho = extractItemDetails({ description: 'Dry Comfort Azul Marinho - M', color: 'Azul Marinho' });
  assertEqual(colorAzulMarinho.color, 'Azul Marinho', 'Test 9.3: Color Azul Marinho recognized before Azul');

  // Test 11: Real DB cases where item has pre-stored size: 'Único' but description has explicit size suffix
  const itemStaleUnicoG1 = extractItemDetails({ description: 'Camiseta Gola Redonda PV Azul Marinho - G1', size: 'Único' });
  assertEqual(itemStaleUnicoG1.size, 'G1', 'Test 11.1: Pre-stored size Único overridden by - G1 in description');

  const itemStalePoloG1 = extractItemDetails({ description: 'Camisa Polo Pv Preta - G1', size: 'Único' });
  assertEqual(itemStalePoloG1.size, 'G1', 'Test 11.2: Pre-stored size Único overridden by - G1 in Polo description');

  const itemStaleChild2 = extractItemDetails({ description: 'Camiseta Infantil Gola Redonda PV Preto - 2', size: 'Único' });
  assertEqual(itemStaleChild2.size, '2', 'Test 11.3: Pre-stored size Único overridden by - 2 in Infantil description');

  // =========================================================================
  // AGRUPAMENTO POR MATÉRIA-PRIMA
  // Cenário 1: Mesmo tecido + mesma cor + modelos DIFERENTES -> 1 grupo
  // Camiseta Gola Redonda (20 un) + Babylook (12 un) = 32 peças
  // =========================================================================
  const orderGR = {
    id: 201, order_number: 'PED-201', status: 'Em Produção',
    total_via_corte: 20, quantity: 20,
    stages_status: [{ id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 20 }],
    items: [
      { product_type: 'Camiseta Gola Redonda', fabric: 'Dry Comfort', color: 'Batom Rouge', size: 'P', quantity: 8 },
      { product_type: 'Camiseta Gola Redonda', fabric: 'Dry Comfort', color: 'Batom Rouge', size: 'M', quantity: 10 },
      { product_type: 'Camiseta Gola Redonda', fabric: 'Dry Comfort', color: 'Batom Rouge', size: 'G1', quantity: 1 },
      { product_type: 'Camiseta Gola Redonda', fabric: 'Dry Comfort', color: 'Batom Rouge', size: 'G2', quantity: 1 }
    ]
  };
  const orderBL = {
    id: 202, order_number: 'PED-202', status: 'Em Produção',
    total_via_corte: 12, quantity: 12,
    stages_status: [{ id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 12 }],
    items: [
      { product_type: 'Babylook', fabric: 'Dry Comfort', color: 'Batom Rouge', size: 'PP', quantity: 1 },
      { product_type: 'Babylook', fabric: 'Dry Comfort', color: 'Batom Rouge', size: 'P', quantity: 3 },
      { product_type: 'Babylook', fabric: 'Dry Comfort', color: 'Batom Rouge', size: 'G', quantity: 8 }
    ]
  };
  const dem1 = aggregateCuttingDemand([orderGR as any, orderBL as any]);
  const grp1 = groupCuttingDemandByRawMaterial(dem1);
  assertEqual(grp1.groups.length, 1, "Cen.1.1: Mesmo tecido/cor + modelos diferentes -> 1 grupo");
  assertEqual(grp1.groups[0].total_necessario, 32, "Cen.1.2: Total 20+12=32 peças");
  assertEqual(grp1.groups[0].models_breakdown.length, 2, "Cen.1.3: 2 modelos no breakdown");
  assertEqual(grp1.incompleteItems.length, 0, "Cen.1.4: Nenhum item incompleto");

  // Cenário 2: Cores diferentes NÃO agrupam
  const orderCorDif = {
    id: 203, order_number: 'PED-203', status: 'Em Produção',
    total_via_corte: 5, quantity: 5,
    stages_status: [{ id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 5 }],
    items: [{ product_type: 'Camiseta Básica', fabric: 'Dry Comfort', color: 'Azul Royal', size: 'M', quantity: 5 }]
  };
  const dem2 = aggregateCuttingDemand([orderGR as any, orderCorDif as any]);
  const grp2 = groupCuttingDemandByRawMaterial(dem2);
  assertEqual(grp2.groups.length, 2, "Cen.2.1: Cores diferentes -> 2 grupos distintos");

  // Cenário 3: Tecidos diferentes NÃO agrupam
  const orderTecDif = {
    id: 204, order_number: 'PED-204', status: 'Em Produção',
    total_via_corte: 7, quantity: 7,
    stages_status: [{ id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 7 }],
    items: [{ product_type: 'Camiseta Básica', fabric: 'Algodão', color: 'Batom Rouge', size: 'M', quantity: 7 }]
  };
  const dem3 = aggregateCuttingDemand([orderGR as any, orderTecDif as any]);
  const grp3 = groupCuttingDemandByRawMaterial(dem3);
  assertEqual(grp3.groups.length, 2, "Cen.3.1: Tecidos diferentes -> 2 grupos distintos");

  // Cenário 4: Cor NÃO informada (sem campo técnico) -> incompleteItems, SEM grupo automático
  const orderSemCor = {
    id: 205, order_number: 'PED-205', status: 'Em Produção',
    total_via_corte: 10, quantity: 10,
    stages_status: [{ id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 10 }],
    items: [{ description: 'Camiseta Básica Batom Rouge - M', size: 'M', quantity: 10 }]
  };
  const dem4 = aggregateCuttingDemand([orderSemCor as any]);
  const grp4 = groupCuttingDemandByRawMaterial(dem4);
  assertEqual(grp4.groups.length, 0, "Cen.4.1: Sem cor técnica -> nenhum grupo automático");
  assertEqual(grp4.incompleteItems.length, 1, "Cen.4.2: Item vai para incompleteItems");

  // =========================================================================
  // Cenário 5: CENTRAL DE CORTE — Múltiplos modelos no mesmo plano de matéria-prima
  // DRY COMFORT | BATOM ROUGE | RAMADO | 1,60m
  // 1. Camiseta Gola Redonda: P: 8, M: 10, G1: 1, G2: 1 (Total: 20)
  // 2. Babylook: PP: 1, P: 3, G: 8 (Total: 12)
  // 3. Infantil: 4: 1, 6: 1, 10: 1 (Total: 3)
  // TOTAL DO PLANO = 35 peças
  // =========================================================================
  const orderCentral1 = {
    id: 301, order_number: 'PED-301', status: 'Em Produção', deadline: '2026-09-22',
    total_via_corte: 20, quantity: 20,
    stages_status: [{ id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 20 }],
    items: [
      { product_type: 'Camiseta Gola Redonda', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: 'P', quantity: 8, qty_corte: 8 },
      { product_type: 'Camiseta Gola Redonda', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: 'M', quantity: 10, qty_corte: 10 },
      { product_type: 'Camiseta Gola Redonda', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: 'G1', quantity: 1, qty_corte: 1 },
      { product_type: 'Camiseta Gola Redonda', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: 'G2', quantity: 1, qty_corte: 1 }
    ]
  };

  const orderCentral2 = {
    id: 302, order_number: 'PED-302', status: 'Em Produção', deadline: '2026-09-24',
    total_via_corte: 12, quantity: 12,
    stages_status: [{ id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 12 }],
    items: [
      { product_type: 'Babylook', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: 'PP', quantity: 1, qty_corte: 1 },
      { product_type: 'Babylook', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: 'P', quantity: 3, qty_corte: 3 },
      { product_type: 'Babylook', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: 'G', quantity: 8, qty_corte: 8 }
    ]
  };

  const orderCentral3 = {
    id: 303, order_number: 'PED-303', status: 'Em Produção', deadline: '2026-09-25',
    total_via_corte: 3, quantity: 3,
    stages_status: [{ id: 2, name: 'Corte', finished: false, quantidade_boa: 0, quantidade_pedido: 3 }],
    items: [
      { product_type: 'Infantil', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: '4', quantity: 1, qty_corte: 1 },
      { product_type: 'Infantil', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: '6', quantity: 1, qty_corte: 1 },
      { product_type: 'Infantil', fabric: 'Dry Comfort', color: 'Batom Rouge', tipo_tecido: 'RAMADO', largura_util: '1,60 m', size: '10', quantity: 1, qty_corte: 1 }
    ]
  };

  const demCentral = aggregateCuttingDemand([orderCentral1 as any, orderCentral2 as any, orderCentral3 as any]);
  const grpCentral = groupCuttingDemandByRawMaterial(demCentral);

  // 1. Deve gerar UM ÚNICO PLANO
  assertEqual(grpCentral.groups.length, 1, "Cen.5.1: 3 modelos com mesmo tecido+cor geram UM ÚNICO plano");
  assertEqual(grpCentral.groups[0].fabric, 'Dry Comfort', "Cen.5.2: Matéria-prima é Dry Comfort");
  assertEqual(grpCentral.groups[0].color, 'Batom Rouge', "Cen.5.3: Cor é Batom Rouge");
  assertEqual(grpCentral.groups[0].total_necessario, 35, "Cen.5.4: Total de peças do plano é 35 (20 + 12 + 3)");

  // 2. Não somar modelos diferentes como um único nome: 3 modelos separados internamente
  assertEqual(grpCentral.groups[0].models_breakdown.length, 3, "Cen.5.5: Contém 3 modelos distintos no breakdown");

  const mbCamiseta = grpCentral.groups[0].models_breakdown.find(m => m.model === 'Camiseta Gola Redonda');
  assertEqual(mbCamiseta?.total, 20, "Cen.5.6: Camiseta Gola Redonda tem 20 peças");
  assertEqual(mbCamiseta?.sizes['P'], 8, "Cen.5.7: Camiseta P = 8");
  assertEqual(mbCamiseta?.sizes['M'], 10, "Cen.5.8: Camiseta M = 10");
  assertEqual(mbCamiseta?.sizes['G1'], 1, "Cen.5.9: Camiseta G1 = 1");
  assertEqual(mbCamiseta?.sizes['G2'], 1, "Cen.5.10: Camiseta G2 = 1");

  const mbBabylook = grpCentral.groups[0].models_breakdown.find(m => m.model === 'Babylook');
  assertEqual(mbBabylook?.total, 12, "Cen.5.11: Babylook tem 12 peças");
  assertEqual(mbBabylook?.sizes['PP'], 1, "Cen.5.12: Babylook PP = 1");
  assertEqual(mbBabylook?.sizes['P'], 3, "Cen.5.13: Babylook P = 3");
  assertEqual(mbBabylook?.sizes['G'], 8, "Cen.5.14: Babylook G = 8");

  const mbInfantil = grpCentral.groups[0].models_breakdown.find(m => m.model === 'Infantil');
  assertEqual(mbInfantil?.total, 3, "Cen.5.15: Infantil tem 3 peças");
  assertEqual(mbInfantil?.sizes['4'], 1, "Cen.5.16: Infantil 4 = 1");
  assertEqual(mbInfantil?.sizes['6'], 1, "Cen.5.17: Infantil 6 = 1");
  assertEqual(mbInfantil?.sizes['10'], 1, "Cen.5.18: Infantil 10 = 1");

  // 3. Validação da Função COPIAR PARA CUTPLAN
  const cutPlanExport = formatDemandForCutPlan(grpCentral.groups[0].models_breakdown);
  const expectedText = 
`Camiseta Gola Redonda
P    8
M    10
G1   1
G2   1

Babylook
PP   1
P    3
G    8

Infantil
4    1
6    1
10   1`;

  assertEqual(cutPlanExport.text, expectedText, "Cen.5.19: Texto para Optitex CutPlan no formato limpo especificado");
  const containsTSVHeaders = cutPlanExport.tsv.startsWith('Modelo\tTamanho\tQuantidade');
  assertEqual(containsTSVHeaders, true, "Cen.5.20: Formato TSV inclui cabeçalho correto para colagem");

  console.log(`\nCutting Tests Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runCuttingTests();

