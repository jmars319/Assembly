import PageShell from "@/app/components/PageShell";
import PurposeCard from "@/app/components/PurposeCard";
import NewPostClient from "@/app/posts/new/NewPostClient";
import { hasAssemblyAiProvider } from "@/lib/ai/client";
import { getStore } from "@/lib/store";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { getPrismaClient } from "@/lib/prisma";

export default async function NewPostPage() {
  const { workspace, user, features } = await requireWorkspaceContext();
  const store = getStore(workspace.id);
  const [briefs, repos] = await Promise.all([store.listBriefs(), store.listRepos()]);
  const prisma = getPrismaClient();
  const workspaceKey = await prisma.workspaceApiKey.findUnique({
    where: { workspaceId: workspace.id },
  });
  const aiConfigured = hasAssemblyAiProvider(Boolean(workspaceKey?.apiKeyCipher));

  return (
    <PageShell
      workspaceName={workspace.name}
      isAdmin={user.isAdmin}
      features={features}
      title="New post"
      subtitle="Generate a post from a brief with repo context."
    >
      <PurposeCard>
        Manually create a new post by choosing a brief, repo context, and style before review.
      </PurposeCard>
      <NewPostClient briefs={briefs} repos={repos} aiConfigured={aiConfigured} />
    </PageShell>
  );
}
