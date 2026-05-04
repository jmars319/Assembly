import { useEffect, useState } from "react";
import { getPromotionIssuesForItem } from "@assembly/domain/content";
import { GLOBAL_HARD_RULES } from "@assembly/prompts/instructions";
import { contentTypes } from "@assembly/shared-types/content";
import { stylePresets } from "@assembly/shared-types/style";
import { loadDesktopShellStatus, type DesktopShellStatus } from "./lib/commands";
import "./App.css";

type NavKey = "dashboard" | "content" | "briefs" | "assemblies" | "schedules" | "settings";

const navItems: Array<{ key: NavKey; label: string; kicker: string }> = [
  { key: "dashboard", label: "Dashboard", kicker: "Shell status" },
  { key: "content", label: "Content", kicker: "Shared types" },
  { key: "briefs", label: "Briefs", kicker: "Human review" },
  { key: "assemblies", label: "Assemblies / Drafts", kicker: "Primary workspace" },
  { key: "schedules", label: "Schedules", kicker: "Approval routing" },
  { key: "settings", label: "Settings", kicker: "Local-first setup" },
];

const formatEnumLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const fieldNotePromotionIssues = getPromotionIssuesForItem({
  type: "FIELD_NOTE",
  rawInput: "- Desktop workspace prepared\n- Shared packages extracted",
});

const sectionCopy: Record<
  NavKey,
  {
    eyebrow: string;
    title: string;
    description: string;
    focusItems: string[];
  }
> = {
  dashboard: {
    eyebrow: "Desktop-first foundation",
    title: "Assembly is ready to grow past the browser without abandoning the web app.",
    description:
      "The desktop client now shares the core content model while the existing web app remains the full implementation.",
    focusItems: [
      "Use the current web app as the functional reference implementation.",
      "Keep approvals and editorial review flows in the frontend.",
      "Move secure local concerns into Rust as features become real.",
    ],
  },
  content: {
    eyebrow: "Shared content model",
    title: "Content intake and promotion rules can already be reused outside Next.js.",
    description:
      "The desktop workspace reads shared content types and validators directly from workspace packages.",
    focusItems: [
      "Content types come from @assembly/shared-types.",
      "Promotion checks come from @assembly/domain.",
      "The current sample intentionally fails strict promotion until a third bullet exists.",
    ],
  },
  briefs: {
    eyebrow: "Brief flow",
    title: "Briefs stay human-approved and reusable as context blocks.",
    description:
      "Desktop marks the screen boundary where repo evidence, prompt composition, and review will converge.",
    focusItems: [
      "Prompt layering already lives in @assembly/prompts.",
      "Repo evidence capture remains web-only for now.",
      "The future desktop brief view should connect local context to cloud-backed evidence carefully.",
    ],
  },
  assemblies: {
    eyebrow: "Primary workspace",
    title: "Assemblies / Drafts is positioned to become the primary desktop workbench.",
    description:
      "This surface is where local persistence, approvals, and editor state should converge once the desktop client starts owning more of the production workflow.",
    focusItems: [
      "Draft state should remain recoverable without network dependence.",
      "Promotion should stay strict even when creation remains flexible.",
      "Command handlers should expose explicit file and persistence operations.",
    ],
  },
  schedules: {
    eyebrow: "Operational view",
    title: "Scheduling remains reviewable and intentionally separate from generation.",
    description:
      "The shell keeps scheduling as a dedicated surface so future background tasks and sync events can be added without overloading the editorial workspace.",
    focusItems: [
      "No auto-posting boundary changes in this pass.",
      "Background work belongs behind Rust commands.",
      "Cloud sync should be additive, not a prerequisite for local work.",
    ],
  },
  settings: {
    eyebrow: "Boundary notes",
    title: "Settings should become the bridge between local storage, secrets, and workspace policy.",
    description:
      "The desktop client can already surface shared editorial presets and global hidden rules while leaving auth, Prisma, and web APIs in place until the local model is ready.",
    focusItems: [
      "Style presets are shared across web and desktop.",
      "Global hidden rules remain centralized in @assembly/prompts.",
      "Secure secret storage is explicitly deferred to Rust-owned code.",
    ],
  },
};

