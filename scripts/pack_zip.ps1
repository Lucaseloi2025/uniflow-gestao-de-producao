$ErrorActionPreference = "Stop"

$staging = "temp_zip_staging"
if (Test-Path $staging) {
    Remove-Item -Path $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null

Write-Host "Copiando api..."
Copy-Item -Path "api" -Destination "$staging/api" -Recurse

Write-Host "Copiando src..."
Copy-Item -Path "src" -Destination "$staging/src" -Recurse

Write-Host "Copiando supabase..."
Copy-Item -Path "supabase" -Destination "$staging/supabase" -Recurse

Write-Host "Copiando tests..."
Copy-Item -Path "tests" -Destination "$staging/tests" -Recurse

Write-Host "Copiando scripts..."
Copy-Item -Path "scripts" -Destination "$staging/scripts" -Recurse

Write-Host "Copiando arquivos de configuração e package..."
Copy-Item -Path "package.json" -Destination "$staging/package.json"
Copy-Item -Path "package-lock.json" -Destination "$staging/package-lock.json"
Copy-Item -Path "tsconfig.json" -Destination "$staging/tsconfig.json"
if (Test-Path "tsconfig.node.json") { Copy-Item -Path "tsconfig.node.json" -Destination "$staging/tsconfig.node.json" }
Copy-Item -Path "vite.config.ts" -Destination "$staging/vite.config.ts"
Copy-Item -Path "vitest.config.ts" -Destination "$staging/vitest.config.ts"
Copy-Item -Path "index.html" -Destination "$staging/index.html"

Write-Host "Copiando SQLs para a raiz do pacote..."
Copy-Item -Path "supabase/migrations/20261018_phase1_deploy_complete.sql" -Destination "$staging/20261018_phase1_deploy_complete.sql"
Copy-Item -Path "supabase/archive_migrations/20261017_phase1_hardening.sql" -Destination "$staging/20261017_phase1_hardening.sql"
Copy-Item -Path "supabase/archive_migrations/20261017_phase1_finalization.sql" -Destination "$staging/20261017_phase1_finalization.sql"
Copy-Item -Path "supabase/archive_migrations/20261017_phase1_foundation.sql" -Destination "$staging/20261017_phase1_foundation.sql"
Copy-Item -Path "supabase/preflight_phase1_check.sql" -Destination "$staging/preflight_phase1_check.sql"

Write-Host "Copiando documentações e logs..."
Copy-Item -Path "INVENTARIO_ROTAS_E_MIDDLEWARES.md" -Destination "$staging/INVENTARIO_ROTAS_E_MIDDLEWARES.md"
Copy-Item -Path "INSTRUCOES_APLICACAO_MIGRATIONS.md" -Destination "$staging/INSTRUCOES_APLICACAO_MIGRATIONS.md"
Copy-Item -Path "relatorio_homologacao_fase1.md" -Destination "$staging/relatorio_homologacao_fase1.md"
Copy-Item -Path "RESULTADO_TESTES_PERMISSAO_RPCS.md" -Destination "$staging/RESULTADO_TESTES_PERMISSAO_RPCS.md"
Copy-Item -Path "saida_integral_testes_build.txt" -Destination "$staging/saida_integral_testes_build.txt"

Write-Host "Gerando ZIP ProComfort_Fase1_Finalizacao_SQL.zip..."
$zipPath = "ProComfort_Fase1_Finalizacao_SQL.zip"
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path "$staging/*" -DestinationPath $zipPath -Force

Write-Host "Copiando para a pasta Downloads do usuário..."
$downloadsPath = "C:\Users\lucas\Downloads\$zipPath"
Copy-Item -Path $zipPath -Destination $downloadsPath -Force

Write-Host "Limpando pasta de staging..."
Remove-Item -Path $staging -Recurse -Force

Write-Host "`nCalculando SHA-256 após geração do ZIP..."
$hashWorkspace = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash
$hashDownloads = (Get-FileHash -Algorithm SHA256 -Path $downloadsPath).Hash

Write-Host "Hash Workspace: $hashWorkspace"
Write-Host "Hash Downloads: $hashDownloads"

if ($hashWorkspace -eq $hashDownloads) {
    Write-Host "✅ Integridade verificada com sucesso: os hashes são rigorosamente idênticos."
} else {
    Write-Error "❌ Divergência detectada entre os arquivos ZIP do Workspace e de Downloads."
}
