# Execution evidence — October 2, 2026

Scope: template upgrade and controlled project-local startup. All local checks
used Windows, Node 24.19.0, npm 12.1.0 and Go 1.27.0. No inference calls, real
credential probes, subagents or formal native reviews were executed.

| Check | Executed result |
| --- | --- |
| `npm test` | 13 passed, zero failures/skips |
| PowerShell installer | Real temporary path containing spaces; configuration installed |
| Git Bash installer | Real temporary path containing spaces; configuration installed |
| Merge/reinstall | Custom model/provider/filter preserved; backups; idempotency; activated runtime paths not duplicated |
| Version policy | Forward patches selected; major/minor/prerelease/downgrade held; a reviewed baseline can approve a wider upgrade |
| Initial managed `--stack-check` | npm staging, verified native build, SDK probe, publication and pointer activation completed |
| Repeat managed `--stack-check` | Pi 1.0.0 / Gentle Shell 4.0.0 / Gentle AI 4.0.0 / Ponytail 4.10.1 |
| Managed `--offline --version` | `1.0.0` |
| Actual Pi SDK | 20 extensions loaded; no extension errors |
| Native binary | Upstream runtime resolver recomputed integrity; version probe reported `gentle-ai 4.0.0` |
| Injected registry failure | Previous published runtime retained; state descriptor unchanged |
| Injected npm failure | Candidate not promoted; previous descriptor unchanged |
| Competing update lock | Second launch refuses; lock and descriptor preserved |
| Synthetic predecessor rollback | Persisted selection/hold transaction exercised; no claim of testing a different live upstream release |
| Shell/JavaScript syntax | Bash wrappers and Node launcher checked |

The initial npm install on the F: development checkout took about 12 minutes.
The acceptance project used a separate local temporary directory. An actual
Windows EPERM occurred while Gentle's native installer renamed its staging
directory: no runtime was promoted. The repeated complete bootstrap succeeded;
the launcher now bounds EPERM/EBUSY retries without bypassing provenance checks.

Runtime commands are reproducible after installing into a disposable project:

```text
node <project>/.pi/stack-launcher/launch.mjs --stack-check
node <project>/.pi/stack-launcher/launch.mjs --offline --version
node scripts/smoke-runtime.mjs <published-bundle> <project>
```

For fault acceptance, create an empty `.stack-acceptance-only` marker **only in
that disposable project**, then run `node scripts/check-startup.mjs <project>`.
This script injects registry/npm failures and temporarily modifies the test
descriptor, restoring it on completion. Never run it against a live project.

Known limits:

- Local execution does not establish macOS/Linux runtime installation or a
  hosted Windows/Linux CI result. CI is configured separately.
- No live NaN request, full interactive TUI or actual formal review was tested.
- Native provenance checks trust the upstream verified installer; npm integrity
  and smoke checks do not prove that arbitrary upstream code is safe or bug-free.
- A real distinct-version patch rollout/rollback was not fabricated: current
  registry versions equal this baseline. Update selection/failure paths use
  explicit synthetic registry metadata.
- Two files carry settings/state activation; interrupted publication is repaired
  to the published descriptor on the next acquired startup. There is no claim of
  a filesystem-wide atomic transaction. New launches are blocked during update.
- A crashed writer leaves an explicit lock; inspect its PID before manual recovery.
- Shell activation is required. Installing this repo does not silently replace
  a global Pi executable or alter a user's profile without `-RegisterShell`.

Rollback boundaries: the baseline unit changes package pins and the NaN bridge.
The startup unit adds launch/install/update helpers and their tests. Retained
version directories and installation backups keep recovery project-local;
reverting either unit does not delete unrelated sessions or user data.