function App() {
  const [activeKey, setActiveKey] = useState<NavKey>("dashboard");
  const [shellStatus, setShellStatus] = useState<DesktopShellStatus | null>(null);
  const [shellError, setShellError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadDesktopShellStatus()
      .then((nextStatus) => {
        if (!cancelled) {
          setShellStatus(nextStatus);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setShellError(error instanceof Error ? error.message : "Unknown Tauri command failure.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSection = sectionCopy[activeKey];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brandBlock">
          <span className="brandTag">tenra Assembly</span>
          <h1>Desktop workspace</h1>
          <p>Desktop-first workspace for the primary Assembly experience.</p>
        </div>

        <nav className="navList" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={item.key === activeKey ? "navItem navItemActive" : "navItem"}
              onClick={() => setActiveKey(item.key)}
              type="button"
            >
              <span>{item.label}</span>
              <small>{item.kicker}</small>
            </button>
          ))}
        </nav>

        <div className="sidebarNote">
          <span className="noteLabel">Shared prompt rule</span>
          <p>{GLOBAL_HARD_RULES[0]}</p>
        </div>
      </aside>

      <main className="mainPanel">
        <header className="hero">
          <div>
            <span className="eyebrow">{activeSection.eyebrow}</span>
            <h2>{activeSection.title}</h2>
            <p>{activeSection.description}</p>
          </div>

          <div className="statusCard">
            <span className="statusLabel">Desktop status</span>
            <strong>{shellStatus?.productName ?? "Loading shell status..."}</strong>
            <p>{shellError ?? shellStatus?.storageStrategy ?? "Waiting for Rust state..."}</p>
            <span className="statusPill">{shellStatus?.mode ?? "pending"}</span>
          </div>
        </header>

        <section className="workspaceGrid">
          <div className="contentColumn">
            <div className="panel">
              <div className="panelHeader">
                <span>Current focus</span>
                <strong>{navItems.find((item) => item.key === activeKey)?.label}</strong>
              </div>
              <ul className="bulletList">
                {activeSection.focusItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="panelGrid">
              <section className="panel">
                <div className="panelHeader">
                  <span>Shared content types</span>
                  <strong>{contentTypes.length} reusable definitions</strong>
                </div>
                <div className="pillRow">
                  {contentTypes.map((type) => (
                    <span key={type} className="contentPill">
                      {formatEnumLabel(type)}
                    </span>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panelHeader">
                  <span>Promotion guardrail example</span>
                  <strong>{fieldNotePromotionIssues.length} strict issue(s)</strong>
                </div>
                <p className="panelCopy">
                  The desktop workspace is reading the shared validation package. This sample field note is still
                  missing one bullet before READY/APPROVED.
                </p>
                <ul className="issueList">
                  {fieldNotePromotionIssues.map((issue) => (
                    <li key={issue.code}>{issue.message}</li>
                  ))}
                </ul>
              </section>

              <section className="panel">
                <div className="panelHeader">
                  <span>Editorial preset baseline</span>
                  <strong>{stylePresets[0]?.name ?? "Unavailable"}</strong>
                </div>
                <p className="panelCopy">{stylePresets[0]?.description}</p>
                <ul className="metaList">
                  <li>Tone: {stylePresets[0]?.constraints.tone}</li>
                  <li>Length: {stylePresets[0]?.constraints.length}</li>
                  <li>Structure: {stylePresets[0]?.constraints.structure}</li>
                </ul>
              </section>
            </div>
          </div>

          <aside className="detailColumn">
            <section className="panel detailPanel">
              <div className="panelHeader">
                <span>Local services</span>
                <strong>{shellStatus?.productName ?? "tenra Assembly"}</strong>
              </div>
              <p className="panelCopy">
                {shellStatus?.syncStrategy ??
                  "Sync planning stays deferred until local persistence and desktop review flows are stable."}
              </p>
              <div className="boundaryGrid">
                <div>
                  <h3>Rust owns</h3>
                  <ul className="metaList">
                    {(shellStatus?.rustBoundary ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Frontend owns</h3>
                  <ul className="metaList">
                    {(shellStatus?.frontendBoundary ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="panel detailPanel">
              <div className="panelHeader">
                <span>Migration posture</span>
                <strong>Web app remains intact</strong>
              </div>
              <ul className="metaList">
                <li>Auth, Prisma, and API routes stay in `apps/webapp` for now.</li>
                <li>Desktop starts as a shell plus shared logic consumer.</li>
                <li>The eventual local data layer should start with SQLite and explicit sync rules.</li>
              </ul>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default App;
