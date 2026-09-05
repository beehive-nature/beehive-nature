# x0x-tunnel — laptop ON-DEMAND tailnet door to the hive box (lane x0x round 5).
# usage: .\x0x-tunnel.ps1 up | down | status
#   up    -> start the daemon (lean gossip profile), seat the direct machine
#            session, arm 127.0.0.1:18080 -> box loopback 12700, verify.
#   down  -> stop the daemon (wifi-friendly: zero background gossip when idle).
#   status-> daemon + forward + tunnel reachability.
# One-time state already persisted in %APPDATA%\x0x: identity, contacts+trust
# (both sides), and the connect ACL at <script dir>\connect-acl.toml.
param([Parameter(Position=0)][ValidateSet('up','down','status')]$Action='status')

$ErrorActionPreference = 'Stop'
$dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$x0x  = Join-Path $dir 'x0x.exe'
$x0xd = Join-Path $dir 'x0xd.exe'
$cfg  = Join-Path $dir 'x0xd-laptop.toml'
$acl  = Join-Path $dir 'connect-acl.toml'
$BOX_AGENT   = '1ca00a42186e3d91591e63fcc153b75aee4b8bd93aedd2c2a56ac2618df66367' # PUBLIC-CONSTANT hive-box agent id
$BOX_MACHINE = '5e9ace67b3825b67f1201ab1490fed1eb1d169edf4dc4499934e92f47fe37bc9' # PUBLIC-CONSTANT hive-box machine id

function Test-Daemon { try { (& $x0x health 2>$null | Select-String 'ok: true').Count -gt 0 } catch { $false } }

switch ($Action) {
  'up' {
    if (-not (Test-Daemon)) {
      Start-Process -FilePath $x0xd -ArgumentList @('--config',$cfg,'--connect-acl',$acl) -WindowStyle Hidden
      $ok = $false
      foreach ($i in 1..40) { Start-Sleep -Seconds 2; if (Test-Daemon) { $ok = $true; break } }
      if (-not $ok) { Write-Error 'daemon did not become healthy in 80s'; exit 1 }
    }
    # seat the direct machine session (gossip shuffling alone may never pair us)
    & $x0x machines connect $BOX_MACHINE 2>$null | Out-Null
    # arm the forward (idempotent: port-busy = already armed by a live daemon)
    & $x0x forward add --local 127.0.0.1:18080 --peer $BOX_AGENT --target-port 12700 2>$null | Out-Null
    foreach ($i in 1..10) {
      Start-Sleep -Seconds 3
      try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:18080/health' -UseBasicParsing -TimeoutSec 20
            if ($r.StatusCode -eq 200) { Write-Host "tunnel UP: 127.0.0.1:18080 -> box 12700 (HTTP 200)"; exit 0 } } catch {}
    }
    Write-Error 'tunnel did not answer through 18080'; exit 1
  }
  'down' {
    & $x0x stop 2>$null | Out-Null
    Start-Sleep -Seconds 3
    Get-Process x0xd -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    if (Get-Process x0xd -ErrorAction SilentlyContinue) { Write-Error 'x0xd still running'; exit 1 }
    Write-Host 'tunnel DOWN: daemon stopped, zero background gossip'
  }
  'status' {
    $d = Test-Daemon
    Write-Host "daemon: $(if($d){'up'}else{'down'})"
    if ($d) {
      & $x0x forward list 2>$null
      try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:18080/health' -UseBasicParsing -TimeoutSec 15
            Write-Host "tunnel: HTTP $($r.StatusCode), $(($r.Content | ConvertFrom-Json).peers) box peers" }
      catch { Write-Host 'tunnel: not answering' }
    }
  }
}
