# Baseline upgrade to Gentle 4 and Pi 1

The previous template used unversioned npm declarations and documented a
September Pi 0.87.1/Gentle 3.7 baseline. Upstream publication does not change a
template checkout or refresh installed project files. Pin the supported stack
explicitly and provide a separately gated startup updater.

Reviewed October 2, 2026 baseline:

| Component | Version | Source |
| --- | --- | --- |
| Pi | 1.0.0 | `@earendil-works/pi-coding-agent@1.0.0` |
| Gentle Shell | 4.0.0 | `gentle-pi@4.0.0` |
| Package-local Gentle AI | 4.0.0 | Gentle Shell's verified native installer |
| Ponytail | 4.10.1 | `@dietrichgebert/ponytail@4.10.1` |

Gentle Shell's published peer requirement is Pi >=0.99.1 and its Node requirement
is >=22.19.0. Pi 1.0.0 also requires Node >=22.19.0. Gentle AI's exact release
commit is `ff77164d4f56f1665b22fb6fac51c2ccbb769400` and its Go module is `/v4`.

Gentle Shell now registers NaN itself. The old project provider would compete
with its native registration and maintain a separate auth/catalog contract.
The replacement only bridges `NAN_BUILDERS_API_KEY` to `NAN_API_KEY` in memory
when the latter is absent. Native saved-credential precedence is unchanged.
There is no copied upstream implementation and no bundled credential.

Verification: the real Pi 1 SDK loaded 20 selected extensions on Windows with
Node 24.19.0. The native Go SumDB-backed install produced `gentle-ai 4.0.0`.
The environment compatibility regression uses synthetic keys only. No model
request or native review was executed. Startup/install acceptance and its
limitations are documented separately in `verification.md`.
