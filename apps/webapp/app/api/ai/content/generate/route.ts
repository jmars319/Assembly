import { NextResponse } from "next/server";
import { createContentItem, attachContent } from "@/lib/content/service";
import { contentTypes } from "@/lib/content/types";
import { getStylePreset } from "@/lib/content/stylePresets";
import { ingestFiles, buildCombinedText } from "@/lib/content/ingest";
import { generateContentDraft, CONTENT_DRAFT_PROMPT_VERSION } from "@/lib/ai/generateContentDraft";
import { requireApiContext } from "@/lib/auth/api";
import { resolveInstructionContext, resolveStylePresetId } from "@/lib/ai/instructions";
import { getOpenAIForWorkspace, hasAssemblyAiProvider } from "@/lib/ai/client";
import { getPrismaClient } from "@/lib/prisma";

const getFiles = (formData: FormData) => {
  const files: File[] = [];
  const single = formData.get("file");
  if (single instanceof File) files.push(single);
  for (const entry of formData.getAll("files")) {
    if (entry instanceof File) files.push(entry);
  }
  return files;
};

export async function POST(request: Request) {
  if (process.env.STORAGE_MODE !== "db") {
    return NextResponse.json({ error: "AI draft requires STORAGE_MODE=db." }, { status: 400 });
  }
  const auth = await requireApiContext("AI_ASSIST");
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

  let type = "";
  let stylePresetId: string | undefined = undefined;
  let rawText = "";
  let format: "json" | "md" = "md";
  let files: File[] = [];

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    type = typeof formData.get("type") === "string" ? (formData.get("type") as string) : "";
    stylePresetId =
      typeof formData.get("stylePresetId") === "string"
        ? (formData.get("stylePresetId") as string)
        : undefined;
    rawText = typeof formData.get("rawText") === "string" ? (formData.get("rawText") as string) : "";
    format = formData.get("format") === "json" ? "json" : "md";
    files = getFiles(formData);
  } else {
    const body = await request.json();
    type = typeof body?.type === "string" ? body.type : "";
    stylePresetId = typeof body?.stylePresetId === "string" ? body.stylePresetId : undefined;
    rawText = typeof body?.rawText === "string" ? body.rawText : "";
    format = body?.format === "json" ? "json" : "md";
  }

  if (!type || !contentTypes.includes(type as never)) {
    return NextResponse.json({ error: "Valid content type is required." }, { status: 400 });
  }

  const { attachments, warnings } = await ingestFiles(files);
  const combinedText = buildCombinedText(rawText, attachments);
  if (!combinedText.trim()) {
    return NextResponse.json({ error: "Provide base text or supported files." }, { status: 400 });
  }

  try {
    const resolvedStylePresetId = await resolveStylePresetId({
      workspaceId: context.workspaceId,
      userId: context.user.id,
      stylePresetId,
    });
    const stylePreset = getStylePreset(resolvedStylePresetId);
    const instructionContext = await resolveInstructionContext({
      workspaceId: context.workspaceId,
      userId: context.user.id,
      stylePresetId: resolvedStylePresetId,
      context: [`Content type: ${type}`],
    });
    const openai = await getOpenAIForWorkspace(context.workspaceId);
    const draft = await generateContentDraft({
      type: type as never,
      stylePreset,
      sourceText: combinedText,
      instructionContext,
      openai,
    });

    const aiMeta = {
      promptVersion: CONTENT_DRAFT_PROMPT_VERSION,
      stylePresetId: stylePreset.id,
      assumptions: draft.assumptions ?? [],
      openQuestions: draft.openQuestions ?? [],
      missingEvidence: draft.missingEvidence ?? [],
      format,
    };

    const created = await createContentItem(context.workspaceId, {
      type: type as never,
      status: "DRAFT",
      title: draft.title ?? null,
      summary: draft.summary ?? null,
      body: draft.body ?? null,
      rawInput: combinedText,
      structured: draft.structured ?? null,
      source: files.length ? "UPLOAD" : "MANUAL",
      aiMeta,
      format,
    }, context.user.id);

    if (!created.ok || !created.item) {
      return NextResponse.json({ ok: false, validation: created.validation }, { status: 400 });
    }

    for (const attachment of attachments) {
      await attachContent(context.workspaceId, created.item.id, {
        fileName: attachment.fileName || "upload",
        mimeType: attachment.mimeType || "application/octet-stream",
        textContent: attachment.textContent,
      });
    }

    return NextResponse.json({
      ok: true,
      item: created.item,
      validation: created.validation,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI draft failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
