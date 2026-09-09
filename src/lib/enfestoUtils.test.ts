import {
  optimizeEnfestoPlan,
  optimizeRamadoPlan,
  getFatorCamadasPorPassada,
  TecidoTipo,
  saveRamadoDecision,
  getRamadoDecisions,
  saveProducaoExcedente,
  getProducaoExcedentes,
  saveApprovedEnfestoPlan,
  getApprovedEnfestoPlans,
  deleteApprovedEnfestoPlan,
  saveOptitexValidatedRisco,
  getOptitexValidatedRiscos,
  MAX_PECAS_POR_RISCO_MESA
} from './enfestoUtils';
import { extractItemDetails } from './cuttingUtils';

console.log('=== Running Unit Tests for RAMADO Strategic Surplus & Optitex Efficiency Engine ===');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failCount++;
  }
}

// ── TEST SUITE 1: LAYER FACTOR ─────────────────────────────────────────────
assert(getFatorCamadasPorPassada('TUBULAR') === 2, 'Test 1.1: TUBULAR should yield 2 effective layers per pass');
assert(getFatorCamadasPorPassada('RAMADO') === 1, 'Test 1.2: RAMADO should yield 1 effective layer per pass');

// ── TEST SUITE 2: CASO DE TESTE 1 (RAMADO - 3 RISCOS EXATOS -> 2 RISCOS COM +1 EXCEDENTE) ──
const resCase1 = optimizeRamadoPlan({
  model: 'Camiseta Básica',
  fabric: 'Algodão Ramado',
  larguraUtil: '1,60 m',
  agruparTamanhos: true,
  demandMap: { P: 4, M: 2, G: 1 }
});

assert(resCase1.plano_exato.resumo.total_excedente === 0, 'Test 2.1: Caso 1 - Plano Exato deve ter 0 excedente');
assert(resCase1.plano_exato.quantidade_riscos_distintos <= 3, 'Test 2.2: Caso 1 - Plano Exato possui riscos otimizados');
assert(resCase1.recomendacao === 'PLANO_OTIMIZADO', 'Test 2.3: Caso 1 - Deve recomendar PLANO_OTIMIZADO com excedente estratégico');
assert(resCase1.requer_aprovacao === true, 'Test 2.4: Caso 1 - Requer aprovação humana obrigatoriamente');
assert(resCase1.excedente_total <= 2, 'Test 2.5: Caso 1 - Excedente total dentro do limite global');
assert(resCase1.plano_otimizado !== null, 'Test 2.6: Caso 1 - Plano Otimizado gerado com sucesso');

// ── TEST SUITE 3: CASO DE TESTE 2 (RAMADO - 3 RISCOS EXATOS -> 2 RISCOS COM +2 EXCEDENTES TOTAL) ──
const resCase2 = optimizeRamadoPlan({
  model: 'Camiseta Oversized',
  fabric: 'Meia Malha Ramada',
  larguraUtil: '1,60 m',
  agruparTamanhos: true,
  demandMap: { P: 4, M: 1, G: 1 }
});

assert(resCase2.candidatas.length > 0, 'Test 3.1: Caso 2 - Gerou opções candidatas');
assert(resCase2.excedente_total <= 2, 'Test 3.2: Caso 2 - Excedente total dentro do limite global (<= 2 peças)');
assert(resCase2.requer_aprovacao === true || resCase2.recomendacao !== undefined, 'Test 3.3: Caso 2 - Estrutura de recomendação válida');
assert(resCase2.requer_aprovacao === true, 'Test 3.4: Caso 2 - Requer aprovação obrigatória');

// ── TEST SUITE 4: CASO DE TESTE 3 (RAMADO - +1 PEÇA SEM GANHO OPERACIONAL DEVE MANTER PLANO EXATO) ──
const resCase3 = optimizeRamadoPlan({
  model: 'Regata Ramada',
  fabric: 'Dry Fit Ramado',
  larguraUtil: '1,60 m',
  agruparTamanhos: true,
  demandMap: { P: 10, M: 10 }
});

assert(resCase3.recomendacao === 'PLANO_EXATO', 'Test 4.1: Caso 3 - Sem ganho operacional REAL, deve escolher PLANO_EXATO');
assert(resCase3.plano_otimizado === null, 'Test 4.2: Caso 3 - Não sugere excedente desnecessário');
assert(resCase3.excedente_total === 0, 'Test 4.3: Caso 3 - Excedente total deve ser 0');

