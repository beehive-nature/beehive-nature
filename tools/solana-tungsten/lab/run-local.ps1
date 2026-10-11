param(
    [string]$Distro = 'Ubuntu',
    [string]$Lab = '/home/travi/bnr-tungsten-lab',
    [string]$Ptau = '/home/travi/plonkport/pot12_final.ptau',
    [string]$Circom = '/home/travi/.cargo/bin/circom'
)
$ErrorActionPreference = 'Stop'
function Invoke-Linux([string[]]$Command) {
    & wsl -d $Distro -- @Command
    if ($LASTEXITCODE -ne 0) { throw "Linux command failed with exit $LASTEXITCODE" }
}
$source = (& wsl -d $Distro -- wslpath -a $PSScriptRoot.Replace('\','/')).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve source directory' }
$runtime = "$Lab/source/x0x-427c411c035474ab4fb06102f19815ba4490e6ac/scripts/ci/isolated-runtime.py"
$run = "$Lab/run-" + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
Invoke-Linux @('/usr/bin/mkdir','-m','700',$run)
$bundleHost = Join-Path $PSScriptRoot '../bundle.local.json'
$bundleLinux = "$source/../bundle.local.json"
$bundleText = & cargo run --quiet --locked --manifest-path (Join-Path $PSScriptRoot '../Cargo.toml') -- bundle
if ($LASTEXITCODE -ne 0) { throw 'Rust worker failed' }
[IO.File]::WriteAllText($bundleHost, ($bundleText -join "`n"))
# Copy the owner pin into the private run before receiving untrusted delivery.
Invoke-Linux @('/usr/bin/cp',$bundleLinux,"$run/owner-bundle.json")
$owner = "$run/owner-bundle.json"
$evidence = @{}
function Invoke-Isolated([string]$Name, [string[]]$PhaseArgs) {
    $prepared = Invoke-Linux (@('/usr/bin/env',"RUNNER_TEMP=$run",'X0X_RUNTIME_TIMEOUT_SECONDS=480',
        '/usr/bin/python3',"$source/prepare_isolation.py",$runtime,'/usr/bin/python3',"$source/$Name.py") + $PhaseArgs)
    $line = $prepared | Where-Object { $_ -like 'BNR_CONFIG=*' } | Select-Object -Last 1
    if (-not $line) { throw 'No isolation configuration produced' }
    $config = $line.Substring('BNR_CONFIG='.Length)
    $evidence[$Name] = $config
    & wsl -d $Distro -u root -- /usr/bin/timeout --signal=TERM --kill-after=10 480 /usr/bin/unshare --net --mount --pid --fork --kill-child --mount-proc /usr/bin/python3 $runtime --setup $config
    if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit $LASTEXITCODE; evidence $config" }
}
Invoke-Isolated 'x0x_delivery' @('--binary',"$Lab/bin/x0x-linux-x64-gnu/x0xd",'--bundle',$owner,'--output',"$run/delivery")
$received = "$run/delivery/received-bundle.json"
Invoke-Isolated 'chains' @('--lab',$Lab,'--bundle',$received,'--owner',$owner,'--output',"$run/solana")
Invoke-Linux @('/usr/bin/python3',"$source/build_plonk.py",'--bundle',$received,'--owner',$owner,
    '--node',"$Lab/node",'--circom',$Circom,'--ptau',$Ptau,'--output',"$run/plonk")
Invoke-Isolated 'vaulta' @('--build',"$run/plonk",'--output',"$run/vaulta")
Invoke-Linux @('/usr/bin/node',"$source/reconcile.mjs",$run)
Write-Output "Completed local acceptance: $run"
Write-Output ($evidence | ConvertTo-Json -Compress)
