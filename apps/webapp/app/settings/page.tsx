import PageShell from "@/app/components/PageShell";
import PurposeCard from "@/app/components/PurposeCard";
import SettingsAIIntegrationSummary from "@/app/components/SettingsAIIntegrationSummary";
import SettingsClient from "@/app/components/SettingsClient";
import SettingsGitHubSummary from "@/app/components/SettingsGitHubSummary";
import { hasAssemblyAiProvider } from "@/lib/ai/client";
import { getStore } from "@/lib/store";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { getPrismaClient } from "@/lib/prisma";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  void searchParams;
  const { workspace, user, features, role } = await requireWorkspaceContext();
  const store = getStore(workspace.id);
  const repos = await store.listRepos();
  const prisma = getPrismaClient();
  const workspaceKey = await prisma.workspaceApiKey.findUnique({
    where: { workspaceId: workspace.id },
  });
  const aiConfigured = hasAssemblyAiProvider(Boolean(workspaceKey?.apiKeyCipher));

  return (
    <PageShell
      title="Settings"
      subtitle="Manage repos and integrations."
      workspaceName={workspace.name}
      isAdmin={user.isAdmin}
      features={features}
    >
      <section className="grid gap-6">
        <PurposeCard>
          Configure repo access, workspace instructions, and integrations that power the review workflow.
        </PurposeCard>
        <SettingsClient repos={repos} role={role} isAdmin={user.isAdmin} />
        <SettingsGitHubSummary />
        <SettingsAIIntegrationSummary configured={aiConfigured} />
      </section>
    </PageShell>
  );
}
