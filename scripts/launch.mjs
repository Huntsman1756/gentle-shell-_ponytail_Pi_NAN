// Project-owned startup gate. Never update a loaded runtime or global Pi.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packages, discoverUpdates, parseVersion, approvedBaseline, assertNativeLine, shouldCheckUpdates } from "./update-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const home = join(root, ".pi/stack-runtime");
const stateFile = join(home, "current.json");
const checkFile = join(home, "update-check.json");
const baseline = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "stack-versions.json"), "utf8"));
const args = process.argv.slice(2);
const offline = args.includes("--offline") || process.env.PI_STACK_OFFLINE === "1";
const checkOnly = args.includes("--stack-check");
const rollback = args.includes("--stack-rollback");
const retryHeld = args.includes("--stack-retry");
const cliArgs = args.filter(arg => !["--stack-check", "--stack-rollback", "--stack-retry"].includes(arg));
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 19)) throw new Error("Node.js >=22.19.0 is required");
mkdirSync(home, { recursive: true });
function execute(command, arguments_, cwd, env = process.env, timeout = 300000) {
	const result = spawnSync(command, arguments_, { cwd, env, encoding: "utf8", timeout, windowsHide: true });
	if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.stderr?.slice(-1500) || result.status}`);
	return result.stdout;
}
function npm(arguments_, cwd) {
	if (process.platform !== "win32") return execute("npm", arguments_, cwd);
	// Execute the JS CLI directly: no shell quoting or command interpolation.
	const wrappers = execute("where.exe", ["npm.cmd"], cwd).trim().split(/\r?\n/);
	const entry = wrappers.map(wrapper => join(dirname(wrapper), "node_modules/npm/bin/npm-cli.js")).find(existsSync);
	if (!entry) throw new Error("Cannot locate npm's JavaScript CLI; reinstall Node.js/npm");
	return execute(process.execPath, [entry, ...arguments_], cwd);
}
function loadState() {
	if (!existsSync(stateFile)) return null;
	const state = JSON.parse(readFileSync(stateFile, "utf8"));
	for (const key of Object.keys(packages)) parseVersion(state.versions[key]);
	if (!/^[a-f0-9]{20}$/.test(state.bundle)) throw new Error("Invalid runtime identity");
	return state;
}
function loadLastCheck() {
	try { return JSON.parse(readFileSync(checkFile, "utf8")); }
	catch { return null; } // Missing or damaged cache must never suppress a check.
}
function atomicJson(path, value) {
	const pending = `${path}.${process.pid}.pending`;
	writeFileSync(pending, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
	renameSync(pending, path);
}
function pointSettings(state) {
	const path = join(root, ".pi/settings.json"), settings = JSON.parse(readFileSync(path, "utf8"));
	for (const key of ["gentlePi", "ponytail"]) {
		const name = packages[key];
		const matches = settings.packages.map((entry, i) => {
			const source = typeof entry === "string" ? entry : entry.source;
			return source === `npm:${name}` || source.startsWith(`npm:${name}@`) || (source.startsWith("./.pi/stack-runtime/releases/") && source.endsWith(`/node_modules/${name}`)) ? i : -1;
		}).filter(i => i >= 0);
		if (matches.length !== 1) throw new Error(`Expected one managed declaration for ${name}`);
		const source = `./.pi/stack-runtime/releases/${state.bundle}/node_modules/${name}`, i = matches[0];
		settings.packages[i] = typeof settings.packages[i] === "string" ? source : { ...settings.packages[i], source };
	}
	atomicJson(path, settings);
}
function verifyBundle(bundle, versions) {
	for (const [key, name] of Object.entries(packages)) {
		const metadata = JSON.parse(readFileSync(join(bundle, "node_modules", name, "package.json"), "utf8"));
		if (metadata.name !== name || metadata.version !== versions[key]) throw new Error(`Unexpected installed version: ${name}`);
	}
	const cli = join(bundle, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
	if (execute(process.execPath, [cli, "--version"], bundle).trim() !== versions.pi) throw new Error("Pi version probe failed");
	return JSON.parse(execute(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "smoke-runtime.mjs"), bundle, root], bundle)).nativeAiVersion;
}
function prepare(versions) {
	const identity = createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.keys(packages).map(key => [key, versions[key]])))).digest("hex").slice(0, 20);
	const bundle = join(home, "releases", identity);
	if (existsSync(bundle)) { assertNativeLine(verifyBundle(bundle, versions), baseline.gentleAi); return { versions, bundle: identity }; }
	const pending = join(home, `pending-${process.pid}-${Date.now()}`);
	mkdirSync(pending, { recursive: true });
	try {
		writeFileSync(join(pending, "package.json"), JSON.stringify({ private: true, dependencies: Object.fromEntries(Object.entries(packages).map(([key, name]) => [name, versions[key]])) }));
		npm(["install", "--ignore-scripts", "--engine-strict", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org"], pending);
		// Only the pinned Gentle installer is run. It verifies native provenance;
		// its direct API does not run the global fullscreen-settings postinstall.
		execute(process.execPath, ["--input-type=module", "-e", "const m=await import('./node_modules/gentle-pi/scripts/gentle-ai-installer.mjs');for(let attempt=0;attempt<3;attempt++){try{const r=await m.installGentleAi();console.log(r.binaryPath);break;}catch(e){if(attempt===2||!['EPERM','EBUSY'].includes(e.code))throw e;await new Promise(resolve=>setTimeout(resolve,1000));}}"], pending, process.env, 1200000);
		assertNativeLine(verifyBundle(pending, versions), baseline.gentleAi);
		mkdirSync(dirname(bundle), { recursive: true });
		renameSync(pending, bundle);
		return { versions, bundle: identity };
	} finally { if (existsSync(pending)) rmSync(pending, { recursive: true, force: true }); }
}

let current = loadState();
const lock = join(home, "update.lock");
let ownsLock = false;
try {
	mkdirSync(lock); // Never launch with settings from a competing publication.
	ownsLock = true;
} catch (error) {
	if (error.code !== "EEXIST") throw error;
	throw new Error("Another stack update is running; retry after it completes");
}
// Claim ownership immediately; the directory is never shared by writers.
if (ownsLock) writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
if (ownsLock) {
	try {
		if (rollback) {
			if (!current?.previous) throw new Error("No previous runtime to restore");
			const restored = { ...current.previous, heldVersions: current.versions };
			verifyBundle(join(home, "releases", restored.bundle), restored.versions);
			pointSettings(restored); atomicJson(stateFile, restored); current = restored;
		} else if (!offline && shouldCheckUpdates(loadLastCheck(), baseline, { installed: current, force: checkOnly || retryHeld })) {
			// Persist attempts too, so registry/install failures do not delay every launch.
			// Explicit checks, retries, first setup and changed baselines bypass this cache.
			atomicJson(checkFile, { checkedAt: Date.now(), baseline });
			const base = current ? approvedBaseline(current.versions, baseline) : baseline;
			const { selected, pending } = await discoverUpdates(base);
			for (const item of pending) console.error(`Update held for compatibility review: ${item.package} ${item.available} (current ${item.installed})`);
			const held = !retryHeld && current?.heldVersions && Object.keys(packages).every(key => selected[key] === current.heldVersions[key]);
			if (held) console.error("Keeping rollback: this exact combination is held. Use --stack-retry to test it again.");
			if (!held && (!current || Object.keys(packages).some(key => selected[key] !== current.versions[key]))) {
				const candidate = prepare(selected);
				pointSettings(candidate);
				atomicJson(stateFile, { ...candidate, previous: current && { versions: current.versions, bundle: current.bundle } });
				current = loadState();
			}
		}
		if (current) pointSettings(current); // Repair interrupted settings/state publication.
	} catch (error) {
		if (!current || rollback) throw error;
		pointSettings(current);
		console.error(`Update not activated; keeping the previous runtime: ${error.message}`);
	} finally { rmSync(lock, { recursive: true, force: true }); }
}
if (!current) throw new Error("No tested runtime installed. Run once online before using --offline.");
const nativeVersion = verifyBundle(join(home, "releases", current.bundle), current.versions);
console.error(`Pi ${current.versions.pi} | Gentle Shell ${current.versions.gentlePi} | Gentle AI ${nativeVersion} | Ponytail ${current.versions.ponytail}`);
if (!checkOnly && !rollback) {
	const cli = join(home, "releases", current.bundle, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
	const result = spawnSync(process.execPath, [cli, ...cliArgs], { cwd: process.cwd(), stdio: "inherit", env: process.env });
	if (result.error) throw result.error;
	process.exitCode = result.status ?? 1;
}
