import { openRouterProvider } from "./openrouter.client";
import { groqProvider } from "./groq.client";
import type { AIProvider, AIProviderName } from "./types";

const providerMap: Record<AIProviderName, AIProvider> = {
  openrouter: openRouterProvider,
  groq: groqProvider,
};

const defaultProvider: AIProviderName =
  (process.env.AI_PROVIDER as AIProviderName) ?? "openrouter";

export function getProvider(name?: AIProviderName): AIProvider {
  const providerName = name ?? defaultProvider;
  const provider = providerMap[providerName];
  if (!provider) {
    throw new Error(`Unknown AI provider: ${providerName}. Available: ${Object.keys(providerMap).join(", ")}`);
  }
  return provider;
}

export { openRouterProvider, groqProvider };
export type { AIProvider, AIProviderName };
export { AIProviderError } from "./types";
