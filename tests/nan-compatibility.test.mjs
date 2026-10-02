import assert from "node:assert/strict";
import test from "node:test";
import bridge from "../.pi/extensions/nan-provider.ts";

test("legacy NaN key is bridged in memory without replacing an explicit key", () => {
	const old = { a: process.env.NAN_API_KEY, b: process.env.NAN_BUILDERS_API_KEY };
	try {
		delete process.env.NAN_API_KEY;
		process.env.NAN_BUILDERS_API_KEY = "synthetic-test-only";
		bridge(); assert.equal(process.env.NAN_API_KEY, "synthetic-test-only");
		process.env.NAN_API_KEY = "explicit-test-only";
		bridge(); assert.equal(process.env.NAN_API_KEY, "explicit-test-only");
	} finally {
		for (const [key, value] of [["NAN_API_KEY", old.a], ["NAN_BUILDERS_API_KEY", old.b]]) {
			if (value === undefined) delete process.env[key]; else process.env[key] = value;
		}
	}
});