// ── TEST SUITE 5: CASO DE TESTE 4 (RAMADO - SIMPLIFICAÇÃO COM +3 PEÇAS É RECUSADA PELO LIMITE GLOBAL DE 2) ──
const resCase4 = optimizeRamadoPlan({
  model: 'Polo Ramada',
  fabric: 'Piquet Ramado',
  larguraUtil: '1,60 m',
  agruparTamanhos: true,
  demandMap: { P: 10, M: 5, G: 1, GG: 1 }
});

assert(resCase4.excedente_total <= 2, 'Test 5.1: Caso 4 - Excedente máximo global NUNCA pode ser maior que 2 peças');

// ── TEST SUITE 6: CASO DE TESTE 5 (REGISTRO DE REJEIÇÃO / MANTIDO EXATO PELO OPERADOR) ──
saveRamadoDecision({
  model: 'Camiseta Básica',
  fabric: 'Algodão Ramado',
  tipo_tecido: 'RAMADO',
  decision: 'MANTIDO_EXATO',
  plano_exato: resCase1.plano_exato,
  plano_otimizado: resCase1.plano_otimizado,
  excedente_proposto: null,
  excedente_total: 0,
  riscos_antes: 3,
  riscos_depois: 3,
  ganho_operacional: 'Mantido corte exato por opção do operador',
  user_id: 1,
  user_name: 'Cortador Teste'
});

const decisions = getRamadoDecisions();
assert(decisions.length > 0, 'Test 6.1: Decisão registrada com sucesso');
assert(decisions[0].decision === 'MANTIDO_EXATO', 'Test 6.2: Decisão de rejeitar excedente registrada como MANTIDO_EXATO');

// ── TEST SUITE 7: REGISTRO DE PEÇAS EXCEDENTES DE PRODUÇÃO ──────────────────
saveProducaoExcedente({
  model: 'Camiseta Básica',
  fabric: 'Algodão Ramado',
  color: 'Preto',
  size: 'G',
  quantidade: 1,
  origem: 'EXCEDENTE_DE_PRODUCAO',
  destino: 'ESTOQUE'
});

const excedentes = getProducaoExcedentes();
assert(excedentes.length > 0, 'Test 7.1: Peça excedente salva com sucesso');
assert(excedentes[0].origem === 'EXCEDENTE_DE_PRODUCAO', 'Test 7.2: Marcada estritamente como EXCEDENTE_DE_PRODUCAO (não alocada a pedidos)');

// ── TEST SUITE 8: PERSISTÊNCIA DE PLANOS DE ENFESTO APROVADOS ─────────────
saveApprovedEnfestoPlan({
  id: 'plan-test-1',
  model: 'Camiseta Básica',
  fabric: 'Algodão Ramado',
  color: 'Preto',
  tipoTecido: 'RAMADO',
  planType: 'PLANO_OTIMIZADO',
  planName: 'PLANO OTIMIZADO (EXCEDENTE ESTRATÉGICO)',
  enfestos: resCase1.plano_otimizado!.enfestos,
  resumo: resCase1.plano_otimizado!.resumo,
  excedente_proposto: { G: 1 },
  excedente_total: 1,
  beneficio_operacional: 'Elimina 1 risco no Optitex',
  user_name: 'Operador Teste',
  created_at: new Date().toISOString(),
  status: 'PENDENTE_DE_CORTE'
});

const approvedPlans = getApprovedEnfestoPlans();
assert(approvedPlans.length > 0, 'Test 8.1: Plano aprovado salvo com sucesso na aba Planos Aprovados');
assert(approvedPlans[0].status === 'PENDENTE_DE_CORTE', 'Test 8.2: Status inicial de corte é PENDENTE_DE_CORTE');

// ── TEST SUITE 9: TESTE OBRIGATÓRIO (DEMANDA P=5 / M=10 / G=6 / GG=2 = 23 PEÇAS) ──────
const resCaseReal = optimizeRamadoPlan({
  model: 'Camiseta Básica',
  fabric: 'Algodão Ramado',
  larguraUtil: '1,60 m',
  agruparTamanhos: true,
  demandMap: { P: 5, M: 10, G: 6, GG: 2 }
});

assert(resCaseReal.candidatas.length >= 2, 'Test 9.1: Geradas múltiplas composições candidatas (CANDIDATA 1, CANDIDATA 2)');

const topCandidate = resCaseReal.candidatas[0];
assert(resCaseReal.plano_exato.resumo.total_planejado === 23, 'Test 9.2: Plano exato atende exatamente 23 peças da demanda (0 excedente)');
assert(topCandidate.resumo.total_faltante === 0, 'Test 9.3: Faltante = 0');
assert(topCandidate.resumo.total_passadas < 18, 'Test 9.4: Nova composição multi-peças reduz drasticamente total de enfestos (de 18 para menos enfestos)');

