# ONE COMMAND: headless Chromium records the real VaaniLens app, then the RTX GPU renders every final video.
#   powershell -ExecutionPolicy Bypass -File .\make-final.ps1
#   options: -SkipRecord (reuse public\demo\app-recording.mp4)   -NoGpu   -SkipFilm
# Output (out\):
#   vaanilens-demo-60s.mp4   -> LinkedIn / X post (Demo Day 60-second award)
#   vaanilens-demo-full.mp4  -> submission form (2-3 min demo)
#   callguard-film-16x9.mp4  -> the 46 s cinematic film (optional extra post)
param([switch]$SkipRecord, [switch]$NoGpu, [switch]$SkipFilm, [switch]$Revoice)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path 'out', 'public\demo' | Out-Null
$py = if (Test-Path '.python-cmd') { (Get-Content '.python-cmd').Trim() } else { 'python' }
if (-not (Test-Path '.env')) { throw 'Missing .env with GNANI_API_KEY (copy .env.example).' }

# 1. Chromium (headless) - installed once into .browsers\
if (-not (Test-Path '.chromium-path')) {
  Write-Host '== Installing Chromium for headless recording/rendering ==' -ForegroundColor Cyan
  $outp = npx --yes @puppeteer/browsers install chromium@latest --path .browsers
  $exe = Get-ChildItem .browsers, node_modules\.remotion -Recurse -Include chrome.exe, chrome-headless-shell.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
  if (-not (Test-Path $exe)) { throw "Chromium install failed: $outp" }
  Set-Content -Encoding ascii '.chromium-path' $exe
}
$env:CHROMIUM_PATH = (Get-Content '.chromium-path').Trim()
Write-Host "Chromium: $env:CHROMIUM_PATH"

if (-not $NoGpu) {
  $gpu = (Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match 'NVIDIA' } | Select-Object -First 1).Name
  if ($gpu) { Write-Host "GPU: $gpu (ANGLE/D3D11 + NVENC)" -ForegroundColor Green; $env:REMOTION_GPU = '1'; $env:REC_GPU = '1' }
  else { Write-Host 'No NVIDIA GPU found - using CPU' -ForegroundColor Yellow }
}

# 2. Synthetic sample calls (Gnani Timbre) - only if missing
if (-not (Test-Path 'public\samples\live.wav')) { npm run samples; if ($LASTEXITCODE -ne 0) { throw 'samples failed' } }

# 3. Headless recording of the real app
if (-not $SkipRecord) {
  Write-Host '== Starting the VaaniLens app (headless) ==' -ForegroundColor Cyan
  $env:NO_OPEN = '1'
  $server = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npx vite --config vite.config.mjs --port 5173 --strictPort --host 127.0.0.1' -PassThru -WindowStyle Hidden
  try {
    $ok = $false
    for ($i = 0; $i -lt 60; $i++) { Start-Sleep 1; try { $h = Invoke-RestMethod 'http://127.0.0.1:5173/api/health'; $ok = $true; break } catch {} }
    if (-not $ok) { throw 'App server did not start' }
    if ($h.mock) { throw 'App is in MOCK mode - check GNANI_API_KEY in .env' }
    Write-Host '== Recording the live app with headless Chromium (about 2 min) ==' -ForegroundColor Cyan
    node scripts/record-demo.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Recording failed' }
  } finally {
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'vite --config vite.config.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
}

# 4. Voices: film voices (Gnani Timbre + Prisma) and the demo narrator (NARRATOR_PROVIDER in .env: gnani or sarvam)
$man = if (Test-Path 'src\audio\manifest.json') { Get-Content 'src\audio\manifest.json' -Raw } else { '{}' }
if ($Revoice -or $man.Trim() -eq '{}') {
  Write-Host '== Film voices: Gnani Timbre + Prisma ==' -ForegroundColor Cyan
  npx tsx scripts/voice.ts
}
if ($Revoice -or -not (Test-Path 'public\demo\vo.json')) {
  Write-Host '== Demo narrator ==' -ForegroundColor Cyan
  npx tsx scripts/voice-demo.ts
  if ($LASTEXITCODE -ne 0) { Write-Host 'Narrator failed - videos will render without narration' -ForegroundColor Yellow }
}
if (-not (Test-Path 'public\demo\events.json')) { Write-Host 'No events.json (old recording): re-run without -SkipRecord to get narration in the demo' -ForegroundColor Yellow }

# 5. Sound mix for the film parts
Invoke-Expression "$py scripts/audio_build.py"
if ($LASTEXITCODE -ne 0) { throw 'Audio build failed' }

# 6. Renders (GPU), retrying with Remotion's own browser if the custom Chromium misbehaves
function Render($comp, $outFile, $props) {
  $rargs = @('remotion', 'render', 'src/index.ts', $comp, $outFile)
  if ($props) { $rargs += "--props=$props" }
  & npx @rargs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Retrying $comp on CPU with Remotion's bundled browser" -ForegroundColor Yellow
    $keepB = $env:CHROMIUM_PATH; $keepG = $env:REMOTION_GPU
    $env:CHROMIUM_PATH = ''; $env:REMOTION_GPU = ''
    & npx @rargs; $code = $LASTEXITCODE
    $env:CHROMIUM_PATH = $keepB; $env:REMOTION_GPU = $keepG
    if ($code -ne 0) { throw "Render failed: $comp" }
  }
}
$raw = npx remotion ffprobe -v error -show_entries format=duration -of csv=p=0 public/demo/app-recording.mp4 | Select-Object -Last 1
$sec = [double]::Parse($raw.Trim(), [Globalization.CultureInfo]::InvariantCulture)
@{ recSeconds = $sec; startAt = 0; maxSeconds = 45 } | ConvertTo-Json -Compress | Set-Content -Encoding ascii 'out\props-short.json'
@{ recSeconds = $sec; startAt = 0; maxSeconds = 160 } | ConvertTo-Json -Compress | Set-Content -Encoding ascii 'out\props-full.json'

$t = Get-Date
Write-Host '== Rendering 60-second post cut ==' -ForegroundColor Cyan
Render 'DemoShort' 'out/vaanilens-demo-60s.mp4' 'out/props-short.json'
Write-Host '== Rendering full demo (form) ==' -ForegroundColor Cyan
Render 'DemoLong' 'out/vaanilens-demo-full.mp4' 'out/props-full.json'
if (-not $SkipFilm) { Write-Host '== Rendering 46 s film ==' -ForegroundColor Cyan; Render 'CallGuardFilm' 'out/callguard-film-16x9.mp4' $null }

$full = 15 + [Math]::Min($sec, 160)
Write-Host ("`nDone in {0:N1} min. Full demo length: {1:N0}s (form wants 120-180s)." -f ((Get-Date) - $t).TotalMinutes, $full) -ForegroundColor Green
Invoke-Item out
