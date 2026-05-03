"use client";

import { useEffect, useMemo, useState } from "react";
import AIInstructions from "@/app/components/AIInstructions";
import RepoAccessEditor from "@/app/components/RepoAccessEditor";
import { FEATURE_KEYS, FEATURE_LABELS } from "@/lib/workspace/features";
import { stylePresets } from "@/lib/content/stylePresets";
import type { RepoAccess } from "@/lib/store/types";

export type BrandInstruction = {
  id: string;
  tag: string;
  tone: string;
  hardRules: string;
  doList: string;
  dontList: string;
};

type SaveState = "idle" | "saved" | "error";

type WorkspaceInstructionForm = {
  tone: string;
  voice: string;
  hardRules: string;
  doList: string;
  dontList: string;
};

type WorkspaceStyle = {
  id: string;
  name: string;
  description: string | null;
  instructions: Record<string, unknown>;
  isPreset: boolean;
};

type WorkspaceApiKeyState = {
  configured: boolean;
  last4: string | null;
  provider: string;
};

const defaultInstructions: BrandInstruction[] = [
  {
    id: "temp-tenra-assembly",
    tag: "tenra Assembly",
    tone: "Direct, technical, low-hype.",
    hardRules: "No em dashes. Avoid superlatives.",
    doList: "Use short sentences. Prefer active voice.",
    dontList: "No claims of autonomy. No release language.",
  },
  {
    id: "temp-tenra",
    tag: "tenra",
    tone: "Concise, pragmatic, product-led.",
    hardRules: "No em dashes. No hashtags.",
    doList: "Highlight workflow clarity. Keep CTAs gentle.",
    dontList: "No trend claims. No external promises.",
  },
];

const emptyWorkspaceInstruction: WorkspaceInstructionForm = {
  tone: "",
  voice: "",
  hardRules: "",
  doList: "",
  dontList: "",
};

const normalizeInstruction = (value: unknown) => (typeof value === "string" ? value : "");

const mapStyleToInstruction = (style: WorkspaceStyle): BrandInstruction => {
  const instructions = (style.instructions ?? {}) as Record<string, unknown>;
  return {
    id: style.id,
    tag: style.name,
    tone: normalizeInstruction(instructions.tone),
    hardRules: normalizeInstruction(instructions.hardRules),
    doList: normalizeInstruction(instructions.doList),
    dontList: normalizeInstruction(instructions.dontList),
  };
};

const mapInstructionToStyle = (entry: BrandInstruction) => ({
  id: entry.id.startsWith("temp-") ? undefined : entry.id,
  name: entry.tag,
  description: null,
  instructions: {
    tone: entry.tone,
    hardRules: entry.hardRules,
    doList: entry.doList,
    dontList: entry.dontList,
  },
});

