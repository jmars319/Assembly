# Deployment Guide

This repo currently deploys the web target, not the desktop shell.

Railway (web service)
1. Create a PostgreSQL plugin.
2. Set env vars from `.env.example`.
3. Ensure `PORT` is set (Railway injects this).
4. Deploy `apps/webapp` as the web service.

DB mode in production
- `STORAGE_MODE=db`
- `DATABASE_URL` points at Railway Postgres
- Run migrations with `pnpm --filter webapp prisma:migrate`
- Prefer `pnpm run verify:web` before production deploys

GitHub App (optional)
- Use the same GitHub App env vars as local dev.
- Install the app and select repos via `/settings/integrations/github`.
