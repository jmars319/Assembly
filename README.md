# tenra Assembly Monorepo

tenra Assembly is a desktop-first tool for AI-assisted, human-approved content production. This repo keeps the existing web app fully functional while giving the Tauri desktop client a practical local content workbench.

Start here:
- `docs/SYSTEM_OVERVIEW.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/REPO_MAP.md`
- `docs/STABILITY_CHECKLIST.md`
- `docs/DESKTOP_ARCHITECTURE.md`

## Workspace layout

```text
apps/
  webapp/       Existing Next.js + Prisma implementation
  desktopapp/   Tauri + Rust + React/Vite local workbench

packages/
  shared-types/ Reusable enums, DTOs, presets, and feature keys
  domain/       Reusable validators, parsers, and audit label mapping
  prompts/      Shared instruction layering and prompt guidance
```

What belongs where:
- `apps/webapp`: current full product behavior, auth, Prisma, API routes, and hosted-web concerns
- `apps/desktopapp`: local draft, review, approval, export, Tauri/Rust boundary work, and shared-package consumption
- `packages/*`: low-risk shared logic that both app targets can consume safely

## Canonical commands

Bootstrap:

```bash
pnpm run bootstrap
```

Daily development:

```bash
pnpm run dev:web
pnpm run dev:desktop
pnpm run dev:both
```

Verification:

```bash
pnpm run check:env
pnpm run check:packages
pnpm run lint
pnpm run typecheck
pnpm run verify:web
pnpm run verify:desktop
pnpm run verify:all
pnpm run doctor
```

Builds:

```bash
pnpm run build:web
pnpm run build:desktop
pnpm run prisma:generate:web
pnpm run prisma:validate:web
```

Notes:
- `doctor` is the canonical non-interactive repo health command.
- `lint` covers the JS/TS workspace.
- `typecheck` covers both apps and all shared packages.
- `verify:web` and `verify:desktop` are meaningful, target-specific health checks.

## Current product split

- `apps/webapp` remains the fuller cloud-backed implementation today.
- `apps/desktopapp` is a usable local desktop workbench for manual content items, review gates, approvals, and Markdown export.
- `packages/*` hold the shared core that both targets can reuse now.

## Local AI Provider

Assembly can now run AI draft/assist flows against a local model server instead
of requiring OpenAI. The current local path uses Ollama's native `/api/generate`
endpoint:

```bash
ASSEMBLY_LOCAL_AI_PROVIDER=ollama
ASSEMBLY_LOCAL_AI_BASE_URL=http://127.0.0.1:11434
ASSEMBLY_LOCAL_AI_MODEL=llama3.2
```

`OPENAI_API_KEY` and workspace API keys still work. For an OpenAI-compatible
local server, set `ASSEMBLY_LOCAL_AI_PROVIDER=openai-compatible` and point
`ASSEMBLY_LOCAL_AI_BASE_URL` at the local `/v1` endpoint. `OPENAI_BASE_URL`
also remains supported. The local model still has to be running; Assembly does
not bundle model weights.

When to use each app:
- Use `webapp` for auth, Prisma-backed flows, API work, and the current end-to-end product.
- Use `desktopapp` for local drafting, reusable content templates, validation, approval state, export, Rust/Tauri boundary work, and future local-first ownership.

## Environment and compatibility names

- Canonical env files live at the repo root: `.env` and `.env.local`
- `apps/webapp` loads repo-root env files explicitly for dev, build, and Prisma commands
- `desktopapp` currently does not depend on the webapp env loading path
- Preferred env names now use `ASSEMBLY_*`
- Legacy `LEDGER_*` names still work where noted for compatibility
- See `docs/DEVELOPER_GUIDE.md` for the exact compatibility mapping and current setup notes.

## Docs kept on purpose

- `docs/SYSTEM_OVERVIEW.md`: product/system summary and boundaries
- `docs/DEVELOPER_GUIDE.md`: bootstrap, env, dev, verify, and compatibility names
- `docs/REPO_MAP.md`: monorepo layout, shared/web-only split, and shim inventory
- `docs/STABILITY_CHECKLIST.md`: operational checklist before changes, commits, handoff, and release tags
- `docs/DESKTOP_ARCHITECTURE.md`: local-first and Rust/frontend boundary note
- `docs/DEPLOYMENT_GUIDE.md`: web deployment notes
- `docs/PHASE0_MVP_PLAN.md`: archived design context that predates the current stabilized monorepo
