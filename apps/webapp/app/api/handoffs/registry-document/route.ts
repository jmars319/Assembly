import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/auth/api";
import { createContentItem } from "@/lib/content/service";
import { registryDocumentRequestToProjectNote } from "@/lib/handoffs/registry";

export async function POST(request: Request) {
  try {
    const auth = await requireApiContext("CONTENT_OPS");
    if (!auth.ok) return auth.response;

    const handoff = registryDocumentRequestToProjectNote(await request.json());
    const result = await createContentItem(
      auth.context.workspaceId,
      {
        type: "PROJECT_NOTE",
        status: "DRAFT",
        title: handoff.title,
        summary: handoff.summary,
        rawInput: handoff.rawInput,
        structured: handoff.structured,
        source: "UPLOAD"
      },
      auth.context.user.id
    );

    if (!result.ok) {
      return NextResponse.json({ ok: false, validation: result.validation }, { status: 400 });
    }

    return NextResponse.json({ ok: true, item: result.item, validation: result.validation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registry document handoff failed.";
    return NextResponse.json(
      { ok: false, validation: { ok: false, errors: [{ code: "registry_document_handoff_failed", message }], warnings: [] } },
      { status: 400 }
    );
  }
}
