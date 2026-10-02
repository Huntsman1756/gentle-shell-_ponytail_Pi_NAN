# Project stack 4.0.0

Upgrade the baseline to Pi 1.0.0, Gentle Shell/Gentle AI 4.0.0 and Ponytail 4.10.1.
Use Gentle Shell's native NaN provider; retain NAN_BUILDERS_API_KEY compatibility
without duplicating registration or persisting secrets.

The project launcher checks all three npm components before each startup. Stable
patches are staged and probed before activation. Major/minor upgrades, including
the bundled native Gentle AI, require a reviewed template baseline. The previous
runtime is retained, failures do not promote candidates, and rollback holds the
rejected combination until an explicit retry or a different combination appears.

Installers now merge existing settings, preserve package filters/MCP/session
files and back up managed changes. Activate the local `pi` function once per
shell; opt into PowerShell profile registration with `-RegisterShell` to make it
persistent. An unactivated global Pi bypasses these checks.

Local verification: 13 tests passed; actual Windows bootstrap and offline Pi
launch; 20 extensions loaded through the real SDK; native integrity/version
probe; injected registry/install failures, competing lock refusal and synthetic
rollback transaction. No LLM requests or formal reviews executed. See
`docs/verification.md` for the exact boundaries and known limits.
