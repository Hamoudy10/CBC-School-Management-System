import {
  DEFAULT_AI_TIMEOUT_MS,
  clampTemperature,
  enforceOutputTokenLimit,
  enforcePromptLimit,
  safeJsonParse,
  sleep,
} from "@/lib/ai/ai.guard";
import { buildAICacheHash, getAICache, setAICache } from "@/lib/ai/ai.cache";
import { logAIEvent } from "@/lib/ai/ai.logger";
import { AIProviderError, type AIProvider, type AIProviderRequest, type AIProviderResponse } from "./types";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL_FAST = process.env.DEEPSEEK_MODEL_FAST ?? "deepseek/deepseek-v4-flash";
const DEFAULT_MODEL_REASONING = process.env.DEEPSEEK_MODEL_REASONING ?? "deepseek/deepseek-v4-pro";
const MAX_RETRIES = 2;

function getApiKey(): string {
  return process.env.DEEPSEEK_API_KEY ?? "";
}

function resolveModel(model?: string, highRisk?: boolean): string {
  if (model) return model;
  if (highRisk) return DEFAULT_MODEL_REASONING;
  return DEFAULT_MODEL_FAST;
}

type DeepSeekCompletionPayload = {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

async function deepSeekGenerate<TJson>(
  request: AIProviderRequest<TJson>,
  highRisk?: boolean,
): Promise<AIProviderResponse<TJson | string>> {
  const startedAt = Date.now();
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new AIProviderError("DeepSeek API key not configured (DEEPSEEK_API_KEY).", {
      provider: "deepseek",
    });
  }

  const responseFormat = request.responseFormat ?? "json";
  const model = resolveModel(request.model, highRisk);
  const temperature = clampTemperature(request.temperature);
  const maxTokens = enforceOutputTokenLimit(request.maxOutputTokens);
  const timeoutMs = Math.max(5_000, Number(process.env.AI_REQUEST_TIMEOUT_MS ?? DEFAULT_AI_TIMEOUT_MS));
  const promptGuard = enforcePromptLimit(request.prompt);
  const warnings: string[] = [];

  if (promptGuard.warning) warnings.push(promptGuard.warning);

  const cacheConfig = request.cache === false ? null : request.cache ?? {};
  const cacheHash = cacheConfig
    ? buildAICacheHash({
        prompt: promptGuard.prompt,
        system: request.system,
        model,
        responseFormat,
        temperature,
        schoolId: cacheConfig.schoolId,
        classId: cacheConfig.classId,
        subject: cacheConfig.subject,
      })
    : null;

  if (cacheHash) {
    const cached = await getAICache<TJson | string>(cacheHash);
    if (cached !== null) {
      return {
        success: true,
        data: cached,
        confidence: 0.95,
        warnings: [...warnings, "Response served from AI cache."],
        meta: { model, attempts: 0, durationMs: Date.now() - startedAt, cached: true },
      };
    }
  }

  let lastError: AIProviderError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const attemptStartedAt = Date.now();

    try {
      const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: promptGuard.prompt },
          ],
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const bodyText = await response.text();
        throw new AIProviderError(
          `DeepSeek request failed (${response.status}): ${bodyText.slice(0, 500)}`,
          { statusCode: response.status, attempt, provider: "deepseek" },
        );
      }

      const payload = (await response.json()) as DeepSeekCompletionPayload;
      const rawText = payload.choices?.[0]?.message?.content?.trim();

      if (!rawText) {
        throw new AIProviderError("DeepSeek returned an empty completion.", {
          attempt,
          provider: "deepseek",
        });
      }

      const usage = {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens,
      };

      let data: TJson | string;
      if (responseFormat === "json") {
        const parsed = safeJsonParse<unknown>(rawText);
        if (!parsed.success) {
          throw new AIProviderError(
            `DeepSeek returned invalid JSON: ${(parsed as { success: false; error: string }).error}`,
            { attempt, provider: "deepseek" },
          );
        }
        if (request.responseSchema) {
          const validated = request.responseSchema.safeParse(parsed.data);
          if (!validated.success) {
            throw new AIProviderError(
              `DeepSeek JSON did not match schema: ${validated.error.issues.map((i) => i.message).join("; ")}`,
              { attempt, provider: "deepseek" },
            );
          }
          data = validated.data;
        } else {
          data = parsed.data as TJson;
        }
      } else {
        data = rawText;
      }

      if (cacheHash) {
        await setAICache({
          hash: cacheHash,
          payload: data,
          schoolId: cacheConfig?.schoolId,
          classId: cacheConfig?.classId,
          subject: cacheConfig?.subject,
          ttlSeconds: cacheConfig?.ttlSeconds,
        });
      }

      const durationMs = Date.now() - attemptStartedAt;
      await logAIEvent({
        requestLabel: request.requestLabel,
        model,
        schoolId: cacheConfig?.schoolId,
        prompt: promptGuard.prompt,
        response: rawText,
        success: true,
        cached: false,
        durationMs,
        usage,
        warnings: [],
      });

      const confidence = payload.choices?.[0]?.finish_reason === "stop" ? 0.9 : 0.8;

      return {
        success: true,
        data,
        confidence,
        warnings,
        meta: {
          model,
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          cached: false,
          usage,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError =
        error instanceof AIProviderError
          ? error
          : new AIProviderError(error instanceof Error ? error.message : "Unknown DeepSeek error", {
              attempt,
              provider: "deepseek",
            });

      if (attempt < MAX_RETRIES) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }
      break;
    }
  }

  const durationMs = Date.now() - startedAt;
  await logAIEvent({
    requestLabel: request.requestLabel,
    model,
    schoolId: cacheConfig?.schoolId,
    prompt: promptGuard.prompt,
    response: undefined,
    success: false,
    cached: false,
    durationMs,
    warnings: [],
    error: lastError?.message ?? "Unknown DeepSeek failure",
  });

  throw lastError ?? new AIProviderError("DeepSeek completion failed after retries.", { provider: "deepseek" });
}

export const deepSeekProvider: AIProvider = {
  name: "deepseek",
  generate: <TJson>(request: AIProviderRequest<TJson>) => {
    const isHighRisk =
      request.requestLabel.includes("high") ||
      request.requestLabel.includes("critical") ||
      request.requestLabel.includes("plan");
    return deepSeekGenerate(request, isHighRisk);
  },
};

export { DEFAULT_MODEL_FAST, DEFAULT_MODEL_REASONING };
