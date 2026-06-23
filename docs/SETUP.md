# Columb.io Setup

This guide is for local development and collaborator onboarding.

## Prerequisites

- Node.js compatible with the version required by the installed Next.js release.
- npm.
- Access to a Supabase project for development or staging.
- Optional Resend or SMTP credentials only when testing live delivery with explicit approval.

## Install

```bash
npm install
```

## Environment

Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Fill the values in `.env.local`. Never commit `.env.local`.

Use safe email defaults for local work:

```env
EMAIL_SEND_MODE=mock
ALLOW_LIVE_EMAIL_SENDS=false
EMAIL_TEST_RECIPIENT=
```

## Supabase Variables

Required:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is required by server-side admin operations. It must never be exposed to the browser or committed.

## Email Variables

Safe mode controls:

```env
EMAIL_SEND_MODE=mock
EMAIL_TEST_RECIPIENT=
ALLOW_LIVE_EMAIL_SENDS=false
```

Resend:

```env
RESEND_API_KEY=
NEXT_PUBLIC_FROM_EMAIL=
```

SMTP:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

Current app SMTP accounts can also be stored per workspace in the database.

## Cron Variable

```env
CRON_SECRET=
```

Use a long random value. Cron/background calls to `/api/send` must authenticate with `Bearer <CRON_SECRET>`.

## Run Locally

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Validation

Before pushing changes:

```bash
npm run lint
npm run build
```

## Email Safety

Local and staging development should use `mock` or `dry_run`.

Do not run `/api/send` with real SMTP or Resend credentials without explicit approval. Do not set `EMAIL_SEND_MODE=live` unless `ALLOW_LIVE_EMAIL_SENDS=true` is intentionally configured and the workspace/campaign scope is verified.

## Migrations

Migrations are stored in:

```text
supabase/migrations
```

They exist in the repository, but this documentation does not confirm they are already applied in any real Supabase project.

Apply migrations carefully in this order:

1. Local or disposable development database.
2. Shared development or staging database.
3. Production only after review and backup.

Do not apply migrations to a real production project directly from local work without review.
