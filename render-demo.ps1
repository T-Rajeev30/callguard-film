# Render the two demo videos from your screen recording of the VaaniLens app.
#   .\render-demo.ps1 -Recording "$HOME\Videos\Captures\vaanilens.mp4"
#   .\render-demo.ps1 -Recording <file> -StartAt 3     # skip the first 3 seconds of the recording
# Output: out\vaanilens-demo-60s.mp4  (for the LinkedIn/X post)
#         out\vaanilens-demo-full.mp4 (for the submission form: needs a recording of ~1:50-2:45)
param([string]$Recording = '', [double]$StartAt = 0)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path 'public\demo', 'out' | Out-Null
if ($Recording) { Copy-Item -LiteralPath $Recording -Destination 'public\demo\app-recording.mp4' -Force }
if (-not (Test-Path 'public\demo\app-recording.mp4')) { throw 'Pass -Recording "<path to your screen recording .mp4>"' }

$py = if (Test-Path '.python-cmd') { (Get-Content '.python-cmd').Trim() } else { 'python' }
if (-not (Test-Path 'public\audio\mix.wav')) { Invoke-Expression "$py scripts/audio_build.py" }

$raw = npx remotion ffprobe -v error -show_entries format=duration -of csv=p=0 public/demo/app-recording.mp4 | Select-Object -Last 1
$sec = [double]::Parse($raw.Trim(), [Globalization.CultureInfo]::InvariantCulture)
Write-Host ("Recording length: {0:N1}s" -f $sec) -ForegroundColor Cyan

@{ recSeconds = $sec; startAt = $StartAt; maxSeconds = 45 } | ConvertTo-Json -Compress | Set-Content -Encoding ascii 'out\props-short.json'
@{ recSeconds = $sec; startAt = $StartAt; maxSeconds = 160 } | ConvertTo-Json -Compress | Set-Content -Encoding ascii 'out\props-full.json'

Write-Host '== 60-second cut (post) ==' -ForegroundColor Cyan
npx remotion render src/index.ts DemoShort out/vaanilens-demo-60s.mp4 --props=out/props-short.json
Write-Host '== Full demo (submission form, 2-3 min) ==' -ForegroundColor Cyan
npx remotion render src/index.ts DemoLong out/vaanilens-demo-full.mp4 --props=out/props-full.json

$full = 15 + [Math]::Min($sec - $StartAt, 160)
if ($full -lt 120) { Write-Host ("WARNING: full demo is {0:N0}s. The form asks for 2-3 minutes: record at least ~1:50 of the app." -f $full) -ForegroundColor Yellow }
Invoke-Item out
