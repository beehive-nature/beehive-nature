# Compatibility entry point: on apartment/shared networks, use one SSH
# connection to the box. This helper never starts a laptop P2P daemon.
# The SSH key stays in WSL. See ops/x0x/LAPTOP-NETWORK.md.
param(
  [Parameter(Position=0)][ValidateSet('up','down','status')][string]$Action='status',
  [ValidateRange(1,120)][int]$IdleMinutes=10,
  [switch]$Media
)
$ErrorActionPreference = 'Stop'
$helper = Join-Path $PSScriptRoot 'box-tunnel.sh'
if (-not (Test-Path -LiteralPath $helper)) { throw "Missing companion helper: $helper" }
$linuxHelper = (& wsl.exe -e wslpath -a $helper).Trim()
if ($LASTEXITCODE -ne 0) { throw 'WSL could not resolve the helper path.' }
$mediaArg = if ($Media) { 'media' } else { 'api' }
& wsl.exe -e bash $linuxHelper $Action ($IdleMinutes * 60) $mediaArg
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($Action -eq 'up') {
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:18080/health' -TimeoutSec 8
    if ($health.status -ne 'healthy') { throw 'The box health response was not healthy.' }
    Write-Host "Windows loopback verified: x0x $($health.version), $($health.peers) box peers."
  } catch {
    & wsl.exe -e bash $linuxHelper down 1 $mediaArg
    throw 'Windows could not reach the box through WSL localhost forwarding; this tunnel was closed.'
  }
}
