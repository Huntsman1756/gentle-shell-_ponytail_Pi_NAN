$launcher = Join-Path $PSScriptRoot '../stack-launcher/launch.mjs'
& node $launcher @args
exit $LASTEXITCODE
