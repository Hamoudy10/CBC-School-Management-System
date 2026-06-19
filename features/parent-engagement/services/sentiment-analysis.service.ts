import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { SentimentResult } from "../types";

const sentimentOutputSchema = z.object({
  overallSentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  sentimentScore: z.number().min(-1).max(1),
  messageLevel: z.array(
    z.object({
      messageId: z.string(),
      sentiment: z.enum(["positive", "neutral", "negative"]),
      score: z.number().min(-1).max(1),
      keyPhrases: z.array(z.string()),
      flaggedIssues: z.array(z.string()).optional(),
    })
  ),
  trends: z.object({
    direction: z.enum(["improving", "declining", "stable"]),
    description: z.string(),
  }),
  recommendations: z.array(z.string()),
  requiresAttention: z.boolean(),
});

export async function analyzeParentSentiment(
  messages: { id: string; text: string; sender: string; timestamp: string }[],
  schoolId: string
): Promise<SentimentResult> {
  try {
    const ai = await generateGroqCompletion<z.infer<typeof sentimentOutputSchema>>({
      system: `You are a communication sentiment analyst for a Kenyan CBC school.
Analyze parent-teacher communication messages and detect sentiment patterns.
Identify concerns, positive engagement, and areas needing attention.
Return JSON only.`,
      prompt: `Analyze the sentiment of these ${messages.length} parent-teacher communication messages:

${JSON.stringify(messages, null, 2)}

For each message determine:
- sentiment: positive, neutral, or negative
- score: -1 (very negative) to +1 (very positive)
- keyPhrases: important phrases that indicate sentiment
- flaggedIssues: any concerns raised

Then determine overall sentiment, trends, and recommendations.

Rules:
- Look for patterns across multiple messages
- Flag concerns about academics, behavior, fees, or well-being
- Note when parents express appreciation or satisfaction
- Recommend specific actions for concerning patterns
- Set requiresAttention=true if any message has negative sentiment with actionable concerns`,
      responseFormat: "json",
      temperature: 0.2,
      responseSchema: sentimentOutputSchema,
      requestLabel: "parent-engagement.sentiment",
      cache: false,
    });

    return sentimentOutputSchema.parse(ai.data);
  } catch (error) {
    logger.warn("AI sentiment analysis failed, using rule-based fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    const positiveWords = [
      "thank", "great", "good", "excellent", "happy", "appreciate", "wonderful",
      "pleased", "helpful", "thanks", "grateful", "love", "best", "amazing",
    ];
    const negativeWords = [
      "concern", "issue", "problem", "worried", "upset", "unhappy", "dissatisfied",
      "complaint", "frustrated", "angry", "disappointed", "poor", "fail", "bad",
    ];

    const messageLevel = messages.map((msg) => {
      const lower = msg.text.toLowerCase();
      const posCount = positiveWords.filter((w) => lower.includes(w)).length;
      const negCount = negativeWords.filter((w) => lower.includes(w)).length;
      const netScore = Math.max(-1, Math.min(1, (posCount - negCount) / Math.max(msg.text.split(" ").length, 1) * 10));

      let sentiment: "positive" | "neutral" | "negative";
      if (netScore > 0.1) sentiment = "positive";
      else if (netScore < -0.1) sentiment = "negative";
      else sentiment = "neutral";

      const keyPhrases: string[] = [];
      if (netScore > 0) keyPhrases.push("Positive engagement");
      if (netScore < 0) keyPhrases.push("Potential concern");

      const flaggedIssues: string[] = [];
      if (lower.includes("fee") || lower.includes("money") || lower.includes("payment"))
        flaggedIssues.push("Financial concern");
      if (lower.includes("bully") || lower.includes("behavior") || lower.includes("fight"))
        flaggedIssues.push("Behavioral concern");
      if (lower.includes("grade") || lower.includes("score") || lower.includes("mark"))
        flaggedIssues.push("Academic concern");

      return {
        messageId: msg.id,
        sentiment,
        score: Math.round(netScore * 100) / 100,
        keyPhrases,
        flaggedIssues: flaggedIssues.length > 0 ? flaggedIssues : undefined,
      };
    });

    const scores = messageLevel.map((m) => m.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const hasNegative = messageLevel.some((m) => m.sentiment === "negative");
    const hasPositive = messageLevel.some((m) => m.sentiment === "positive");

    let overallSentiment: "positive" | "neutral" | "negative" | "mixed";
    if (hasNegative && hasPositive) overallSentiment = "mixed";
    else if (hasNegative) overallSentiment = "negative";
    else if (hasPositive) overallSentiment = "positive";
    else overallSentiment = "neutral";

    const recentScores = messageLevel.slice(-3).map((m) => m.score);
    const avgRecent =
      recentScores.length > 0
        ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
        : avgScore;

    const trendDirection =
      avgRecent > avgScore + 0.1
        ? "improving"
        : avgRecent < avgScore - 0.1
        ? "declining"
        : "stable";

    const recommendations: string[] = [];
    if (hasNegative) recommendations.push("Address parent concerns promptly");
    if (overallSentiment === "mixed") recommendations.push("Follow up on specific concerns while acknowledging positive feedback");
    if (messageLevel.some((m) => m.flaggedIssues?.includes("Financial concern"))) recommendations.push("Discuss fee payment options with parent");
    if (messageLevel.some((m) => m.flaggedIssues?.includes("Behavioral concern"))) recommendations.push("Schedule meeting to discuss behavior concerns");
    if (overallSentiment === "positive") recommendations.push("Maintain positive engagement and provide regular updates");

    return {
      overallSentiment,
      sentimentScore: Math.round(avgScore * 100) / 100,
      messageLevel,
      trends: {
        direction: trendDirection,
        description: `Communication sentiment is ${trendDirection} with ${overallSentiment} overall tone.`,
      },
      recommendations:
        recommendations.length > 0
          ? recommendations
          : ["Continue regular communication with parent"],
      requiresAttention: hasNegative,
    };
  }
}
