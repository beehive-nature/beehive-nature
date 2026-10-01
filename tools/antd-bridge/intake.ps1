param([ValidateSet('Start','Status')][string]$Action='Status',[string]$StateDir=(Join-Path $env:USERPROFILE 'bridge-state-bpay-ui'))
$ErrorActionPreference='Stop'
$servicePath=Join-Path $PSScriptRoot 'intake-server.mjs'
if($Action -eq 'Start'){
  $listener=Get-NetTCPConnection -LocalPort 8807 -State Listen -ErrorAction SilentlyContinue
  if(-not $listener){
    New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
    $env:ANTD_BRIDGE_STATE=(Resolve-Path -LiteralPath $StateDir).Path
    $nodePath=(Get-Command node -ErrorAction Stop).Source
    $process=Start-Process -FilePath $nodePath -ArgumentList @('"'+$servicePath+'"') -WindowStyle Hidden -WorkingDirectory $PSScriptRoot -RedirectStandardOutput (Join-Path $StateDir 'intake-service.log') -RedirectStandardError (Join-Path $StateDir 'intake-service.err') -PassThru
    $process.Id | Set-Content -LiteralPath (Join-Path $StateDir 'intake-service.pid')
    for($i=0;$i -lt 20;$i++){try{$null=Invoke-RestMethod http://127.0.0.1:8807/health -TimeoutSec 3;break}catch{Start-Sleep -Milliseconds 250}}
  }
}
$health=Invoke-RestMethod http://127.0.0.1:8807/health -TimeoutSec 4
if($health.service -ne 'bdata-local-intake' -or -not $health.intake.ready){throw 'Port 8807 belongs to another service; nothing was replaced.'}
$health | ConvertTo-Json -Depth 6
