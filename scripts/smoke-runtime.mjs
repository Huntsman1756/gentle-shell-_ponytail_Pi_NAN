// No inference, external requests or real credentials are used by this gate.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [bundleArgument, projectArgument] = process.argv.slice(2);
const bundle = resolve(bundleArgument), project = resolve(projectArgument);
const sandbox = mkdtempSync(join(tmpdir(), "pi-stack-smoke-"));
process.env.PI_OFFLINE = "1";
process.env.PI_CODING_AGENT_DIR = join(sandbox, "agent");
process.env.GENTLE_PI_AGENT_HOME = join(sandbox, "gentle");
delete process.env.NAN_API_KEY;
delete process.env.NAN_BUILDERS_API_KEY;
try {
	const gentleRoot = join(bundle, "node_modules/gentle-pi");
	const native = await import(pathToFileURL(join(gentleRoot, "runtime/gentle-ai-binary.mjs")));
	const binary = native.resolveGentleAiBinary(gentleRoot, process.platform, readFileSync, { env: { GENTLE_PI_CONFIG_HOME: sandbox }, home: sandbox });
	const version = spawnSync(binary, ["version"], { encoding: "utf8", timeout: 30000, windowsHide: true });
	assert.equal(version.status, 0, "Native Gentle AI version probe failed");
	assert.equal(version.stdout.trim(), `gentle-ai ${native.GENTLE_AI_VERSION}`);
	const { DefaultResourceLoader, SettingsManager } = await import(pathToFileURL(join(bundle, "node_modules/@earendil-works/pi-coding-agent/dist/index.js")));
	const loader = new DefaultResourceLoader({
		cwd: sandbox,
		agentDir: join(sandbox, "agent"),
		settingsManager: SettingsManager.inMemory({ packages: [join(bundle, "node_modules/gentle-pi"), join(bundle, "node_modules/@dietrichgebert/ponytail")] }),
		additionalExtensionPaths: [join(project, ".pi/extensions/nan-provider.ts")],
	});
	await loader.reload();
	const loaded = loader.getExtensions();
	assert.deepEqual(loaded.errors, [], "Extensions must load on the selected Pi API");
	assert(loaded.extensions.some(extension => extension.path.includes("gentle-pi")));
	assert(loaded.extensions.some(extension => extension.path.includes("ponytail")));
	assert(loaded.extensions.some(extension => extension.path.endsWith("nan-provider.ts")));
	console.log(JSON.stringify({ extensionLoading: true, loaded: loaded.extensions.length, nativeAiVersion: native.GENTLE_AI_VERSION, nativeIntegrity: true, inferenceRequests: 0 }));
} finally { rmSync(sandbox, { recursive: true, force: true }); }
