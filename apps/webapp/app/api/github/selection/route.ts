import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { hasGitHubEnv } from "@/lib/github/env";
import { requireApiContext } from "@/lib/auth/api";

const internalRepoNames = new Set(["jmars319/assembly", "jason_marshall/ledger"]);
const internalRepoAccessNames = ["jmars319/Assembly", "jason_marshall/ledger"];

export async function POST(request: Request) {
  const auth = await requireApiContext("GITHUB");
  if (!auth.ok) return auth.response;

  if (process.env.STORAGE_MODE !== "db" || !hasGitHubEnv()) {
    return NextResponse.json({ error: "GitHub not configured." }, { status: 400 });
  }

  const body = await request.json();
  if (!Array.isArray(body?.repoIds)) {
    return NextResponse.json({ error: "repoIds must be an array." }, { status: 400 });
  }

  const repoIds = body.repoIds
    .map((id: unknown) => {
      if (typeof id === "number") return id;
      if (typeof id === "string" && id.trim() !== "") {
        const parsed = Number(id);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })
    .filter((id: number | null): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);

  const prisma = getPrismaClient();
  const installation = await prisma.gitHubInstallation.findFirst({
    where: { workspaceId: auth.context.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  if (!installation) {
    return NextResponse.json({ error: "No installation." }, { status: 404 });
  }

  const updates = [
    prisma.gitHubRepo.updateMany({
      where: { installationId: installation.id, workspaceId: auth.context.workspaceId },
      data: { selected: false },
    }),
  ];

  if (repoIds.length) {
    updates.push(
      prisma.gitHubRepo.updateMany({
        where: {
          installationId: installation.id,
          repoId: { in: repoIds },
          workspaceId: auth.context.workspaceId,
        },
        data: { selected: true },
      })
    );
  }

  await prisma.$transaction(updates);

  const selectedRepos = await prisma.gitHubRepo.findMany({
    where: { installationId: installation.id, selected: true, workspaceId: auth.context.workspaceId },
    orderBy: { fullName: "asc" },
  });

  const repoAccessIds = selectedRepos.map(
    (repo) => `github-${auth.context.workspaceId}-${repo.repoId}`
  );

  await prisma.repoAccess.deleteMany({
    where: {
      workspaceId: auth.context.workspaceId,
      ...(repoAccessIds.length
        ? { AND: [{ id: { startsWith: "github-" } }, { id: { notIn: repoAccessIds } }] }
        : { id: { startsWith: "github-" } }),
    },
  });

  if (!selectedRepos.some((repo) => internalRepoNames.has(repo.fullName.toLowerCase()))) {
    await prisma.repoAccess.deleteMany({
      where: { repo: { in: internalRepoAccessNames }, workspaceId: auth.context.workspaceId },
    });
  }

  await Promise.all(
    selectedRepos.map((repo) => {
      const defaultTag = internalRepoNames.has(repo.fullName.toLowerCase()) ? "ASSEMBLY_INTERNAL" : "tenra";
      return prisma.repoAccess.upsert({
        where: { id: `github-${auth.context.workspaceId}-${repo.repoId}` },
        update: { repo: repo.fullName },
        create: {
          id: `github-${auth.context.workspaceId}-${repo.repoId}`,
          workspaceId: auth.context.workspaceId,
          repo: repo.fullName,
          projectTag: defaultTag,
          enabled: true,
          triggerPosts: false,
          triggerSchedules: false,
          triggerTasks: false,
        },
      });
    })
  );

  return NextResponse.json({ selectedCount: repoIds.length });
}
