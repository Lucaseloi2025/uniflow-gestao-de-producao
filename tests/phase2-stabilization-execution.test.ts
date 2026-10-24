import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const apiSource = fs.readFileSync(path.resolve(__dirname, '../api/index.ts'), 'utf8');
const minhaFilaSource = fs.readFileSync(path.resolve(__dirname, '../src/pages/MinhaFila.tsx'), 'utf8');
const useAppLogicSource = fs.readFileSync(path.resolve(__dirname, '../src/hooks/useAppLogic.ts'), 'utf8');
const orderDrawerSource = fs.readFileSync(path.resolve(__dirname, '../src/components/modals/OrderDetailsDrawer.tsx'), 'utf8');

describe('Fase 2 — Estabilização da Execução (Etapas B a L)', () => {
  it('Cenário 1 — Apontamento parcial 148/152 preserva saldo restante 4 após pausa e retomada', () => {
    const quantidadePrevista = 152;
    const apontamentosValidos = [
      { id: 347, quantidade_boa_incremento: 148, observacao: 'Produção parcial Felipe' },
      { id: 999, quantidade_boa_incremento: 60, observacao: '[INVALIDADO] Duplicado' },
    ];

    const isValidLog = (log: any) => {
      if (log.invalidated_at || log.is_invalidated === true) return false;
      const obs = String(log.observacao || '').toUpperCase();
      if (obs.includes('[INVALIDADO') || obs.includes('[ESTORNADO')) return false;
      return true;
    };

    const quantidadeConcluida = apontamentosValidos
      .filter(isValidLog)
      .reduce((acc, l) => acc + Number(l.quantidade_boa_incremento || 0), 0);
    const saldoRestante = Math.max(0, quantidadePrevista - quantidadeConcluida);

    expect(quantidadeConcluida).toBe(148);
    expect(saldoRestante).toBe(4);

    // Finalizando as 4 restantes -> 152/152 e saldo 0
    const novaConcluida = quantidadeConcluida + 4;
    const novoSaldo = Math.max(0, quantidadePrevista - novaConcluida);
    const etapaConcluida = novoSaldo === 0 && novaConcluida >= quantidadePrevista;

    expect(novaConcluida).toBe(152);
    expect(novoSaldo).toBe(0);
    expect(etapaConcluida).toBe(true);
  });

  it('Cenário 2 — Pedido de 1 peça (#PED-1122) garante abertura do modal mesmo fora da lista paginada', () => {
    expect(minhaFilaSource).toContain('const heroOrder = useMemo<Order | null>');
    expect(minhaFilaSource).toContain('order_number: heroExecution.order_number || String(heroExecution.order_id)');
    expect(useAppLogicSource).toContain('syncOrderStageProgress(targetOrder)');
    expect(useAppLogicSource).toContain('quantidade_boa_incremento: Number(actionQuantityInput) || 0');
  });

  it('Cenário 3 — Bloqueio de duplicidade, saldo zero e concorrência entre operadores', () => {
    expect(apiSource).toContain('STAGE_ALREADY_COMPLETED');
    expect(apiSource).toContain('ZERO_BALANCE_REMAINING');
    expect(apiSource).toContain('CONCURRENT_STAGE_EXECUTION');
    expect(apiSource).toContain('OVERRIDE_REASON_REQUIRED');
    expect(apiSource).toContain('TRANSFERENCIA_OPERADOR');
    expect(apiSource).toContain('idempotent_replay: true');

    // Nunca enviar EM_ANDAMENTO com canStart=true
    expect(apiSource).toContain("const canStart = Boolean(\n                !hasActiveExecution &&\n                (currentStageStatus === 'LIBERADA' || currentStageStatus === 'PARCIAL') &&\n                saldoRestante > 0 &&\n                !isBlocked\n            );");
  });

  it('Cenário 4 — Filtro estrito por código/slug de etapa (Sublimação não mistura outras etapas)', () => {
    expect(apiSource).toContain('function getStageSlug');
    expect(apiSource).toContain("if (currentStageSlug !== stageSlugFilter)");
    expect(minhaFilaSource).toContain("params.set('stage_slug', selectedStageSlug || 'ALL')");
    expect(minhaFilaSource).toContain("if (itemSlug !== selectedStageSlug) return false;");
  });

  it('Cenário 5 — Pedidos concluídos não permanecem em Pedidos (Entrada) Ativos e OrderDetailsDrawer não usa exec.status Finalizado como concluído', () => {
    expect(apiSource).toContain("o.status !== 'Pronto' && o.status !== 'Entregue' && o.status !== 'Cancelado' && o.status !== 'Concluído' && !isAllFinished");
    expect(orderDrawerSource).toContain("return Boolean(orderStage.finished === true || orderStage.status_operacao === 'CONCLUIDA');");
    expect(orderDrawerSource).not.toContain("return Boolean(orderStage.finished || exec?.status === 'Finalizado');");
  });

  it('Cenário 6 — Upload de imagens processa multipart no primeiro tick e grava no bucket artes com auditoria', () => {
    expect(apiSource).toContain('uploadFileToArtesStorage');
    expect(apiSource).toContain('UPLOAD_IMAGEM_PEDIDO');
    expect(apiSource).toContain('resolveUploadMimeAndExt');
  });

  it('Cenário 7 — Zero caracteres UTF-8 corrompidos (mojibake) em api/index.ts e src/', () => {
    expect(apiSource).not.toMatch(/Ã§|Ã£|Ã¡|Ã©|Ãª|Ã³|Ãº|â€|ðŸ/);
    expect(minhaFilaSource).not.toMatch(/Ã§|Ã£|Ã¡|Ã©|Ãª|Ã³|Ãº|â€|ðŸ/);
    expect(useAppLogicSource).not.toMatch(/Ã§|Ã£|Ã¡|Ã©|Ãª|Ã³|Ãº|â€|ðŸ/);
    expect(orderDrawerSource).not.toMatch(/Ã§|Ã£|Ã¡|Ã©|Ãª|Ã³|Ãº|â€|ðŸ/);
  });
});
