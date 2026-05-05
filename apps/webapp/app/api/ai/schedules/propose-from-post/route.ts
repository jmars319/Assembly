import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { generateScheduleProposal } from "@/lib/ai/generateScheduleProposal";
import { requireApiContext } from "@/lib/auth/api";
import { resolveInstructionContext } from "@/lib/ai/instructions";
import { getOpenAIForWorkspace, hasAssemblyAiProvider } from "@/lib/ai/client";
import { getAuditLabel } from "@/lib/audit/labels";

const fallbackDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  date.setHours(10, 0, 0, 0);
  return date;
};

export async function POST(request: Request) {
  if (process.env.STORAGE_MODE !== "db") {
    return NextResponse.json({ error: "Scheduling requires STORAGE_MODE=db." }, { status: 400 });
  }
  const auth = await requireApiContext("AI_SCHEDULER");
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
  const postId = typeof body?.postId === "string" ? body.postId : "";
  if (!postId) {
    return NextResponse.json({ error: "postId is required." }, { status: 400 });
  }

  try {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId: context.workspaceId },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const postJson =
      post.postJson && typeof post.postJson === "object" && !Array.isArray(post.postJson)
        ? (post.postJson as Record<string, unknown>)
        : null;
    const postText =
      typeof postJson?.text === "string"
        ? postJson.text
        : typeof postJson?.body === "string"
          ? postJson.body
          : "";

    const instructionContext = await resolveInstructionContext({
      workspaceId: context.workspaceId,
      userId: context.user.id,
      context: [`Platform: ${post.platform}`],
    });
    const openai = await getOpenAIForWorkspace(context.workspaceId);
    const suggestion = await generateScheduleProposal({
      postText: postText || post.title,
      platform: post.platform,
      instructionContext,
      openai,
    });

    const scheduledFor = new Date(suggestion.scheduledFor);
    const safeDate = Number.isNaN(scheduledFor.getTime()) ? fallbackDate() : scheduledFor;
    const channel = suggestion.channel?.trim() || post.platform;

    const schedule = await prisma.scheduleProposal.create({
      data: {
        workspaceId: context.workspaceId,
        projectId: post.projectId,
        status: "NEEDS_REVIEW",
        items: {
          create: {
            postId: post.id,
            channel,
            scheduledFor: safeDate,
          },
        },
      },
      include: { items: true },
    });

    await prisma.auditLog.create({
      data: {
        actor: "system:ai",
        action: "SCHEDULE_PROPOSED",
        actionLabel: getAuditLabel("SCHEDULE_PROPOSED"),
        entityType: "ScheduleProposal",
        entityId: schedule.id,
        workspaceId: context.workspaceId,
        metadata: {
          postId: post.id,
          channel,
          scheduledFor: safeDate.toISOString(),
          rationale: suggestion.rationale,
          assumptions: suggestion.assumptions,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      schedule: {
        id: schedule.id,
        status: schedule.status,
        items: schedule.items.map((item) => ({
          id: item.id,
          postId: item.postId,
          channel: item.channel,
          scheduledFor: item.scheduledFor.toISOString(),
        })),
      },
      suggestion: {
        rationale: suggestion.rationale,
        assumptions: suggestion.assumptions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI schedule proposal failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
