$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $projectRoot "storage\backups"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$archivePath = Join-Path $backupRoot ("swamedia2-backup-" + $timestamp + ".zip")
$stagingRoot = Join-Path $env:TEMP ("swamedia2-backup-" + [guid]::NewGuid().ToString("N"))
$stagingProject = Join-Path $stagingRoot "swamedia2"

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
New-Item -ItemType Directory -Path $stagingProject -Force | Out-Null

$items = Get-ChildItem -LiteralPath $projectRoot -Force | Where-Object {
    $_.Name -notin @("storage", ".git")
}

foreach ($item in $items) {
    Copy-Item -LiteralPath $item.FullName -Destination $stagingProject -Recurse -Force
}

Compress-Archive -Path (Join-Path $stagingProject "*") -DestinationPath $archivePath -Force
Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Get-ChildItem -LiteralPath $backupRoot -Filter "*.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force

Write-Output ("Backup created: " + $archivePath)
