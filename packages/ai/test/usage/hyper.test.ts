import { describe, expect, it } from "bun:test";
import type { FetchImpl } from "@oh-my-pi/pi-ai/types";
import type { UsageFetchContext, UsageFetchParams } from "@oh-my-pi/pi-ai/usage";
import { hyperUsageProvider } from "@oh-my-pi/pi-ai/usage/hyper";

const CREDITS_URL = "https://hyper.charm.land/v1/credits";

function makeCredential(apiKey = "sk-hyper-test"): UsageFetchParams["credential"] {
	return { type: "api_key", apiKey };
}

function makeCtx(status: number, body: unknown, sink: { authorization?: string } = {}): UsageFetchContext {
	const fetch: FetchImpl = async (_input, init) => {
		sink.authorization = new Headers(init?.headers).get("Authorization") ?? undefined;
		return new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});
	};
	return { fetch };
}

describe("hyper usage provider", () => {
	it("rejects non-api_key credentials and other providers", () => {
		expect(hyperUsageProvider.supports!({ provider: "hyper", credential: makeCredential(), signal: undefined })).toBe(
			true,
		);
		expect(
			hyperUsageProvider.supports!({ provider: "hyper", credential: { type: "oauth" }, signal: undefined }),
		).toBe(false);
		expect(
			hyperUsageProvider.supports!({ provider: "openai", credential: makeCredential(), signal: undefined }),
		).toBe(false);
	});

	it("maps the Hypercredit balance to a credits-unit remaining limit", async () => {
		const sink: { authorization?: string } = {};
		const report = await hyperUsageProvider.fetchUsage!(
			{ provider: "hyper", credential: makeCredential(), signal: undefined },
			makeCtx(200, { balance: 92.5 }, sink),
		);

		expect(report).not.toBeNull();
		expect(report?.provider).toBe("hyper");
		expect(sink.authorization).toBe("Bearer sk-hyper-test");
		expect(report?.limits).toEqual([
			{
				id: "hyper:credits",
				label: "Hypercredits",
				scope: { provider: "hyper", shared: true },
				amount: { remaining: 92.5, unit: "credits" },
				status: "ok",
			},
		]);
	});

	it("marks a zero balance exhausted", async () => {
		const report = await hyperUsageProvider.fetchUsage!(
			{ provider: "hyper", credential: makeCredential(), signal: undefined },
			makeCtx(200, { balance: 0 }),
		);
		expect(report?.limits[0]?.status).toBe("exhausted");
	});

	it("returns null on auth failure without throwing", async () => {
		const report = await hyperUsageProvider.fetchUsage!(
			{ provider: "hyper", credential: makeCredential(), signal: undefined },
			makeCtx(401, { error: { message: "invalid api key" } }),
		);
		expect(report).toBeNull();
	});

	it("returns null on a non-JSON body without throwing", async () => {
		const fetch: FetchImpl = async () => new Response("<html>", { status: 200 });
		const report = await hyperUsageProvider.fetchUsage!(
			{ provider: "hyper", credential: makeCredential(), signal: undefined },
			{ fetch },
		);
		expect(report).toBeNull();
	});
});
