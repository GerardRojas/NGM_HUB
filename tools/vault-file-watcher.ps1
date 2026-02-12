# ============================================================================
# NGM Vault File Watcher - Auto-versioning on save
# ============================================================================
# Monitors the rclone-mounted vault drive for file changes and auto-creates
# new versions via the Vault API. This ensures version history tracks every
# edit made through the desktop mount.
#
# How it works:
#   1. Uses .NET FileSystemWatcher to monitor the mounted vault drive
#   2. When a file is saved (Changed/Created event), waits for write to finish
#   3. Looks up the file in vault_files by bucket_path pattern match
#   4. Calls POST /vault/files/{id}/versions to create a new version
#   5. Debounces: ignores rapid successive saves (e.g. auto-save every 5s)
#
# Usage:
#   .\vault-file-watcher.ps1                    # Watch V: drive (default)
#   .\vault-file-watcher.ps1 -WatchPath "V:\"   # Custom mount path
#   .\vault-file-watcher.ps1 -ApiBase "http://127.0.0.1:8000"  # Dev server
# ============================================================================

param(
    [string]$WatchPath = "V:\",
    [string]$ApiBase = "https://ngm-fastapi.onrender.com",
    [int]$DebounceSec = 10,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# -- Config --
$configDir = Join-Path $env:USERPROFILE ".ngm-vault"
$logFile = Join-Path $configDir "watcher.log"
$tokenFile = Join-Path $configDir "auth-token.txt"

# Debounce tracking: path -> last-upload-time
$script:debounceMap = @{}

# -- Logging --
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    if ($Verbose -or $Level -eq "ERROR") {
        $color = switch ($Level) {
            "ERROR" { "Red" }
            "WARN"  { "Yellow" }
            "OK"    { "Green" }
            default { "Gray" }
        }
        Write-Host $line -ForegroundColor $color
    }
    Add-Content $logFile $line -ErrorAction SilentlyContinue
}

function Get-AuthToken {
    if (Test-Path $tokenFile) {
        return (Get-Content $tokenFile -Raw).Trim()
    }
    Write-Host ""
    Write-Host "Authentication required." -ForegroundColor Yellow
    Write-Host "Paste your NGM auth token (from browser localStorage 'ngmToken'):" -ForegroundColor Cyan
    $token = Read-Host "Token"
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    $token | Set-Content $tokenFile -Encoding UTF8
    return $token
}

