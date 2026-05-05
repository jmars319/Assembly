export default function SettingsAIIntegrationSummary({
  configured,
}: {
  configured: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="text-sm font-semibold text-slate-200">AI integration</div>
      <div className="mt-2 text-sm text-slate-400">
        Provider: <span className="text-slate-300">{configured ? "Configured" : "Not configured"}</span>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Use a workspace key, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, or a local Ollama endpoint.
      </div>
    </div>
  );
}
