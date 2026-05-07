import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/auth/api";
import { createContentItem } from "@/lib/content/service";
import { getAuditLabel } from "@/lib/audit/labels";
import { scoutOpportunityToProjectNote } from "@/lib/handoffs/scout";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const auth = await requireApiContext("CONTENT_OPS");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const dryRun = Boolean(body?.dryRun);
    const handoff = scoutOpportunityToProjectNote(dryRun ? body.payload : body);
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        preview: {
          title: handoff.title,
          summary: handoff.summary,
          project: handoff.project,
          relatedSlugs: handoff.relatedSlugs,
          topics: handoff.topics,
          aiMeta: handoff.aiMeta
        },
        validation: { ok: true, errors: [], warnings: [] }
      });
    }

    const prisma = getPrismaClient();
    const project = await prisma.project.upsert({
      where: {
        workspaceId_tag: {
          workspaceId: auth.context.workspaceId,
          tag: handoff.project.tag
        }
      },
      create: {
        workspaceId: auth.context.workspaceId,
        name: handoff.project.name,
        tag: handoff.project.tag
      },
      update: {
        name: handoff.project.name
      }
    });
    const result = await createContentItem(
      auth.context.workspaceId,
      {
        type: "PROJECT_NOTE",
        status: "DRAFT",
        title: handoff.title,
        summary: handoff.summary,
        rawInput: handoff.rawInput,
        structured: handoff.structured,
        relatedSlugs: handoff.relatedSlugs,
        topics: handoff.topics,
        aiMeta: {
          ...handoff.aiMeta,
          projectId: project.id,
          projectTag: project.tag
        },
        source: "UPLOAD"
      },
      auth.context.user.id
    );

    if (!result.ok) {
      return NextResponse.json({ ok: false, validation: result.validation }, { status: 400 });
    }

    await prisma.auditLog.create({
      data: {
        actor: "system",
        actorUserId: auth.context.user.id,
        action: "SCOUT_OPPORTUNITY_IMPORTED",
        actionLabel: getAuditLabel("SCOUT_OPPORTUNITY_IMPORTED"),
        entityType: "Project",
        entityId: project.id,
        workspaceId: auth.context.workspaceId,
        metadata: {
          projectTag: project.tag,
          contentItemId: result.item?.id,
          source: "scout-opportunity-handoff"
        }
      }
    });

    return NextResponse.json({ ok: true, item: result.item, project, validation: result.validation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scout opportunity handoff failed.";
    return NextResponse.json(
      { ok: false, validation: { ok: false, errors: [{ code: "scout_opportunity_handoff_failed", message }], warnings: [] } },
      { status: 400 }
    );
  }
}
