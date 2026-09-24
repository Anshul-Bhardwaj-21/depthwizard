<#
.SYNOPSIS
    DepthWizard — One-click data preparation + model training script (Windows).

.DESCRIPTION
    Runs the complete DepthWizard training pipeline in sequence:
        1. Prepare training data  (synthetic by default, no internet needed)
        2. Train the HeightUNet model
        3. Print the path to the best checkpoint

.PARAMETER Epochs
    Number of training epochs (default: 30).
    Use a small value like 2-5 to quickly verify the pipeline.

.PARAMETER BatchSize
    Training batch size (default: 8). Reduce to 4 if you get out-of-memory errors.

.PARAMETER NTiles
    Number of synthetic tiles to generate (default: 200).
    Use 500+ for better accuracy; use 50 for a quick test run.

.PARAMETER DataRoot
    Where to write/read training data (default: model\data).

.PARAMETER HFDownload
    Switch: use huggingface-cli to download real GAMUS data instead of synthetic.
    Falls back to synthetic automatically if the download fails.

.PARAMETER SmokeTest
    Switch: skip data prep and run a 2-epoch smoke test on tiny synthetic data.
    Fastest way to verify the whole pipeline works.

.EXAMPLE
    .\run_training.ps1                      # Generate 200 synthetic tiles, train 30 epochs
    .\run_training.ps1 -Epochs 5            # Quick 5-epoch run
    .\run_training.ps1 -NTiles 500          # Larger dataset
    .\run_training.ps1 -HFDownload          # Try real GAMUS (falls back to synthetic)
    .\run_training.ps1 -SmokeTest           # Fastest end-to-end check (~30s on CPU)

#>
param(
    [int]   $Epochs    = 30,
    [int]   $BatchSize = 8,
    [int]   $NTiles    = 200,
    [string]$DataRoot  = "model\data",
    [switch]$HFDownload,
    [switch]$SmokeTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$ModelDir    = Join-Path $ProjectRoot "model"
$DataDir     = Join-Path $ProjectRoot $DataRoot

# ── Color helpers ─────────────────────────────────────────────────────────────
function Write-Header([string]$msg) {
    Write-Host "`n$('─' * 60)" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "$('─' * 60)`n" -ForegroundColor Cyan
}
function Write-Success([string]$msg) { Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Warn([string]$msg)    { Write-Host "⚠  $msg" -ForegroundColor Yellow }
function Write-Step([string]$msg)    { Write-Host "▶  $msg" -ForegroundColor White }

# ── Verify Python ─────────────────────────────────────────────────────────────
Write-Header "DepthWizard Training Pipeline"

try {
    $pyVer = python --version 2>&1
    Write-Success "Python found: $pyVer"
} catch {
    Write-Error "Python not found in PATH. Please install Python 3.10+ and try again."
    exit 1
}

# ── SMOKE TEST shortcut ───────────────────────────────────────────────────────
if ($SmokeTest) {
    Write-Header "SMOKE TEST MODE — No data download, tiny synthetic dataset"
    Write-Step "Running: python train.py --smoke-test"
    Push-Location $ModelDir
    try {
        python train.py --smoke-test
        if ($LASTEXITCODE -ne 0) { throw "Smoke test failed (exit code $LASTEXITCODE)" }
        Write-Success "Smoke test passed!"
    } finally {
        Pop-Location
    }
    exit 0
}

# ── STEP 1: Prepare data ──────────────────────────────────────────────────────
Write-Header "Step 1/2 — Preparing training data"

$prepareScript = Join-Path $ModelDir "data\prepare_data.py"

if (-not (Test-Path $prepareScript)) {
    Write-Error "prepare_data.py not found at $prepareScript"
    exit 1
}

if ($HFDownload) {
    Write-Step "Mode: HuggingFace CLI download (falls back to synthetic if it fails)"
    python $prepareScript --mode hf-cli --root $DataDir --n-tiles $NTiles
} else {
    Write-Step "Mode: Synthetic data generation ($NTiles tiles, no internet needed)"
    python $prepareScript --mode synthetic --root $DataDir --n-tiles $NTiles
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Data preparation failed (exit code $LASTEXITCODE). Check the output above."
    exit 1
}

Write-Success "Data ready at: $DataDir"

# ── STEP 2: Train ─────────────────────────────────────────────────────────────
Write-Header "Step 2/2 — Training HeightUNet"
Write-Step "Epochs=$Epochs  BatchSize=$BatchSize  DataRoot=$DataDir"

Push-Location $ModelDir
try {
    python train.py `
        --data-root $DataDir `
        --epochs    $Epochs `
        --batch-size $BatchSize

    if ($LASTEXITCODE -ne 0) { throw "Training failed (exit code $LASTEXITCODE)" }
} finally {
    Pop-Location
}

# ── Summary ───────────────────────────────────────────────────────────────────
$BestPt = Join-Path $ModelDir "checkpoints\best.pt"
Write-Header "Training complete!"
if (Test-Path $BestPt) {
    Write-Success "Best checkpoint: $BestPt"
} else {
    Write-Warn "best.pt not found in checkpoints/ — check training logs above."
}

Write-Host "`nTo run inference with the trained model:"
Write-Host "  cd model" -ForegroundColor DarkGray
Write-Host "  python infer.py --checkpoint checkpoints\best.pt --input <your_image.png> --out-dir outputs/" -ForegroundColor DarkGray
Write-Host ""
