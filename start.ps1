<#
.SYNOPSIS
    DepthWizard - One-click app launcher for SIH demo

.DESCRIPTION
    Starts the FastAPI backend and React frontend in separate windows.
    Open http://localhost:5173 in your browser after running this.

.EXAMPLE
    .\start.ps1
#>

$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DepthWizard - Starting App           " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kill anything already on the ports
$ports = @(8000, 5173)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $pids) {
            try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
}

Write-Host ">> Starting backend (port 8000)..." -ForegroundColor White
Start-Process powershell -WorkingDirectory "$ProjectRoot\backend" -ArgumentList "-NoExit", "-Command", "python -m uvicorn app:app --reload --port 8000" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ">> Starting frontend (port 5173)..." -ForegroundColor White
Start-Process powershell -WorkingDirectory "$ProjectRoot\frontend" -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 4

# Open browser
Write-Host ""
Write-Host "[OK] Launching browser -> http://localhost:5173" -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  Backend API:   http://localhost:8000" -ForegroundColor DarkGray
Write-Host "  Frontend App:  http://localhost:5173" -ForegroundColor DarkGray
Write-Host "  Health Check:  http://localhost:8000/health" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Close either PowerShell window to stop that service." -ForegroundColor DarkGray
Write-Host ""
