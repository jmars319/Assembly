# Developer Guide

Use this guide for day-to-day work in the Assembly by JAMARQ monorepo.

## Bootstrap

1. Run `pnpm run bootstrap`
2. Copy `.env.example` to `.env.local` if you need local config
3. Run `pnpm run check:env`
4. Use the Node version in `.node-version` / `.nvmrc`

## Environment files

- Canonical env files live at the repo root: `.env` and `.env.local`
- `apps/webapp` loads repo-root env files explicitly; hidden symlinks are not required for normal use
- `apps/webapp/.env` and `apps/webapp/.env.local` are optional local overrides only
- `desktopapp` currently does not depend on the webapp env loading path
- `pnpm run check:env` fails early on broken env links, missing DB env for `STORAGE_MODE=db`, or partial GitHub integration config

Webapp env summary:
- Required for normal DB-backed development: `STORAGE_MODE=db`, `DATABASE_URL`
- Optional unless those features are used: `ASSEMBLY_KMS_KEY`, GitHub App env vars, `OPENAI_API_KEY`
- GitHub App env vars should be configured as a complete set or left unset entirely

Legacy compatibility names:
- `ASSEMBLY_KMS_KEY` is preferred; `LEDGER_KMS_KEY` is still accepted as a fallback
- `ASSEMBLY_SMOKE_EMAIL` is preferred; `LEDGER_SMOKE_EMAIL` is still accepted as a fallback
- `ASSEMBLY_SMOKE_PASSWORD` is preferred; `LEDGER_SMOKE_PASSWORD` is still accepted as a fallback
- Legacy cookie names (`ledger_session`, `ledger_workspace`, `ledger_github_state`) are still read temporarily so active sessions and in-flight GitHub installs are not broken during the rename

## Run the webapp

DB mode:
1. Set in `.env.local`:
   - `STORAGE_MODE=db`
   - `DATABASE_URL=postgresql://localhost:5432/assembly?schema=public`
2. Run:
   - `pnpm run prisma:generate:web`
   - `pnpm --filter webapp prisma:migrate`
3. Optional: `pnpm --filter webapp db:smoke`

Notes:
- The current webapp is effectively DB-backed for real sign-in and persisted workflows.
- Non-DB mode is not the recommended day-to-day path.

Prisma migrate diff (shadow DB):
```bash
createdb assembly_shadow
```

Set:
```bash
SHADOW_DATABASE_URL=postgresql://localhost:5432/assembly_shadow
```

Then:
```bash
pnpm --filter webapp exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script
```

Dev-only seed data (DB mode):
```bash
STORAGE_MODE=db NODE_ENV=development pnpm --filter webapp db:seed
```

Content Ops seed/smoke (DB mode):
```bash
pnpm --filter webapp content:seed
pnpm --filter webapp content:smoke
```

GitHub App setup (optional, DB mode):
- Configure env vars in `.env.local`
- Go to `/settings/integrations/github` and install/select repos
- `pnpm --filter webapp github:smoke` skips if not configured or not installed

AI integration (optional):
- Set `OPENAI_API_KEY` in `.env.local`
- AI endpoints remain manual and human-reviewed

## Run the desktopapp

- Run `pnpm run dev:desktop`
- The desktop app is currently a shell plus shared-logic consumer
- Web auth, Prisma, and API routes remain in `apps/webapp`

## Run both apps

- Run `pnpm run dev:both`
- This starts the webapp dev server and the desktop Tauri dev flow together
- Press `Ctrl+C` once to stop both cleanly

## Verification

Use these from the repo root:
- `pnpm run check:packages`
- `pnpm run verify:web`
- `pnpm run verify:desktop`
- `pnpm run verify:all`
- `pnpm run doctor`
- `pnpm run lint`
- `pnpm run typecheck`

Verification intent:
- `check:packages` verifies shared packages typecheck and their exports resolve from real consumer contexts
- `verify:web` checks shared packages, Prisma generate/validate, webapp typecheck, and webapp build
- `verify:desktop` checks shared packages, desktopapp typecheck, desktop frontend build, and a lightweight Tauri debug build
- `verify:all` runs both target verifications in sequence and stops on failure
- `doctor` runs `check:env`, `lint`, `typecheck`, `verify:web`, and `verify:desktop`

## Root scripts

- `pnpm run bootstrap`
- `pnpm run check:env`
- `pnpm run check:packages`
- `pnpm run dev:web`
- `pnpm run dev:desktop`
- `pnpm run dev:both`
- `pnpm run build:web`
- `pnpm run build:desktop`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run verify:web`
- `pnpm run verify:desktop`
- `pnpm run verify:all`
- `pnpm run doctor`
- `pnpm run prisma:generate:web`
- `pnpm run prisma:validate:web`

## Related docs

See [docs/REPO_MAP.md](/Users/jason_marshall/JAMARQ/Experiments/Assembly/docs/REPO_MAP.md) for the monorepo layout and shim inventory.
See [docs/STABILITY_CHECKLIST.md](/Users/jason_marshall/JAMARQ/Experiments/Assembly/docs/STABILITY_CHECKLIST.md) for the operating checklist.
See [docs/DESKTOP_ARCHITECTURE.md](/Users/jason_marshall/JAMARQ/Experiments/Assembly/docs/DESKTOP_ARCHITECTURE.md) for the desktop-first boundary note.
