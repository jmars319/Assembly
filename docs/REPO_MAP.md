# Repo Map

Assembly by JAMARQ is a pnpm monorepo with two app targets and a small shared core.

## Top-level folders

- `apps/webapp`: the fuller Next.js implementation, including auth, Prisma access, API handlers, and current product behavior
- `apps/desktopapp`: the Tauri + Rust + React/Vite desktop shell
- `packages/shared-types`: reusable enums, DTOs, style presets, and workspace feature shapes
- `packages/domain`: reusable validation, parsing, and audit-display helpers
- `packages/prompts`: reusable prompt/instruction composition
- `docs`: developer workflow, architecture notes, and operational references
- `scripts`: root-level developer helpers for bootstrap, dev, verify, and doctor flows

## Shared vs web-only

Shared now:
- content types and statuses
- style presets
- workspace feature labels
- content parsers and validators
- audit label mapping
- prompt and instruction layering

Still web-only:
- auth and session handling
- Prisma schema, migrations, and database access
- Next.js API routes
- GitHub App install and sync flows
- hosted deployment concerns

## Why desktop is still a shell

- The desktop app is intentionally not feature-parity yet.
- It exists to stabilize Tauri/Rust boundaries and consume shared logic safely.
- The webapp remains the authoritative implementation while desktop-first local ownership is still deferred.

## Temporary webapp shim files

These files are temporary re-export shims that keep existing webapp imports stable while the source of truth lives in `packages/*`:

- `apps/webapp/lib/content/types.ts`
- `apps/webapp/lib/content/stylePresets.ts`
- `apps/webapp/lib/content/parsers.ts`
- `apps/webapp/lib/content/validators.ts`
- `apps/webapp/lib/audit/labels.ts`
- `apps/webapp/lib/store/types.ts`
- `apps/webapp/lib/workspace/features.ts`
- `apps/webapp/lib/ai/instructionsCore.ts`

Rule:
- do not add web-only logic to those shim files
- add shared logic to `packages/*`
- remove shims only when imports are migrated intentionally

## Intentional compatibility names

These legacy names still exist on purpose and should not be renamed casually:

- `ledger_session`, `ledger_workspace`, `ledger_github_state`: legacy cookie names still read during the rename so active sessions and in-flight GitHub installs are not broken
- `LEDGER_KMS_KEY`, `LEDGER_SMOKE_EMAIL`, `LEDGER_SMOKE_PASSWORD`: legacy env fallbacks kept while `ASSEMBLY_*` names become the standard
- `LEDGER_INTERNAL`: legacy internal repo/project tag still accepted while new defaults use `ASSEMBLY_INTERNAL`
- historical Prisma migration files may still contain old Ledger names because migration history should remain stable and reviewable
