# Assembly by JAMARQ Phase 0 Hardening Plan (Archived)

Purpose: provide a lean, implementable design plan and Prisma schema proposal for approval before Phase 1. This document is kept as historical design context; it predates the current stabilized monorepo and should not be treated as the primary source of truth for current setup commands.

## Decisions (source of truth)
- Admin is global via `User.isAdmin` (not a workspace role).
- Invite acceptance flow: Option A — invite acceptance creates user if missing, sets password, then creates membership.
- User instructions: v1 is global per user (not workspace-scoped), with a planned migration path to workspace-scoped later.
- Membership revocation: session remains valid, but every workspace request must enforce active membership (403 immediately on revoke).
- Usage caps: track both tokens and request counts; v1 logs usage, enforcement stubbed.
- Workspace resolution: session-scoped `activeWorkspaceId` stored in cookie; changed via explicit switch action.
- Invite expiry: stored `expiresAt` and enforced on read (no background job in v1).
- Password reset: revoke all active sessions on successful reset.

## Scope (Phase 1 target)
- Email + password auth (no OAuth).
- Sessions, password reset, and basic rate limits.
- Workspaces with strict data separation.
- Roles: Admin (superuser), Owner, Member.
- Invitations and revocations.
- Feature flags enforced at API and hidden in UI.
- AI instructions layered: global → workspace → user → style → request.
- Per-workspace API key storage with usage caps scaffolding.
- Migration of existing single-tenant data into a default workspace.

## System Design (lean)

### Authentication
- Email + password only.
- Password hashing with Argon2 or bcrypt (prefer Argon2).
- Session tokens stored in DB; httpOnly cookie.
- Reset tokens stored in DB, expire automatically.
- Basic rate limiting: per-email attempt counter + temporary lock (DB fields).
- Optional: lightweight IP-based limiter to reduce brute force.

### Workspaces + Roles
- Workspace is the primary boundary.
- Users can belong to multiple workspaces via membership table.
- Roles:
  - Admin: global superuser via `User.isAdmin` (not a workspace role); bypasses workspace role checks but never merges data.
  - Owner: manage users, features, instructions, API key, styles.
  - Member: use system, set personal AI preferences only.
- Ownership transfer:
  - Owners can transfer ownership to another member.
  - Guardrail: a workspace must always have at least one Owner.

### Invites
- Owner can invite via email.
- Invite tokens expire, revocable, and are single-use (usedAt).
- `InviteStatus.EXPIRED` is derived at read-time in v1 (no background job).
- Acceptance flow (v1):
  - Accept invite link → set password → user created if missing → membership created → login.
  - If user exists, attach membership.
  - Expired/revoked invite → clear error, no changes.
- Expiry is enforced by comparing `expiresAt` on read; no background job in v1.
- Revocation removes membership; membership checks are enforced on every request.
- On revoke, invalidate user sessions or deny on membership check (preferred: deny via membership).
- Successful login resets failedLoginCount and clears lockedUntil.
- Successful password reset revokes all active sessions for the user.

### Feature Flags (server-enforced)
- Workspace-level flags (starter set below, expandable).
- API routes check flags and return 403 when disabled.
- UI hides disabled features for non-admin.
- Starter set (granular):
  - GITHUB, GITHUB_CONNECT, GITHUB_SYNC
  - CONTENT_OPS, CONTENT_UPLOAD
  - SCHEDULING
  - AI_ASSIST, AI_BRIEFS, AI_CONTENT_ASSIST, AI_SCHEDULER

Standard response for disabled feature:
```
HTTP 403
{ "error": "Feature disabled.", "code": "feature_disabled", "feature": "<FEATURE_KEY>" }
```

Default flags for new workspace (v1):
- GITHUB: disabled
- GITHUB_CONNECT: disabled
- GITHUB_SYNC: disabled
- CONTENT_OPS: enabled
- CONTENT_UPLOAD: enabled
- SCHEDULING: enabled
- AI_ASSIST: enabled
- AI_BRIEFS: enabled
- AI_CONTENT_ASSIST: enabled
- AI_SCHEDULER: enabled

### AI Instructions Layering
Order:
1) Global hard rules (code-only).
2) Workspace instructions (owner/admin).
3) User instructions (member preferences).
4) Style preset (selected).
5) Per-request context (brief/content).

Global hard rule (verbatim): NO EM-DASHES EVER.

### API Key per Workspace + Usage Caps
- Workspace can store optional OpenAI key encrypted at rest.
- Decision: encrypt using a single server secret (prefer `ASSEMBLY_KMS_KEY`, with `LEDGER_KMS_KEY` accepted as a legacy fallback) via node crypto; store `apiKeyCipher` and `apiKeyLast4`.
- Default to platform key when workspace key is empty.
- Usage caps: daily limit and monthly limit fields; enforcement stubbed (tracking table).
- Usage tracking per workspace and per user; log token count and request count for future billing.

### Onboarding
- Owner setup wizard (required on workspace creation).
- Member setup wizard (skippable on first login).
- Store completion flags to allow re-entry later.

## Prisma Schema Proposal (new models + fields)

### Enums
```
enum WorkspaceRole {
  OWNER
  MEMBER
}

enum FeatureKey {
  GITHUB
  GITHUB_CONNECT
  GITHUB_SYNC
  CONTENT_OPS
  CONTENT_UPLOAD
  SCHEDULING
  AI_ASSIST
  AI_BRIEFS
  AI_CONTENT_ASSIST
  AI_SCHEDULER
}

enum InviteStatus {
  PENDING
  ACCEPTED
  REVOKED
  EXPIRED
}
```

