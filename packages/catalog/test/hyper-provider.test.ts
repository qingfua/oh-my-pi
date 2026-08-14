import { describe, expect, it } from "bun:test";
import { Effort } from "@oh-my-pi/pi-catalog/effort";
import { getBundledModels } from "@oh-my-pi/pi-catalog/models";
import { hyperModelManagerOptions, mapHyperModel } from "@oh-my-pi/pi-catalog/provider-models/openai-compat";
import type { FetchImpl, ModelSpec } from "@oh-my-pi/pi-catalog/types";

const MODELS_PAYLOAD = {
	object: "list",
	data: [
		{
			id: "deepseek-v4-pro",
			object: "model",
			owned_by: "hyper",
			display_name: "DeepSeek-V4-Pro",
			context_window: 1_000_000,
			max_output_tokens: 384_000,
			capabilities: { vision: false },
			reasoning: {
				effort_levels: [
					{ value: "high", display: "High" },
					{ value: "xhigh", display: "X-High" },
				],
				default_effort_level: "high",
			},
			pricing: { input: 2.4, output: 4.8, cache_create: 0, cache_hit: 0.2 },
		},
		{
			id: "gemma-4-26b-a4b-it",
			object: "model",
			display_name: "Gemma 4 26B A4B",
			context_window: 256_000,
			max_output_tokens: 25_600,
			capabilities: { vision: false },
			pricing: { input: 0.116, output: 0.408, cache_create: 0.058, cache_hit: 0 },
		},
	],
};

function hyperFetch(): FetchImpl {
	return (async () =>
		new Response(JSON.stringify(MODELS_PAYLOAD), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})) as unknown as FetchImpl;
}

async function runDiscovery() {
	const options = hyperModelManagerOptions({ fetch: hyperFetch() });
	const fetchDynamicModels = options.fetchDynamicModels!;
	const models = await fetchDynamicModels();
	expect(models).not.toBeNull();
	return models!;
}

describe("Charm Hyper provider", () => {
	it("discovers chat-completions models with rich metadata lifted", async () => {
		const models = await runDiscovery();
		const pro = models.find(model => model.id === "deepseek-v4-pro");
		expect(pro).toMatchObject({
			id: "deepseek-v4-pro",
			name: "DeepSeek-V4-Pro",
			api: "openai-completions",
			provider: "hyper",
			baseUrl: "https://hyper.charm.land/v1",
			reasoning: true,
			input: ["text"],
			contextWindow: 1_000_000,
			maxTokens: 384_000,
			cost: { input: 2.4, output: 4.8, cacheRead: 0.2, cacheWrite: 0 },
			thinking: {
				mode: "effort",
				efforts: [Effort.High, Effort.XHigh],
				defaultLevel: Effort.High,
			},
		});
	});

	it("leaves non-reasoning models without thinking metadata", async () => {
		const models = await runDiscovery();
		const gemma = models.find(model => model.id === "gemma-4-26b-a4b-it");
		expect(gemma?.reasoning).toBe(false);
		expect(gemma?.thinking).toBeUndefined();
		expect(gemma?.name).toBe("Gemma 4 26B A4B");
		expect(gemma?.maxTokens).toBe(25_600);
	});

	it("marks vision-capable models with image input", () => {
		const defaults: ModelSpec<"openai-completions"> = {
			id: "kimi-k2.6",
			name: "kimi-k2.6",
			api: "openai-completions",
			provider: "hyper",
			baseUrl: "https://hyper.charm.land/v1",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: null,
			maxTokens: null,
		};
		const mapped = mapHyperModel(
			{
				id: "kimi-k2.6",
				display_name: "Kimi K2.6",
				context_window: 262_000,
				max_output_tokens: 26_214,
				capabilities: { vision: true },
				pricing: { input: 0.95, output: 4, cache_create: 0.16, cache_hit: 0 },
			},
			defaults,
			undefined,
		);
		expect(mapped.input).toEqual(["text", "image"]);
		expect(mapped.thinking).toBeUndefined();
	});

	it("bundles the models.dev snapshot as an openai-completions fallback catalog", () => {
		const bundled = getBundledModels("hyper");
		expect(bundled.length).toBeGreaterThan(0);
		expect(bundled[0]?.provider).toBe("hyper");
		expect(bundled[0]?.api).toBe("openai-completions");
		expect(bundled.some(model => model.id === "deepseek-v4-pro")).toBe(true);
	});
});
