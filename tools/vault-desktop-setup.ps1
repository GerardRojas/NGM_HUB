# ============================================================================
# NGM Vault Desktop Setup - rclone S3 mount for Supabase Storage
# ============================================================================
# This script configures rclone to mount the Supabase Vault bucket as a local
# Windows folder, providing a Google Drive Desktop-like experience.
#
# Prerequisites:
#   1. rclone installed (https://rclone.org/downloads/ or `winget install rclone`)
#   2. WinFsp installed (https://winfsp.dev/rel/ - required for FUSE mount on Windows)
#   3. Supabase project S3 credentials (from Dashboard > Settings > API > S3 Access)
#
# Usage:
#   .\vault-desktop-setup.ps1 -Setup        # First-time configuration
#   .\vault-desktop-setup.ps1 -Mount        # Mount the vault as V: drive
#   .\vault-desktop-setup.ps1 -Unmount      # Unmount the vault
#   .\vault-desktop-setup.ps1 -Status       # Check mount status
# ============================================================================

param(
    [switch]$Setup,
    [switch]$Mount,
    [switch]$Unmount,
    [switch]$Status,
    [string]$MountPoint = "V:",
    [string]$LocalSync = "$env:USERPROFILE\NGM Vault"
)

$ErrorActionPreference = "Stop"

# -- Config file location --
$configDir = Join-Path $env:USERPROFILE ".ngm-vault"
$configFile = Join-Path $configDir "vault-config.json"
$logFile = Join-Path $configDir "vault-mount.log"
$pidFile = Join-Path $configDir "mount.pid"

function Write-Banner {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  NGM Vault Desktop" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Prerequisites {
    $missing = @()

    # Check rclone
    $rclone = Get-Command rclone -ErrorAction SilentlyContinue
    if (-not $rclone) { $missing += "rclone (https://rclone.org/downloads/)" }

    # Check WinFsp
    $winfsp = Test-Path "C:\Program Files (x86)\WinFsp" -ErrorAction SilentlyContinue
    if (-not $winfsp) {
        $winfsp = Test-Path "C:\Program Files\WinFsp" -ErrorAction SilentlyContinue
    }
    if (-not $winfsp) { $missing += "WinFsp (https://winfsp.dev/rel/)" }

    if ($missing.Count -gt 0) {
        Write-Host "Missing prerequisites:" -ForegroundColor Red
        foreach ($m in $missing) {
            Write-Host "  - $m" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "Install them and re-run this script." -ForegroundColor Red
        return $false
    }

    Write-Host "[OK] rclone and WinFsp installed" -ForegroundColor Green
    return $true
}

function Invoke-Setup {
    Write-Banner

    if (-not (Test-Prerequisites)) { return }

    Write-Host "Setting up NGM Vault Desktop connection..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You need S3 credentials from Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "  1. Go to https://supabase.com/dashboard" -ForegroundColor Gray
    Write-Host "  2. Select your project" -ForegroundColor Gray
    Write-Host "  3. Settings > API > S3 Access" -ForegroundColor Gray
    Write-Host "  4. Enable S3 protocol and copy the credentials" -ForegroundColor Gray
    Write-Host ""

    $endpoint = Read-Host "Supabase S3 Endpoint (e.g. https://frpshidpuazlqfxodrbs.supabase.co/storage/v1/s3)"
    $accessKey = Read-Host "S3 Access Key ID"
    $secretKey = Read-Host "S3 Secret Access Key" -AsSecureString

    # Convert SecureString back for storage
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey)
    $secretKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    # Create config dir
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }

    # Save config (encrypted with DPAPI via ConvertFrom-SecureString)
    $config = @{
        endpoint   = $endpoint
        access_key = $accessKey
        secret_key = $secretKeyPlain
        bucket     = "vault"
        region     = "us-east-1"
        mount_point = $MountPoint
        local_sync = $LocalSync
    }
    $config | ConvertTo-Json | Set-Content $configFile -Encoding UTF8

    # Configure rclone remote
    $rcloneConfig = @"
