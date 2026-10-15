param([string]$TargetDir)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
$staging = $null
$backup = $null
$destination = $null
$installed = $false
$dllCreated = $false
try {
    $node = Get-Command node.exe -ErrorAction Stop
    $nodeVersion = & $node.Source -p process.versions.node
    if ($LASTEXITCODE -ne 0 -or ([version]$nodeVersion).Major -lt 22) { throw 'Node.js 22 or later is required.' }
    $socketType = & $node.Source -p 'typeof WebSocket'
    if ($LASTEXITCODE -ne 0 -or $socketType -ne 'function') { throw 'Built-in WebSocket support is required.' }
    foreach ($relative in @('bin\winmm.dll', 'index.js', 'package.json', 'lib\files.js', 'lib\cdp.js', 'lib\service.js', 'webview\index.html', 'manage.bat')) {
        if (-not (Test-Path -LiteralPath (Join-Path $source $relative) -PathType Leaf)) { throw "Missing repository file: $relative. Extract the entire ZIP before installing." }
    }
    if (-not $TargetDir) {
        $app = Get-Process -Name Antigravity -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($app -and $app.Path) { $TargetDir = Split-Path -Parent $app.Path }
    }
    if (-not $TargetDir) {
        $entry = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Antigravity*' } | Select-Object -First 1
        if ($entry -and $entry.InstallLocation -and (Test-Path -LiteralPath (Join-Path $entry.InstallLocation 'Antigravity.exe'))) { $TargetDir = $entry.InstallLocation }
        elseif ($entry -and $entry.DisplayIcon) {
            $icon = (($entry.DisplayIcon -split ',')[0]).Trim('"')
            if (Test-Path -LiteralPath $icon) { $TargetDir = Split-Path -Parent $icon }
        }
    }
    if (-not $TargetDir) { $TargetDir = Join-Path $env:LOCALAPPDATA 'Programs\antigravity' }
    if (-not (Test-Path -LiteralPath (Join-Path $TargetDir 'Antigravity.exe') -PathType Leaf)) {
        $TargetDir = (Read-Host 'Enter the Antigravity folder or Antigravity.exe path').Trim('"')
        if ([IO.Path]::GetFileName($TargetDir) -ieq 'Antigravity.exe') { $TargetDir = Split-Path -Parent $TargetDir }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $TargetDir 'Antigravity.exe') -PathType Leaf)) { throw 'Antigravity.exe was not found.' }
    $TargetDir = (Resolve-Path -LiteralPath $TargetDir).Path
    $appExe = Join-Path $TargetDir 'Antigravity.exe'
    $running = @(Get-Process -Name Antigravity -ErrorAction SilentlyContinue | Where-Object { $_.Path -ieq $appExe })
    if ($running.Count -gt 0) { throw 'Close Antigravity completely, then run start.bat again.' }
    $dll = Join-Path $TargetDir 'winmm.dll'
    $sourceDll = Join-Path $source 'bin\winmm.dll'
    if ((Test-Path -LiteralPath $dll) -and (Get-FileHash -LiteralPath $dll).Hash -ne (Get-FileHash -LiteralPath $sourceDll).Hash) {
        throw 'An unrecognized winmm.dll already exists in the installation folder. Back it up and remove it before installing.'
    }
    Write-Host "[Found] $TargetDir"
    $destination = Join-Path $TargetDir 'office-viewer'
    if ([IO.Path]::GetFullPath($source).TrimEnd('\') -ieq [IO.Path]::GetFullPath($destination).TrimEnd('\')) { throw 'Run the installer from the extracted repository, not the deployed office-viewer folder.' }
    $staging = Join-Path $TargetDir ('.office-viewer-staging-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    foreach ($relative in @('index.js', 'package.json', 'lib', 'webview', 'manage.bat')) {
        Copy-Item -LiteralPath (Join-Path $source $relative) -Destination $staging -Recurse -Force
    }
    & $node.Source --check (Join-Path $staging 'index.js')
    if ($LASTEXITCODE -ne 0) { throw 'Deployed JavaScript failed validation.' }
    $sourceCount = @(Get-ChildItem -LiteralPath (Join-Path $source 'webview') -Recurse -File).Count
    $targetCount = @(Get-ChildItem -LiteralPath (Join-Path $staging 'webview') -Recurse -File).Count
    if ($sourceCount -ne $targetCount) { throw 'Webview assets were not copied completely.' }
    # Stop only this installed viewer, including older versions without --stop.
    $installedScript = Join-Path $destination 'index.js'
    $pattern = '(?i)(?:"' + [regex]::Escape($installedScript) + '"|' + [regex]::Escape($installedScript) + '(?=\s|$))'
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match $pattern } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -ErrorAction Stop
    }
    if (Test-Path -LiteralPath $destination) {
        $backup = Join-Path $TargetDir ('.office-viewer-backup-' + [guid]::NewGuid().ToString('N'))
        Move-Item -LiteralPath $destination -Destination $backup
    }
    Move-Item -LiteralPath $staging -Destination $destination
    $staging = $null
    $installed = $true
    $dllCreated = -not (Test-Path -LiteralPath $dll)
    Copy-Item -LiteralPath $sourceDll -Destination $dll -Force
    if ((Get-FileHash -LiteralPath $sourceDll).Hash -ne (Get-FileHash -LiteralPath $dll).Hash) { throw 'DLL verification failed.' }
    Write-Host '[OK] Installation verified. Start Antigravity normally.'
    Write-Host "[Info] Diagnostics: $destination\manage.bat"
} catch {
    $failure = $_.Exception.Message
    if ($installed -and $destination -and (Test-Path -LiteralPath $destination)) { Remove-Item -LiteralPath $destination -Recurse -Force -ErrorAction SilentlyContinue }
    if ($backup -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $destination -ErrorAction SilentlyContinue; $backup = $null }
    if ($dllCreated -and $dll) { Remove-Item -LiteralPath $dll -Force -ErrorAction SilentlyContinue }
    Write-Host "[ERROR] $failure" -ForegroundColor Red
    exit 1
} finally {
    if ($staging -and (Test-Path -LiteralPath $staging)) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
}
if ($backup -and (Test-Path -LiteralPath $backup)) { Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue }
exit 0
