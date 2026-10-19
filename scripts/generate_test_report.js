import { execSync } from 'child_process';
import fs from 'fs';

console.log('Gerando saída integral dos testes e build...');

let logContent = '================================================================================\n';
logContent += 'SAÍDA INTEGRAL DOS TESTES E BUILD — FASE 1 PROCOMFORT\n';
logContent += `Gerado em: ${new Date().toISOString()} (America/Sao_Paulo: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})\n`;
logContent += '================================================================================\n\n';

function runAndCapture(label, cmd) {
  logContent += `\n################################################################################\n`;
  logContent += `### ${label}\n`;
  logContent += `### Comando: ${cmd}\n`;
  logContent += `################################################################################\n\n`;
  console.log(`Executando: ${label}...`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    logContent += out;
    logContent += `\n[RESULTADO]: SUCESSO (Exit code 0)\n`;
  } catch (err) {
    if (err.stdout) logContent += err.stdout;
    if (err.stderr) logContent += '\n--- STDERR ---\n' + err.stderr;
    logContent += `\n[RESULTADO]: ERRO (Exit code ${err.status})\n`;
  }
}

// 1. Suíte Principal da Fase 1
runAndCapture('1. HOMOLOGAÇÃO TÉCNICA DA FASE 1 (RPCs, Idempotência, RBAC, 10 Cenários)', 'npx tsx src/lib/operationEngine.test.ts');

// 2. Testes de Regressão Unitários
runAndCapture('2. TESTES DE CORTE E MODELO (cuttingUtils)', 'npx tsx src/lib/cuttingUtils.test.ts');
runAndCapture('3. TESTES DE ENFESTO E EFICIÊNCIA (enfestoUtils)', 'npx tsx src/lib/enfestoUtils.test.ts');
runAndCapture('4. TESTES DE PERDAS E REPOSIÇÕES (lossUtils)', 'npx tsx src/lib/lossUtils.test.ts');
runAndCapture('5. TESTES DE PRODUÇÃO E VOLUMES (productionUtils)', 'npx tsx src/lib/productionUtils.test.ts');

// 3. Lint e Build
runAndCapture('6. VERIFICAÇÃO DE TIPOS (LINT: tsc --noEmit)', 'npm run lint');
runAndCapture('7. COMPILAÇÃO DE PRODUÇÃO (VITE BUILD)', 'npm run build');

fs.writeFileSync('saida_integral_testes_build.txt', logContent, 'utf8');
console.log('Arquivo saida_integral_testes_build.txt salvo com sucesso!');
