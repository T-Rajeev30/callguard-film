# CallGuard film - one-time setup on Windows (PowerShell 5+ or 7)
# Usage:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "`n== CallGuard film setup ==" -ForegroundColor Cyan

# 1. Node.js (Remotion needs 18+)
if (-not (Has 'node')) {
  Write-Host 'Installing Node.js LTS with winget...' -ForegroundColor Yellow
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  Refresh-Path
}
Write-Host ("Node " + (node -v))

# 2. Python 3 (sound design + mix). Avoid the Microsoft Store 'python' stub.
$py = $null
foreach ($cand in @('py -3', 'python', 'python3')) {
  try { $v = Invoke-Expression "$cand -c `"import sys; print(sys.version_info[0])`"" 2>$null; if ($v -eq '3') { $py = $cand; break } } catch {}
}
if (-not $py) {
  Write-Host 'Installing Python 3.12 with winget...' -ForegroundColor Yellow
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  Refresh-Path
  $py = 'py -3'
}
Write-Host "Python via: $py"
Set-Content -Path '.python-cmd' -Value $py -Encoding ascii

# 3. Python packages (numpy + Spotify Pedalboard)
Invoke-Expression "$py -m pip install --upgrade pip"
Invoke-Expression "$py -m pip install -r requirements.txt"

# 4. Node packages + Remotion's headless browser
npm install
npx remotion browser ensure

Write-Host "`nSetup complete. Next:" -ForegroundColor Green
Write-Host '  powershell -ExecutionPolicy Bypass -File .\render.ps1'
Write-Host '  (optional narration first:  $env:SARVAM_API_KEY = "your-key";  then  .\render.ps1 -Voice)'
