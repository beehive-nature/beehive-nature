# voice-capture.ps1 - record N seconds from the DEFAULT microphone to a
# 16kHz 16-bit mono WAV (whisper's preferred shape), with ZERO installs:
# winmm waveIn* via Add-Type P/Invoke. Local only; nothing leaves the box.
# ASCII ONLY: Windows PowerShell 5.1 reads BOM-less UTF-8 as ANSI.
#
# Usage: powershell -NoProfile -File voice-capture.ps1 -Out goal.wav -Seconds 5
param(
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Seconds = 5
)

$cs = @"
using System;
using System.Runtime.InteropServices;
public static class WaveIn {
  [DllImport("winmm.dll")] public static extern int waveInGetNumDevs();
  [DllImport("winmm.dll")] public static extern int waveInOpen(out IntPtr h, int devId, ref WAVEFORMATEX fmt, IntPtr cb, IntPtr inst, int flags);
  [DllImport("winmm.dll")] public static extern int waveInPrepareHeader(IntPtr h, ref WAVEHDR hdr, int size);
  [DllImport("winmm.dll")] public static extern int waveInAddBuffer(IntPtr h, ref WAVEHDR hdr, int size);
  [DllImport("winmm.dll")] public static extern int waveInStart(IntPtr h);
  [DllImport("winmm.dll")] public static extern int waveInUnprepareHeader(IntPtr h, ref WAVEHDR hdr, int size);
  [DllImport("winmm.dll")] public static extern int waveInStop(IntPtr h);
  [DllImport("winmm.dll")] public static extern int waveInClose(IntPtr h);

  [StructLayout(LayoutKind.Sequential)]
  public struct WAVEFORMATEX { public ushort tag, chans; public int rate, bytesPerSec; public ushort align, bits; }

  [StructLayout(LayoutKind.Sequential)]
  public struct WAVEHDR { public IntPtr data; public int len, recorded; public IntPtr user, flags, next; public int reserved; }
}
"@
Add-Type -TypeDefinition $cs

if ([WaveIn]::waveInGetNumDevs() -lt 1) { Write-Error "no waveform capture device"; exit 1 }

$rate = 16000
$bytes = $rate * 2 * $Seconds   # 16-bit mono
$buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes)
$fmt = New-Object WaveIn+WAVEFORMATEX
$fmt.tag = 1; $fmt.chans = 1; $fmt.rate = $rate; $fmt.bits = 16
$fmt.align = 2; $fmt.bytesPerSec = $rate * 2

$h = [IntPtr]::Zero
if ([WaveIn]::waveInOpen([ref]$h, -1, [ref]$fmt, [IntPtr]::Zero, [IntPtr]::Zero, 0) -ne 0) {
  Write-Error "waveInOpen failed (device busy or no default mic)"; exit 1
}
$hdr = New-Object WaveIn+WAVEHDR
$hdr.data = $buffer; $hdr.len = $bytes
$hs = [Runtime.InteropServices.Marshal]::SizeOf($hdr)
[void][WaveIn]::waveInPrepareHeader($h, [ref]$hdr, $hs)
[void][WaveIn]::waveInAddBuffer($h, [ref]$hdr, $hs)
[void][WaveIn]::waveInStart($h)
Write-Host "recording $Seconds s from the default microphone..."
Start-Sleep -Milliseconds ($Seconds * 1000 + 400)
[void][WaveIn]::waveInStop($h)
[void][WaveIn]::waveInUnprepareHeader($h, [ref]$hdr, $hs)
[void][WaveIn]::waveInClose($h)

$got = $hdr.recorded
if ($got -lt $rate) { Write-Error "captured only $got bytes - mic muted?"; exit 1 }

# write a canonical 44-byte RIFF header + PCM
$out = [IO.File]::Create($Out)
$bw = New-Object IO.BinaryWriter($out)
$bw.Write([Text.Encoding]::ASCII.GetBytes("RIFF"))
$bw.Write([uint32](36 + $got))
$bw.Write([Text.Encoding]::ASCII.GetBytes("WAVEfmt "))
$bw.Write([uint32]16)
$bw.Write([uint16]1); $bw.Write([uint16]1)
$bw.Write([uint32]$rate); $bw.Write([uint32]($rate * 2))
$bw.Write([uint16]2); $bw.Write([uint16]16)
$bw.Write([Text.Encoding]::ASCII.GetBytes("data"))
$bw.Write([uint32]$got)
$tmp = New-Object byte[] $got
[Runtime.InteropServices.Marshal]::Copy($buffer, $tmp, 0, $got)
$bw.Write($tmp)
$bw.Close()
[Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
Write-Host ("wrote {0} - {1} bytes, 16kHz mono 16-bit" -f $Out, $got)
