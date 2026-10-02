# Dot-source once per terminal, or add that dot-source to your own profile.
# Resolve the current project at each call; never route other projects here.
function global:pi {
    $project = (Get-Location).Path
    while ($project) {
        $launcher = Join-Path $project '.pi/bin/pi.ps1'
        if (Test-Path -LiteralPath $launcher) {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher @args
            return
        }
        $parent = Split-Path $project -Parent
        if ($parent -eq $project) { break }
        $project = $parent
    }
    $native = Get-Command pi -CommandType Application -ErrorAction Stop | Select-Object -First 1
    & $native.Source @args
}
