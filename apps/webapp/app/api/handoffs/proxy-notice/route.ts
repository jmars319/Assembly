import { NextResponse } from "next/server";
import type { AssemblyProxyNoticeHandoff } from "@assembly/shared-types/handoffs";
import { requireApiContext } from "@/lib/auth/api";
import { getContentItem, updateContentItem } from "@/lib/content/service";

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
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : process.env.ASSEMBLY_PROXY_SHAPE_URL;
    const deliver = body?.deliver === true;
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

    if (!deliver) {
      return NextResponse.json({ ok: true, delivered: false, handoff: payload });
    }

    if (!endpoint) {
      return NextResponse.json({
        ok: true,
        delivered: false,
        deliveryMode: "json-fallback",
        handoff: payload,
        error: "ASSEMBLY_PROXY_SHAPE_URL is not configured."
      });
    }

    const proxyResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.proxyShapeRequest)
    });

    if (!proxyResponse.ok) {
      return NextResponse.json({
        ok: true,
        delivered: false,
        deliveryMode: "json-fallback",
        handoff: payload,
        error: await proxyResponse.text()
      });
    }

    const proxyBody = (await proxyResponse.json().catch(() => ({}))) as {
      result?: { text?: string };
      text?: string;
    };
    const shapedText = proxyBody.result?.text ?? proxyBody.text ?? "";
    const proxyMeta = {
      proxyDelivery: {
        deliveredAt: new Date().toISOString(),
        endpoint,
        traceId: payload.proxyShapeRequest.traceId,
        shapedText
      }
    };

    await updateContentItem(auth.context.workspaceId, item.id, {
      body: shapedText ? `${draftText}\n\n## Proxy shaped output\n\n${shapedText}` : draftText,
      aiMeta:
        item.aiMeta && typeof item.aiMeta === "object" && !Array.isArray(item.aiMeta)
          ? { ...item.aiMeta, ...proxyMeta }
          : proxyMeta,
      actorUserId: auth.context.user.id
    });

    return NextResponse.json({
      ok: true,
      delivered: true,
      deliveryMode: "direct-post",
      handoff: payload,
      proxy: proxyBody
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assembly Proxy handoff failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
