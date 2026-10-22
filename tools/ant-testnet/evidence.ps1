# evidence.ps1 - the Windows side of the lab's exposure under WSL2 NAT: what the host forwards,
# what its firewall allows, and whether the devnet ports answer anywhere but loopback. Plain
# text; paste it into the run's receipt beside evidence.sh from inside the guest.
#   powershell -ExecutionPolicy Bypass -File tools\ant-testnet\evidence.ps1
$ErrorActionPreference = 'Continue'
Write-Output "== at"
(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$env:COMPUTERNAME
$rpc = $null
try {
  $m = Invoke-RestMethod -TimeoutSec 5 'http://127.0.0.1:25000/api/devnet-manifest.json'
  $rpc = ([uri]$m.evm.rpc_url).Port
  Write-Output ("== manifest reachable on loopback; test chain rpc port {0}" -f $rpc)
} catch { Write-Output ("== manifest NOT reachable on loopback: {0}" -f $_.Exception.Message) }
Write-Output "== host listeners for the devnet ports (expected: wslrelay on 127.0.0.1 only)"
if ($rpc) { $pat = (":25000 |:{0} " -f $rpc) } else { $pat = ":25000 " }
netstat -ano | Select-String $pat | ForEach-Object { $_.Line.Trim() }
Write-Output "== portproxy (any entry here is a deliberate LAN exposure)"
netsh interface portproxy show all
Write-Output "== Hyper-V firewall for the WSL VM (DefaultInboundAction Block = the LAN cannot reach guest sockets)"
try { Get-NetFirewallHyperVVMSetting -PolicyStore ActiveStore -ErrorAction Stop | Select-Object Name,Enabled,DefaultInboundAction,LoopbackEnabled | Format-Table -AutoSize | Out-String } catch { Write-Output ("no Hyper-V VM firewall setting cmdlet: {0}" -f $_.Exception.Message) }
Write-Output "== Hyper-V inbound allow rules naming the lab (expected: none)"
try { Get-NetFirewallHyperVRule -PolicyStore ActiveStore -ErrorAction Stop | Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' -and $_.DisplayName -match 'anvil|devnet|25000|3044|3045|3046' } | Select-Object DisplayName,Enabled | Format-Table -AutoSize | Out-String } catch { Write-Output ("no Hyper-V rule cmdlet: {0}" -f $_.Exception.Message) }
Write-Output "== host inbound allow rules naming the lab (expected: none)"
Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True | Where-Object { $_.DisplayName -match 'anvil|devnet|25000' } | Select-Object DisplayName,Profile | Format-Table -AutoSize | Out-String
Write-Output "== host IPv4 addresses"
$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' })
$ips | Select-Object IPAddress,InterfaceAlias | Format-Table -AutoSize | Out-String
Write-Output "== HTTP reach of the manifest on each non-loopback host address (expected: every one fails)"
foreach ($ip in $ips.IPAddress) {
  $url = ('http://{0}:25000/api/devnet-manifest.json' -f $ip)
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url
    Write-Output ("{0}:25000 ANSWERED HTTP {1} - the manifest is reachable off loopback" -f $ip, $r.StatusCode)
  } catch {
    $why = ($_.Exception.Message -replace "`r|`n", ' ')
    Write-Output ("{0}:25000 no answer ({1})" -f $ip, $why)
  }
}
Write-Output "== outside reach (foreign oracle check-host.net, TCP to this network's public address; expected: every node times out)"
try {
  $pub = (Invoke-RestMethod -TimeoutSec 8 'https://api.ipify.org?format=json').ip
  $ports = @(25000)
  if ($rpc) { $ports += $rpc }
  foreach ($p in $ports) {
    $ask = ('https://check-host.net/check-tcp?host={0}:{1}&max_nodes=3' -f $pub, $p)
    $req = Invoke-RestMethod -TimeoutSec 15 -Headers @{Accept='application/json'} $ask
    Start-Sleep -Seconds 10
    $res = Invoke-RestMethod -TimeoutSec 15 -Headers @{Accept='application/json'} ('https://check-host.net/check-result/{0}' -f $req.request_id)
    Write-Output ("port {0} report {1}" -f $p, $req.permanent_link)
    $res | ConvertTo-Json -Compress
  }
} catch { Write-Output ("outside reach not measured: {0}" -f $_.Exception.Message) }
