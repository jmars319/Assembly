import { NextResponse } from "next/server";
import { generateBriefFromText } from "@/lib/ai/generateBriefFromText";
import { requireApiContext } from "@/lib/auth/api";
import { resolveInstructionContext, resolveStylePresetId } from "@/lib/ai/instructions";
import { getOpenAIForWorkspace, hasAssemblyAiProvider } from "@/lib/ai/client";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(request: Request) {
  if (process.env.STORAGE_MODE !== "db") {
    return NextResponse.json({ error: "Brief suggestion requires STORAGE_MODE=db." }, { status: 400 });
  }
  const auth = await requireApiContext("AI_BRIEFS");
  if (!auth.ok) return auth.response;
  const { context } = auth as { context: { workspaceId: string; user: { id: string } } };
  const prisma = getPrismaClient();
  const workspaceKey = await prisma.workspaceApiKey.findUnique({
    where: { workspaceId: context.workspaceId },
  });
  const aiConfigured = hasAssemblyAiProvider(Boolean(workspaceKey?.apiKeyCipher));
  if (!aiConfigured) {
    return NextResponse.json({ error: "AI assist not configured." }, { status: 400 });
  }

  const body = await request.json();
  const promptText = typeof body?.promptText === "string" ? body.promptText.trim() : "";
  const stylePresetId = typeof body?.stylePresetId === "string" ? body.stylePresetId : undefined;
  if (!promptText) {
    return NextResponse.json({ error: "promptText is required." }, { status: 400 });
  }

  try {
    const resolvedStylePresetId = await resolveStylePresetId({
      workspaceId: context.workspaceId,
      userId: context.user.id,
      stylePresetId,
    });
    const instructionContext = await resolveInstructionContext({
      workspaceId: context.workspaceId,
      userId: context.user.id,
      stylePresetId: resolvedStylePresetId,
      context: ["General brief request"],
    });
    const openai = await getOpenAIForWorkspace(context.workspaceId);
    const summary = await generateBriefFromText({ promptText, instructionContext, openai });
    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Brief suggestion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
