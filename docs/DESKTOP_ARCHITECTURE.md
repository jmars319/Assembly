# Desktop Architecture Note

tenra Assembly now ships two apps in the same monorepo because the existing web app is still the complete implementation, while the desktop client is the future primary surface.

## What remains web-only today

- Auth and session handling
- Prisma schema, migrations, and database access
- Next.js API routes
- GitHub App install/sync flows
- Current hosted deployment path

## Why both apps coexist

- The web app is the working product and reference implementation.
- The desktop app can grow without forcing a risky rewrite.
- Shared packages let new logic move once and stay reusable.
- Future hosted/admin/client surfaces may still belong on the web.

## Desktop-first local storage plan

- Local-first persistence is planned, not fully implemented yet.
- SQLite is the likely first local database.
- Rust should own file access, local DB access, secret storage, and background tasks.
- The frontend should stay focused on editing, approvals, settings, and presentation.

## Sync and cloud posture

- Cloud sync should follow a stable local model, not replace it.
- Future sync should be explicit, auditable, and compatible with human approval workflows.
- The web app remains the authoritative cloud-backed implementation until desktop storage and sync are proven.