function Find-VaultFile {
    param([string]$RelativePath)

    # Convert Windows path separators to forward slash
    $storagePath = $RelativePath -replace "\\", "/"

    # The relative path from mount root maps to bucket_path in storage
    # E.g.: Projects\MyProject\Plans\drawing_v1.pdf -> Projects/MyProject/Plans/drawing_v1.pdf
    # We search by matching the filename + parent path pattern

    $token = Get-AuthToken
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type"  = "application/json"
    }

    # Extract filename (without version suffix) for search
    $filename = [System.IO.Path]::GetFileNameWithoutExtension($storagePath)
    # Strip version suffix like _v1, _v2 etc.
    $searchName = $filename -replace "_v\d+$", ""

    try {
        $body = @{
            query = $searchName
        } | ConvertTo-Json

        $response = Invoke-RestMethod `
            -Uri "$ApiBase/vault/search" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -ContentType "application/json"

        if ($response -and $response.Count -gt 0) {
            # Find best match by bucket_path similarity
            foreach ($file in $response) {
                $bp = $file.bucket_path
                if ($bp -and $storagePath -like "*$($file.name)*") {
                    return $file
                }
            }
            # Fallback: return first result with matching name
            foreach ($file in $response) {
                if ($file.name -like "*$searchName*") {
                    return $file
                }
            }
        }
    } catch {
        Write-Log "API search failed: $_" "ERROR"
    }
    return $null
}

function New-VaultVersion {
    param(
        [string]$FileId,
        [string]$LocalPath
    )

    $token = Get-AuthToken

    # Read the modified file
    $fileBytes = [System.IO.File]::ReadAllBytes($LocalPath)
    $fileName = [System.IO.Path]::GetFileName($LocalPath)

    # Build multipart form
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"

    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
        "Content-Type: application/octet-stream",
        "",
        ""
    )
    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes(($bodyLines -join $LF))

    $commentPart = @(
        "",
        "--$boundary",
        "Content-Disposition: form-data; name=`"comment`"",
        "",
        "Auto-versioned from desktop edit",
        "--$boundary--",
        ""
    )
    $footerBytes = [System.Text.Encoding]::UTF8.GetBytes(($commentPart -join $LF))

    # Combine header + file bytes + footer
    $bodyStream = New-Object System.IO.MemoryStream
    $bodyStream.Write($headerBytes, 0, $headerBytes.Length)
    $bodyStream.Write($fileBytes, 0, $fileBytes.Length)
    $bodyStream.Write($footerBytes, 0, $footerBytes.Length)
    $bodyBytes = $bodyStream.ToArray()
    $bodyStream.Dispose()

    try {
        $response = Invoke-RestMethod `
            -Uri "$ApiBase/vault/files/$FileId/versions" `
            -Method POST `
            -Headers @{ "Authorization" = "Bearer $token" } `
            -Body $bodyBytes `
            -ContentType "multipart/form-data; boundary=$boundary"

        Write-Log "New version created for file $FileId ($('{0:N1}' -f ($fileBytes.Length / 1KB)) KB)" "OK"
        return $true
    } catch {
        Write-Log "Failed to create version for $FileId : $_" "ERROR"
        return $false
    }
}

function Handle-FileChange {
    param(
        [string]$FullPath,
        [string]$ChangeType
    )

    # Skip directories, temp files, hidden files
    if ((Get-Item $FullPath -ErrorAction SilentlyContinue).PSIsContainer) { return }
    $name = [System.IO.Path]::GetFileName($FullPath)
    if ($name.StartsWith(".") -or $name.StartsWith("~") -or $name.EndsWith(".tmp") -or $name.EndsWith(".crdownload")) {
        return
    }

    # Debounce check
    $now = Get-Date
    if ($script:debounceMap.ContainsKey($FullPath)) {
        $lastTime = $script:debounceMap[$FullPath]
        $elapsed = ($now - $lastTime).TotalSeconds
        if ($elapsed -lt $DebounceSec) {
            Write-Log "Debounced: $name (${elapsed}s since last)" "INFO"
            return
        }
    }
    $script:debounceMap[$FullPath] = $now

    # Wait for file to be fully written
    Start-Sleep -Milliseconds 500

    # Get relative path from watch root
    $relativePath = $FullPath.Substring($WatchPath.TrimEnd("\").Length + 1)
    Write-Log "File $ChangeType : $relativePath" "INFO"

    # Look up in vault DB
    $vaultFile = Find-VaultFile -RelativePath $relativePath
    if ($vaultFile) {
        Write-Log "Matched vault file: $($vaultFile.id) ($($vaultFile.name))" "INFO"
        $result = New-VaultVersion -FileId $vaultFile.id -LocalPath $FullPath
        if ($result) {
            Write-Host "  [v+] $name -> new version created" -ForegroundColor Green
        }
    } else {
        Write-Log "No matching vault file for: $relativePath (may be a new file via rclone sync)" "WARN"
    }
}

# -- Main --
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NGM Vault File Watcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $WatchPath)) {
    Write-Host "Watch path not found: $WatchPath" -ForegroundColor Red
    Write-Host "Make sure the vault is mounted first:" -ForegroundColor Yellow
    Write-Host "  .\vault-desktop-setup.ps1 -Mount" -ForegroundColor Gray
    exit 1
}

# Ensure log dir exists
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# Verify auth token
$null = Get-AuthToken
Write-Host "[OK] Authenticated" -ForegroundColor Green

Write-Host "Watching: $WatchPath" -ForegroundColor Cyan
Write-Host "API:      $ApiBase" -ForegroundColor Gray
Write-Host "Debounce: ${DebounceSec}s" -ForegroundColor Gray
Write-Host "Log:      $logFile" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop watching." -ForegroundColor Yellow
Write-Host ""

# Create FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $WatchPath
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $false
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName

# Register events
$onChange = Register-ObjectEvent $watcher "Changed" -Action {
    Handle-FileChange -FullPath $Event.SourceEventArgs.FullPath -ChangeType "changed"
}
$onCreate = Register-ObjectEvent $watcher "Created" -Action {
    Handle-FileChange -FullPath $Event.SourceEventArgs.FullPath -ChangeType "created"
}
$onRename = Register-ObjectEvent $watcher "Renamed" -Action {
    Handle-FileChange -FullPath $Event.SourceEventArgs.FullPath -ChangeType "renamed"
}

$watcher.EnableRaisingEvents = $true

Write-Log "Watcher started on $WatchPath" "OK"

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    # Cleanup
    $watcher.EnableRaisingEvents = $false
    Unregister-Event -SourceIdentifier $onChange.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $onCreate.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $onRename.Name -ErrorAction SilentlyContinue
    $watcher.Dispose()
    Write-Log "Watcher stopped" "INFO"
    Write-Host ""
    Write-Host "Watcher stopped." -ForegroundColor Yellow
}
