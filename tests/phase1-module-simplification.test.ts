import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Validação da Remoção de Módulos e Simplificação do ProComfort', () => {
  it('1. Arquivos físicos dos módulos removidos não devem existir no projeto', () => {
    const removedFiles = [
      path.resolve('src', 'pages', 'Costs.tsx'),
      path.resolve('src', 'pages', 'TaskMonitor.tsx'),
      path.resolve('src', 'pages', 'PCP', 'Conferencia.tsx')
    ];

    for (const file of removedFiles) {
      expect(fs.existsSync(file), `Arquivo não deveria existir: ${file}`).toBe(false);
    }
  });

  it('2. Sidebar deve conter apenas as 3 seções e 6 itens canônicos permitidos', () => {
    const sidebarContent = fs.readFileSync(path.resolve('src', 'components', 'Sidebar.tsx'), 'utf-8');

    // Módulos proibidos não devem ser importados ou renderizados no menu
    expect(sidebarContent).not.toContain('Conferência');
    expect(sidebarContent).not.toContain('Separação');
    expect(sidebarContent).not.toContain('Monitor');
    expect(sidebarContent).not.toContain('Custos');
    expect(sidebarContent).not.toContain('conferencia');
    expect(sidebarContent).not.toContain('costs');
    expect(sidebarContent).not.toContain('monitor');

    // Seções obrigatórias
    expect(sidebarContent).toContain('PRODUÇÃO');
    expect(sidebarContent).toContain('GERENCIAL');
    expect(sidebarContent).toContain('SISTEMA');

    // Itens canônicos
    expect(sidebarContent).toContain('"Dashboard"');
    expect(sidebarContent).toContain('"Fluxo Kanban"');
    expect(sidebarContent).toContain('"Pedidos (Entrada)"');
    expect(sidebarContent).toContain('"Colaboradores"');
    expect(sidebarContent).toContain('"Relatórios"');
    expect(sidebarContent).toContain('"Configurações"');
  });

  it('3. App.tsx não deve importar ou renderizar páginas removidas', () => {
    const appContent = fs.readFileSync(path.resolve('src', 'App.tsx'), 'utf-8');

    expect(appContent).not.toContain('./pages/Costs');
    expect(appContent).not.toContain('./pages/TaskMonitor');
    expect(appContent).not.toContain('./pages/PCP/Conferencia');
    expect(appContent).not.toContain("activeTab === 'costs'");
    expect(appContent).not.toContain("activeTab === 'monitor'");
    expect(appContent).not.toContain("activeTab === 'conferencia'");
  });

  it('4. useAppLogic.ts deve redirecionar URLs legadas diretamente para o Dashboard', () => {
    const logicContent = fs.readFileSync(path.resolve('src', 'hooks', 'useAppLogic.ts'), 'utf-8');

    // Deve conter o redirecionador de segurança
    expect(logicContent).toContain("['conferencia', 'costs', 'monitor'].includes(rawTab)");
    expect(logicContent).toContain("navigate('/', { replace: true })");

    // Não deve expor metaCustoPeca nem memoizedCostsByCollaborator
    expect(logicContent).not.toContain('memoizedCostsByCollaborator');
    expect(logicContent).not.toContain('metaCustoPeca');
  });

  it('5. Relatórios e PrintableReport devem estar livres de dados e colunas de custos', () => {
    const printableContent = fs.readFileSync(path.resolve('src', 'PrintableReport.tsx'), 'utf-8');

    expect(printableContent).not.toContain('Custo Total M.O.');
    expect(printableContent).not.toContain('Custo / Peça');
    expect(printableContent).not.toContain('totalCost');
    expect(printableContent).not.toContain('costPerPiece');
    expect(printableContent).not.toContain('costsByCollaborator');

    const reportsContent = fs.readFileSync(path.resolve('src', 'pages', 'Reports.tsx'), 'utf-8');
    expect(reportsContent).not.toContain('(Custo do Retrabalho)');
    expect(reportsContent).toContain('(Tempo de Retrabalho)');
  });

  it('6. API de configuração e sincronização de pedidos não deve obrigar Conferência (Etapa 8) e deve resolver etapas dinamicamente', () => {
    const apiContent = fs.readFileSync(path.resolve('api', 'index.ts'), 'utf-8');

    // Resolução canônica dinâmica de etapas
    expect(apiContent).toContain('resolveDefaultProductionStageIds');
    expect(apiContent).toContain('isCorteStage');
    expect(apiContent).toContain('isCosturaStage');
    expect(apiContent).toContain('isConferenciaStage');
    expect(apiContent).not.toContain('defaultRequiredStages = [1, 17, 8]');
    expect(apiContent).not.toContain('defaultRequiredStages = [1, 17]');

    // Endpoint /api/executions/monitor deve ter sido removido
    expect(apiContent).not.toContain("app.get('/api/executions/monitor'");

    // /api/reports deve expurgar campos de custos
    expect(apiContent).toContain('delete data.costsByCollaborator;');
    expect(apiContent).toContain('delete data.costsByOrder;');
    expect(apiContent).toContain('delete data.summary.total_labor_cost;');
  });

  it('7. App.tsx não deve conter imports ociosos de módulos internos de PCP ou cortes', () => {
    const appContent = fs.readFileSync(path.resolve('src', 'App.tsx'), 'utf-8');

    expect(appContent).not.toContain('ConsolidatedCuttingPanel');
    expect(appContent).not.toContain('PcpDashboard');
    expect(appContent).not.toContain('PcpNecessidades');
    expect(appContent).not.toContain('PcpPrioridades');
    expect(appContent).not.toContain('PcpBloqueados');
    expect(appContent).not.toContain('PcpSettings');
    expect(appContent).not.toContain('PcpControleFaccao');
  });

  it('8. useAppLogic.ts não deve depender do ID fixo 8 para marcar pedidos como entregues', () => {
    const logicContent = fs.readFileSync(path.resolve('src', 'hooks', 'useAppLogic.ts'), 'utf-8');

    expect(logicContent).not.toContain('Number(stageId) === 8');
  });
});
