// NaN Builders provider — project-scoped registration.
//
// Pi only reads models.json from the global agent dir (~/.pi/agent), so the
// provider is registered from this project extension instead. The API key is
// resolved from $NAN_BUILDERS_API_KEY at request time; no secret lives in the
// repo. Model list mirrors https://nan.builders/docs/pi.

const COMPAT = { supportsDeveloperRole: true };
const COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export default function (pi) {
	pi.registerProvider("nan", {
		name: "NaN Builders",
		baseUrl: "https://api.nan.builders/v1",
		apiKey: "$NAN_BUILDERS_API_KEY",
		api: "openai-completions",
		models: [
			{ id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", reasoning: true, input: ["text", "image"], contextWindow: 1048575, maxTokens: 32768, cost: COST, compat: COMPAT },
			{ id: "glm5.3-flash", name: "GLM 5.3 Flash", reasoning: true, input: ["text", "image"], contextWindow: 1048576, maxTokens: 32768, cost: COST, compat: COMPAT },
			{ id: "qwen3.8-flash", name: "Qwen 3.8 Flash", reasoning: true, input: ["text", "image"], contextWindow: 262144, maxTokens: 32768, cost: COST, compat: COMPAT },
			{ id: "mimo-v2.6-flash", name: "Xiaomi MiMo V2.6 Flash", reasoning: true, input: ["text", "image"], contextWindow: 1048576, maxTokens: 32768, cost: COST, compat: COMPAT },
			{ id: "gemma4", name: "Gemma 4", reasoning: true, input: ["text", "image"], contextWindow: 262144, maxTokens: 65536, cost: COST, compat: COMPAT },
			{ id: "qwen3.6", name: "Qwen 3.6", reasoning: true, input: ["text", "image"], contextWindow: 262144, maxTokens: 65536, cost: COST, compat: COMPAT },
			{ id: "glm5.3", name: "GLM 5.3 (premium)", reasoning: true, input: ["text"], contextWindow: 1048576, maxTokens: 32768, cost: COST, compat: COMPAT },
		],
	});
}
