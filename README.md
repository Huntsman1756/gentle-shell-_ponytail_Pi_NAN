# Pi + Gentle Shell + Ponytail + NaN

Project-local stack: **Pi 1.0.0**, **Gentle Shell 4.0.0**, its bundled **Gentle
AI 4.0.0**, and **Ponytail 4.10.1**. Requires **Node.js >=22.19.0**. The reviewed
baseline is `stack-versions.json`.

## Why the template was behind

The previous template documented Pi 0.87.1/Gentle Shell 3.7 and declared unpinned
packages. Upstream releases do not update a template or already installed files.
Gentle AI is installed separately inside Gentle Shell: updating a system binary
does not update that package-local review runtime.

[Gentle AI 4](https://github.com/Gentleman-Programming/gentle-ai/releases/tag/v4.0.0)
uses `/v4`, retires SDD/OpenSpec in favor of ODD and moves Pi to built-in MCP.
[Pi 1.0](https://github.com/earendil-works/pi/releases/tag/v1.0.0) is the new
stable harness. Gentle Shell 4 owns NaN authentication and its model catalog;
this template no longer registers a competing provider or guesses model limits.

## Install or upgrade

Clone this repository, inspect it, then install into an existing project.

Windows:

```powershell
.\install.ps1 -Target 'F:\path\to\project'
cd 'F:\path\to\project'
. .\.pi\bin\activate.ps1
pi --stack-check
pi
```

macOS/Linux/Git Bash:

```bash
bash ./install.sh /path/to/project
cd /path/to/project
source .pi/bin/activate.sh
pi --stack-check
pi
```

Activation defines `pi` in that terminal. Each call finds the managed launcher
in the current project or a parent; unrelated projects use the normal Pi binary.
**Without activation, global `pi` bypasses the template's update checks.**

For persistent Windows activation, pass `-RegisterShell` to `install.ps1`.
This explicit option appends a dot-source line to that PowerShell profile;
it does not replace it. PowerShell 7 and Windows PowerShell have separate
profiles. On Bash/Zsh, add `source /absolute/project/.pi/bin/activate.sh` to your
own profile. Keep that project available or update the line after moving it.

Remote install is supported; activate afterwards as above:

```powershell
irm https://raw.githubusercontent.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN/main/install.ps1 | iex
```

```bash
curl -fsSL https://raw.githubusercontent.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN/main/install.sh | bash
```

The installer merges managed package versions, preserves custom models/providers,
package filters and unrelated packages, and backs up changed managed files in
`.pi/template-backups/`. It does not copy installed runtime trees, overwrite MCP
or credential files, grant project trust or invoke models.

## Controlled updates at launch

The launcher queries npm for Pi, Gentle Shell and Ponytail on first setup and
then at most once every six hours during normal launches. Failed attempts also
start that interval, avoiding repeated network delays. `pi --stack-check` and
`--stack-retry` force an immediate check; a changed template baseline does too.
Offline mode always skips discovery. The interval is stored per project in
`.pi/stack-runtime/update-check.json`; runtime probes still run on every launch.

1. Forward **patch** releases in each approved major/minor line are automatic.
   The highest nondeprecated stable patch in that line is selected from all
   published versions, even when npm's `latest` points to a newer major/minor.
   `4.0.0 -> 4.0.1` is eligible; `4.1.0`, `5.0.0`, prereleases and downgrades are
   held. The bundled native Gentle AI must also stay in its approved major/minor.
   A new reviewed template baseline can approve a wider upgrade.
2. Exact versions install in staging with an npm integrity lockfile and strict
   engine requirements. General lifecycle scripts are disabled. Only Gentle's
   native installer API runs, verifying its upstream release/build provenance.
   Windows requires local **Go >=1.25.10** for that source build. First setup may
   take several minutes. Transient native EPERM/EBUSY failures get bounded retries.
3. Probes check package identities, Pi version and actual SDK extension loading
   for Gentle Shell, Ponytail and the environment bridge. This sandbox is offline,
   uses no real credentials and performs **zero inference requests**.
4. A complete runtime is published into its own version directory. Project
   declarations point to it. Already loaded versions are never overwritten.
   This intentionally changes `.pi/settings.json`; inspect its diff before
   committing your project. Custom package filters remain intact.
5. Failed checks do not promote a candidate. Discovery/install failure retains
   the published runtime; first setup fails explicitly if there is no fallback.
   The previous version stays available for rollback.
6. A project lock prevents concurrent updates and new launches during publication.
   A second launch reports that it must retry after the update finishes.
   Version/extension/native-integrity probes also run
   before an offline launch. No global Pi configuration is rewritten.

```text
pi --stack-check          Force check/install without launching a model session
pi --offline              Use the installed runtime without registry checks
pi --stack-rollback       Restore the previous runtime without launching
pi --stack-retry --stack-check   Re-test a combination held after rollback
```

`PI_STACK_OFFLINE=1` skips update discovery; use Pi's own `--offline` as well to
suppress its catalog refreshes. After a crashed installer, inspect the recorded
PID in `.pi/stack-runtime/update.lock/owner.json` before removing that one lock
directory. Never remove a live installer's lock. For approved major/minor
updates, inspect a newer template, reinstall its launcher and run the check.

Patch gating reduces exposure; it does **not** guarantee upstream is regression
free. Probes do not establish live provider access, interactive rendering or
completed formal review. Rollback restores package paths/version selection,
not sessions, user data, all settings or credentials.

## NaN, isolation and MCP

Use native `/login nan` or `NAN_API_KEY`. The original `NAN_BUILDERS_API_KEY`
remains compatible: the bridge forwards it only in the current process when
`NAN_API_KEY` is absent. Native saved credentials retain their precedence.
Never commit, print or paste keys. The fallback model catalog does not prove
account access, price or quota. Upgrading does not switch your selected model.

Gentle discovery remains project-isolated with `GENTLE_PI_AGENT_HOME`. The
ordinary Pi auth/settings directory is unchanged. The deliberate opt-out
`PI_NAN_ALLOW_SHARED_GENTLE_HOME=1` permits shared discovery. Project/user
instructions still govern publication, delegation and review authorization.

Pi reads trusted project servers from `.pi/mcp.json` and personal servers from
`~/.pi/agent/mcp.json`. Do not install `pi-mcp-adapter`: its `/mcp` extension
overrides native MCP. This template does not delete global packages or invent
server configurations. Inspect `pi list` and remove an old adapter declaration
in its actual scope, retaining its configuration until migration is verified.
See [Pi MCP](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/mcp.md)
and Gentle AI's scoped sync/migration release notes.

## Verify

```bash
npm test
node scripts/smoke-runtime.mjs /path/to/test-bundle /path/to/project
```

Tests cover merge/backup/idempotency, invalid inputs, update policy, failures,
legacy environment compatibility and both installers. Windows/Linux CI is
configured. Actual execution and limitations belong in
[verification evidence](docs/verification.md), separately from hosted CI.
