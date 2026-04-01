// lib/api/rateLimit.ts
// ============================================================
// Rate Limiting for API Routes with per-endpoint configuration
// Uses in-memory store (replace with Redis for production scale)
// Returns rate limit headers for client-side handling
// ============================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Rate Limit Store (in-memory for v1)
// ============================================================
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const keyRateLimitStore = new Map<string, RateLimitEntry>();

// ============================================================
// Configuration
// ============================================================
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const defaultConfig: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
};

const strictConfig: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

// ============================================================
// Per-endpoint rate limit presets
// ============================================================
export const ENDPOINT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  password_reset: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  messaging: { maxRequests: 50, windowMs: 60 * 60 * 1000 },
  report_generation: { maxRequests: 20, windowMs: 60 * 60 * 1000 },
  payment: { maxRequests: 10, windowMs: 60 * 1000 },
  file_upload: { maxRequests: 30, windowMs: 60 * 60 * 1000 },
  default: { maxRequests: 100, windowMs: 60 * 1000 },
};

// ============================================================
// Get Client Identifier
// ============================================================
function getClientIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

// ============================================================
// Check Rate Limit
// ============================================================
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = defaultConfig,
  userId?: string,
): RateLimitResult {
  const key = getClientIdentifier(request, userId);
  const now = Date.now();

  // Get or create entry
  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Create new window
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
      limit: config.maxRequests,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  };
}

// ============================================================
// Apply rate limit headers to response
// ============================================================
export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    response.headers.set("Retry-After", String(Math.ceil((result.resetAt - Date.now()) / 1000)));
  }

  return response;
}

// ============================================================
// Rate Limit Presets
// ============================================================
export function checkLoginRateLimit(request: NextRequest): RateLimitResult {
  return checkRateLimit(request, ENDPOINT_RATE_LIMITS.login);
}

export function checkPasswordResetRateLimit(
  request: NextRequest,
): RateLimitResult {
  return checkRateLimit(request, ENDPOINT_RATE_LIMITS.password_reset);
}

export function checkMessageRateLimit(
  request: NextRequest,
  userId: string,
): RateLimitResult {
  return checkRateLimit(request, ENDPOINT_RATE_LIMITS.messaging, userId);
}

export function checkReportGenerationRateLimit(
  request: NextRequest,
  userId: string,
): RateLimitResult {
  return checkRateLimit(request, ENDPOINT_RATE_LIMITS.report_generation, userId);
}

export function checkPaymentRateLimit(
  request: NextRequest,
  userId: string,
): RateLimitResult {
  return checkRateLimit(request, ENDPOINT_RATE_LIMITS.payment, userId);
}

export function checkFileUploadRateLimit(
  request: NextRequest,
  userId: string,
): RateLimitResult {
  return checkRateLimit(request, ENDPOINT_RATE_LIMITS.file_upload, userId);
}

// ============================================================
// Cleanup old entries (run periodically)
// ============================================================
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
  for (const [key, entry] of keyRateLimitStore.entries()) {
    if (now > entry.resetAt) {
      keyRateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

// ============================================================
// Legacy key-based rate limiter compatibility
// ============================================================
export function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = keyRateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    keyRateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count += 1;
  keyRateLimitStore.set(key, entry);

  if (entry.count <= maxRequests) {
    return { allowed: true, retryAfter: 0 };
  }

  return {
    allowed: false,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}
