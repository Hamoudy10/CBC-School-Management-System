// __tests__/lib/rateLimit.test.ts
// ============================================================
// Unit tests for Rate Limiting utility
// Tests rate limit checking, window reset, and header generation
// ============================================================

import { describe, it, expect, beforeEach } from "@jest/globals";
import { checkRateLimit, rateLimit, cleanupRateLimitStore } from "@/lib/api/rateLimit";

// Mock NextRequest
function createMockRequest(ip?: string) {
  return {
    headers: {
      get: (key: string) => (key === "x-forwarded-for" ? ip : null),
    },
  } as any;
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    cleanupRateLimitStore();
  });

  it("allows requests within limit", () => {
    const request = createMockRequest("192.168.1.1");
    const result = checkRateLimit(request, { maxRequests: 5, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("blocks requests after limit exceeded", () => {
    const request = createMockRequest("192.168.1.2");
    const config = { maxRequests: 3, windowMs: 60000 };

    checkRateLimit(request, config);
    checkRateLimit(request, config);
    const result = checkRateLimit(request, config);

    expect(result.allowed).toBe(true); // 3rd request is still allowed
    expect(result.remaining).toBe(0);

    const blocked = checkRateLimit(request, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks different IPs separately", () => {
    const request1 = createMockRequest("192.168.1.10");
    const request2 = createMockRequest("192.168.1.20");
    const config = { maxRequests: 2, windowMs: 60000 };

    checkRateLimit(request1, config);
    checkRateLimit(request1, config);
    const result1 = checkRateLimit(request1, config);

    const result2 = checkRateLimit(request2, config);

    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
  });

  it("uses userId when provided", () => {
    const request = createMockRequest("192.168.1.1");
    const config = { maxRequests: 2, windowMs: 60000 };

    checkRateLimit(request, config, "user-1");
    checkRateLimit(request, config, "user-1");
    const result = checkRateLimit(request, config, "user-1");

    expect(result.allowed).toBe(false);
  });

  it("resets after window expires", () => {
    const request = createMockRequest("192.168.1.3");
    const config = { maxRequests: 2, windowMs: 1 }; // 1ms window

    checkRateLimit(request, config);
    checkRateLimit(request, config);

    // Wait for window to expire
    const expired = checkRateLimit(request, config);

    expect(expired.allowed).toBe(true);
    expect(expired.remaining).toBe(1);
  });
});

describe("rateLimit (key-based)", () => {
  beforeEach(() => {
    cleanupRateLimitStore();
  });

  it("allows requests within limit", () => {
    const result = rateLimit("test-key", 3, 60);
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it("blocks after limit exceeded", () => {
    rateLimit("test-key-2", 2, 60);
    rateLimit("test-key-2", 2, 60);
    const result = rateLimit("test-key-2", 2, 60);

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("tracks different keys separately", () => {
    rateLimit("key-a", 1, 60);
    const resultA = rateLimit("key-a", 1, 60);
    const resultB = rateLimit("key-b", 1, 60);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });
});
