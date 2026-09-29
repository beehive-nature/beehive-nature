# Low-volume observation, never a node launcher or throughput stress test.
# Output omits SSIDs, gateway addresses, peer identities, and credentials.
param(
  [ValidateRange(5,30)][int]$Samples=10,
  [string]$Adapter='Wi-Fi',
  [string]$Label='baseline',
  [string]$ProbeHost='129.153.202.144'
)
$ErrorActionPreference='Stop'
$nic=Get-NetAdapter -Name $Adapter
$route=Get-NetRoute -InterfaceIndex $nic.ifIndex -DestinationPrefix '0.0.0.0/0' |
  Sort-Object RouteMetric | Select-Object -First 1
if (-not $route) { throw 'No IPv4 default route for the selected adapter.' }
$before=Get-NetAdapterStatistics -Name $Adapter
$started=Get-Date
$ping=[System.Net.NetworkInformation.Ping]::new()
$measurements=@()
try {
  for ($i=0; $i -lt $Samples; $i++) {
    foreach ($target in @(@{Name='gateway';Address=$route.NextHop},@{Name='box';Address=$ProbeHost})) {
      try {
        $reply=$ping.Send($target.Address,750)
        $measurements += [pscustomobject]@{target=$target.Name;status=$reply.Status.ToString();rtt_ms=$(if ($reply.Status -eq 'Success') {$reply.RoundtripTime} else {$null})}
      } catch { $measurements += [pscustomobject]@{target=$target.Name;status='ProbeError';rtt_ms=$null} }
    }
    Start-Sleep -Milliseconds 750
  }
} finally { $ping.Dispose() }
$after=Get-NetAdapterStatistics -Name $Adapter
$elapsed=((Get-Date)-$started).TotalSeconds
$summary=@()
foreach ($target in @('gateway','box')) {
  $rows=@($measurements | Where-Object target -eq $target)
  $ok=@($rows | Where-Object status -eq 'Success')
  $stats=$ok | Measure-Object rtt_ms -Average -Maximum -Minimum
  $summary += [pscustomobject]@{target=$target;sent=$rows.Count;replies=$ok.Count;mean_ms=$stats.Average;max_ms=$stats.Maximum;min_ms=$stats.Minimum}
}
[pscustomobject]@{
  label=$Label;timestamp_utc=$started.ToUniversalTime().ToString('o');elapsed_s=[math]::Round($elapsed,2)
  average_sent_mbps=[math]::Round(($after.SentBytes-$before.SentBytes)*8/$elapsed/1e6,4)
  average_received_mbps=[math]::Round(($after.ReceivedBytes-$before.ReceivedBytes)*8/$elapsed/1e6,4)
  sent_errors=$after.OutboundPacketErrors-$before.OutboundPacketErrors
  received_errors=$after.ReceivedPacketErrors-$before.ReceivedPacketErrors
  local_p2p_processes=@(Get-Process | Where-Object ProcessName -match '^(x0xd|ant-node|antd|autonomi|safenode)$' | Select-Object -ExpandProperty ProcessName)
  probes=$summary
  limit='Adapter traffic includes other applications. Missing ICMP replies alone do not establish an outage. WSL processes must be checked separately.'
} | ConvertTo-Json -Depth 5
