import { describe, expect, it, vi } from "bun:test";
import { loginHyper } from "@oh-my-pi/pi-ai/registry/hyper";
import type { OAuthController } from "@oh-my-pi/pi-ai/registry/oauth/types";
import type { FetchImpl } from "@oh-my-pi/pi-ai/types";

function makeController(paste: string, fetchMock: FetchImpl): OAuthController {
	return {
		onAuth: () => {},
		onPrompt: async () => paste,
		fetch: fetchMock,
	};
}

describe("loginHyper validation", () => {
	it("validates against GET /v1/credits and returns the trimmed key on 200", async () => {
		const calls: Array<{ url: string; method?: string; auth?: string | null }> = [];
		const fetchMock: FetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			const headers = new Headers(init?.headers ?? {});
			calls.push({ url, method: init?.method, auth: headers.get("authorization") });
			return new Response(JSON.stringify({ balance: 100 }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		});

		const key = await loginHyper(makeController("  sk-hyper-valid  ", fetchMock));

		expect(key).toBe("sk-hyper-valid");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(calls[0]?.url).toBe("https://hyper.charm.land/v1/credits");
		expect(calls[0]?.method ?? "GET").toBe("GET");
		expect(calls[0]?.auth).toBe("Bearer sk-hyper-valid");
	});

	it("throws a validation error when /v1/credits returns 401", async () => {
		const fetchMock: FetchImpl = vi.fn(
			async () => new Response("invalid api key", { status: 401, headers: { "Content-Type": "text/plain" } }),
		);

		await expect(loginHyper(makeController("sk-hyper-bad", fetchMock))).rejects.toThrow(/hyper.*401/i);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("rejects an empty paste before touching the network", async () => {
		const fetchMock: FetchImpl = vi.fn(async () => new Response("", { status: 200 }));

		await expect(loginHyper(makeController("   ", fetchMock))).rejects.toThrow(/API key is required/i);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
