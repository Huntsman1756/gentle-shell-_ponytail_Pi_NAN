#Requires -Version 5.1
param([string]$Target = (Get-Location).Path, [switch]$RegisterShell)
$ErrorActionPreference = 'Stop'
$Target = (Resolve-Path -LiteralPath $Target).Path
$source = $PSScriptRoot
$tmp = $null
try {
    if (-not $source -or -not (Test-Path (Join-Path $source 'scripts/install-template.mjs'))) {
        $tmp = Join-Path ([IO.Path]::GetTempPath()) ('pi-nan-stack-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $tmp | Out-Null
        $zip = Join-Path $tmp 'repo.zip'
        Invoke-WebRequest -Uri 'https://github.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN/archive/refs/heads/main.zip' -OutFile $zip
        Expand-Archive -LiteralPath $zip -DestinationPath $tmp
        $source = Join-Path $tmp 'gentle-shell-_ponytail_Pi_NAN-main'
    }
    & node (Join-Path $source 'scripts/install-template.mjs') $Target
    if ($LASTEXITCODE -ne 0) { throw 'Template installation failed' }
    . (Join-Path $Target '.pi/bin/activate.ps1')
    if ($RegisterShell) {
        $activation = Join-Path $Target '.pi/bin/activate.ps1'
        $line = '. ''' + $activation.Replace("'", "''") + ''''
        $profileDir = Split-Path $PROFILE -Parent
        New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
        $existing = if (Test-Path -LiteralPath $PROFILE) { Get-Content -LiteralPath $PROFILE } else { @() }
        if ($existing -notcontains $line) { Add-Content -LiteralPath $PROFILE -Value $line }
        Write-Host ('Startup function added to ' + $PROFILE)
    }
    Write-Host 'Enable controlled startup in this terminal:'
    Write-Host ('  . "' + (Join-Path $Target '.pi/bin/activate.ps1') + '"')
    Write-Host 'Then use: pi --stack-check (install/verify); pi (launch); pi --stack-rollback'
} finally {
    if ($tmp) {
        $resolved = [IO.Path]::GetFullPath($tmp)
        $expected = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
        if (-not $resolved.StartsWith($expected, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid temporary cleanup path' }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