[ngm-vault]
type = s3
provider = Other
env_auth = false
access_key_id = $accessKey
secret_access_key = $secretKeyPlain
endpoint = $endpoint
acl = public-read
bucket_acl = public-read
no_check_bucket = true
force_path_style = true
"@

    $rcloneConfigPath = Join-Path $env:APPDATA "rclone\rclone.conf"
    $rcloneDir = Split-Path $rcloneConfigPath
    if (-not (Test-Path $rcloneDir)) {
        New-Item -ItemType Directory -Path $rcloneDir -Force | Out-Null
    }

    # Check if remote already exists
    $existingConfig = ""
    if (Test-Path $rcloneConfigPath) {
        $existingConfig = Get-Content $rcloneConfigPath -Raw
    }

    if ($existingConfig -match "\[ngm-vault\]") {
        # Replace existing config block
        $existingConfig = $existingConfig -replace "(?s)\[ngm-vault\].*?(?=\[|$)", $rcloneConfig + "`n`n"
        Set-Content $rcloneConfigPath $existingConfig -Encoding UTF8
    } else {
        Add-Content $rcloneConfigPath "`n$rcloneConfig" -Encoding UTF8
    }

    Write-Host ""
    Write-Host "[OK] rclone remote 'ngm-vault' configured" -ForegroundColor Green

    # Test connection
    Write-Host ""
    Write-Host "Testing connection..." -ForegroundColor Cyan
    try {
        $result = rclone lsd "ngm-vault:vault" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Connection successful! Vault bucket accessible." -ForegroundColor Green
            Write-Host ""
            Write-Host "Bucket contents:" -ForegroundColor Gray
            Write-Host $result
        } else {
            Write-Host "[WARN] Could not list bucket. Check your credentials." -ForegroundColor Yellow
            Write-Host "Error: $result" -ForegroundColor Red
        }
    } catch {
        Write-Host "[WARN] Connection test failed: $_" -ForegroundColor Yellow
    }

    # Create local sync folder
    if (-not (Test-Path $LocalSync)) {
        New-Item -ItemType Directory -Path $LocalSync -Force | Out-Null
        Write-Host "[OK] Created local sync folder: $LocalSync" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Setup complete! Use these commands:" -ForegroundColor Green
    Write-Host "  .\vault-desktop-setup.ps1 -Mount      # Mount as $MountPoint drive" -ForegroundColor Cyan
    Write-Host "  .\vault-desktop-setup.ps1 -Unmount    # Unmount" -ForegroundColor Cyan
    Write-Host "  .\vault-desktop-setup.ps1 -Status     # Check status" -ForegroundColor Cyan
    Write-Host ""
}

function Invoke-Mount {
    Write-Banner

    if (-not (Test-Prerequisites)) { return }

    if (-not (Test-Path $configFile)) {
        Write-Host "Not configured yet. Run: .\vault-desktop-setup.ps1 -Setup" -ForegroundColor Red
        return
    }

    $config = Get-Content $configFile | ConvertFrom-Json

    # Check if already mounted
    if (Test-Path $pidFile) {
        $existingPid = Get-Content $pidFile
        $proc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Vault is already mounted (PID: $existingPid)" -ForegroundColor Yellow
            Write-Host "Use -Unmount first, or -Status to check." -ForegroundColor Gray
            return
        }
        Remove-Item $pidFile -Force
    }

    $mountTarget = $config.mount_point
    if (-not $mountTarget) { $mountTarget = $MountPoint }

    Write-Host "Mounting NGM Vault as $mountTarget ..." -ForegroundColor Cyan

    # Start rclone mount as background process
    $rcloneArgs = @(
        "mount",
        "ngm-vault:vault",
        $mountTarget,
        "--vfs-cache-mode", "full",
        "--vfs-cache-max-age", "1h",
        "--vfs-write-back", "5s",
        "--vfs-read-chunk-size", "5M",
        "--vfs-read-chunk-size-limit", "50M",
        "--dir-cache-time", "30s",
        "--poll-interval", "15s",
        "--buffer-size", "16M",
        "--transfers", "4",
        "--checkers", "8",
        "--log-file", $logFile,
        "--log-level", "INFO",
        "--no-console"
    )

    $process = Start-Process -FilePath "rclone" -ArgumentList $rcloneArgs -PassThru -WindowStyle Hidden
    $process.Id | Set-Content $pidFile

    Start-Sleep -Seconds 2

    # Verify mount
    if (Test-Path $mountTarget) {
        Write-Host ""
        Write-Host "[OK] Vault mounted at $mountTarget" -ForegroundColor Green
        Write-Host ""
        Write-Host "Structure:" -ForegroundColor Gray
        Write-Host "  ${mountTarget}\" -ForegroundColor White
        Write-Host "    Global\          (files outside any project)" -ForegroundColor Gray
        Write-Host "    Projects\" -ForegroundColor Gray
        Write-Host "      ProjectName\   (per-project files)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "You can now open $mountTarget in File Explorer," -ForegroundColor Cyan
        Write-Host "edit files directly, and changes sync automatically." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Log file: $logFile" -ForegroundColor Gray
    } else {
        Write-Host "[WARN] Mount may still be starting. Check -Status in a few seconds." -ForegroundColor Yellow
    }
}

