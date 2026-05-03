import PageShell from "@/app/components/PageShell";
import PurposeCard from "@/app/components/PurposeCard";
import GitHubIntegrationClient from "@/app/settings/integrations/github/GitHubIntegrationClient";
import { requireWorkspaceContext } from "@/lib/workspace/context";

export default async function GitHubIntegrationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  void searchParams;
  const { workspace, user, features } = await requireWorkspaceContext();
  const enabled = user.isAdmin || features.GITHUB;

  return (
    <PageShell
      title="GitHub integration"
      subtitle="Connect the tenra Assembly GitHub App and select repos."
      workspaceName={workspace.name}
      isAdmin={user.isAdmin}
      features={features}
    >
      <PurposeCard>
        Connect the read-only GitHub App, then select which repos Assembly can read.
      </PurposeCard>
      {!enabled ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
          GitHub integration is disabled for this workspace.
        </div>
      ) : (
        <GitHubIntegrationClient />
      )}
    </PageShell>
  );
}
