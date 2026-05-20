# ============================================================
# Sender Pro - Smart One-Click Deploy Script
# Usage: .\deploy.ps1
# Optional: .\deploy.ps1 -SkipBuild        (skip frontend build)
# Optional: .\deploy.ps1 -BackendOnly      (skip frontend entirely)
# Optional: .\deploy.ps1 -FrontendOnly     (skip backend upload)
# ============================================================

param(
    [switch]$SkipBuild,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$VPS_HOST = "root@76.13.243.183"
$VPS_PATH = "/var/www/sender-pro"
$LOCAL = $PSScriptRoot
$ErrorCount = 0

# ── Helper Functions ──────────────────────────────────────────
function Step-Title($num, $total, $msg) {
    Write-Host ""
    Write-Host "[$num/$total] $msg" -ForegroundColor Yellow
}

function OK($msg) {
    Write-Host "     v  $msg" -ForegroundColor Green
}

function FAIL($msg) {
    Write-Host "     X  FAILED: $msg" -ForegroundColor Red
    $script:ErrorCount++
}

function Run-SSH($cmd) {
    $out = ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $VPS_HOST $cmd 2>&1
    if ($LASTEXITCODE -ne 0) {
        return $false, ($out -join "`n")
    }
    return $true, ($out -join "`n")
}

function SCP-File($local, $remote) {
    scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 $local "${VPS_HOST}:${remote}" 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

function SCP-Dir($local, $remote) {
    scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 -r $local "${VPS_HOST}:${remote}" 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

# ── Banner ────────────────────────────────────────────────────
Clear-Host
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Sender Pro - Smart Deploy v2.0"            -ForegroundColor Cyan
Write-Host "   senderpro.smdigitalworks.com"                      -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$modeLabel = "Full Deploy"
if ($BackendOnly) { $modeLabel = "Backend Only" }
if ($FrontendOnly) { $modeLabel = "Frontend Only" }

Write-Host "   Mode: $modeLabel"                                     -ForegroundColor Gray
Write-Host "   Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"    -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Cyan

$TOTAL_STEPS = 5
if ($BackendOnly) { $TOTAL_STEPS = 3 }
if ($FrontendOnly) { $TOTAL_STEPS = 3 }
$STEP = 0

# ── STEP 1: SSH Connectivity Check ───────────────────────────
$STEP++
Step-Title $STEP $TOTAL_STEPS "Testing VPS connection..."
$ok, $out = Run-SSH "echo connected"
if ($ok) {
    OK "VPS reachable"
}
else {
    FAIL "Cannot connect to VPS! Check your SSH keys / internet."
    Write-Host "       $out" -ForegroundColor Red
    exit 1
}

# ── STEP 2: Build Frontend ────────────────────────────────────
if (-not $BackendOnly) {
    $STEP++
    Step-Title $STEP $TOTAL_STEPS "Building frontend..."
    Set-Location "$LOCAL\frontend"
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  Build Error Output:" -ForegroundColor Red
        $buildOutput | Select-Object -Last 30 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        FAIL "Frontend build failed. Fix errors above first."
        Set-Location $LOCAL
        exit 1
    }
    OK "Frontend built successfully"
    Set-Location $LOCAL
}

# ── STEP 3: Upload Backend Files ──────────────────────────────
if (-not $FrontendOnly) {
    $STEP++
    Step-Title $STEP $TOTAL_STEPS "Uploading backend files..."

    $files = @(
        @{ src = "$LOCAL\backend\server.js"; dst = "$VPS_PATH/backend/server.js" },
        @{ src = "$LOCAL\backend\package.json"; dst = "$VPS_PATH/backend/package.json" }
    )

    # All route files (*.js)
    $routeFiles = Get-ChildItem "$LOCAL\backend\routes\*.js" -ErrorAction SilentlyContinue
    foreach ($rf in $routeFiles) {
        $files += @{ src = $rf.FullName; dst = "$VPS_PATH/backend/routes/$($rf.Name)" }
    }

    # All model files
    $modelFiles = Get-ChildItem "$LOCAL\backend\models\*.js" -ErrorAction SilentlyContinue
    foreach ($mf in $modelFiles) {
        $files += @{ src = $mf.FullName; dst = "$VPS_PATH/backend/models/$($mf.Name)" }
    }

    # All util files
    $utilFiles = Get-ChildItem "$LOCAL\backend\utils\*.js" -ErrorAction SilentlyContinue
    foreach ($uf in $utilFiles) {
        $files += @{ src = $uf.FullName; dst = "$VPS_PATH/backend/utils/$($uf.Name)" }
    }

    # All middleware files
    $mwFiles = Get-ChildItem "$LOCAL\backend\middleware\*.js" -ErrorAction SilentlyContinue
    foreach ($mw in $mwFiles) {
        $files += @{ src = $mw.FullName; dst = "$VPS_PATH/backend/middleware/$($mw.Name)" }
    }

    $uploadOK = 0
    $uploadFAIL = 0
    foreach ($f in $files) {
        if (Test-Path $f.src) {
            $success = SCP-File $f.src $f.dst
            if ($success) {
                $uploadOK++
            }
            else {
                Write-Host "       WARNING: Failed to upload $($f.src | Split-Path -Leaf)" -ForegroundColor DarkYellow
                $uploadFAIL++
                $script:ErrorCount++
            }
        }
    }
    OK "Backend: $uploadOK files uploaded, $uploadFAIL failed"
}

# ── STEP 4: Upload Frontend Build ────────────────────────────
if (-not $BackendOnly) {
    $STEP++
    Step-Title $STEP $TOTAL_STEPS "Uploading frontend build..."

    $buildPath = "$LOCAL\frontend\build"
    if (-not (Test-Path $buildPath)) {
        FAIL "Build folder not found at $buildPath"
    }
    else {
        # Clear old build on server
        $ok1, $out1 = Run-SSH "rm -rf $VPS_PATH/frontend/build"
        $ok2, $out2 = Run-SSH "mkdir -p $VPS_PATH/frontend/build"
        if ($ok1 -and $ok2) {
            $success = SCP-Dir "$buildPath\." "$VPS_PATH/frontend/build/"
            if ($success) {
                OK "Frontend uploaded"
            }
            else {
                FAIL "Frontend upload failed (SCP error)"
            }
        }
        else {
            FAIL "Could not clear old frontend on VPS"
        }
    }
}

# ── STEP 5: Restart PM2 and Catch Errors ─────────────────────
$STEP++
Step-Title $STEP $TOTAL_STEPS "Restarting server and catching errors..."

$ok, $out = Run-SSH "pm2 restart sender-pro --update-env"
if (-not $ok) {
    $ok2, $out2 = Run-SSH "cd $VPS_PATH/backend ; pm2 start server.js --name sender-pro"
    if ($ok2) {
        OK "Server started fresh via PM2"
    }
    else {
        FAIL "Could not restart PM2"
        Write-Host "       $out2" -ForegroundColor Red
    }
}
else {
    OK "PM2 restarted"
}

# Wait 5s and grab startup logs
Write-Host ""
Write-Host "  -- Checking Server Logs (5s)... --" -ForegroundColor Cyan
Start-Sleep -Seconds 5

$ok, $logs = Run-SSH "pm2 logs sender-pro --lines 20 --nostream"
if ($ok -and $logs) {
    $logLines = $logs -split "`n"
    foreach ($line in $logLines) {
        $trimmed = $line.Trim()
        if ($trimmed -match "error|fail|exception|crash" -and $trimmed -notmatch "StrictHostKeyChecking") {
            Write-Host "  [ERROR] $trimmed" -ForegroundColor Red
            $script:ErrorCount++
        }
        elseif ($trimmed -match "started|ready|listening|synced|loaded") {
            Write-Host "  [OK]    $trimmed" -ForegroundColor Green
        }
        elseif ($trimmed -ne "") {
            Write-Host "  [LOG]   $trimmed" -ForegroundColor Gray
        }
    }
}

# PM2 online check
$ok3, $pmStatus = Run-SSH "pm2 list --no-color"
if ($ok3) {
    Write-Host ""
    $pmLines = $pmStatus -split "`n"
    foreach ($pline in $pmLines) {
        if ($pline -match "sender-pro") {
            if ($pline -match "online") {
                Write-Host "  [PM2]  sender-pro is ONLINE" -ForegroundColor Green
            }
            elseif ($pline -match "errored|stopped") {
                Write-Host "  [PM2]  sender-pro is ERRORED/STOPPED!" -ForegroundColor Red
                $script:ErrorCount++
            }
        }
    }
}

# ── Final Summary ─────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan

if ($ErrorCount -gt 0) {
    Write-Host "  WARNING: Deploy done with $ErrorCount issue(s)!" -ForegroundColor Red
    Write-Host "  SSH into VPS to debug:"                          -ForegroundColor Yellow
    Write-Host "    ssh root@senderpro.smdigitalworks.com"                 -ForegroundColor White
    Write-Host "    pm2 logs sender-pro"                           -ForegroundColor White
}
else {
    Write-Host "  SUCCESS: Deploy complete, no errors!"            -ForegroundColor Green
    Write-Host "  Live: https://senderpro.smdigitalworks.com"              -ForegroundColor Cyan
}

Write-Host "  Time: $(Get-Date -Format 'HH:mm:ss')"               -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Cyan

Set-Location $LOCAL
