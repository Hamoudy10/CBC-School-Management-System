import type { Metadata } from "next";
import { AIAgentPage } from "@/features/ai-agent/components/AIAgentPage";

export const metadata: Metadata = {
  title: "AI Assistant",
};

export default function Page() {
  return <AIAgentPage />;
}
