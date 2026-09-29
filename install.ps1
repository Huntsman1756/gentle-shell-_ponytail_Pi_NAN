#Requires -Version 5.1
<#
.SYNOPSIS
  Installs the Pi + Gentle Shell + Ponytail + NaN project-local stack into a project.

.DESCRIPTION
  Can run two ways:
    - Remote:  irm https://raw.githubusercontent.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN/main/install.ps1 | iex
    - Local:   .\install.ps1 -Target C:\path\to\project   (from a clone of this repo)

  Copies .pi/ into the target project. Pi installs the declared npm packages
  itself on the first trusted run inside that project.

.PARAMETER Target
  Project directory to configure. Defaults to the current directory.
#>
param(
    [string]$Target = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$repo = 'Huntsman1756/gentle-shell-_ponytail_Pi_NAN'
$Target = (Resolve-Path $Target).Path

# Resolve the source .pi directory: alongside this script (cloned repo)
# or downloaded from GitHub (remote execution).
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { '' }
$source = Join-Path $scriptDir '.pi'

if (-not (Test-Path $source)) {
    $tmp = Join-Path $env:TEMP ('pi-nan-stack-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $zip = Join-Path $tmp 'repo.zip'
    Write-Host "Downloading template from github.com/$repo ..."
    Invoke-WebRequest -Uri "https://github.com/$repo/archive/refs/heads/main.zip" -OutFile $zip
    Expand-Archive $zip -DestinationPath $tmp -Force
    $source = Join-Path $tmp 'gentle-shell-_ponytail_Pi_NAN-main\.pi'
}

if (-not (Test-Path $source)) { throw "Could not locate the .pi template." }

Copy-Item -Recurse -Force $source $Target
Write-Host "Copied .pi -> $Target"

# Root .gitignore entries so Pi runtime state never gets committed.
$gitignore = Join-Path $Target '.gitignore'
$entries = @('.pi/npm/*', '!.pi/npm/.gitignore', '.atl/')
$existing = if (Test-Path $gitignore) { Get-Content $gitignore } else { @() }
$missing = $entries | Where-Object { $existing -notcontains $_ }
if ($missing) {
    Add-Content $gitignore ("`n# Pi local runtime state`n" + ($missing -join "`n"))
    Write-Host "Updated .gitignore"
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Set the key (once per machine):  setx NAN_BUILDERS_API_KEY `"sk-...`""
Write-Host "     (open a new terminal afterwards so the variable is visible)"
Write-Host "  2. cd `"$Target`""
Write-Host "  3. pi            -> accept the project-trust prompt; packages install automatically"
Write-Host "  4. If npm blocks the gentle-pi postinstall, run once:"
Write-Host "       node .pi/npm/node_modules/gentle-pi/scripts/install-gentle-ai.mjs"
Write-Host "  5. Smoke test:   pi -p `"say READY`""
