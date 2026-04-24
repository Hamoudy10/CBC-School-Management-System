import {
  DEFAULT_AI_TIMEOUT_MS,
  clampTemperature,
  enforceOutputTokenLimit,
  enforcePromptLimit,
  safeJsonParse,
  sleep,
} from "./ai.guard";
import { buildAICacheHash, getAICache, setAICache } from "./ai.cache";
import { logAIEvent } from "./ai.logger";
import { GroqCompletionError, type AIResponse, type AIResponseFormat, type GenerateGroqCompletionParams } from "./ai.types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const MAX_RETRIES = 3;

type GroqCompletionPayload = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type JsonCompletionParams<TJson> = GenerateGroqCompletionParams<TJson> & {
  responseFormat: "json";
};

type TextCompletionParams = GenerateGroqCompletionParams<string> & {
  responseFormat: "text";
};

export async function generateGroqCompletion<TJson>(
  params: JsonCompletionParams<TJson>,
): Promise<AIResponse<TJson>>;
export async function generateGroqCompletion(
  params: TextCompletionParams,
): Promise<AIResponse<string>>;
export async function generateGroqCompletion<TJson = Record<string, unknown>>(
  params: GenerateGroqCompletionParams<TJson>,
): Promise<AIResponse<TJson | string>> {
  const startedAt = Date.now();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new GroqCompletionError("Groq API key not configured (GROQ_API_KEY).");
  }

  const responseFormat: AIResponseFormat = params.responseFormat ?? "json";
  const model = params.model ?? DEFAULT_MODEL;
  const temperature = clampTemperature(params.temperature);
  const maxTokens = enforceOutputTokenLimit(params.maxOutputTokens);
  const timeoutMs = Math.max(5_000, params.timeoutMs ?? Number(process.env.AI_REQUEST_TIMEOUT_MS ?? DEFAULT_AI_TIMEOUT_MS));
  const promptGuard = enforcePromptLimit(params.prompt, params.maxPromptChars);
  const warnings: string[] = [];

  if (promptGuard.warning) {
    warnings.push(promptGuard.warning);
  }

  const cacheConfig = params.cache === false ? null : params.cache ?? {};
  const cacheHash = cacheConfig
    ? buildAICacheHash({
        prompt: promptGuard.prompt,
        system: params.system,
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
      const cachedWarnings = [...warnings, "Response served from AI cache."];

      return {
        success: true,
        data: cached,
        confidence: 0.95,
        warnings: cachedWarnings,
        meta: {
          model,
          attempts: 0,
          durationMs: Date.now() - startedAt,
          cached: true,
        },
      };
    }
  }

  let lastError: GroqCompletionError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const attemptStartedAt = Date.now();

    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: params.system,
            },
            {
              role: "user",
              content: promptGuard.prompt,
            },
          ],
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat === "json"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const bodyText = await response.text();
        throw new GroqCompletionError(
          `Groq request failed (${response.status}): ${bodyText.slice(0, 500)}`,
          {
            statusCode: response.status,
            attempt,
          },
        );
      }

      const payload = (await response.json()) as GroqCompletionPayload;
      const rawText = payload.choices?.[0]?.message?.content?.trim();

      if (!rawText) {
        throw new GroqCompletionError("Groq returned an empty completion.", {
          attempt,
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
           throw new GroqCompletionError(
             `Groq returned invalid JSON: ${(parsed as { success: false; error: string }).error}`,
             { attempt },
           );
         }

         if (params.responseSchema) {
           const validated = params.responseSchema.safeParse(parsed.data);
           if (!validated.success) {
             throw new GroqCompletionError(
               `Groq JSON did not match schema: ${(validated as { success: false; error: { issues: { message: string }[] } }).error.issues
                 .map((issue) => issue.message)
                 .join("; ")}`,
               { attempt },
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
        requestLabel: params.requestLabel,
        model,
        schoolId: cacheConfig?.schoolId,
        prompt: promptGuard.prompt,
        response: rawText,
        success: true,
        cached: false,
        durationMs,
        usage,
        warnings,
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
        error instanceof GroqCompletionError
          ? error
          : new GroqCompletionError(
              error instanceof Error ? error.message : "Unknown Groq completion error",
              { attempt },
            );

      if (attempt < MAX_RETRIES) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  await logAIEvent({
    requestLabel: params.requestLabel,
    model,
    schoolId: cacheConfig?.schoolId,
    prompt: promptGuard.prompt,
    response: undefined,
    success: false,
    cached: false,
    durationMs,
    warnings,
    error: lastError?.message ?? "Unknown Groq completion failure",
  });

  throw lastError ?? new GroqCompletionError("Groq completion failed after retries.");
}
