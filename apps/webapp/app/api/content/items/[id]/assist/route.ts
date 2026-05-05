import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { assistContentItem } from "@/lib/content/assist";
import { requireApiContext } from "@/lib/auth/api";
import { resolveInstructionContext } from "@/lib/ai/instructions";
import { getOpenAIForWorkspace, hasAssemblyAiProvider } from "@/lib/ai/client";
import { getAuditLabel } from "@/lib/audit/labels";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireApiContext("AI_CONTENT_ASSIST");
    if (!auth.ok) return auth.response;
    const prisma = getPrismaClient();
    const workspaceKey = await prisma.workspaceApiKey.findUnique({
      where: { workspaceId: auth.context.workspaceId },
    });
    if (!hasAssemblyAiProvider(Boolean(workspaceKey?.apiKeyCipher))) {
      return NextResponse.json(
        { ok: false, validation: { ok: false, errors: [{ code: "ai_missing", message: "AI assist not configured.", hint: "Set OPENAI_API_KEY, OPENAI_BASE_URL, or ASSEMBLY_LOCAL_AI_BASE_URL to enable." }], warnings: [] } },
        { status: 400 },
      );
    }

    const resolved = await params;
    const body = await request.json();
    const mode = body?.mode as "sanitize" | "structure" | "summarize";
    const apply = Boolean(body?.apply);

    if (!mode) {
      return NextResponse.json(
        { ok: false, validation: { ok: false, errors: [{ code: "assist_mode_required", message: "mode is required." }], warnings: [] } },
        { status: 400 },
      );
    }

    const item = await prisma.contentItem.findFirst({
      where: { id: resolved.id, workspaceId: auth.context.workspaceId },
    });
    if (!item) {
      return NextResponse.json(
        { ok: false, validation: { ok: false, errors: [{ code: "content_missing", message: "Content item not found." }], warnings: [] } },
        { status: 404 },
      );
    }

    if (apply) {
      const suggested = body?.suggested as {
        title?: string;
        summary?: string;
        body?: string;
        structured?: unknown;
      };
      if (!suggested) {
        return NextResponse.json(
          { ok: false, validation: { ok: false, errors: [{ code: "assist_missing_payload", message: "suggested payload required for apply." }], warnings: [] } },
          { status: 400 },
        );
      }
      const updated = await prisma.contentItem.update({
        where: { id: item.id },
        data: {
          title: suggested.title ?? item.title,
          summary: suggested.summary ?? item.summary,
          body: suggested.body ?? item.body,
          structured: (suggested.structured as never) ?? item.structured,
        },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.context.workspaceId,
          actor: "system:content_ops",
          actorUserId: auth.context.user.id,
          action: "content_assist_applied",
          actionLabel: getAuditLabel("content_assist_applied"),
          entityType: "ContentItem",
          entityId: item.id,
          note: `AI assist applied (${mode}).`,
        },
      });
      return NextResponse.json({ ok: true, item: updated });
    }

    const instructionContext = await resolveInstructionContext({
      workspaceId: auth.context.workspaceId,
      userId: auth.context.user.id,
      context: [`Mode: ${mode}`, `Content type: ${item.type}`],
    });
    const openai = await getOpenAIForWorkspace(auth.context.workspaceId);
    const suggested = await assistContentItem(item, mode, instructionContext, openai);
    await prisma.auditLog.create({
      data: {
        workspaceId: auth.context.workspaceId,
        actor: "system:content_ops",
        actorUserId: auth.context.user.id,
        action: "content_assist_suggested",
        actionLabel: getAuditLabel("content_assist_suggested"),
        entityType: "ContentItem",
        entityId: item.id,
        note: `AI assist suggested (${mode}).`,
      },
    });

    return NextResponse.json({
      ok: true,
      suggested,
      preview: {
        before: {
          title: item.title,
          summary: item.summary,
          body: item.body,
          structured: item.structured,
        },
        after: suggested,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI assist failed.";
    return NextResponse.json(
      { ok: false, validation: { ok: false, errors: [{ code: "assist_failed", message }], warnings: [] } },
      { status: 400 },
    );
  }
}
