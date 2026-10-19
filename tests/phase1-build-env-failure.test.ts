import { describe, it, expect, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * AUDITORIA V8 — ITEM 4: FALHA DETERMINÍSTICA DO BUILD DE PRODUÇÃO SEM VARIÁVEIS
 * 
 * Valida que o comando npm run build (vite build) em modo produção:
 * 1. Falha imediatamente com código de saída 1 quando VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY estão ausentes;
 * 2. Emite mensagem de erro explícita no stderr/stdout;
 * 3. Tem sucesso completo (código 0) quando as variáveis de ambiente necessárias são fornecidas.
 */
describe('Auditoria V8 — Item 4: Validação do Build de Produção sem Variáveis de Ambiente', () => {
  const distPath = path.resolve('dist');

  afterAll(() => {
    // Manter o ambiente limpo após os testes
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
  });

  it('1. Deve falhar com exit code não-zero quando executado sem variáveis de ambiente de produção', () => {
    // Remover dist se existir previamente
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }

    // Criar ambiente explicitamente sem as variáveis VITE_SUPABASE_*
    const envWithoutVars = { ...process.env };
    delete envWithoutVars.VITE_SUPABASE_URL;
    delete envWithoutVars.VITE_SUPABASE_ANON_KEY;
    delete envWithoutVars.SKIP_ENV_VALIDATION;

    const result = spawnSync('npm', ['run', 'build'], {
      env: envWithoutVars,
      shell: true,
      encoding: 'utf8',
    });

    // Deve falhar com código diferente de zero
    expect(result.status).not.toBe(0);

    const fullOutput = (result.stdout || '') + (result.stderr || '');
    expect(fullOutput).toContain('ERRO FATAL DE BUILD DE PRODUÇÃO');
    expect(fullOutput).toContain('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');

    // Não deve ter gerado dist/ (ou deve estar ausente)
    expect(fs.existsSync(distPath)).toBe(false);
  });

  it('2. Deve concluir com sucesso (exit code 0) quando as variáveis de ambiente de produção são fornecidas', () => {
    const envWithVars = {
      ...process.env,
      VITE_SUPABASE_URL: 'https://staging-temp-build.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-anon-token-build-test',
    };

    const result = spawnSync('npm', ['run', 'build'], {
      env: envWithVars,
      shell: true,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(fs.existsSync(distPath)).toBe(true);
    expect(fs.existsSync(path.join(distPath, 'index.html'))).toBe(true);
  }, 180000);
});
