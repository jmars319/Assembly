import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { generatePost } from "@/lib/ai/generatePost";
import { getStylePreset } from "@/lib/content/stylePresets";
import { requireApiContext } from "@/lib/auth/api";
import { resolveInstructionContext, resolveStylePresetId } from "@/lib/ai/instructions";
import { getOpenAIForWorkspace, hasAssemblyAiProvider } from "@/lib/ai/client";
import { getAuditLabel } from "@/lib/audit/labels";

type Platform =
  | "twitter"
  | "instagram"
  | "linkedin"
  | "facebook"
  | "gbp"
  | "youtube"
  | "threads"
  | "tiktok"
  | "mastodon"
  | "bluesky"
  | "reddit"
  | "pinterest"
  | "snapchat"
  | "generic";

const normalizePlatform = (value?: string): Platform => {
  switch ((value ?? "").toLowerCase()) {
    case "twitter":
    case "x":
      return "twitter";
    case "instagram":
      return "instagram";
    case "linkedin":
      return "linkedin";
    case "facebook":
    case "fb":
      return "facebook";
    case "gbp":
    case "google":
    case "google-business":
      return "gbp";
    case "youtube":
    case "yt":
      return "youtube";
    case "threads":
      return "threads";
    case "tiktok":
    case "tt":
      return "tiktok";
    case "mastodon":
      return "mastodon";
    case "bluesky":
      return "bluesky";
    case "reddit":
      return "reddit";
    case "pinterest":
      return "pinterest";
    case "snapchat":
      return "snapchat";
    default:
      return "generic";
  }
};

export async function POST(request: Request) {
  if (process.env.STORAGE_MODE !== "db") {
    return NextResponse.json({ error: "AI posts require STORAGE_MODE=db." }, { status: 400 });
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

  const body = await request.json();
  if (!body?.briefId || typeof body.briefId !== "string") {
    return NextResponse.json({ error: "briefId is required." }, { status: 400 });
  }

  const platforms: Platform[] = Array.isArray(body.platforms)
    ? Array.from(new Set(body.platforms.map((value: string) => normalizePlatform(value))))
    : [];
  const repoIds = Array.isArray(body.repoIds)
    ? body.repoIds.filter((id: unknown) => typeof id === "string" && id.trim().length > 0)
    : [];
  const stylePresetId = typeof body.stylePresetId === "string" ? body.stylePresetId : undefined;
  const brandTag = typeof body.brandTag === "string" ? body.brandTag : undefined;

  if (!platforms.length) {
    return NextResponse.json({ error: "platforms are required." }, { status: 400 });
  }

  try {
    const brief = await prisma.brief.findFirst({
      where: { id: body.briefId, workspaceId: context.workspaceId },
    });
    if (!brief) {
      return NextResponse.json({ error: "Brief not found." }, { status: 404 });
    }

    if (repoIds.length === 0) {
      return NextResponse.json({ error: "At least one repo is required." }, { status: 400 });
    }

    const repos = await prisma.repoAccess.findMany({
      where: { id: { in: repoIds }, workspaceId: context.workspaceId },
    });
    if (repos.length !== repoIds.length) {
      return NextResponse.json({ error: "One or more repos were not found." }, { status: 404 });
    }
    const repoNames = repos.map((repo) => repo.repo);
    const repoTags = Array.from(new Set(repos.map((repo) => repo.projectTag)));

    if (!brandTag && repoTags.length > 1) {
      return NextResponse.json(
        { error: "Brand selection is required when using multiple repo tags." },
        { status: 400 }
      );
    }

    const evidenceDocs = brief.evidenceBundleId
      ? await prisma.evidenceItem.findMany({
          where: { bundleId: brief.evidenceBundleId, type: "DOCUMENTATION", workspaceId: context.workspaceId },
          orderBy: { title: "asc" },
          take: 5,
        })
      : [];
    const evidenceRecent = brief.evidenceBundleId
      ? await prisma.evidenceItem.findMany({
          where: {
            bundleId: brief.evidenceBundleId,
            type: { not: "DOCUMENTATION" },
            workspaceId: context.workspaceId,
          },
          orderBy: { occurredAt: "desc" },
          take: 20,
        })
      : [];
    const evidenceItems = [...evidenceDocs, ...evidenceRecent];

    const resolvedStylePresetId = await resolveStylePresetId({
      workspaceId: context.workspaceId,
      userId: context.user.id,
      stylePresetId,
    });
    const stylePreset = getStylePreset(resolvedStylePresetId);
    const openai = await getOpenAIForWorkspace(context.workspaceId);
    const postTexts = await Promise.all(
      platforms.map(async (platform) =>
        generatePost({
          briefText: brief.summary,
          platform,
          repoNames,
          evidenceItems: evidenceItems.map((item) => ({
            type: item.type,
            title: item.title,
            body: item.body,
            content: item.content,
          })),
          stylePreset,
          instructionContext: await resolveInstructionContext({
            workspaceId: context.workspaceId,
            userId: context.user.id,
            stylePresetId: resolvedStylePresetId,
            orgTag: brandTag ?? repoTags[0],
            context: [`Platform: ${platform}`],
          }),
          openai,
        })
      )
    );

    const posts = await prisma.$transaction(async (tx) => {
      const createdPosts = await Promise.all(
        platforms.map((platform, index) =>
          tx.post.create({
            data: {
              workspaceId: context.workspaceId,
              projectId: brief.projectId,
              platform,
              title: `AI post (${platform})`,
              status: "NEEDS_REVIEW",
              postJson: {
                text: postTexts[index],
                platform,
                source: "openai",
                model: "gpt-5-mini",
                stylePresetId: stylePreset.id,
                repoIds,
                repoNames,
                brandTag: brandTag ?? repoTags[0],
                evidenceBundleId: brief.evidenceBundleId ?? undefined,
              },
              claims: [],
            },
          })
        )
      );

      await Promise.all(
        createdPosts.map((post, index) =>
          tx.auditLog.create({
            data: {
              actor: "system:ai",
              action: "generate_post",
              actionLabel: getAuditLabel("generate_post"),
              entityType: "Post",
              entityId: post.id,
              workspaceId: context.workspaceId,
              note: `Post generated for brief ${brief.id}.`,
              metadata: {
                briefId: brief.id,
                platform: platforms[index],
                model: "gpt-5-mini",
                repoIds,
                repoNames,
                stylePresetId: stylePreset.id,
              },
            },
          })
        )
      );

      return createdPosts;
    });

    return NextResponse.json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI posts failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
