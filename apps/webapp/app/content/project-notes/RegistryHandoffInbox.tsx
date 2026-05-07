"use client";

import { useState } from "react";
import type { ValidationIssue } from "@/lib/content/types";

type ImportResponse = {
  ok?: boolean;
  dryRun?: boolean;
  item?: {
    id: string;
    title?: string | null;
    status?: string | null;
    workspaceId?: string | null;
  };
  preview?: ScoutOpportunityPreview;
  validation?: {
    errors?: ValidationIssue[];
    warnings?: ValidationIssue[];
  };
};

type HandoffStage = "idle" | "imported" | "drafted" | "reviewed" | "exported";
type HandoffSource = "registry" | "scout";
type ScoutOpportunityPreview = {
  title: string;
  summary: string;
  project: {
    name: string;
    tag: string;
  };
  relatedSlugs: string[];
  topics: string[];
  aiMeta?: Record<string, unknown>;
};
type IncomingOpportunity = ScoutOpportunityPreview & {
  previewedAt: string;
};
type ProxyAttempt = {
  attemptedAt?: string;
  endpoint?: string;
  traceId?: string;
  status?: "ok" | "failed" | "fallback";
  message?: string;
};

export default function RegistryHandoffInbox() {
  const [payload, setPayload] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ImportResponse["item"] | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);
  const [stage, setStage] = useState<HandoffStage>("idle");
  const [proxyHandoffJson, setProxyHandoffJson] = useState("");
  const [proxyDelivery, setProxyDelivery] = useState("");
  const [proxyAttempts, setProxyAttempts] = useState<ProxyAttempt[]>([]);
  const [scoutPreview, setScoutPreview] = useState<ScoutOpportunityPreview | null>(null);
  const [incomingOpportunities, setIncomingOpportunities] = useState<IncomingOpportunity[]>([]);

  const importHandoffRequest = async (source: HandoffSource) => {
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
        setStage("idle");
        return;
      }
      setStage("imported");

      const response = await fetch(
        source === "registry" ? "/api/handoffs/registry-document" : "/api/handoffs/scout-opportunity",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        },
      );
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
      if (source === "scout") {
        setScoutPreview(null);
      }
      setPayload("");
      setStage("drafted");
    } finally {
      setBusy(false);
    }
  };

  const previewScoutOpportunity = async () => {
    setBusy(true);
    setCreated(null);
    setErrors([]);
    setWarnings([]);
    try {
      let body: unknown;
      try {
        body = JSON.parse(payload);
      } catch {
        setErrors([{ code: "scout_json_invalid", message: "Scout opportunity JSON could not be parsed." }]);
        setStage("idle");
        return;
      }
      const response = await fetch("/api/handoffs/scout-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, payload: body }),
      });
      const data = (await response.json()) as ImportResponse;
      const preview = data.preview;
      if (!response.ok || !data.ok || !preview) {
        setErrors(data.validation?.errors ?? [{ code: "scout_preview_failed", message: "Scout preview failed." }]);
        setWarnings(data.validation?.warnings ?? []);
        return;
      }
      setScoutPreview(preview);
      setIncomingOpportunities((current) => [{ ...preview, previewedAt: new Date().toISOString() }, ...current].slice(0, 5));
      setWarnings(data.validation?.warnings ?? []);
      setStage("imported");
    } finally {
      setBusy(false);
    }
  };

  const markReviewed = async () => {
    if (!created?.id) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/content/items/${encodeURIComponent(created.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY", note: "Registry handoff reviewed for Proxy export." }),
      });
      const data = (await response.json()) as ImportResponse;
      if (!response.ok || !data.ok) {
        setErrors(data.validation?.errors ?? [{ code: "registry_review_failed", message: "Review status failed." }]);
        setWarnings(data.validation?.warnings ?? []);
        return;
      }
      setCreated(data.item ?? created);
      setStage("reviewed");
    } finally {
      setBusy(false);
    }
  };

  const exportProxyHandoff = async (deliver = false) => {
    if (!created?.id) return;
    setBusy(true);
    try {
      const response = await fetch("/api/handoffs/proxy-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: created.id, deliver }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        delivered?: boolean;
        deliveryMode?: string;
        handoff?: unknown;
        proxy?: unknown;
        proxyDeliveryAttempts?: ProxyAttempt[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.handoff) {
        setErrors([{ code: "proxy_handoff_failed", message: data.error ?? "Proxy handoff export failed." }]);
        return;
      }
      setProxyHandoffJson(JSON.stringify(data.handoff, null, 2));
      setProxyAttempts(data.proxyDeliveryAttempts ?? proxyAttempts);
      setProxyDelivery(
        deliver
          ? data.delivered
            ? "Proxy shaped output was posted back to this draft."
            : data.error ?? "Proxy endpoint is not configured; JSON fallback is shown."
          : "Proxy handoff JSON exported for manual delivery.",
      );
      setStage("exported");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">Suite Handoff Inbox</div>
          <div className="mt-1 text-xs text-slate-500">
            Registry document requests and Scout opportunity handoffs
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || !payload.trim()}
            onClick={() => void importHandoffRequest("registry")}
            type="button"
          >
            {busy ? "Importing" : "Create Registry draft"}
          </button>
          <button
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || !payload.trim()}
            onClick={() => void previewScoutOpportunity()}
            type="button"
          >
            {busy ? "Previewing" : "Preview Scout"}
          </button>
          <button
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || !payload.trim() || !scoutPreview}
            onClick={() => void importHandoffRequest("scout")}
            type="button"
          >
            Create reviewed Scout draft
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-4">
        {(["imported", "drafted", "reviewed", "exported"] as const).map((step) => (
          <span
            className={`rounded border px-3 py-2 ${
              stage === step || (step === "imported" && stage !== "idle")
                ? "border-emerald-900 bg-emerald-950/40 text-emerald-100"
                : "border-slate-800 bg-slate-950"
            }`}
            key={step}
          >
            {step}
          </span>
        ))}
      </div>
      <textarea
        className="mt-4 min-h-40 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        placeholder='{"schema":"tenra-registry.assembly-document-request.v1",...} or {"schema":"tenra-scout.opportunity-handoff.v1",...}'
      />
      {scoutPreview ? (
        <div className="mt-3 rounded-lg border border-sky-900 bg-sky-950/40 px-3 py-2 text-sm text-sky-100">
          <div className="font-semibold">Scout opportunity ready for review</div>
          <div>{scoutPreview.title}</div>
          <div className="mt-1 text-sky-200/80">
            Project: {scoutPreview.project.name} ({scoutPreview.project.tag})
          </div>
          <div className="mt-1 text-sky-200/80">{scoutPreview.summary}</div>
        </div>
      ) : null}
      {incomingOpportunities.length ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
          <div className="mb-2 font-semibold text-slate-100">Incoming Scout opportunities</div>
          <div className="space-y-2">
            {incomingOpportunities.map((opportunity) => (
              <div className="rounded border border-slate-800 px-3 py-2" key={`${opportunity.project.tag}-${opportunity.previewedAt}`}>
                <div className="font-semibold text-slate-100">{opportunity.title}</div>
                <div>{opportunity.project.tag} · {new Date(opportunity.previewedAt).toLocaleString()}</div>
                <div className="text-slate-500">{opportunity.relatedSlugs.slice(0, 2).join(", ")}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {created ? (
        <div className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Draft created: {created.title ?? created.id} ({created.status ?? "DRAFT"})
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-emerald-800 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || stage === "reviewed" || stage === "exported"}
              onClick={() => void markReviewed()}
              type="button"
            >
              Mark reviewed
            </button>
            <button
              className="rounded-full border border-emerald-800 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || (stage !== "reviewed" && stage !== "exported")}
              onClick={() => void exportProxyHandoff(false)}
              type="button"
            >
              Export Proxy handoff
            </button>
            <button
              className="rounded-full border border-emerald-800 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || (stage !== "reviewed" && stage !== "exported")}
              onClick={() => void exportProxyHandoff(true)}
              type="button"
            >
              Send Proxy
            </button>
          </div>
        </div>
      ) : null}
      {proxyDelivery ? <p className="mt-3 text-sm text-slate-300">{proxyDelivery}</p> : null}
      {proxyAttempts.length ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
          <div className="mb-2 font-semibold text-slate-100">Proxy delivery attempts</div>
          <div className="space-y-2">
            {proxyAttempts.slice(0, 5).map((attempt, index) => (
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between" key={`${attempt.traceId}-${index}`}>
                <span>
                  {attempt.status ?? "unknown"} · {attempt.attemptedAt ? new Date(attempt.attemptedAt).toLocaleString() : "pending"}
                  {attempt.endpoint ? ` · ${attempt.endpoint}` : ""}
                </span>
                {attempt.message ? <span className="text-slate-500">{attempt.message.slice(0, 120)}</span> : null}
                {attempt.status === "failed" || attempt.status === "fallback" ? (
                  <button
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busy || !created?.id}
                    onClick={() => void exportProxyHandoff(true)}
                    type="button"
                  >
                    Retry Proxy
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {proxyHandoffJson ? (
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
          {proxyHandoffJson}
        </pre>
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
