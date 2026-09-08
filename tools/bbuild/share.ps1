param([ValidateSet('up', 'down', 'status')][string]$Action = 'status')
$shareScriptWindows = Join-Path $PSScriptRoot 'share.sh'
$shareScriptLinux = (& wsl.exe -e wslpath -a -u $shareScriptWindows).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the WSL worker script.' }
& wsl.exe -e bash $shareScriptLinux $Action
exit $LASTEXITCODE
