export const packages = {
	pi: "@earendil-works/pi-coding-agent",
	gentlePi: "gentle-pi",
	ponytail: "@dietrichgebert/ponytail",
};
export const updateIntervalMs = 6 * 60 * 60 * 1000;
export function shouldCheckUpdates(lastCheck, baseline, { installed, force = false, now = Date.now() } = {}) {
	if (!installed || force) return true;
	if (!Number.isFinite(lastCheck?.checkedAt) || lastCheck.checkedAt > now) return true;
	if (Object.keys(baseline).some(key => lastCheck.baseline?.[key] !== baseline[key])) return true;
	return now - lastCheck.checkedAt >= updateIntervalMs;
}
export function parseVersion(value) {
	const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
	if (!match) throw new Error("Only stable numeric releases are supported");
	return match.slice(1).map(Number);
}
export function selectPatch(current, latest) {
	const a = parseVersion(current), b = parseVersion(latest);
	return a[0] === b[0] && a[1] === b[1] && b[2] > a[2] ? latest : current;
}
export function assertNativeLine(version, approved) {
	const actual = parseVersion(version), expected = parseVersion(approved);
	if (actual[0] !== expected[0] || actual[1] !== expected[1]) throw new Error("Bundled Gentle AI major/minor needs template compatibility review");
}
export function approvedBaseline(current, baseline) {
	const selected = { ...current };
	for (const key of Object.keys(packages)) {
		const a = parseVersion(current[key]), b = parseVersion(baseline[key]);
		if (b[0] > a[0] || (b[0] === a[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] > a[2])))) selected[key] = baseline[key];
	}
	return selected;
}
export async function discoverUpdates(current, fetcher = fetch) {
	const selected = { ...current }, pending = [];
	for (const [key, name] of Object.entries(packages)) {
		const response = await fetcher(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
			headers: { Accept: "application/vnd.npm.install-v1+json" }, signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) throw new Error(`Registry lookup failed for ${name}: HTTP ${response.status}`);
		const metadata = await response.json();
		const latest = metadata["dist-tags"]?.latest;
		if (metadata.name !== name || !metadata.versions || !metadata.versions[latest]?.dist?.integrity) throw new Error(`Invalid registry metadata for ${name}`);
		parseVersion(current[key]);
		for (const [version, release] of Object.entries(metadata.versions)) {
			// Ignore prereleases and noncanonical versions; never select deprecated releases.
			if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || release.deprecated) continue;
			if (selectPatch(selected[key], version) === selected[key]) continue;
			if (release.name !== name || release.version !== version || !release.dist?.integrity) throw new Error(`Invalid registry metadata for ${name}@${version}`);
			selected[key] = version;
		}
		const stableLatest = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(latest);
		if (latest !== selected[key] && (!stableLatest || selectPatch(current[key], latest) === current[key])) pending.push({ package: name, installed: current[key], available: latest });
	}
	return { selected, pending };
}
