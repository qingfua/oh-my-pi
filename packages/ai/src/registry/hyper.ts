import { createApiKeyLogin } from "./api-key-login";
import type { OAuthLoginCallbacks } from "./oauth/types";
import type { ProviderDefinition } from "./types";

export const loginHyper = createApiKeyLogin({
	providerLabel: "Charm Hyper",
	authUrl: "https://hyper.charm.land",
	instructions: "Create or copy your API key (sk-hyper-...) from the Hyper dashboard",
	promptMessage: "Paste your Hyper API key",
	placeholder: "sk-hyper-...",
	// Deliberately NOT /v1/models — that endpoint is public, so keying it would
	// accept garbage (200 either way). /v1/credits is authenticated and free.
	validation: {
		kind: "models-endpoint",
		provider: "hyper",
		modelsUrl: "https://hyper.charm.land/v1/credits",
	},
});

export const hyperProvider = {
	id: "hyper",
	name: "Charm Hyper",
	login: (cb: OAuthLoginCallbacks) => loginHyper(cb),
} as const satisfies ProviderDefinition;
