// Acceptance against an already bootstrapped disposable project, never a
// user's live project. Injected registry/npm failures use synthetic inputs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const project = resolve(process.argv[2]);
const marker = join(project, ".stack-acceptance-only");
if (!existsSync(marker)) throw new Error("Create .stack-acceptance-only in a disposable acceptance project first");
const launcher = join(project, ".pi/stack-launcher/launch.mjs");
const stateFile = join(project, ".pi/stack-runtime/current.json");
const original = readFileSync(stateFile, "utf8");
const sandbox = mkdtempSync(join(tmpdir(), "pi-update-faults-"));
const invoke = (hook, environment = {}) => spawnSync(process.execPath, ["--import", pathToFileURL(hook).href, launcher, "--stack-check"], { cwd: project, env: { ...process.env, ...environment }, encoding: "utf8", timeout: 60000 });
try {
	const offline = join(sandbox, "offline.mjs");
	writeFileSync(offline, "globalThis.fetch=async()=>{throw new Error('synthetic registry failure')};");
	let result = invoke(offline);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /keeping the previous runtime/);
	assert.equal(readFileSync(stateFile, "utf8"), original);
	const patch = join(sandbox, "patch.mjs");
	const state = JSON.parse(original), versions = state.versions;
	const nextPi = versions.pi.replace(/\d+$/, value => String(Number(value) + 1));
	writeFileSync(patch, `const versions=${JSON.stringify({ "@earendil-works/pi-coding-agent": nextPi, "gentle-pi": versions.gentlePi, "@dietrichgebert/ponytail": versions.ponytail })};globalThis.fetch=async url=>{const name=decodeURIComponent(url.split('/').at(-2));return {ok:true,json:async()=>({name,version:versions[name],dist:{integrity:'synthetic'}})};};`);
	const bin = join(sandbox, "bin"); mkdirSync(bin);
	if (process.platform === "win32") {
		writeFileSync(join(bin, "npm.cmd"), "@echo off\r\nexit /b 42\r\n");
		const cli = join(bin, "node_modules/npm/bin"); mkdirSync(cli, { recursive: true });
		writeFileSync(join(cli, "npm-cli.js"), "console.error('synthetic installation failure');process.exit(42);");
	} else {
		writeFileSync(join(bin, "npm"), "#!/bin/sh\necho 'synthetic installation failure' >&2\nexit 42\n"); chmodSync(join(bin, "npm"), 0o755);
	}
	result = invoke(patch, { PATH: bin + delimiter + process.env.PATH });
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /synthetic installation failure/);
	assert.equal(readFileSync(stateFile, "utf8"), original);
	// A competing writer's lock is neither removed nor stolen.
	const lock = join(project, ".pi/stack-runtime/update.lock"); mkdirSync(lock);
	writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: process.pid }));
	try {
		result = invoke(patch);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Another stack update is running/);
		assert(existsSync(join(lock, "owner.json")));
		assert.equal(readFileSync(stateFile, "utf8"), original);
	} finally { rmSync(lock, { recursive: true }); }
	// Synthetic predecessor exercises the persisted rollback/hold transaction;
	// it does not assert testing another live upstream version.
	writeFileSync(stateFile, JSON.stringify({ ...state, previous: { bundle: state.bundle, versions: state.versions } }));
	result = spawnSync(process.execPath, [launcher, "--stack-rollback"], { cwd: project, encoding: "utf8", timeout: 60000 });
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(JSON.parse(readFileSync(stateFile)).heldVersions, state.versions);
	console.log(JSON.stringify({ registryFailureFallback: true, installationFailureFallback: true, competingLockPreserved: true, syntheticRollbackTransaction: true, inferenceRequests: 0 }));
} finally {
	writeFileSync(stateFile, original);
	rmSync(sandbox, { recursive: true, force: true });
}