### New Models
```
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  isAdmin       Boolean  @default(false)
  failedLoginCount Int?  @default(0)
  lockedUntil   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  memberships   WorkspaceMember[]
  sessions      Session[]
  passwordResets PasswordReset[]
  userInstructions UserInstruction?
}

model Workspace {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  members       WorkspaceMember[]
  features      WorkspaceFeature[]
  invites       WorkspaceInvite[]
  instructions  WorkspaceInstruction?
  apiKeys       WorkspaceApiKey?
  usageCaps     WorkspaceUsageCaps?
  usageLogs     WorkspaceUsageLog[]
  styles        WorkspaceStyle[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        WorkspaceRole
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
}

model Session {
  id          String   @id @default(cuid())
  userId      String
  token       String   @unique
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PasswordReset {
  id          String   @id @default(cuid())
  userId      String
  token       String   @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model WorkspaceInvite {
  id          String   @id @default(cuid())
  workspaceId String
  email       String
  role        WorkspaceRole @default(MEMBER)
  token       String   @unique
  status      InviteStatus @default(PENDING)
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model WorkspaceFeature {
  id          String   @id @default(cuid())
  workspaceId String
  key         FeatureKey
  enabled     Boolean @default(true)
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, key])
}

model WorkspaceInstruction {
  id          String   @id @default(cuid())
  workspaceId String   @unique
  tone        String?
  voice       String?
  hardRules   String?
  doList      String?
  dontList    String?
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model UserInstruction {
  id        String   @id @default(cuid())
  userId    String   @unique
  tone      String?
  notes     String?
  updatedAt DateTime @updatedAt

  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model WorkspaceApiKey {
  id            String   @id @default(cuid())
  workspaceId   String   @unique
  provider      String   @default("openai")
  apiKeyCipher  String?
  apiKeyLast4   String?
  updatedAt     DateTime @updatedAt

  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model WorkspaceUsageCaps {
  id            String   @id @default(cuid())
  workspaceId   String   @unique
  dailyLimit    Int?     // calls or tokens
  monthlyLimit  Int?
  updatedAt     DateTime @updatedAt

  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model WorkspaceUsageLog {
  id            String   @id @default(cuid())
  workspaceId   String
  userId        String?
  model         String?
  tokens        Int?
  requestCount  Int?     @default(1)
  createdAt     DateTime @default(now())

  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user          User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
}

model WorkspaceStyle {
  id              String   @id @default(cuid())
  workspaceId     String
  name            String
  description     String?
  instructions    Json
  isPreset        Boolean  @default(false)
  createdByUserId String?
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy       User?     @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@unique([workspaceId, name])
}

model UserStylePreference {
  id              String   @id @default(cuid())
  userId          String
  workspaceId     String
  defaultStyleId  String?
  updatedAt       DateTime @updatedAt

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
}
```

### Existing Models: add workspaceId + audit fields
Add `workspaceId` (FK) to:
- Project, Brief, Post, ContentItem, AuditLog, ScheduleProposal, Task, GitHubInstallation, GitHubRepo, RepoAccess, EvidenceBundle

AuditLog additions:
- `actorUserId` (nullable for system actions)
- `actionLabel` (human-readable)
- `beforeJson` / `afterJson` (or `diffJson`) for change context

All queries must scope by workspace.

### Workspace scoping checklist
- GitHubInstallation and GitHubRepo are workspace-scoped; do not assume a global singleton.
- RepoAccess is workspace-owned (no global allowlist).
- EvidenceBundle and EvidenceItem must be workspace-scoped.
- No queries without `workspaceId` unless `User.isAdmin` and explicitly in cross-workspace admin tooling.

## Migration Approach
1) Create default workspace: `Assembly Workspace` with slug `default`.
2) Create Admin user from existing ADMIN_TOKEN (temporary bootstrap).
3) Migrate all existing rows to default workspace:
   - Add `workspaceId` with default workspace for all records.
4) Create default feature flags enabled for default workspace.
5) Mark existing global AI instructions as workspace instructions for default workspace.
6) Workspace slug generation: lowercase, dash-separated, de-dupe with numeric suffix on collision.

## Security Notes
- Session token is opaque and stored in DB; cookie is httpOnly, SameSite=Lax, Secure in production.
- Rate limiting: store `failedLoginCount` + `lockedUntil` on user (optional extra fields).
- API routes must verify:
  - Auth session
  - Workspace membership (active membership required)
  - Feature flag allowed
- Membership revocation should deny access immediately (membership check on every request).
- Session auth and workspace membership auth are separate checks; both are required.
- Workspace resolution is from the session-scoped active workspace cookie; do not infer from route without an explicit switch.

## Phase 1 Implementation Checklist (summary)
- Add models + migrations.
- Build auth routes (login/logout/reset).
- Add middleware session check (replace ADMIN_TOKEN gate).
- Add workspace selection + role enforcement.
- Add feature flag checks in API routes.
- Layer AI instructions using workspace/user/style/context.

## Open Questions for Approval
- Preferred hashing library: Argon2 vs bcrypt.
- Session expiration policy (e.g., 7 days rolling vs fixed).
- Usage cap units (requests vs token counts).
- Admin strategy confirmation: global `User.isAdmin` (recommended) vs admin as workspace role.
- Style system confirmation: include WorkspaceStyle + UserStylePreference in Phase 1.
- API key encryption approach confirmation: encrypt now with `ASSEMBLY_KMS_KEY` (with `LEDGER_KMS_KEY` legacy fallback) vs defer encryption (not recommended).
