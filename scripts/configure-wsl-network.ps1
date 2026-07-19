$ErrorActionPreference = "Stop"

$wslConfigPath = Join-Path $env:USERPROFILE ".wslconfig"
$backupPath = $null

if (Test-Path $wslConfigPath) {
  $backupPath = "$wslConfigPath.codex-backup-$(Get-Date -Format yyyyMMddHHmmss)"
  Copy-Item -LiteralPath $wslConfigPath -Destination $backupPath
}

$content = @"
[wsl2]
networkingMode=nat
dnsProxy=true
firewall=false
localhostForwarding=true
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($wslConfigPath, $content, $utf8NoBom)

Write-Host "WSL networking configured in: $wslConfigPath"
if ($backupPath) {
  Write-Host "Previous config backed up to: $backupPath"
}

Write-Host "Restarting WSL..."
wsl.exe --shutdown

Write-Host "Done. Start the stack with: scripts\\start-local-wsl.cmd"
