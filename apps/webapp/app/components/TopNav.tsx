import Link from "next/link";
import type { FeatureKey } from "@prisma/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/content", label: "Content", feature: "CONTENT_OPS" as FeatureKey },
  { href: "/briefs", label: "Briefs", feature: "AI_BRIEFS" as FeatureKey },
  { href: "/inbox", label: "Inbox" },
  { href: "/schedules/manage", label: "Schedules", feature: "SCHEDULING" as FeatureKey },
  { href: "/settings", label: "Settings" },
];

export default function TopNav({
  workspaceName,
  isAdmin,
  features,
}: {
  workspaceName?: string;
  isAdmin?: boolean;
  features?: Partial<Record<FeatureKey, boolean>>;
}) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 bg-slate-950/80 px-8 py-4">
      <div className="flex items-baseline gap-3">
        <span className="text-xl font-semibold tracking-tight">tenra Assembly</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {navItems
          .filter((item) => {
            if (!item.feature) return true;
            if (isAdmin) return true;
            return features?.[item.feature] ?? false;
          })
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-slate-800 px-3 py-1 text-slate-300 hover:border-slate-600 hover:text-slate-100"
            >
              {item.label}
            </Link>
          ))}
        <Link
          href="/workspaces"
          className="rounded-full border border-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-300 hover:border-slate-600 hover:text-slate-100"
        >
          {workspaceName ?? "Workspace"}
        </Link>
        {isAdmin ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-wide text-emerald-200">
            Admin
          </span>
        ) : null}
        <Link
          href="/logout"
          className="rounded-full border border-slate-800 px-3 py-1 text-slate-300 hover:border-slate-600 hover:text-slate-100"
        >
          Logout
        </Link>
      </div>
    </nav>
  );
}
