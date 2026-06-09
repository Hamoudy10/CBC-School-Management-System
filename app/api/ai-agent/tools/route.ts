import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse } from "@/lib/api/response";
import { getAvailableToolsForUser, getToolNamesForUser } from "@/features/ai-agent/services/tool-registry.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: NextRequest, { user }: any) => {
  const tools = getAvailableToolsForUser(user);
  const toolList = tools.map((t) => ({
    name: t.name,
    description: t.description,
    module: t.module,
    action: t.action,
    riskLevel: t.riskLevel,
  }));

  return successResponse({
    tools: toolList,
    toolNames: getToolNamesForUser(user),
    totalTools: toolList.length,
  });
});
