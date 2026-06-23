# Columb.io

Outbound email automation for modern teams.

Columb.io is a Next.js application for workspace-based contact management, email templates, campaign scheduling, and safe email job processing. The project has been hardened to avoid accidental live email sends during local development and collaboration.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres, RLS, and SSR clients
- Resend and Nodemailer/SMTP provider paths
- Radix UI and lucide-react UI primitives

## Quick Start

Install dependencies:

```bash
npm install
```

Create local environment config:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Fill `.env.local` with development or staging credentials. Do not commit `.env.local`.

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` - start the local Next.js dev server.
- `npm run lint` - run ESLint.
- `npm run build` - run a production build and TypeScript checks.
- `npm run start` - start the built production server.

## Required Environment

Use `.env.example` as the source of truth for required variables:

- Supabase URL and anon key
- Supabase service role key for server-side admin operations
- Resend API key, if using Resend
- SMTP host/user/password/port/from, if using SMTP
- `CRON_SECRET` for background/cron processing
- `APP_URL`
- Safe email mode controls

## Safe Email Modes

The app uses `EMAIL_SEND_MODE` and `ALLOW_LIVE_EMAIL_SENDS` to prevent accidental real email delivery.

### `EMAIL_SEND_MODE=mock`

Default for non-production when the variable is missing. No real provider is called. Jobs complete as `mocked`.

### `EMAIL_SEND_MODE=dry_run`

Compiles the email and processes the job path, but does not call SMTP or Resend. Jobs complete as `dry_run`.

### `EMAIL_SEND_MODE=live`

Allows real delivery only when:

```env
EMAIL_SEND_MODE=live
ALLOW_LIVE_EMAIL_SENDS=true
```

Do not use `live` without explicit approval and a verified test plan.

## Email Safety Warning

Do not run `/api/send` with real SMTP/Resend credentials unless the team has explicitly approved the run. Local and staging work should use:

```env
EMAIL_SEND_MODE=mock
ALLOW_LIVE_EMAIL_SENDS=false
```

or:

```env
EMAIL_SEND_MODE=dry_run
ALLOW_LIVE_EMAIL_SENDS=false
```

## Documentation

- [Setup Guide](docs/SETUP.md)
- [Technical Status](docs/TECHNICAL_STATUS.md)

## Database Migrations

SQL migrations live in `supabase/migrations`.

The repo contains the current intended schema history, but do not assume these migrations have already been applied to the real Supabase project. Apply them first in a local, development, or staging database, verify data and policies, then promote carefully.

Do not apply migrations to production without review.

## Current Safety Baseline

- Workspace data is isolated through `workspace_members`.
- Role permissions exist for `owner`, `admin`, `manager`, `member`, and `viewer`.
- `/api/send` requires authentication or `CRON_SECRET`, workspace scope, and send permission.
- Email jobs support safe send modes, explicit simulated statuses, lock/retry recovery, and idempotency.
