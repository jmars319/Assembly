import { NextResponse } from "next/server";
import type { AssemblyProxyNoticeHandoff } from "@assembly/shared-types/handoffs";
import { requireApiContext } from "@/lib/auth/api";
import { getContentItem } from "@/lib/content/service";

function getRegistryExportId(value: unknown): string | undefined {
  const sourceLink =
    value && typeof value === "object" && typeof (value as { sourceLink?: unknown }).sourceLink === "string"
      ? (value as { sourceLink: string }).sourceLink
      : "";

  return sourceLink.startsWith("registry-handoff:") ? sourceLink.replace("registry-handoff:", "") : undefined;
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiContext("CONTENT_OPS");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const contentItemId = typeof body?.contentItemId === "string" ? body.contentItemId : "";
    if (!contentItemId) {
      return NextResponse.json({ ok: false, error: "contentItemId is required." }, { status: 400 });
    }

    const item = await getContentItem(auth.context.workspaceId, contentItemId);
    if (!item) {
      return NextResponse.json({ ok: false, error: "Content item not found." }, { status: 404 });
    }

    const title = item.title ?? "Assembly notice handoff";
    const draftText = item.body || item.rawInput || item.summary || title;
    const sourceRegistryExportId = getRegistryExportId(item.structured);
    const exportedAt = new Date().toISOString();
    const payload: AssemblyProxyNoticeHandoff = {
      schema: "tenra-assembly.proxy-notice-handoff.v1",
      exportedAt,
      sourceApp: "assembly",
      contentItemId: item.id,
      title,
      draftText,
      sourceRegistryExportId,
      proxyShapeRequest: {
        clientApp: "assembly",
        surface: "internal-note",
        profileId: "profile:default",
        purpose: "Shape a Registry-backed Assembly notice before customer-facing review.",
        draftText,
        audience: "content operator",
        sourceArtifact: {
          schema: "tenra-registry.assembly-document-request.v1",
          artifactId: sourceRegistryExportId,
          exportedAt
        },
        hardConstraints: ["Do not publish directly", "Keep Registry source context visible"],
        traceId: `assembly-proxy-${item.id}`
      }
    };

    return NextResponse.json({ ok: true, handoff: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assembly Proxy handoff failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
