$zipName = "ProComfort_Fase1_Finalizacao_SQL.zip"
$zipPath = Join-Path (Get-Location) $zipName

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "Coletando arquivos para o pacote ZIP..."
$items = Get-ChildItem -Path . -Exclude "node_modules", ".git", ".env*", $zipName

Compress-Archive -Path $items -DestinationPath $zipPath -CompressionLevel Optimal -Force
Write-Host "ZIP criado com sucesso em: $zipPath"

$downloads = "C:\Users\lucas\Downloads"
if (Test-Path $downloads) {
    Copy-Item -Path $zipPath -Destination (Join-Path $downloads $zipName) -Force
    Write-Host "Copiado para: $downloads\$zipName"
}

$desktopOne = "C:\Users\lucas\OneDrive\Desktop"
if (Test-Path $desktopOne) {
    Copy-Item -Path $zipPath -Destination (Join-Path $desktopOne $zipName) -Force
    Write-Host "Copiado para: $desktopOne\$zipName"
}

$desktopStd = "C:\Users\lucas\Desktop"
if (Test-Path $desktopStd) {
    Copy-Item -Path $zipPath -Destination (Join-Path $desktopStd $zipName) -Force
    Write-Host "Copiado para: $desktopStd\$zipName"
}

$sqlPath = "supabase/migrations/20261017_phase1_finalization.sql"
$sqlHash = (Get-FileHash -Path $sqlPath -Algorithm SHA256).Hash
$zipHash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash
$zipSize = (Get-Item $zipPath).Length

Write-Host "=== HASHES SHA-256 ==="
Write-Host "SQL_SHA256: $sqlHash"
Write-Host "ZIP_SHA256: $zipHash"
Write-Host "ZIP_SIZE_BYTES: $zipSize"
