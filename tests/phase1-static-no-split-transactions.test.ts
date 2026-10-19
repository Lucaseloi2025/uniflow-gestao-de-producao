import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Auditoria Fase 1 — Análise Estática de Integridade Transacional (Eliminação de Transações Divididas e Inventário Completo)', () => {
  const apiFilePath = path.resolve('api', 'index.ts');
  const apiContent = fs.readFileSync(apiFilePath, 'utf8');
  const apiLines = apiContent.split('\n');

  it('1. Não deve existir definição ou chamada para funções antigas não-transacionais (logProgress, logLoss)', () => {
    expect(apiContent).not.toMatch(/\bfunction\s+logProgress\b/);
    expect(apiContent).not.toMatch(/\blogProgress\s*\(/);
    expect(apiContent).not.toMatch(/\bfunction\s+logLoss\b/);
    expect(apiContent).not.toMatch(/\blogLoss\s*\(/);
  });

  it('2. Nenhuma rota mutável deve conter fallback de usuário para 1 ou stage_id fixo para 2', () => {
    expect(apiContent).not.toMatch(/user_id\s*\|\|\s*1/);
    expect(apiContent).not.toMatch(/Number\(user_id\)\s*\|\|\s*1/);
    expect(apiContent).not.toMatch(/stage_id\s*:\s*2\b/);
  });

  it('3. Nenhuma rota HTTP ou função do backend deve conter bloco catch vazio silencioso', () => {
    const emptyCatchRegex = /catch\s*\([a-zA-Z0-9_]*\)\s*\{\s*\}/g;
    const matches = apiContent.match(emptyCatchRegex) || [];
    expect(matches, `Encontrados ${matches.length} blocos catch vazios que suprimem erros de banco`).toEqual([]);
  });

  it('4. Nenhuma rota mutável crítica pode executar auditoria desacoplada pós-mutação (writeAuditLogStore / recordPcpAuditLog)', () => {
    const criticalRoutes = [
      '/api/orders/:id/stages/:stageId/progress',
      '/api/orders/:id/stages/:stageId/loss',
      '/api/executions/start',
      '/api/executions/pause-all',
      '/api/executions/auto-pause',
      '/api/executions/:id/pause',
      '/api/executions/:id/resume',
      '/api/executions/:id/finish',
      '/api/pcp-phase1/ordens/:id/bloqueio',
      '/api/pcp-phase1/ordens/:id/desbloqueio',
      '/api/pcp-phase1/ordens/:id/prioridade_manual',
      '/api/cutting/register-consolidated',
      '/api/cutting/ramado-decision',
      '/api/orders/:id/expedir',
    ];

    for (const route of criticalRoutes) {
      const routeIdx = apiContent.indexOf(`"${route}"`);
      const routeAltIdx = apiContent.indexOf(`'${route}'`);
      const effectiveIdx = routeIdx !== -1 ? routeIdx : routeAltIdx;
      expect(effectiveIdx, `Rota crítica ${route} deve existir registrada no Express`).toBeGreaterThan(0);

      const nextRouteIdx = apiContent.indexOf('\napp.', effectiveIdx + route.length);
      const endIdx = nextRouteIdx !== -1 ? nextRouteIdx : effectiveIdx + 3000;
      const routeBlock = apiContent.substring(effectiveIdx, endIdx);

      // Garantir que a rota crítica não chama auditoria desacoplada após mutação
      expect(routeBlock).not.toContain('writeAuditLogStore(');
      expect(routeBlock).not.toContain('recordPcpAuditLog(');
      expect(routeBlock).not.toMatch(/\.from\(\s*['"]pcp_audit_log['"]\s*\)\s*\.insert/);

      // Garantir que a rota utiliza RPC transacional
      expect(routeBlock).toMatch(/\.rpc\(\s*['"](?:rpc_|pcp_)/);
    }
  });

  it('5. Inventário Completo: todas as rotas mutáveis do Express devem ser classificadas rigorosamente', () => {
    interface RouteInfo {
      method: string;
      path: string;
      startLine: number;
      endLine: number;
    }

    const mutableRoutes: RouteInfo[] = [];
    const routeRegex = /app\.(post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = routeRegex.exec(apiContent)) !== null) {
      const lineNo = apiContent.substring(0, match.index).split('\n').length;
      mutableRoutes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        startLine: lineNo,
        endLine: 0,
      });
    }

    const anyRouteIndices: number[] = [];
    const anyRouteRegex = /\napp\.(get|post|put|patch|delete|use)\s*\(/g;
    let anyMatch: RegExpExecArray | null;
    while ((anyMatch = anyRouteRegex.exec(apiContent)) !== null) {
      const lineNo = apiContent.substring(0, anyMatch.index).split('\n').length + 1;
      anyRouteIndices.push(lineNo);
    }

    for (let i = 0; i < mutableRoutes.length; i++) {
      const nextAny = anyRouteIndices.find(idx => idx > mutableRoutes[i].startLine);
      mutableRoutes[i].endLine = nextAny ? nextAny - 1 : apiLines.length;
    }

    expect(mutableRoutes.length).toBeGreaterThanOrEqual(40);

    for (const r of mutableRoutes) {
      const routeKey = `${r.method} ${r.path}`;
      const routeBlock = apiLines.slice(r.startLine - 1, r.endLine).join('\n');

      // 1. Proibido ler identidade do body ou fallback para 1
      expect(routeBlock).not.toMatch(/user_id\s*\|\|\s*1/);
      expect(routeBlock).not.toMatch(/Number\(user_id\)\s*\|\|\s*1/);
      expect(routeBlock).not.toMatch(/stage_id\s*:\s*2\b/);

      // 2. Proibido auditoria assíncrona/desacoplada
      expect(routeBlock).not.toContain('writeAuditLogStore(');
      expect(routeBlock).not.toContain('recordPcpAuditLog(');

      // 3. Classificação de conformidade sem safeExceptions:
      const usesApprovedRpc = /\.rpc\(\s*['"](?:rpc_|pcp_tx_|generate_)/.test(routeBlock);
      const tableMatches = [...routeBlock.matchAll(/supabase(?:Admin)?\s*\.\s*from\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*(insert|update|delete|upsert)/g)].map(m => m[1]);
      const distinctTables = new Set(tableMatches);

      // Se a rota realiza gravações em mais de 1 tabela diferente, ela DEVE ser RPC transacional
      if (distinctTables.size > 1) {
        expect(usesApprovedRpc, `Rota mutável [${routeKey}] (L${r.startLine}-L${r.endLine}) grava em múltiplas tabelas diferentes (${distinctTables.size}) sem RPC transacional: ${Array.from(distinctTables).join(', ')}`).toBe(true);
      } else {
        expect(distinctTables.size <= 1, `Rota mutável [${routeKey}] deve ser gravação atômica de tabela única`).toBe(true);
      }
    }
  });

  it('6. As 27 RPCs transacionais de negócio com auditoria atômica devem existir declaradas na migration consolidada', () => {
    const migrationPath = path.resolve('supabase', 'migrations', '20261018_phase1_deploy_complete.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    const expectedRpcs = [
      'pcp_apply_stage_progress',
      'rpc_start_operation',
      'rpc_pause_operation',
      'rpc_resume_operation',
      'rpc_finish_operation',
      'rpc_record_production',
      'rpc_record_loss',
      'pcp_tx_recalcular_necessidades',
      'pcp_tx_criar_plano_corte',
      'pcp_tx_aprovar_plano_corte',
      'pcp_tx_registrar_op',
      'pcp_tx_registrar_numero_tiny_op',
      'pcp_tx_bloquear_ordem',
      'pcp_tx_desbloquear_ordem',
      'pcp_tx_alterar_prioridade',
      'pcp_tx_reabrir_etapa',
      'pcp_tx_expedir_ordem',
      'pcp_tx_register_consolidated_cutting',
      'pcp_tx_record_ramado_decision',
      'pcp_tx_create_cut_plan',
      'pcp_tx_release_cut_plan',
      'pcp_tx_complete_cut_plan',
      'pcp_tx_send_cut_plan_sewing',
      'pcp_tx_return_cut_plan_sewing',
      'pcp_tx_cancel_cut_plan',
      'pcp_tx_reset_production',
      'pcp_tx_cancel_order'
    ];

    expect(expectedRpcs.length).toBe(27);
    for (const rpc of expectedRpcs) {
      expect(migrationContent, `Migration deve conter declaração da RPC public.${rpc}`).toContain(`FUNCTION public.${rpc}`);
    }
  });

  it('7. Rota /api/cutting/register-consolidated deve usar RPC transacional pcp_tx_register_consolidated_cutting e ator do JWT', () => {
    const routeIdx = apiContent.indexOf('"/api/cutting/register-consolidated"');
    expect(routeIdx).toBeGreaterThan(0);
    const nextRouteIdx = apiContent.indexOf('\napp.', routeIdx + 30);
    const block = apiContent.substring(routeIdx, nextRouteIdx);

    expect(block).toContain('pcp_tx_register_consolidated_cutting');
    expect(block).toContain('getActorId(req)');
    expect(block).not.toContain('allocateCuttingPieces(');
    expect(block).not.toContain('safeUpsertOrderStageProgress(');
    expect(block).not.toContain('stage_id: 2');
    expect(block).toContain('if (rpcErr)');
  });

  it('8. Rota /api/cutting/ramado-decision deve usar RPC transacional pcp_tx_record_ramado_decision e ator do JWT', () => {
    const routeIdx = apiContent.indexOf('"/api/cutting/ramado-decision"');
    expect(routeIdx).toBeGreaterThan(0);
    const nextRouteIdx = apiContent.indexOf('\napp.', routeIdx + 30);
    const block = apiContent.substring(routeIdx, nextRouteIdx);

    expect(block).toContain('pcp_tx_record_ramado_decision');
    expect(block).toContain('getActorId(req)');
    expect(block).toContain('if (rpcErr)');
  });

  it('9. Rotas de Cut Plans e Reset de Produção devem utilizar RPCs transacionais e ator do JWT', () => {
    const cutPlanRoutes = [
      { pattern: "app.post('/api/cut-plans'", rpc: 'pcp_tx_create_cut_plan' },
      { pattern: "app.post('/api/cut-plans/:id/release'", rpc: 'pcp_tx_release_cut_plan' },
      { pattern: "app.post('/api/cut-plans/:id/complete-cut'", rpc: 'pcp_tx_complete_cut_plan' },
      { pattern: "app.post('/api/cut-plans/:id/send-sewing'", rpc: 'pcp_tx_send_cut_plan_sewing' },
      { pattern: "app.post('/api/cut-plans/:id/return-sewing'", rpc: 'pcp_tx_return_cut_plan_sewing' },
      { pattern: "app.post('/api/cut-plans/:id/cancel'", rpc: 'pcp_tx_cancel_cut_plan' },
      { pattern: 'app.post("/api/admin/reset-production"', rpc: 'pcp_tx_reset_production' },
      { pattern: 'app.patch("/api/orders/:id/cancel"', rpc: 'pcp_tx_cancel_order' },
    ];

    for (const r of cutPlanRoutes) {
      const idx = apiContent.indexOf(r.pattern);
      expect(idx, `Rota ${r.pattern} deve existir`).toBeGreaterThan(0);
      const nextIdx = apiContent.indexOf('\napp.', idx + r.pattern.length);
      const block = apiContent.substring(idx, nextIdx !== -1 ? nextIdx : idx + 2000);
      expect(block).toContain(r.rpc);
      expect(block).toContain('getActorId(req)');
    }
  });

  it('10. Rota GET /api/pcp-phase1/audit-log deve ser protegida com middleware isAuditReader (apenas Administrador e PCP)', () => {
    const auditRouteIdx = apiContent.indexOf("'/api/pcp-phase1/audit-log'");
    expect(auditRouteIdx).toBeGreaterThan(0);
    const line = apiContent.substring(auditRouteIdx - 50, auditRouteIdx + 100);
    expect(line).toContain('isAuditReader');
    expect(apiContent).toContain('export const VALID_AUDIT_READER_ROLES = [');
  });

  it('11. Rotas do PCP não devem aceitar identidade pelo body (created_by, aprovado_por, usuario)', () => {
    const pcpRoutes = [
      "app.post('/api/pcp/planos'",
      "app.post('/api/pcp/planos/:id/aprovar'",
      "app.post('/api/pcp/ops'",
      "app.post('/api/pcp/ops/:id/registrar-tiny'"
    ];

    for (const p of pcpRoutes) {
      const idx = apiContent.indexOf(p);
      expect(idx, `Rota ${p} deve existir`).toBeGreaterThan(0);
      const nextIdx = apiContent.indexOf('\napp.', idx + p.length);
      const block = apiContent.substring(idx, nextIdx !== -1 ? nextIdx : idx + 2000);
      expect(block).not.toMatch(/created_by\s*\|\|/);
      expect(block).not.toMatch(/aprovado_por\s*\|\|/);
      expect(block).not.toMatch(/usuario\s*\|\|/);
      expect(block).toContain('getActorName(req');
    }
  });
});
