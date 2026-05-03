# Stability Checklist

Use this as the operating checklist for tenra Assembly from the repo root.

## Canonical commands

- Bootstrap: `pnpm run bootstrap`
- Repo doctor: `pnpm run doctor`
- Env check: `pnpm run check:env`
- Shared package check: `pnpm run check:packages`
- Full lint: `pnpm run lint`
- Full typecheck: `pnpm run typecheck`
- Web verification: `pnpm run verify:web`
- Desktop verification: `pnpm run verify:desktop`
- Full verification: `pnpm run verify:all`
- Web dev: `pnpm run dev:web`
- Desktop dev: `pnpm run dev:desktop`
- Combined dev: `pnpm run dev:both`

## Before major changes

- Run `pnpm run bootstrap` on a fresh clone or after dependency/tooling drift
- Run `pnpm run doctor` before broad refactors or cross-app changes
- Run `pnpm run check:env`
- Run `pnpm run check:packages` if touching `packages/*`
- Run `pnpm run typecheck`
- Run `pnpm run verify:web` if touching `apps/webapp`, Prisma, or shared packages used by web
- Run `pnpm run verify:desktop` if touching `apps/desktopapp`, Rust, or shared packages used by desktop
- Run `pnpm run verify:all` for monorepo-wide or cross-app changes

## Before committing

- Run `pnpm run lint`
- Run `pnpm run check:env`
- Run the verification command that matches the surface you changed
- Prefer `pnpm run verify:all` if a change touched both apps or shared packages
- If the change touches scripts/tooling/docs used across the repo, prefer `pnpm run doctor`

## Before handoff

- Run `pnpm run doctor`
- Note which target(s) you changed: `webapp`, `desktopapp`, `packages/*`, or tooling/docs
- Call out any env assumptions explicitly
- If anything was intentionally not verified, say so concretely

## Before tagging a release

- Run `pnpm run doctor`
- Confirm the working tree is intentional and reviewable
- Prefer `pnpm run verify:all` again after any release-specific doc/version updates
- Treat `doctor` and `verify:*` as CI-ready, non-interactive commands

## Fast rule of thumb

- Web-only change: `pnpm run verify:web`
- Desktop-only change: `pnpm run verify:desktop`
- Shared package change: `pnpm run verify:all`
- Tooling / root script change: `pnpm run doctor`
