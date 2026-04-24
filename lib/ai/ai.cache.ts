import { createHash } from "crypto";
import { createSupabaseServerClient } from "../supabase/server";
import { logger } from "../logger";

type CacheEntry = {
  expiryMs: number;
  payload: unknown;
};

const MEMORY_CACHE_MAX_ITEMS = 500;
const memoryCache = new Map<string, CacheEntry>();

function pruneMemoryCache() {
  const now = Date.now();

  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiryMs <= now) {
      memoryCache.delete(key);
    }
  }

  if (memoryCache.size <= MEMORY_CACHE_MAX_ITEMS) {
    return;
  }

  const oldest = [...memoryCache.entries()]
    .sort((left, right) => left[1].expiryMs - right[1].expiryMs)
    .slice(0, memoryCache.size - MEMORY_CACHE_MAX_ITEMS);

  for (const [key] of oldest) {
    memoryCache.delete(key);
  }
}

type BuildAICacheHashParams = {
  prompt: string;
  system: string;
  model: string;
  responseFormat: "json" | "text";
  temperature: number;
  schoolId?: string | null;
  classId?: string | null;
  subject?: string | null;
};

export function buildAICacheHash(input: BuildAICacheHashParams): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prompt: input.prompt,
        system: input.system,
        model: input.model,
        responseFormat: input.responseFormat,
        temperature: input.temperature,
        schoolId: input.schoolId ?? null,
        classId: input.classId ?? null,
        subject: input.subject ?? null,
      }),
    )
    .digest("hex");
}

export async function getAICache<T>(hash: string): Promise<T | null> {
  pruneMemoryCache();

  const existing = memoryCache.get(hash);
  if (existing && existing.expiryMs > Date.now()) {
    return existing.payload as T;
  }

  if (existing) {
    memoryCache.delete(hash);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("ai_cache")
      .select("response, expiry")
      .eq("hash", hash)
      .gt("expiry", nowIso)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const expiryMs = new Date(data.expiry as string).getTime();
    if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
      return null;
    }

    memoryCache.set(hash, {
      payload: data.response,
      expiryMs,
    });

    return data.response as T;
  } catch (error) {
    logger.debug("AI cache read skipped", {
      source: "ai.cache",
      error: error instanceof Error ? error.message : "Unknown cache read error",
    });
    return null;
  }
}

type SetAICacheParams = {
  hash: string;
  payload: unknown;
  ttlSeconds?: number;
  schoolId?: string | null;
  classId?: string | null;
  subject?: string | null;
};

export async function setAICache({
  hash,
  payload,
  ttlSeconds = Number(process.env.AI_CACHE_TTL_SECONDS ?? 60 * 60 * 6),
  schoolId,
  classId,
  subject,
}: SetAICacheParams): Promise<void> {
  const expiryMs = Date.now() + Math.max(60, ttlSeconds) * 1000;
  const expiryIso = new Date(expiryMs).toISOString();

  memoryCache.set(hash, {
    payload,
    expiryMs,
  });
  pruneMemoryCache();

  try {
    const supabase = await createSupabaseServerClient();

    const row = {
      hash,
      response: payload,
      expiry: expiryIso,
      school_id: schoolId ?? null,
      class_id: classId ?? null,
      subject: subject ?? null,
    };

    const { error } = await supabase.from("ai_cache").upsert(row, {
      onConflict: "hash",
      ignoreDuplicates: false,
    });

    if (!error) {
      return;
    }

    // Fallback for environments where only core columns exist.
    await supabase.from("ai_cache").upsert(
      {
        hash,
        response: payload,
        expiry: expiryIso,
      },
      {
        onConflict: "hash",
        ignoreDuplicates: false,
      },
    );
  } catch (error) {
    logger.debug("AI cache write skipped", {
      source: "ai.cache",
      error: error instanceof Error ? error.message : "Unknown cache write error",
    });
  }
}
