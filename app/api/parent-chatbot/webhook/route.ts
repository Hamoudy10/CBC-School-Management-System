export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateBody } from '@/lib/api/validation';
import { checkChatbotRateLimit, withRateLimitHeaders } from '@/lib/api/rateLimit';
import { chatbotWebhookSchema, handleChatbotQuery } from '@/features/parent-chatbot';

export async function POST(request: NextRequest) {
  const rateLimit = checkChatbotRateLimit(request);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { reply: 'Too many requests. Please try again later.', requires_human: false },
      { status: 429 },
    );
    return withRateLimitHeaders(response, rateLimit);
  }

  const validation = await validateBody(request, chatbotWebhookSchema);
  if (!validation.success) {
    const response = NextResponse.json({ error: validation.errors }, { status: 400 });
    return withRateLimitHeaders(response, rateLimit);
  }

  try {
    const result = await handleChatbotQuery(validation.data!);
    const response = NextResponse.json({ reply: result.reply, requires_human: result.requiresHuman });
    return withRateLimitHeaders(response, rateLimit);
  } catch (error) {
    const response = NextResponse.json(
      { reply: 'System error. Please try again later.', requires_human: true },
      { status: 500 },
    );
    return withRateLimitHeaders(response, rateLimit);
  }
}
