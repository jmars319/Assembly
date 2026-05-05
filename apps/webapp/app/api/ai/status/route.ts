import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/auth/api";
import { hasAssemblyAiProvider } from "@/lib/ai/client";
import { getPrismaClient } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { context } = auth as { context: { workspaceId: string } };
  const prisma = getPrismaClient();
  const workspaceKey = await prisma.workspaceApiKey.findUnique({
    where: { workspaceId: context.workspaceId },
  });
  const configured = hasAssemblyAiProvider(Boolean(workspaceKey?.apiKeyCipher));
  return NextResponse.json({
    configured,
    workspaceConfigured: Boolean(workspaceKey?.apiKeyCipher),
  });
}
