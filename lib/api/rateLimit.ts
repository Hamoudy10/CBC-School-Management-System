// lib/api/rateLimit.ts
// ============================================================
// Simple Rate Limiting for API Routes
// Uses in-memory store (replace with Redis for production scale)
// ============================================================

import { NextRequest } from "next/server";

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
  };
}

// ============================================================
// Rate Limit Presets
// ============================================================
export function checkLoginRateLimit(request: NextRequest): RateLimitResult {
  return checkRateLimit(request, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  });
}

export function checkPasswordResetRateLimit(
  request: NextRequest,
): RateLimitResult {
  return checkRateLimit(request, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  });
}

export function checkMessageRateLimit(
  request: NextRequest,
  userId: string,
): RateLimitResult {
  return checkRateLimit(
    request,
    {
      maxRequests: 50,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    userId,
  );
}

export function checkReportGenerationRateLimit(
  request: NextRequest,
  userId: string,
): RateLimitResult {
  return checkRateLimit(
    request,
    {
      maxRequests: 20,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    userId,
  );
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
