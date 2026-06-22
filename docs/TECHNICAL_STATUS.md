# Columb.io Technical Status

This document summarizes the current technical baseline for collaborators.

## Application State

Columb.io is a workspace-based outbound email automation app. It currently covers:

- Supabase authentication.
- Workspace membership and active workspace context.
- Contacts.
- Templates.
- Campaigns.
- SMTP settings.
- Safe campaign job creation and processing.
- Dashboard metrics for real and simulated sends.

Do not assume CSV import, real notifications, or follow-up automation are production-ready unless a later patch explicitly says so.

## Roles

Roles are defined in `lib/permissions.ts` and in the database migration `20260622000002_workspace_member_roles.sql`.

| Role | Intent |
| --- | --- |
| `owner` | Full workspace control, including destructive workspace-level permissions. |
| `admin` | Workspace administration without deleting the workspace or managing billing. |
| `manager` | Operational campaign/contact/template management and sending. |
| `member` | Basic contact and template work; limited campaign draft behavior. |
| `viewer` | Read-oriented role with no explicit app-level permissions. |

## App-Level Permissions

| Permission | owner | admin | manager | member | viewer |
| --- | --- | --- | --- | --- | --- |
| manageWorkspace | yes | yes | no | no | no |
| manageMembers | yes | yes | no | no | no |
| manageSmtp | yes | yes | no | no | no |
| manageContacts | yes | yes | yes | yes | no |
| deleteContacts | yes | yes | yes | no | no |
| manageTemplates | yes | yes | yes | yes | no |
| deleteTemplates | yes | yes | yes | no | no |
| manageCampaigns | yes | yes | yes | no | no |
| sendCampaigns | yes | yes | yes | no | no |
| importContacts | yes | yes | yes | no | no |
| exportContacts | yes | yes | yes | no | no |
| deleteWorkspace | yes | no | no | no | no |
| manageBilling | yes | no | no | no | no |
| viewAnalytics | yes | yes | yes | no | no |

## Workspace Isolation

Workspace isolation is based on `workspace_members`.

The active workspace is read from the user profile, then verified against `workspace_members`. Server Actions and pages should only operate on a workspace where the user has membership.

Database RLS policies use helper functions such as:

- `is_workspace_member`
- `current_user_workspace_role`
- `current_user_has_workspace_role`
- `is_workspace_admin`

Main workspace-scoped tables include:

- `contacts`
- `templates`
- `campaigns`
- `email_jobs`
- `smtp_settings`
- `notifications`

## RLS Baseline

Reads are generally membership-based. Mutations are role-aware where the role patch has been applied.

Examples:

- Contacts/templates can be managed by owner/admin/manager/member, with deletes limited to owner/admin/manager.
- Campaigns can be managed by owner/admin/manager, with limited member draft behavior.
- Email jobs can be mutated by owner/admin/manager.
- SMTP settings are limited to owner/admin.
- Notifications are readable by workspace members and mutable by owner/admin.

## `/api/send` Protection

The send endpoint is protected by multiple checks:

- Cron/background execution requires `Authorization: Bearer <CRON_SECRET>`.
- User-triggered execution requires an authenticated Supabase user.
- User-triggered execution is scoped to the active workspace.
- `force=true` is not global for regular users.
- `force=true` requires `canSendCampaigns`.
- Cron force mode requires an explicit `workspace_id`.
- Admin client usage is constrained by workspace filters before job processing.

Do not run `/api/send` with real credentials without explicit approval.

## Safe Email Modes

Email delivery is centrally controlled by `lib/email-mode.ts`.

| Mode | Behavior | Final job status |
| --- | --- | --- |
| `mock` | Does not call SMTP or Resend; simulates success. | `mocked` |
| `dry_run` | Compiles/processes but does not call SMTP or Resend. | `dry_run` |
| `live` | Can call SMTP or Resend only when `ALLOW_LIVE_EMAIL_SENDS=true`. | `sent` on success |

If `EMAIL_SEND_MODE=live` but `ALLOW_LIVE_EMAIL_SENDS` is not `true`, processing is blocked.

In non-production environments, the default is safe mock behavior when mode is missing.

## Email Job Statuses

| Status | Meaning |
| --- | --- |
| `queued` | Waiting to be claimed. |
| `processing` | Claimed by a processing run. |
| `sent` | Real provider delivery succeeded. |
| `failed` | Exhausted attempts or failed permanently. |
| `mocked` | Simulated success in mock mode. |
| `dry_run` | Processed without provider delivery in dry-run mode. |
| `cancelled` | Cancelled job, including duplicate cleanup. |

Dashboard sent metrics count real `sent` jobs only when `send_mode='live'`.

## Job Lock, Retry, and Recovery

`email_jobs` include processing metadata:

- `attempt_count`
- `max_attempts`
- `locked_at`
- `locked_by`
- `last_error`
- `processed_at`

The SQL function `claim_email_jobs` atomically claims queued jobs and stale processing jobs. It uses a run id, batch size, workspace scope, attempt limits, and stale lock recovery.

Handled failures return jobs to `queued` when attempts remain. Exhausted jobs become `failed`.

## Job Idempotency

`email_jobs` include:

- `idempotency_key`
- `sequence_index`

For the initial campaign step, `sequence_index` is `0` and the deterministic key is:

```text
campaign_id:contact_id:sequence_index
```

The database enforces one active job per `workspace_id`, `campaign_id`, `contact_id`, and `sequence_index`. Duplicate insert attempts are counted as `duplicateJobsSkipped` in `/api/send`.

Legacy duplicates are resolved by migration: one canonical job is kept and the rest are marked `cancelled`.

## Migrations

Current migrations in the repository:

```text
20260615000000_init_schema.sql
20260615000001_workspace_members.sql
20260615000002_contacts_add_linkedin_imported.sql
20260615000003_campaign_days_time.sql
20260615000004_smtp_settings.sql
20260616000000_campaigns_add_targeting.sql
20260616000001_smtp_settings_multi.sql
20260616000002_workspace_timezone.sql
20260622000000_fix_handle_new_user_membership.sql
20260622000001_harden_workspace_rls.sql
20260622000002_workspace_member_roles.sql
20260622000003_email_job_send_modes.sql
20260622000004_email_job_processing_locks.sql
20260622000005_email_job_idempotency.sql
```

These files are present in the repo. They may or may not have been applied to any real Supabase project.

Apply migrations first in development or staging. Review data effects before production, especially migrations that update roles, RLS, job statuses, locks, and duplicate jobs.

## Known Follow-Up Items

- Confirm which Supabase environment has received each migration.
- Add generated Supabase TypeScript database types if the project starts relying on typed table inserts.
- Rename Next.js `middleware` to `proxy` when scheduled; current build reports a deprecation warning.
- Replace remaining raw `<img>` usage with `next/image` where appropriate.
- Clean existing mojibake text in older UI copy.
