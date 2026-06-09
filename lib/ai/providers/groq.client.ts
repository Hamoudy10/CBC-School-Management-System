import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { AIProviderError, type AIProvider, type AIProviderRequest, type AIProviderResponse } from "./types";

const groqProvider: AIProvider = {
  name: "groq",
  generate: async <TJson>(request: AIProviderRequest<TJson>): Promise<AIProviderResponse<TJson | string>> => {
    try {
      const groqParams: any = {
        system: request.system,
        prompt: request.prompt,
        model: request.model,
        responseFormat: request.responseFormat,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        responseSchema: request.responseSchema,
        requestLabel: request.requestLabel,
        cache: request.cache,
      };
      const result = await generateGroqCompletion<TJson>(groqParams);

      return result as AIProviderResponse<TJson | string>;
    } catch (error) {
      throw new AIProviderError(
        error instanceof Error ? error.message : "Groq completion failed",
        { provider: "groq" },
      );
    }
  },
};

export { groqProvider };
