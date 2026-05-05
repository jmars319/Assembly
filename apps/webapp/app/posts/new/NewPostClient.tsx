"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brief, RepoAccess } from "@/lib/store/types";
import { stylePresets } from "@/lib/content/stylePresets";

type Props = {
  briefs: Brief[];
  repos: RepoAccess[];
  aiConfigured: boolean;
};

type StyleOption = {
  id: string;
  name: string;
  description?: string | null;
  source: "preset" | "workspace";
};

export default function NewPostClient({ briefs, repos, aiConfigured }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [briefId, setBriefId] = useState<string>(briefs[0]?.id ?? "");
  const [platformMode, setPlatformMode] = useState<"single" | "multi">("single");
  const [platform, setPlatform] = useState<string>("generic");
  const [multiPlatforms, setMultiPlatforms] = useState<Set<string>>(new Set());
  const [stylePresetId, setStylePresetId] = useState(stylePresets[0]?.id ?? "neutral-brief");
  const [styleOptions, setStyleOptions] = useState<StyleOption[]>(
    stylePresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      source: "preset",
    })),
  );
  const [singleRepoId, setSingleRepoId] = useState<string>(repos[0]?.id ?? "");
  const [multiRepoIds, setMultiRepoIds] = useState<Set<string>>(new Set());
  const [brandOverride, setBrandOverride] = useState<string>("");
  const [createdPosts, setCreatedPosts] = useState<Array<{ id: string; title: string }>>([]);
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStyles = async () => {
      try {
        const [stylesRes, prefRes] = await Promise.all([
          fetch("/api/workspaces/styles"),
          fetch("/api/workspaces/style-preference"),
        ]);
        if (stylesRes.ok) {
          const data = await stylesRes.json();
          const workspaceStyles = Array.isArray(data?.styles)
            ? data.styles.map((style: { id: string; name: string; description?: string | null }) => ({
                id: style.id,
                name: style.name,
                description: style.description ?? null,
                source: "workspace" as const,
              }))
            : [];
          setStyleOptions([
            ...stylePresets.map((preset) => ({
              id: preset.id,
              name: preset.name,
              description: preset.description,
              source: "preset" as const,
            })),
            ...workspaceStyles,
          ]);
        }
        if (prefRes.ok) {
          const data = await prefRes.json();
          const preferred = data?.preference?.defaultStyleId;
          if (typeof preferred === "string" && preferred) {
            setStylePresetId(preferred);
          }
        }
      } catch {
        // keep defaults
      }
    };
    void loadStyles();
  }, []);

  const brandOptions = useMemo(
    () => Array.from(new Set(repos.map((repo) => repo.projectTag).filter(Boolean))),
    [repos]
  );

  const selectedRepos = useMemo(() => {
    const ids = mode === "single" ? [singleRepoId] : Array.from(multiRepoIds);
    return repos.filter((repo) => ids.includes(repo.id));
  }, [mode, singleRepoId, multiRepoIds, repos]);

  const selectedPlatforms = useMemo(
    () => (platformMode === "single" ? [platform] : Array.from(multiPlatforms)),
    [platformMode, platform, multiPlatforms]
  );

  const selectedTags = useMemo(
    () => Array.from(new Set(selectedRepos.map((repo) => repo.projectTag))),
    [selectedRepos]
  );

  const shouldChooseBrand = mode === "multi" && selectedTags.length > 1;
  const brandOverrideOptions = selectedTags.length ? selectedTags : brandOptions;

  const selectedBrandTag = shouldChooseBrand
    ? brandOverride
    : selectedTags[0] ?? brandOverride;

  const toggleRepo = (id: string) => {
    setMultiRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const togglePlatform = (value: string) => {
    setMultiPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const submit = async () => {
    setState("submitting");
    setError(null);
    setCreatedPosts([]);
    if (!briefId) {
      setError("Select a brief.");
      setState("error");
      return;
    }
    if (!aiConfigured) {
      setError("AI provider is not configured.");
      setState("error");
      return;
    }

    const repoIds = selectedRepos.map((repo) => repo.id);
    if (repoIds.length === 0) {
      setError("Select at least one repo.");
      setState("error");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("Select at least one platform.");
      setState("error");
      return;
    }
    if (shouldChooseBrand && !selectedBrandTag) {
      setError("Select a brand for this post.");
      setState("error");
      return;
    }

    const endpoint = platformMode === "single" ? "/api/ai/post" : "/api/ai/posts";
    const payload =
      platformMode === "single"
        ? {
            briefId,
            platform,
            repoIds,
            stylePresetId,
            brandTag: selectedBrandTag || undefined,
          }
        : {
            briefId,
            platforms: selectedPlatforms,
            repoIds,
            stylePresetId,
            brandTag: selectedBrandTag || undefined,
          };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Failed to generate post.");
      setState("error");
      return;
    }

    const response = await res.json();
    if (platformMode === "single") {
      router.push(`/posts/${response.id}`);
      return;
    }

    const posts = Array.isArray(response.posts) ? response.posts : [];
    setCreatedPosts(posts.map((post: { id: string; title: string }) => ({
      id: post.id,
      title: post.title ?? "Post",
    })));
    setState("idle");
  };

  return (
    <div className="grid gap-6">
      {briefs.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">
          No briefs available yet.
        </div>
      ) : null}
      {repos.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">
          No repos are available. Connect GitHub and select repos first.
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="text-sm font-semibold text-slate-200">Post source</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs text-slate-400">
            Brief
            <select
              value={briefId}
              onChange={(event) => setBriefId(event.target.value)}
              disabled={briefs.length === 0}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            >
              {briefs.map((brief) => (
                <option key={brief.id} value={brief.id}>
                  {brief.summary.slice(0, 80)}...
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Platforms</div>
              <div className="text-xs text-slate-500">Generate for one or multiple platforms.</div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                onClick={() => setPlatformMode("single")}
                className={`rounded-full border px-3 py-1 ${
                  platformMode === "single"
                    ? "border-slate-500 text-slate-100"
                    : "border-slate-800 text-slate-400"
                }`}
              >
                Single
              </button>
              <button
                onClick={() => setPlatformMode("multi")}
                className={`rounded-full border px-3 py-1 ${
                  platformMode === "multi"
                    ? "border-slate-500 text-slate-100"
                    : "border-slate-800 text-slate-400"
                }`}
              >
                Multi
              </button>
            </div>
          </div>
          {platformMode === "single" ? (
            <div className="mt-3">
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                disabled={briefs.length === 0}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              >
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="pinterest">Pinterest</option>
                <option value="snapchat">Snapchat</option>
                <option value="youtube">YouTube (Community)</option>
                <option value="instagram">Instagram</option>
                <option value="twitter">X (Twitter)</option>
                <option value="linkedin">LinkedIn</option>
                <option value="reddit">Reddit</option>
                <option value="gbp">Google Business Profile</option>
                <option value="threads">Threads</option>
                <option value="bluesky">Bluesky</option>
                <option value="mastodon">Mastodon</option>
                <option value="generic">Generic</option>
              </select>
            </div>
          ) : (
            <div className="mt-3 grid gap-2 text-xs text-slate-400">
              {[
                { value: "facebook", label: "Facebook" },
                { value: "tiktok", label: "TikTok" },
                { value: "pinterest", label: "Pinterest" },
                { value: "snapchat", label: "Snapchat" },
                { value: "youtube", label: "YouTube (Community)" },
                { value: "instagram", label: "Instagram" },
                { value: "twitter", label: "X (Twitter)" },
                { value: "linkedin", label: "LinkedIn" },
                { value: "reddit", label: "Reddit" },
                { value: "gbp", label: "Google Business Profile" },
                { value: "threads", label: "Threads" },
                { value: "bluesky", label: "Bluesky" },
                { value: "mastodon", label: "Mastodon" },
                { value: "generic", label: "Generic" },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={multiPlatforms.has(option.value)}
                    onChange={() => togglePlatform(option.value)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Style preset</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {styleOptions.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setStylePresetId(preset.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm ${
                  stylePresetId === preset.id
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                    : "border-slate-800 bg-slate-950/40 text-slate-300"
                }`}
              >
                <div className="font-semibold">{preset.name}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {preset.description || (preset.source === "workspace" ? "Workspace style." : "Preset style.")}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-200">Repository context</div>
            <div className="text-xs text-slate-500">
              Choose single or multi-repo context for this post.
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => setMode("single")}
              className={`rounded-full border px-3 py-1 ${
                mode === "single"
                  ? "border-slate-500 text-slate-100"
                  : "border-slate-800 text-slate-400"
              }`}
            >
              Single
            </button>
            <button
              onClick={() => setMode("multi")}
              className={`rounded-full border px-3 py-1 ${
                mode === "multi"
                  ? "border-slate-500 text-slate-100"
                  : "border-slate-800 text-slate-400"
              }`}
            >
              Multi
            </button>
          </div>
        </div>

        {mode === "single" ? (
          <div className="mt-4">
            <select
              value={singleRepoId}
              onChange={(event) => setSingleRepoId(event.target.value)}
              disabled={repos.length === 0}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            >
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.repo} ({repo.projectTag})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {repos.map((repo) => (
              <label
                key={repo.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
              >
                <div>
                  <div className="font-semibold text-slate-100">{repo.repo}</div>
                  <div className="text-xs text-slate-500">{repo.projectTag}</div>
                </div>
                <input
                  type="checkbox"
                  checked={multiRepoIds.has(repo.id)}
                  onChange={() => toggleRepo(repo.id)}
                  disabled={repos.length === 0}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
              </label>
            ))}
          </div>
        )}

        {shouldChooseBrand ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Brand override</div>
            <select
              value={brandOverride}
              onChange={(event) => setBrandOverride(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            >
              <option value="">Select brand</option>
              {brandOverrideOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="text-sm font-semibold text-slate-200">AI context</div>
        <div className="mt-2 text-xs text-slate-500">
          {selectedBrandTag ? `Brand tag: ${selectedBrandTag}.` : "No brand tag selected."}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Workspace instructions and the selected style preset will be applied automatically.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={state === "submitting" || briefs.length === 0 || repos.length === 0}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-60"
        >
          {state === "submitting" ? "Generating..." : "Generate post"}
        </button>
        {state === "submitting" ? <div className="text-xs text-slate-500">Working...</div> : null}
        {error ? <div className="text-xs text-rose-300">{error}</div> : null}
      </div>
      {createdPosts.length ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-200">
          <div className="text-xs uppercase tracking-wide text-slate-500">Posts created</div>
          <div className="mt-3 grid gap-2">
            {createdPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => router.push(`/posts/${post.id}`)}
                className="text-left text-sm text-slate-100 hover:text-white"
              >
                {post.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
