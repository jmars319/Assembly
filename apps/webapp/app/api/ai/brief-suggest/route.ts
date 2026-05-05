import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { generateBrief } from "@/lib/ai/generateBrief";
import { requireApiContext } from "@/lib/auth/api";
import { resolveInstructionContext, resolveStylePresetId } from "@/lib/ai/instructions";
import { getOpenAIForWorkspace, hasAssemblyAiProvider } from "@/lib/ai/client";

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
  const bundleId = typeof body?.bundleId === "string" ? body.bundleId : "";
  const stylePresetId = typeof body?.stylePresetId === "string" ? body.stylePresetId : undefined;

  if (!bundleId) {
    return NextResponse.json({ error: "bundleId is required." }, { status: 400 });
  }

  if (!("evidenceBundle" in prisma) || !("evidenceItem" in prisma)) {
    return NextResponse.json(
      { error: "Evidence tables not available. Run prisma generate and migrate." },
      { status: 500 }
    );
  }
  const bundle = await prisma.evidenceBundle.findUnique({
    where: { id: bundleId },
    include: { items: true },
  });
  if (!bundle) {
    return NextResponse.json({ error: "Evidence bundle not found." }, { status: 404 });
  }
  if (bundle.workspaceId !== context.workspaceId) {
    return NextResponse.json({ error: "Evidence bundle not found." }, { status: 404 });
  }

  const fullCoverage = await prisma.evidenceBundle.findFirst({
    where: { repoId: bundle.repoId, scope: "FULL", workspaceId: context.workspaceId },
  });

  const resolvedStylePresetId = await resolveStylePresetId({
    workspaceId: context.workspaceId,
    userId: context.user.id,
    stylePresetId,
  });
  const repo = await prisma.repoAccess.findFirst({
    where: { id: bundle.repoId, workspaceId: context.workspaceId },
  });
  const instructionContext = await resolveInstructionContext({
    workspaceId: context.workspaceId,
    userId: context.user.id,
    stylePresetId: resolvedStylePresetId,
    orgTag: repo?.projectTag,
    context: [`Repo: ${bundle.repoFullName}`],
  });

  const openai = await getOpenAIForWorkspace(context.workspaceId);
  const text = await generateBrief({
    repoFullName: bundle.repoFullName,
    items: bundle.items.map((item) => ({
      type: item.type,
      title: item.title,
      body: item.body,
      url: item.url,
      occurredAt: item.occurredAt.toISOString(),
      content: item.content,
    })),
    coverage: {
      scope: bundle.scope,
      scopeValue: bundle.scopeValue,
      scopePage: bundle.scopePage,
      autoSelected: bundle.autoSelected,
      fullCoverageComplete: Boolean(fullCoverage),
    },
    instructionContext,
    openai,
  });

  return NextResponse.json({ summary: text });
}
