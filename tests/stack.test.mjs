import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { installTemplate } from "../scripts/install-template.mjs";
import { approvedBaseline, assertNativeLine, discoverUpdates, parseVersion, selectPatch, shouldCheckUpdates, updateIntervalMs, packages } from "../scripts/update-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("template pins agree with the reviewed baseline", () => {
	const baseline = JSON.parse(readFileSync(join(root, "stack-versions.json")));
	const settings = JSON.parse(readFileSync(join(root, ".pi/settings.json")));
	assert(settings.packages.includes(`npm:gentle-pi@${baseline.gentlePi}`));
	assert(settings.packages.includes(`npm:@dietrichgebert/ponytail@${baseline.ponytail}`));
});
function temporary(run) {
	const path = mkdtempSync(join(tmpdir(), "pi-template-test-"));
	try { return run(path); } finally { rmSync(path, { recursive: true, force: true }); }
}
test("install preserves custom settings, package filters, MCP and runtime", () => temporary(target => {
	mkdirSync(join(target, ".pi/npm"), { recursive: true });
	const original = { defaultProvider: "custom", defaultModel: "my-model", theme: "custom", packages: [{ source: "npm:gentle-pi@3.7.0", skills: [] }, "npm:other@1.0.0"] };
	writeFileSync(join(target, ".pi/settings.json"), JSON.stringify(original));
	writeFileSync(join(target, ".pi/mcp.json"), '{"mcpServers":{"user":{}}}');
	writeFileSync(join(target, ".pi/npm/runtime-sentinel"), "preserved");
	const result = installTemplate(target);
	const updated = JSON.parse(readFileSync(join(target, ".pi/settings.json")));
	assert.equal(updated.defaultModel, "my-model");
	assert.equal(updated.defaultProvider, "custom");
	assert.equal(updated.theme, "custom");
	assert.deepEqual(updated.packages[0], { source: "npm:gentle-pi@4.0.0", skills: [] });
	assert(updated.packages.includes("npm:other@1.0.0"));
	assert.equal(readFileSync(join(target, ".pi/npm/runtime-sentinel"), "utf8"), "preserved");
	assert.equal(readFileSync(join(target, ".pi/mcp.json"), "utf8"), '{"mcpServers":{"user":{}}}');
	assert.deepEqual(JSON.parse(readFileSync(join(result.backup, ".pi/settings.json"))), original);
	assert.deepEqual(installTemplate(target).changedFiles, []);
}));
test("invalid settings fail before any managed file is written", () => temporary(target => {
	mkdirSync(join(target, ".pi"));
	writeFileSync(join(target, ".pi/settings.json"), "{broken");
	assert.throws(() => installTemplate(target));
	assert(!existsSync(join(target, ".pi/extensions")));
}));
test("reinstall keeps activated immutable packages without duplicate declarations", () => temporary(target => {
	installTemplate(target);
	const path = join(target, ".pi/settings.json"), settings = JSON.parse(readFileSync(path));
	settings.packages = ["./.pi/stack-runtime/releases/0123456789abcdef0123/node_modules/gentle-pi", { source: "./.pi/stack-runtime/releases/0123456789abcdef0123/node_modules/@dietrichgebert/ponytail", skills: [] }];
	writeFileSync(path, JSON.stringify(settings));
	installTemplate(target);
	assert.deepEqual(JSON.parse(readFileSync(path)).packages, settings.packages);
}));
test("duplicate declarations fail without silently selecting one", () => temporary(target => {
	mkdirSync(join(target, ".pi"));
	writeFileSync(join(target, ".pi/settings.json"), JSON.stringify({ packages: ["npm:gentle-pi", "npm:gentle-pi@3.7.0"] }));
	assert.throws(() => installTemplate(target), /Duplicate managed/);
	assert(!existsSync(join(target, ".pi/extensions")));
}));
test("a dangling managed directory link fails before installation", () => temporary(target => {
	mkdirSync(join(target, ".pi"));
	symlinkSync(join(target, "missing-link-target"), join(target, ".pi/extensions"), process.platform === "win32" ? "junction" : "dir");
	assert.throws(() => installTemplate(target), /Managed path is a symlink/);
	assert(!existsSync(join(target, ".pi/settings.json")));
	assert(!existsSync(join(target, "missing-link-target")));
}));
test("only forward patch releases are automatically selected", () => {
	assert.equal(selectPatch("4.0.0", "4.0.1"), "4.0.1");
	for (const version of ["4.1.0", "5.0.0", "3.9.9", "4.0.0"]) assert.equal(selectPatch("4.0.0", version), "4.0.0");
	for (const version of ["4.0.1-beta.1", "latest", "4.0", "04.0.0"]) assert.throws(() => parseVersion(version));
});
test("a Shell patch cannot silently upgrade the native Gentle AI major/minor", () => {
	assertNativeLine("4.0.1", "4.0.0");
	assert.throws(() => assertNativeLine("4.1.0", "4.0.0"), /compatibility review/);
	assert.throws(() => assertNativeLine("5.0.0", "4.0.0"), /compatibility review/);
});
test("a newer reviewed template can approve a minor without downgrading installed patches", () => {
	assert.deepEqual(approvedBaseline({ pi: "1.0.2", gentlePi: "4.0.1", ponytail: "4.10.1" }, { pi: "1.0.0", gentlePi: "4.1.0", ponytail: "4.10.2" }), { pi: "1.0.2", gentlePi: "4.1.0", ponytail: "4.10.2" });
});
function registryMetadata(name, latest, versions = [latest]) {
	return { name, "dist-tags": { latest }, versions: Object.fromEntries(versions.map(version => [version, { name, version, dist: { integrity: "fixture" } }])) };
}
test("registry selects the highest compatible patch even when latest moves to another branch", async () => {
	const calls = [];
	const result = await discoverUpdates({ pi: "1.0.0", gentlePi: "4.0.0", ponytail: "4.10.1" }, async url => {
		calls.push(url);
		const name = decodeURIComponent(url.split("/").at(-1));
		const version = { "@earendil-works/pi-coding-agent": "1.0.1", "gentle-pi": "4.1.0", "@dietrichgebert/ponytail": "4.10.2" }[name];
		const versions = name === "gentle-pi" ? ["4.0.2", "4.1.0", "4.0.1", "4.0.10", "4.0.11-beta.1", "3.9.9"] : [version];
		return { ok: true, json: async () => registryMetadata(name, version, versions) };
	});
	assert.equal(calls.length, 3);
	assert.equal(result.selected.pi, "1.0.1");
	assert.equal(result.selected.ponytail, "4.10.2");
	assert.equal(result.selected.gentlePi, "4.0.10");
	assert.equal(result.pending.length, 1);
});
test("deprecated patches are skipped and prerelease latest does not hide stable patches", async () => {
	const current = { pi: "1.0.0", gentlePi: "4.0.0", ponytail: "4.10.1" };
	const result = await discoverUpdates(current, async (url, options) => {
		assert.equal(options.headers.Accept, "application/vnd.npm.install-v1+json");
		const name = decodeURIComponent(url.split("/").at(-1));
		const key = Object.keys(packages).find(key => packages[key] === name);
		const metadata = registryMetadata(name, current[key]);
		if (key === "gentlePi") {
			Object.assign(metadata, registryMetadata(name, "5.0.0-beta.1", ["5.0.0-beta.1", "4.0.1", "4.0.2"]));
			metadata.versions["4.0.2"].deprecated = "withdrawn";
		}
		return { ok: true, json: async () => metadata };
	});
	assert.equal(result.selected.gentlePi, "4.0.1");
	assert.equal(result.pending[0].available, "5.0.0-beta.1");
});
test("bad registry identity and network errors do not return a candidate", async () => {
	const current = { pi: "1.0.0", gentlePi: "4.0.0", ponytail: "4.10.1" };
	await assert.rejects(discoverUpdates(current, async () => ({ ok: true, json: async () => ({ name: "wrong", version: "1.0.1", dist: { integrity: "fixture" } }) })));
	await assert.rejects(discoverUpdates(current, async () => { throw new Error("offline"); }), /offline/);
	await assert.rejects(discoverUpdates(current, async () => ({ ok: false, status: 503 })), /HTTP 503/);
	const bad = registryMetadata(packages.pi, "2.0.0", ["2.0.0", "1.0.1"]);
	delete bad.versions["1.0.1"].dist.integrity;
	await assert.rejects(discoverUpdates(current, async () => ({ ok: true, json: async () => bad })), /Invalid registry metadata/);
});
test("automatic checks wait six hours but explicit checks and changed baselines bypass the cache", () => {
	const baseline = { pi: "1.0.0", gentleAi: "4.0.0" }, checkedAt = 1000;
	const cached = { checkedAt, baseline };
	assert.equal(shouldCheckUpdates(cached, baseline, { installed: true, now: checkedAt + updateIntervalMs - 1 }), false);
	assert.equal(shouldCheckUpdates(cached, baseline, { installed: true, now: checkedAt + updateIntervalMs }), true);
	assert.equal(shouldCheckUpdates(cached, baseline, { installed: true, force: true, now: checkedAt }), true);
	assert.equal(shouldCheckUpdates(cached, baseline, { installed: false, now: checkedAt }), true);
	assert.equal(shouldCheckUpdates(cached, { ...baseline, gentleAi: "4.1.0" }, { installed: true, now: checkedAt }), true);
	for (const cache of [null, {}, { checkedAt: "1000" }, { checkedAt: NaN }, { checkedAt: checkedAt + 1, baseline }]) {
		assert.equal(shouldCheckUpdates(cache, baseline, { installed: true, now: checkedAt }), true);
	}
});
test("launcher caches successful and failed attempts, forces checks and honors offline mode", () => temporary(target => {
	installTemplate(target);
	const baseline = JSON.parse(readFileSync(join(root, "stack-versions.json")));
	const versions = Object.fromEntries(Object.keys(packages).map(key => [key, baseline[key]]));
	const bundle = "0123456789abcdef0123", home = join(target, ".pi/stack-runtime");
	for (const [key, name] of Object.entries(packages)) {
		const directory = join(home, "releases", bundle, "node_modules", name);
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, "package.json"), JSON.stringify({ name, version: versions[key] }));
	}
	writeFileSync(join(home, "current.json"), JSON.stringify({ versions, bundle }));
	const trace = join(target, "fetches.txt"), hook = join(target, "hook.mjs"), mode = join(target, "mode.txt");
	writeFileSync(mode, "failure");
	writeFileSync(hook, `import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {appendFileSync,readFileSync} from 'node:fs';
cp.spawnSync=(_command,args)=>({status:0,stdout:args.includes('--version')?'1.0.0':JSON.stringify({nativeAiVersion:'4.0.0'})});
syncBuiltinESMExports();
globalThis.fetch=async url=>{
appendFileSync(${JSON.stringify(trace)},'attempt\\n');
if(readFileSync(${JSON.stringify(mode)},'utf8')==='failure')throw new Error('synthetic registry failure');
const name=decodeURIComponent(url.split('/').at(-1)),versions=${JSON.stringify(Object.fromEntries(Object.entries(packages).map(([key, name]) => [name, versions[key]])))},version=versions[name];
return {ok:true,json:async()=>({name,'dist-tags':{latest:version},versions:{[version]:{name,version,dist:{integrity:'fixture'}}}})};
};`);
	const launcher = join(target, ".pi/stack-launcher/launch.mjs");
	const invoke = args => {
		const env = { ...process.env }; delete env.PI_STACK_OFFLINE;
		const result = spawnSync(process.execPath, ["--import", pathToFileURL(hook).href, launcher, ...args], { cwd: target, env, encoding: "utf8", timeout: 10000 });
		assert.equal(result.status, 0, result.stderr);
		return result;
	};
	assert.match(invoke([]).stderr, /keeping the previous runtime/);
	assert(!invoke([]).stderr.includes("synthetic registry failure"));
	assert.equal(readFileSync(trace, "utf8").trim().split("\n").length, 1);
	invoke(["--stack-check"]); invoke(["--stack-retry", "--stack-check"]);
	assert.equal(readFileSync(trace, "utf8").trim().split("\n").length, 3);
	invoke(["--offline", "--stack-check"]);
	assert.equal(readFileSync(trace, "utf8").trim().split("\n").length, 3);
	writeFileSync(join(home, "update-check.json"), "{broken");
	invoke([]);
	assert.equal(readFileSync(trace, "utf8").trim().split("\n").length, 4);
	writeFileSync(join(home, "update-check.json"), JSON.stringify({ checkedAt: Date.now() - updateIntervalMs, baseline }));
	invoke([]);
	assert.equal(readFileSync(trace, "utf8").trim().split("\n").length, 5);
	writeFileSync(mode, "success");
	assert(!invoke(["--stack-check"]).stderr.includes("keeping the previous runtime"));
	invoke([]);
	assert.equal(readFileSync(trace, "utf8").trim().split("\n").length, 8);
}));
test("PowerShell installer works in a path containing spaces", { skip: process.platform !== "win32" }, () => temporary(parent => {
	const target = join(parent, "project with spaces"); mkdirSync(target);
	const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "install.ps1"), "-Target", target], { encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr);
	assert(existsSync(join(target, ".pi/bin/activate.ps1")));
}));
test("Bash installer works in a path containing spaces", () => temporary(parent => {
	const target = join(parent, "project with spaces"); mkdirSync(target);
	const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
	if (!existsSync(bash) && process.platform === "win32") return;
	const result = spawnSync(bash, [join(root, "install.sh").replaceAll("\\", "/"), target.replaceAll("\\", "/")], { encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr);
	assert(existsSync(join(target, ".pi/bin/activate.sh")));
}));
