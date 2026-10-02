import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { installTemplate } from "../scripts/install-template.mjs";
import { approvedBaseline, assertNativeLine, discoverUpdates, parseVersion, selectPatch } from "../scripts/update-policy.mjs";

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
test("registry checks all packages and retains incompatible upgrades as pending", async () => {
	const calls = [];
	const result = await discoverUpdates({ pi: "1.0.0", gentlePi: "4.0.0", ponytail: "4.10.1" }, async url => {
		calls.push(url);
		const name = decodeURIComponent(url.split("/").at(-2));
		const version = { "@earendil-works/pi-coding-agent": "1.0.1", "gentle-pi": "4.1.0", "@dietrichgebert/ponytail": "4.10.2" }[name];
		return { ok: true, json: async () => ({ name, version, dist: { integrity: "fixture" } }) };
	});
	assert.equal(calls.length, 3);
	assert.equal(result.selected.pi, "1.0.1");
	assert.equal(result.selected.ponytail, "4.10.2");
	assert.equal(result.selected.gentlePi, "4.0.0");
	assert.equal(result.pending.length, 1);
});
test("bad registry identity and network errors do not return a candidate", async () => {
	const current = { pi: "1.0.0", gentlePi: "4.0.0", ponytail: "4.10.1" };
	await assert.rejects(discoverUpdates(current, async () => ({ ok: true, json: async () => ({ name: "wrong", version: "1.0.1", dist: { integrity: "fixture" } }) })));
	await assert.rejects(discoverUpdates(current, async () => { throw new Error("offline"); }), /offline/);
});
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