export default function SettingsClient({
  repos,
  role,
  isAdmin,
}: {
  repos: RepoAccess[];
  role?: "OWNER" | "MEMBER";
  isAdmin: boolean;
}) {
  const canManage = isAdmin || role === "OWNER";
  const [instructions, setInstructions] = useState<BrandInstruction[]>(defaultInstructions);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [workspaceInstruction, setWorkspaceInstruction] =
    useState<WorkspaceInstructionForm>(emptyWorkspaceInstruction);
  const [instructionSaveState, setInstructionSaveState] = useState<SaveState>("idle");
  const [styles, setStyles] = useState<WorkspaceStyle[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [featuresSaveState, setFeaturesSaveState] = useState<SaveState>("idle");
  const [apiKeyState, setApiKeyState] = useState<WorkspaceApiKeyState>({
    configured: false,
    last4: null,
    provider: "openai",
  });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySaveState, setApiKeySaveState] = useState<SaveState>("idle");
  const [defaultStyleId, setDefaultStyleId] = useState<string>("");
  const [preferenceSaveState, setPreferenceSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    const load = async () => {
      try {
        const [stylesRes, instructionRes, featureRes, apiKeyRes, prefRes] = await Promise.all([
          fetch("/api/workspaces/styles"),
          fetch("/api/workspaces/instructions"),
          fetch("/api/workspaces/features"),
          fetch("/api/workspaces/api-key"),
          fetch("/api/workspaces/style-preference"),
        ]);

        if (stylesRes.ok) {
          const data = (await stylesRes.json()) as { styles: WorkspaceStyle[] };
          setStyles(data.styles ?? []);
          const mapped = (data.styles ?? []).filter((style) => !style.isPreset).map(mapStyleToInstruction);
          if (mapped.length) {
            setInstructions(mapped);
          }
        }

        if (instructionRes.ok) {
          const data = (await instructionRes.json()) as { instruction?: WorkspaceInstructionForm };
          if (data.instruction) {
            setWorkspaceInstruction({
              tone: data.instruction.tone ?? "",
              voice: data.instruction.voice ?? "",
              hardRules: data.instruction.hardRules ?? "",
              doList: data.instruction.doList ?? "",
              dontList: data.instruction.dontList ?? "",
            });
          }
        }

        if (featureRes.ok) {
          const data = (await featureRes.json()) as { features: Record<string, boolean> };
          setFeatures(data.features ?? {});
        }

        if (apiKeyRes.ok) {
          const data = (await apiKeyRes.json()) as WorkspaceApiKeyState;
          setApiKeyState({
            configured: Boolean(data.configured),
            last4: data.last4 ?? null,
            provider: data.provider ?? "openai",
          });
        }

        if (prefRes.ok) {
          const data = (await prefRes.json()) as { preference?: { defaultStyleId?: string | null } };
          setDefaultStyleId(data.preference?.defaultStyleId ?? "");
        }
      } catch {
        setSaveState("error");
      }
    };

    void load();
  }, []);

  const saveWorkspaceInstruction = async () => {
    if (!canManage) return;
    setInstructionSaveState("idle");
    try {
      const response = await fetch("/api/workspaces/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspaceInstruction),
      });
      setInstructionSaveState(response.ok ? "saved" : "error");
    } catch {
      setInstructionSaveState("error");
    }
  };

  const save = async () => {
    if (!canManage) return;
    try {
      const response = await fetch("/api/workspaces/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styles: instructions.map(mapInstructionToStyle) }),
      });
      if (!response.ok) {
        setSaveState("error");
        return;
      }
      const data = (await response.json()) as { styles: WorkspaceStyle[] };
      setStyles(data.styles ?? []);
      setInstructions(
        (data.styles ?? [])
          .filter((style) => !style.isPreset)
          .map(mapStyleToInstruction),
      );
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const reset = () => {
    if (!canManage) return;
    setInstructions(defaultInstructions);
    setSaveState("idle");
  };

  const saveFeatures = async () => {
    if (!canManage) return;
    try {
      const updates = FEATURE_KEYS.map((key) => ({
        key,
        enabled: Boolean(features[key]),
      }));
      const response = await fetch("/api/workspaces/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      setFeaturesSaveState(response.ok ? "saved" : "error");
    } catch {
      setFeaturesSaveState("error");
    }
  };

  const saveDefaultStyle = async (value: string) => {
    try {
      setDefaultStyleId(value);
      const response = await fetch("/api/workspaces/style-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultStyleId: value || null }),
      });
      setPreferenceSaveState(response.ok ? "saved" : "error");
    } catch {
      setPreferenceSaveState("error");
    }
  };

  const saveApiKey = async () => {
    if (!canManage) return;
    setApiKeySaveState("idle");
    try {
      const response = await fetch("/api/workspaces/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      if (!response.ok) {
        setApiKeySaveState("error");
        return;
      }
      const data = (await response.json()) as WorkspaceApiKeyState;
      setApiKeyState({
        configured: Boolean(data.configured),
        last4: data.last4 ?? null,
        provider: data.provider ?? "openai",
      });
      setApiKeyInput("");
      setApiKeySaveState("saved");
    } catch {
      setApiKeySaveState("error");
    }
  };

  const clearApiKey = async () => {
    if (!canManage) return;
    try {
      const response = await fetch("/api/workspaces/api-key", { method: "DELETE" });
      if (response.ok) {
        setApiKeyState({ configured: false, last4: null, provider: "openai" });
        setApiKeySaveState("saved");
      } else {
        setApiKeySaveState("error");
      }
    } catch {
      setApiKeySaveState("error");
    }
  };

  const brandOptions = useMemo(
    () => Array.from(new Set(instructions.map((item) => item.tag).filter(Boolean))),
    [instructions],
  );

  const usedTags = useMemo(() => new Set(repos.map((repo) => repo.projectTag)), [repos]);

  const styleOptions = useMemo(() => {
    const presetOptions = stylePresets.map((preset) => ({ id: preset.id, label: preset.name }));
    const custom = styles
      .filter((style) => !style.isPreset)
      .map((style) => ({ id: style.id, label: style.name }));
    return [...presetOptions, ...custom];
  }, [styles]);

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-4 text-sm font-semibold text-slate-200">Workspace AI defaults</div>
        <div className="grid gap-3 text-xs text-slate-400">
          <label className="grid gap-2">
            Tone
            <input
              value={workspaceInstruction.tone}
              onChange={(event) =>
                setWorkspaceInstruction({ ...workspaceInstruction, tone: event.target.value })
              }
              disabled={!canManage}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="grid gap-2">
            Voice
            <input
              value={workspaceInstruction.voice}
              onChange={(event) =>
                setWorkspaceInstruction({ ...workspaceInstruction, voice: event.target.value })
              }
              disabled={!canManage}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="grid gap-2">
            Hard rules
            <textarea
              rows={2}
              value={workspaceInstruction.hardRules}
              onChange={(event) =>
                setWorkspaceInstruction({ ...workspaceInstruction, hardRules: event.target.value })
              }
              disabled={!canManage}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 p-2 text-sm text-slate-100"
            />
          </label>
          <label className="grid gap-2">
            Do list
            <textarea
              rows={2}
              value={workspaceInstruction.doList}
              onChange={(event) =>
                setWorkspaceInstruction({ ...workspaceInstruction, doList: event.target.value })
              }
              disabled={!canManage}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 p-2 text-sm text-slate-100"
            />
          </label>
          <label className="grid gap-2">
            Don&apos;t list
            <textarea
              rows={2}
              value={workspaceInstruction.dontList}
              onChange={(event) =>
                setWorkspaceInstruction({ ...workspaceInstruction, dontList: event.target.value })
              }
              disabled={!canManage}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 p-2 text-sm text-slate-100"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={saveWorkspaceInstruction}
            disabled={!canManage}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200"
          >
            Save defaults
          </button>
          <span className="text-xs text-slate-500">
            {instructionSaveState === "saved" ? "Saved." : instructionSaveState === "error" ? "Save failed." : null}
          </span>
        </div>
      </div>

      <AIInstructions
        instructions={instructions}
        onChange={setInstructions}
        onSave={save}
        onReset={reset}
        saveState={saveState}
        usedTags={usedTags}
        canManage={canManage}
      />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 text-sm font-semibold text-slate-200">Default style</div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <select
            value={defaultStyleId}
            onChange={(event) => saveDefaultStyle(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
          >
            <option value="">No default</option>
            {styleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {preferenceSaveState === "saved" ? "Saved." : preferenceSaveState === "error" ? "Save failed." : null}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 text-sm font-semibold text-slate-200">Workspace AI key</div>
        <div className="text-xs text-slate-500">
          {apiKeyState.configured
            ? `Workspace key set (${apiKeyState.provider}, ending ${apiKeyState.last4 ?? "—"}).`
            : "No workspace key set. Uses platform default if configured."}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <input
            type="password"
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder="Set workspace OpenAI key"
            disabled={!canManage}
            className="min-w-[240px] rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
          />
          <button
            onClick={saveApiKey}
            disabled={!canManage || !apiKeyInput}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200"
          >
            Save key
          </button>
          <button
            onClick={clearApiKey}
            disabled={!canManage}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200"
          >
            Clear
          </button>
          <span className="text-xs text-slate-500">
            {apiKeySaveState === "saved" ? "Saved." : apiKeySaveState === "error" ? "Save failed." : null}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 text-sm font-semibold text-slate-200">Workspace features</div>
        <div className="grid gap-2 text-xs text-slate-400">
          {FEATURE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(features[key])}
                onChange={(event) =>
                  setFeatures((prev) => ({ ...prev, [key]: event.target.checked }))
                }
                disabled={!canManage}
                className="h-4 w-4"
              />
              <span>{FEATURE_LABELS[key]}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={saveFeatures}
            disabled={!canManage}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200"
          >
            Save features
          </button>
          <span className="text-xs text-slate-500">
            {featuresSaveState === "saved" ? "Saved." : featuresSaveState === "error" ? "Save failed." : null}
          </span>
        </div>
      </div>

      <RepoAccessEditor repos={repos} brandOptions={brandOptions} />
    </div>
  );
}
