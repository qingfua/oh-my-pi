import type { UsageFetchContext, UsageFetchParams, UsageLimit, UsageProvider, UsageReport } from "../usage";
import { isRecord } from "../utils";

const PROVIDER = "hyper";
const CREDITS_URL = "https://hyper.charm.land/v1/credits";

/**
 * Fetches the team's Hypercredit balance (`GET /v1/credits`). Hypercredits are
 * Charm Hyper's own unit of account (every user gets 100/month free); the
 * balance is a remaining-only amount with no used/limit, unit "credits".
 */
async function fetchHyperUsage(params: UsageFetchParams, ctx: UsageFetchContext): Promise<UsageReport | null> {
	if (params.provider !== PROVIDER) return null;
	const credential = params.credential;
	if (credential.type !== "api_key" || !credential.apiKey) return null;

	let payload: unknown;
	try {
		const response = await ctx.fetch(CREDITS_URL, {
			headers: { Authorization: `Bearer ${credential.apiKey}` },
			signal: params.signal,
		});
		if (!response.ok) {
			ctx.logger?.warn("Hyper usage fetch failed", { status: response.status });
			return null;
		}
		payload = await response.json();
	} catch (error) {
		ctx.logger?.warn("Hyper usage fetch error", { error: String(error) });
		return null;
	}

	if (!isRecord(payload) || typeof payload.balance !== "number" || !Number.isFinite(payload.balance)) {
		ctx.logger?.warn("Hyper usage response invalid", { payload });
		return null;
	}

	const balance = payload.balance;
	const limit: UsageLimit = {
		id: "hyper:credits",
		label: "Hypercredits",
		scope: { provider: params.provider, shared: true },
		amount: { remaining: balance, unit: "credits" },
		status: balance > 0 ? "ok" : "exhausted",
	};

	return {
		provider: params.provider,
		fetchedAt: Date.now(),
		limits: [limit],
	};
}

export const hyperUsageProvider: UsageProvider = {
	id: PROVIDER,
	fetchUsage: fetchHyperUsage,
	supports: params =>
		params.provider === PROVIDER && params.credential.type === "api_key" && !!params.credential.apiKey,
	validatesCredentials: true,
};