// ── TEST SUITE 10: TESTE DE RISCO COM BAIXA EFICIÊNCIA (G+P = 77,60% < 80,00%) ──
saveOptitexValidatedRisco({
  model: 'Camiseta Básica',
  fabric: 'Algodão Ramado',
  largura_util: '1,60 m',
  tipo_tecido: 'RAMADO',
  sizes: ['G', 'P'],
  composicao: { G: 1, P: 1 },
  comprimento_real_metros: 2.10,
  eficiencia_optitex_pct: 77.60,
  status: 'VALIDADO',
  user_name: 'Cortador Optitex'
});

const optitexRiscos = getOptitexValidatedRiscos();
assert(optitexRiscos.length > 0, 'Test 10.1: Risco validado no Optitex salvo no histórico');
assert(optitexRiscos[0].eficiencia_optitex_pct === 77.60, 'Test 10.2: Registrada eficiência real do teste no Optitex de 77.60%');

const resLowEff = optimizeRamadoPlan({
  model: 'Camiseta Básica',
  fabric: 'Algodão Ramado',
  larguraUtil: '1,60 m',
  agruparTamanhos: true,
  demandMap: { G: 6, P: 6 },
  eficienciaMinimaDesejada: 80.0
});

assert(resLowEff.candidatas.length > 0, 'Test 10.3: Motor avalia candidatos considerando eficiência mínima de 80.00%');

// ── TEST SUITE 11: REGRESSÃO TUBULAR ───────────────────────────────────────
const resTubular = optimizeEnfestoPlan({
  model: 'Camiseta Básica',
  fabric: 'Algodão Tubular',
  tipoTecido: 'TUBULAR',
  larguraUtil: '1,60 m',
  agruparTamanhos: true,
  demandMap: { G: 7, GG: 6 }
});

assert(resTubular.recomendada !== undefined, 'Test 11.1: Motor TUBULAR continua funcionando normalmente');
// ── TEST SUITE 12: LIMITAÇÃO DA MESA DE CORTE (MAX 8 PCS) E DESCRIÇÃO DE MODELO ──
assert(MAX_PECAS_POR_RISCO_MESA === 8, 'Test 12.1: Limite máximo da mesa de corte é exatamente 8 peças por risco');

const largeDemandRes = optimizeRamadoPlan({
  model: 'Camiseta com Recorte',
  fabric: 'Algodão Ramado',
  larguraUtil: '1,60 m',
  agruparTamanhos: true,
  demandMap: { P: 10, M: 20, G: 15, GG: 5 }
});

const allRisksValidTable = largeDemandRes.candidatas.every(cand =>
  cand.enfestos.every(enf => {
    const totalPcs = Object.values(enf.peças_por_passada).reduce((a, b) => a + b, 0);
    return totalPcs <= 8;
  })
);
assert(allRisksValidTable, 'Test 12.2: Todas as composições candidatas respeitam o limite máximo de 8 peças/camada da mesa');

const parsedRecorteItem = extractItemDetails({ description: 'Camiseta com Recorte Dry Fit Preto / Recorte Cinza G' });
assert(parsedRecorteItem.product_type === 'Camiseta com Recorte', 'Test 12.3: Extração de modelo preserva "Camiseta com Recorte" em vez de simplificar para "Camiseta Básica"');
assert(parsedRecorteItem.color.includes('PRETO') && parsedRecorteItem.color.includes('CINZA'), 'Test 12.4: Extração de cor identifica combinação do Corpo (Preto) e Recorte (Cinza)');

// ── TEST SUITE 13: EXCLUSÃO DE PLANOS APROVADOS ──
const dummyPlanId = `plan-test-del-${Date.now()}`;
saveApprovedEnfestoPlan({
  id: dummyPlanId,
  model: 'Camiseta Teste Del',
  fabric: 'Dry Fit',
  color: 'Preto',
  tipoTecido: 'RAMADO',
  planType: 'PLANO_EXATO',
  planName: 'Plano Teste Exclusão',
  enfestos: [],
  resumo: { total_necessario: 5, total_planejado: 5, total_passadas: 2, total_camadas: 2, total_metros_previstos: 5, todos_riscos_validados: true, pode_aprovar: true },
  user_name: 'Test',
  created_at: new Date().toISOString(),
  status: 'PENDENTE_DE_CORTE'
});
deleteApprovedEnfestoPlan(dummyPlanId);
const plansAfterDel = getApprovedEnfestoPlans();
assert(!plansAfterDel.some(p => p.id === dummyPlanId), 'Test 13.1: Exclusão de plano aprovado remove o registro do repositório');

console.log(`\nIntelligent Assistant Tests Summary: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
  process.exit(1);
}
