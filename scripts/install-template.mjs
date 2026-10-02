// Both platform wrappers share this merge policy. No global state or
// credentials are copied, and installed runtime trees are never distributed.
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function installTemplate(target, source = resolve(dirname(fileURLToPath(import.meta.url)), "..")) {
	target = resolve(target);
	if (!lstatSync(target).isDirectory()) throw new Error("Target must be an existing project directory");
	const sources = { ".pi/extensions/project-isolation.js": ".pi/extensions/project-isolation.js", ".pi/extensions/nan-provider.ts": ".pi/extensions/nan-provider.ts", ".pi/npm/.gitignore": ".pi/npm/.gitignore" };
	for (const file of ["launch.mjs", "update-policy.mjs", "smoke-runtime.mjs"]) sources[`.pi/stack-launcher/${file}`] = `scripts/${file}`;
	sources[".pi/stack-launcher/stack-versions.json"] = "stack-versions.json";
	for (const file of ["pi.ps1", "pi.cmd", "pi.sh", "activate.ps1", "activate.sh"]) sources[`.pi/bin/${file}`] = `scripts/${file}`;
	const managed = [".pi/settings.json", ...Object.keys(sources), ".gitignore"];
	for (const path of [".pi", ".pi/extensions", ".pi/npm", ".pi/bin", ".pi/stack-launcher", ".pi/template-backups", ...managed]) {
		const destination = join(target, path);
		if (existsSync(destination) && lstatSync(destination).isSymbolicLink()) throw new Error(`Managed path is a symlink: ${path}`);
	}
	const template = JSON.parse(readFileSync(join(source, ".pi/settings.json"), "utf8"));
	const settingsPath = join(target, ".pi/settings.json");
	const current = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
	if (!current || typeof current !== "object" || Array.isArray(current)) throw new Error("Settings must be an object");
	if (current.packages !== undefined && !Array.isArray(current.packages)) throw new Error("Settings packages must be an array");
	const packageName = value => {
		const text = typeof value === "string" ? value : value?.source;
		if (typeof text !== "string") throw new Error("Package entries must have a string source");
		const managedPath = /^\.\/\.pi\/stack-runtime\/releases\/[a-f0-9]{20}\/node_modules\/(gentle-pi|@dietrichgebert\/ponytail)$/.exec(text);
		if (managedPath) return `npm:${managedPath[1]}`;
		return text.replace(/@[^/@]+$/, "");
	};
	const packages = [...(current.packages || [])];
	for (const spec of template.packages) {
		const name = packageName(spec);
		const indexes = packages.map((value, index) => packageName(value) === name ? index : -1).filter(index => index >= 0);
		if (indexes.length > 1) throw new Error(`Duplicate managed package: ${name}`);
		if (indexes.length) {
			const i = indexes[0];
			const previousSource = typeof packages[i] === "string" ? packages[i] : packages[i].source;
			const source = previousSource.startsWith("./.pi/stack-runtime/releases/") ? previousSource : spec;
			packages[i] = typeof packages[i] === "string" ? source : { ...packages[i], source };
		} else packages.push(spec);
	}
	const updated = { ...template, ...current, packages };
	const plan = new Map([[".pi/settings.json", JSON.stringify(updated, null, 2) + "\n"]]);
	for (const [path, original] of Object.entries(sources)) plan.set(path, readFileSync(join(source, original), "utf8"));
	const ignore = existsSync(join(target, ".gitignore")) ? readFileSync(join(target, ".gitignore"), "utf8") : "";
	const entries = [".pi/npm/*", "!.pi/npm/.gitignore", ".pi/gentle-agent-home/", ".pi/template-backups/", ".pi/stack-runtime/", ".pi/stack-launcher/", ".pi/bin/", ".atl/"];
	const missing = entries.filter(entry => !ignore.split(/\r?\n/).includes(entry));
	plan.set(".gitignore", ignore + (missing.length ? `${ignore.endsWith("\n") || !ignore ? "" : "\n"}# Pi local runtime state\n${missing.join("\n")}\n` : ""));
	const changes = [...plan].filter(([path, content]) => !existsSync(join(target, path)) || readFileSync(join(target, path), "utf8") !== content);
	const backup = join(target, ".pi/template-backups", `${Date.now()}-${process.pid}`);
	for (const [path] of changes) {
		const destination = join(target, path);
		if (existsSync(destination)) {
			const saved = join(backup, path);
			mkdirSync(dirname(saved), { recursive: true });
			copyFileSync(destination, saved);
		}
	}
	for (const [path, content] of changes) {
		const destination = join(target, path);
		mkdirSync(dirname(destination), { recursive: true });
		writeFileSync(destination, content, "utf8");
	}
	return { changedFiles: changes.map(([path]) => path), backup: existsSync(backup) ? backup : null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [major, minor] = process.versions.node.split(".").map(Number);
	if (major < 22 || (major === 22 && minor < 19)) throw new Error("Node.js >=22.19.0 is required");
	console.log(JSON.stringify(installTemplate(process.argv[2] || process.cwd()), null, 2));
	console.log("Install Pi 1.0.0: npm i -g @earendil-works/pi-coding-agent@1.0.0");
	console.log("Then run pi in the project and review the configuration before granting project trust.");
}
