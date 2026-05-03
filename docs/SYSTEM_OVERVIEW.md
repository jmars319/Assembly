# System Overview

tenra Assembly is a human-in-the-loop system for turning repo evidence, editorial context, and internal notes into reviewable content outputs.

## Current product shape

- `apps/webapp` is the fuller implementation today
- `apps/desktopapp` is the future primary client, but currently a shell
- `packages/*` hold the low-risk shared logic both targets can reuse now

## Operating pipeline

1. Connect repos with the read-only GitHub App and select the allowlist
2. Capture evidence from repos or paste internal notes
3. Create briefs from evidence or direct prompts
4. Draft posts or Content Ops artifacts
5. Apply human review and approval gates
6. Propose schedules and track manual tasks
7. Record state transitions in audit logs

## Core boundaries

- GitHub access is read-only
- AI proposes; humans approve
- No auto-posting or silent publishing
- The webapp remains the authoritative cloud-backed path until desktop local storage and sync are proven

## Key UI routes

- Dashboard: `/dashboard`
- Content: `/content`
- Briefs: `/briefs`
- Inbox: `/inbox`
- Schedules: `/schedules`, `/schedules/manage`
- Tasks: `/tasks`, `/tasks/manage`
- Settings: `/settings`, `/settings/integrations/github`

## Key code anchors

- Shared types: `packages/shared-types`
- Shared validation/parsing: `packages/domain`
- Shared prompt composition: `packages/prompts`
- Web auth/session path: `apps/webapp/lib/auth`, `apps/webapp/proxy.ts`
- Web database path: `apps/webapp/prisma`, `apps/webapp/lib/prisma.ts`
- Web GitHub integration: `apps/webapp/lib/github`, `apps/webapp/app/api/github/*`
- Desktop shell and Rust boundary: `apps/desktopapp/src`, `apps/desktopapp/src-tauri`

## Recommended docs

- `docs/DEVELOPER_GUIDE.md` for local setup, env handling, and root commands
- `docs/REPO_MAP.md` for the monorepo layout, web-only boundaries, and shim inventory
- `docs/STABILITY_CHECKLIST.md` for pre-change, pre-commit, handoff, and release checks
- `docs/DESKTOP_ARCHITECTURE.md` for the desktop-first local ownership plan
- `docs/DEPLOYMENT_GUIDE.md` for web deployment notes
