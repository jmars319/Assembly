"use client";

import { useState } from "react";
import type { RepoAccess } from "@/lib/store/types";

export default function RepoAccessEditor({
  repos,
  brandOptions = ["tenra Assembly", "tenra"],
}: {
  repos: RepoAccess[];
  brandOptions?: string[];
}) {
  const [items, setItems] = useState<RepoAccess[]>(repos);
  const [state, setState] = useState<"idle" | "saved" | "error" | "saving">("idle");

  const updateItem = (id: string, changes: Partial<RepoAccess>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  };

  const save = async () => {
    setState("saving");
    const res = await fetch("/api/settings/repos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repos: items }),
    });
    setState(res.ok ? "saved" : "error");
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">Repo access</div>
          <div className="text-xs text-slate-500">Allowlist and trigger settings for pipeline sync.</div>
        </div>
        <button
          onClick={save}
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-slate-500"
        >
          Save changes
        </button>
      </div>
      <div className="grid gap-3">
        {items.map((repo) => {
          const repoSlug = repo.repo.toLowerCase();
          const allowAssemblyInternal =
            repoSlug === "assembly" || repoSlug.endsWith("/assembly") || repoSlug === "ledger" || repoSlug.endsWith("/ledger");
          const filteredBrands = (brandOptions || []).filter((tag) =>
            tag === "ASSEMBLY_INTERNAL" || tag === "LEDGER_INTERNAL" ? allowAssemblyInternal : true
          );
          const options = Array.from(
            new Set([...filteredBrands, repo.projectTag].filter(Boolean))
          );

          return (
            <div
              key={repo.id}
              className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200 md:grid-cols-[1.4fr_0.7fr_1fr_1fr]"
            >
              <div>
                <div className="font-semibold text-slate-100">{repo.repo}</div>
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={repo.enabled}
                    onChange={(event) => updateItem(repo.id, { enabled: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  Enabled
                </label>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-500">Project tag</label>
                <select
                  value={repo.projectTag}
                  onChange={(event) => updateItem(repo.id, { projectTag: event.target.value })}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 text-xs text-slate-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={repo.triggerPosts}
                    onChange={(event) =>
                      updateItem(repo.id, { triggerPosts: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  Trigger posts
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={repo.triggerSchedules}
                    onChange={(event) =>
                      updateItem(repo.id, { triggerSchedules: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  Trigger schedules
                </label>
              </div>
              <div className="flex flex-col gap-2 text-xs text-slate-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={repo.triggerTasks}
                    onChange={(event) =>
                      updateItem(repo.id, { triggerTasks: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  Trigger tasks
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-slate-500">
        {state === "saving" ? "Saving..." : null}
        {state === "saved" ? "Saved." : null}
        {state === "error" ? "Save failed." : null}
      </div>
    </div>
  );
}
