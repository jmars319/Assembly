"use client";

import { useState } from "react";
import type { ValidationIssue } from "@/lib/content/types";

type ImportResponse = {
  ok?: boolean;
  item?: {
    id: string;
    title?: string | null;
    status?: string | null;
    workspaceId?: string | null;
  };
  validation?: {
    errors?: ValidationIssue[];
    warnings?: ValidationIssue[];
  };
};

export default function RegistryHandoffInbox() {
  const [payload, setPayload] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ImportResponse["item"] | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);

  const importRegistryRequest = async () => {
    setBusy(true);
    setCreated(null);
    setErrors([]);
    setWarnings([]);
    try {
      let body: unknown;
      try {
        body = JSON.parse(payload);
      } catch {
        setErrors([{ code: "registry_json_invalid", message: "Registry handoff JSON could not be parsed." }]);
        return;
      }

      const response = await fetch("/api/handoffs/registry-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as ImportResponse;
      if (!response.ok || !data.ok) {
        setErrors(
          data.validation?.errors ?? [{ code: "registry_import_failed", message: "Registry handoff import failed." }],
        );
        setWarnings(data.validation?.warnings ?? []);
        return;
      }
      setCreated(data.item ?? null);
      setWarnings(data.validation?.warnings ?? []);
      setPayload("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">Registry Handoff Inbox</div>
          <div className="mt-1 text-xs text-slate-500">tenra-registry.assembly-document-request.v1</div>
        </div>
        <button
          className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || !payload.trim()}
          onClick={importRegistryRequest}
        >
          {busy ? "Importing" : "Create draft"}
        </button>
      </div>
      <textarea
        className="mt-4 min-h-40 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        placeholder='{"schema":"tenra-registry.assembly-document-request.v1",...}'
      />
      {created ? (
        <div className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Draft created: {created.title ?? created.id} ({created.status ?? "DRAFT"})
        </div>
      ) : null}
      {errors.length ? (
        <div className="mt-3 space-y-2 rounded-lg border border-rose-950 bg-rose-950/40 px-3 py-2">
          {errors.map((issue, index) => (
            <div key={`${issue.code}-${index}`} className="text-sm text-rose-100">
              {issue.message}
            </div>
          ))}
        </div>
      ) : null}
      {warnings.length ? (
        <div className="mt-3 space-y-2 rounded-lg border border-amber-950 bg-amber-950/40 px-3 py-2">
          {warnings.map((issue, index) => (
            <div key={`${issue.code}-${index}`} className="text-sm text-amber-100">
              {issue.message}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
