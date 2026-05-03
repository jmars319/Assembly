"use client";

import { useState } from "react";
import type { Project } from "@/lib/store/types";

type Props = {
  projects: Project[];
};

export default function ProjectsClient({ projects }: Props) {
  const [items, setItems] = useState<Project[]>(projects);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setState("saving");
    setError(null);
    const trimmedName = name.trim();
    const trimmedTag = tag.trim();
    if (!trimmedName) {
      setState("error");
      setError("Project name is required.");
      return;
    }
    if (!trimmedTag) {
      setState("error");
      setError("Project tag is required.");
      return;
    }

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: trimmedName, tag: trimmedTag }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setState("error");
      setError(payload.error ?? "Failed to create project.");
      return;
    }

    const created = (await res.json()) as Project;
    setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    setTag("");
    setState("idle");
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="text-sm font-semibold text-slate-200">Create project</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs text-slate-400">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="tenra"
            />
          </label>
          <label className="grid gap-2 text-xs text-slate-400">
            Tag
            <input
              value={tag}
              onChange={(event) => setTag(event.target.value.toUpperCase())}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="tenra"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={submit}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200"
          >
            {state === "saving" ? "Saving..." : "Create project"}
          </button>
          {error ? <div className="text-xs text-rose-300">{error}</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="text-sm font-semibold text-slate-200">Projects</div>
        <div className="mt-4 grid gap-3">
          {items.length === 0 ? (
            <div className="text-sm text-slate-500">No projects yet.</div>
          ) : (
            items.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
              >
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {project.tag}
                </div>
                <div className="mt-1 text-sm text-slate-100">{project.name}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
