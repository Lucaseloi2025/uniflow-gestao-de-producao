import { spawnSync } from 'node:child_process';

/**
 * PACOTE V9 — SCRIPT DE HOMOLOGAÇÃO EM STAGING SUPABASE REAL
 * 
 * Regras estritas:
 * 1. Falha com código 1 se as credenciais de staging estiverem ausentes;
 * 2. Falha com código 1 se STAGING_API_BASE_URL for marcada como obrigatória e não estiver configurada;
 * 3. Executa a suíte e analisa o resultado;
 * 4. Falha com código 1 se qualquer teste for pulado (skipped);
 * 5. Falha com código 1 se houver qualquer erro de execução;
 * 6. Apenas sai com código 0 se 100% dos testes passarem com ZERO testes pulados.
 */
function main() {
  const stagingUrl = process.env.STAGING_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY?.trim();
  const apiBaseUrl = process.env.STAGING_API_BASE_URL?.trim();
  const requireApiUrl = process.env.REQUIRE_STAGING_API_URL === 'true' || process.env.REQUIRE_STAGING_API_URL === '1';

  console.log('================================================================================');
  console.log('PROCOMFORT — RUNNER OFICIAL DE HOMOLOGAÇÃO EM STAGING SUPABASE REAL');
  console.log('================================================================================');

  // 1. Verificação de credenciais
  if (!stagingUrl || !serviceRoleKey || !anonKey) {
    console.error('\n❌ STATUS: INCOMPLETA (Credenciais de Staging ausentes)');
    console.error('Nenhum projeto Supabase de Staging remoto está configurado neste ambiente.');
    console.error('Variáveis obrigatórias:');
    console.error(`- STAGING_SUPABASE_URL: ${stagingUrl ? 'Configurada' : 'AUSENTE'}`);
    console.error(`- STAGING_SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? 'Configurada' : 'AUSENTE'}`);
    console.error(`- STAGING_SUPABASE_ANON_KEY: ${anonKey ? 'Configurada' : 'AUSENTE'}`);
    console.error('\nInstruções obrigatórias:');
    console.error('1. Crie um projeto Supabase dedicado e descartável para staging;');
    console.error('2. Execute no SQL Editor a migração supabase/migrations/20261018_phase1_deploy_complete.sql;');
    console.error('3. Defina as variáveis de ambiente e execute novamente npm run test:staging-live.\n');
    console.log('================================================================================');
    process.exit(1);
  }

  // 2. Verificação de STAGING_API_BASE_URL se exigida
  if (requireApiUrl && !apiBaseUrl) {
    console.error('\n❌ STATUS: INCOMPLETA (STAGING_API_BASE_URL obrigatória mas ausente)');
    console.error('A variável STAGING_API_BASE_URL é necessária para este ambiente e não foi informada.');
    process.exit(1);
  }

  console.log('\n🚀 Conectando à instância remota de staging configurada via ambiente...');
  if (apiBaseUrl) {
    console.log('🌐 Utilizando backend externo em STAGING_API_BASE_URL (configurado).');
  } else {
    console.log('🌐 Backend API: servidor Express local na porta efêmera integrado ao Staging.');
  }
  console.log('Executando suíte live de ponta a ponta (GoTrue + RLS + PostgREST + Backend JWT -> RPC)...\n');

  // 3. Execução da suíte via Vitest capturando saída e status
  const vitestProcess = spawnSync('npx', ['vitest', 'run', 'tests/phase1-supabase-staging-live.test.ts', '--reporter=verbose'], {
    encoding: 'utf8',
    shell: true,
  });

  const fullOutput = (vitestProcess.stdout || '') + (vitestProcess.stderr || '');
  console.log(fullOutput);

  // 4. Verificação de código de saída do processo
  if (vitestProcess.status !== 0) {
    console.error('\n❌ Falhas detectadas na suíte de homologação em staging.');
    process.exit(vitestProcess.status || 1);
  }

  // 5. Verificação estrita de testes pulados (skipped)
  const hasSkipped = /\b(?:skipped|pulado)\b/i.test(fullOutput) && !fullOutput.includes('0 skipped');
  if (hasSkipped) {
    console.error('\n❌ FALHA DE HOMOLOGAÇÃO: Testes foram pulados (skipped).');
    console.error('A liberação para produção exige homologação 100% executada com 0 testes pulados.');
    process.exit(1);
  }

  console.log('\n================================================================================');
  console.log('✅ HOMOLOGAÇÃO EM STAGING REAL CONCLUÍDA COM 100% DE SUCESSO (0 SKIPPED).');
  console.log('================================================================================');
  process.exit(0);
}

main();
