# CallGuard film - render on your own machine
# Usage:
#   .\render.ps1                 # sound mix + 16:9 + 4:5 videos
#   .\render.ps1 -Voice          # Gnani Timbre voices + Prisma transcript first (needs GNANI_API_KEY in .env)
#   .\render.ps1 -Only16x9       # skip the 4:5 feed cut
#   .\render.ps1 -Concurrency 4  # limit CPU threads if the laptop gets hot
#   .\render.ps1 -Studio         # open Remotion Studio to preview / scrub instead of rendering
param([switch]$Voice, [switch]$Only16x9, [switch]$Studio, [int]$Concurrency = 0)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$py = if (Test-Path '.python-cmd') { (Get-Content '.python-cmd').Trim() } else { 'python' }
New-Item -ItemType Directory -Force -Path 'out' | Out-Null

if ($Voice) {
  if (-not (Test-Path '.env') -and -not $env:GNANI_API_KEY) { throw 'Create .env from .env.example and add GNANI_API_KEY first.' }
  Write-Host '== Generating voices with Gnani Timbre + transcribing with Gnani Prisma ==' -ForegroundColor Cyan
  npx tsx scripts/voice.ts
}

Write-Host '== Building sound design + score + mix ==' -ForegroundColor Cyan
Invoke-Expression "$py scripts/audio_build.py"
if ($LASTEXITCODE -ne 0) { throw 'Audio build failed (see above).' }

if ($Studio) { npx remotion studio src/index.ts; exit }

$extra = @()
if ($Concurrency -gt 0) { $extra += "--concurrency=$Concurrency" }

$t = Get-Date
Write-Host '== Rendering 16:9 (1920x1080) ==' -ForegroundColor Cyan
npx remotion render src/index.ts CallGuardFilm out/callguard-film-16x9.mp4 @extra
if ($LASTEXITCODE -ne 0) { throw 'Render failed.' }

if (-not $Only16x9) {
  Write-Host '== Rendering 4:5 feed cut (1080x1350) ==' -ForegroundColor Cyan
  npx remotion render src/index.ts CallGuardFeed out/callguard-film-4x5.mp4 @extra
  if ($LASTEXITCODE -ne 0) { throw 'Render failed.' }
}

Write-Host ("`nDone in {0:N1} min. Files are in .\out" -f ((Get-Date) - $t).TotalMinutes) -ForegroundColor Green
Invoke-Item out