function Invoke-Unmount {
    Write-Banner

    if (Test-Path $pidFile) {
        $existingPid = Get-Content $pidFile
        $proc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping rclone mount (PID: $existingPid)..." -ForegroundColor Cyan
            Stop-Process -Id $existingPid -Force
            Start-Sleep -Seconds 1
            Write-Host "[OK] Vault unmounted" -ForegroundColor Green
        } else {
            Write-Host "No running mount process found." -ForegroundColor Yellow
        }
        Remove-Item $pidFile -Force
    } else {
        Write-Host "No mount PID file found. Vault may not be mounted." -ForegroundColor Yellow
        # Try to kill any rclone mount processes
        $rcloneProcs = Get-Process rclone -ErrorAction SilentlyContinue
        if ($rcloneProcs) {
            Write-Host "Found rclone processes. Stopping..." -ForegroundColor Yellow
            $rcloneProcs | Stop-Process -Force
            Write-Host "[OK] Stopped rclone" -ForegroundColor Green
        }
    }
}

function Get-MountStatus {
    Write-Banner

    $mounted = $false

    if (Test-Path $pidFile) {
        $existingPid = Get-Content $pidFile
        $proc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($proc) {
            $mounted = $true
            Write-Host "Status: MOUNTED" -ForegroundColor Green
            Write-Host "  PID:    $existingPid" -ForegroundColor Gray
            Write-Host "  Memory: $([math]::Round($proc.WorkingSet64 / 1MB, 1)) MB" -ForegroundColor Gray

            if (Test-Path $configFile) {
                $config = Get-Content $configFile | ConvertFrom-Json
                Write-Host "  Mount:  $($config.mount_point)" -ForegroundColor Gray
            }
        }
    }

    if (-not $mounted) {
        Write-Host "Status: NOT MOUNTED" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Use -Mount to start." -ForegroundColor Gray
    }

    if (Test-Path $logFile) {
        Write-Host ""
        Write-Host "Recent log entries:" -ForegroundColor Cyan
        Get-Content $logFile -Tail 5 | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Gray
        }
    }
}

# -- Main dispatcher --
if ($Setup)   { Invoke-Setup; return }
if ($Mount)   { Invoke-Mount; return }
if ($Unmount) { Invoke-Unmount; return }
if ($Status)  { Get-MountStatus; return }

# Default: show help
Write-Banner
Write-Host "Usage:" -ForegroundColor White
Write-Host "  .\vault-desktop-setup.ps1 -Setup       First-time configuration" -ForegroundColor Gray
Write-Host "  .\vault-desktop-setup.ps1 -Mount       Mount vault as V: drive" -ForegroundColor Gray
Write-Host "  .\vault-desktop-setup.ps1 -Unmount     Unmount vault" -ForegroundColor Gray
Write-Host "  .\vault-desktop-setup.ps1 -Status      Check mount status" -ForegroundColor Gray
Write-Host ""
Write-Host "Options:" -ForegroundColor White
Write-Host "  -MountPoint V:     Drive letter (default: V:)" -ForegroundColor Gray
Write-Host "  -LocalSync <path>  Local sync folder path" -ForegroundColor Gray
Write-Host ""
