# install.ps1 — bDISPATCH one-shot install on the founder's Windows box. Run from the repo root.
#   powershell -ExecutionPolicy Bypass -File tools\bdispatch\install.ps1
# Does, in order: deps → key (keyring only) → npub/NIP-05/GRANT files → seat scan → nak → user service → test drop.
# The secret is generated inside Python and handed straight to Windows Credential Manager. It is never echoed.
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$disp = Join-Path $repo "docs\dispatches"

# 1 · deps (pinned)
python -m pip install --quiet "nostr-sdk==0.42.1" "keyring==25.7.0"

# 2 · key → Credential Manager (service bnr/bclaude/nsec, user bclaude). Idempotent: existing entry is kept.
$pub = python (Join-Path $PSScriptRoot "keyinit.py")
$npub = $pub[0]; $hex = $pub[1]
Write-Host "bclaude npub: $npub"

# 3 · NIP-05 + GRANT hand-off (public material only)
$nip05 = @{ names = @{ bclaude = $hex } } | ConvertTo-Json -Compress
$site = Join-Path $repo "..\skaists.dev\.well-known"
if (Test-Path $site) {
  $wk = Join-Path $site "nostr.json"
  if (Test-Path $wk) { $j = Get-Content $wk -Raw | ConvertFrom-Json; $j.names | Add-Member -Force bclaude $hex; $j | ConvertTo-Json -Compress | Set-Content $wk -NoNewline }
  else { $nip05 | Set-Content $wk -NoNewline }
  Write-Host "NIP-05 written to skaists.dev site tree: $wk"
} else {
  $nip05 | Set-Content (Join-Path $disp "nip05-bclaude.json") -NoNewline
  Write-Host "skaists.dev tree not on this box — NIP-05 JSON filed at docs/dispatches/nip05-bclaude.json (copy to https://skaists.dev/.well-known/nostr.json)"
}
@("$npub", "bclaude@skaists.dev", "In buzz, on each seat agent -> Manage agent access -> add this pubkey.") -join "`n" | Set-Content (Join-Path $disp "BDISPATCH-GRANT.md") -NoNewline

# 4 · seat pubkeys (read-only scan, secrets skipped)
python (Join-Path $PSScriptRoot "seatscan.py")

# 5 · nak (public domain — VERIFIED-FACTS A60) for relay verification only; the watcher signs from the keyring itself.
if (-not (Get-Command nak -ErrorAction SilentlyContinue)) {
  if (Get-Command go -ErrorAction SilentlyContinue) { go install github.com/fiatjaf/nak@latest }
  else { Write-Host "nak: install Go or drop nak.exe on PATH from github.com/fiatjaf/nak/releases (verify sha256 against the release manifest)" }
}

# 6 · user service: Scheduled Task at logon, survives reboot, runs as the founder (keyring is per-user)
$py = (Get-Command pythonw -ErrorAction SilentlyContinue).Source; if (-not $py) { $py = (Get-Command python).Source }
$action  = New-ScheduledTaskAction -Execute $py -Argument "`"$PSScriptRoot\watcher.py`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "bnr-bdispatch-watcher" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName "bnr-bdispatch-watcher"

# 7 · test drop (goose). The watcher appends RELAYED <ts> <event id> to=goose once it lands.
"SEND TO: goose`nACK bDISPATCH — reply with your seat name and this event id" | Set-Content (Join-Path $disp "TEST-BDISPATCH-$(Get-Date -Format yyyy-MM-dd).md") -NoNewline
Write-Host "dropped test file; watch docs/dispatches for the RELAYED line, then: nak req -k 1059 -p $hex wss://skaists.buzz"
