# Columb

Internal outreach platform for automated email campaigns and lead follow-up.

## Goal

Columb is an internal outreach platform designed to centralize contact management, email campaigns, automated follow-ups, and response tracking.

Initial use cases:

* Coachmetric → contact and outreach for gyms
* Joseph → contact and outreach for churches and security clients

This is NOT intended to be a complete CRM.

Priority:

1. Send emails
2. Track responses
3. Automate follow-up
4. Organize contacts

Everything else comes later.

---

# Tech Stack

Frontend:

* Next.js (App Router)
* TypeScript
* Tailwind
* Shadcn UI

Backend:

* Next.js Server Actions + API Routes
* Supabase

Email:

* Resend

Deploy:

* Vercel

No separate backend folder.

Architecture should remain monolithic during V1.

---

# Core Architecture

Browser

↓

Next.js

↓

Server Actions / API Routes

↓

Supabase

↓

Email Provider

---

# Multi Workspace

The application must support multiple isolated workspaces.

Examples:

* Coachmetric
* Joseph

Every business resource MUST belong to a workspace.

Required field:

workspace_id

Users can only access data inside their workspace.

---

# Authentication

Features:

* Login
* Logout
* Protected routes
* Workspace isolation

Authentication handled through Supabase.

Tables:

profiles

Fields:

* id
* workspace_id
* name
* created_at

workspaces

Fields:

* id
* name
* created_at

---

# Dashboard

Purpose:
Show actionable information.

Widgets:

* Total contacts
* Emails sent
* Response rate
* Pending follow-ups

Sections:

Recent responses

Upcoming follow-ups

No maps in V1.

---

# Contacts Module

CRUD required.

Fields:

* id
* workspace_id
* name
* company
* email
* phone (optional)
* city (optional)
* tags
* status
* last_contact_at
* created_at

Status:

* new
* contacted
* waiting
* replied
* converted
* closed

Features:

* Search
* Filters
* CSV import

---

# Templates Module

Reusable email templates.

Fields:

* id
* workspace_id
* name
* subject
* body

Supported variables:

{{nome}}

{{empresa}}

{{cidade}}

Features:

* Preview rendered output
* Variable replacement

Example:

Subject:
Quick idea for {{empresa}}

Body:
Hello {{nome}}

---

# Campaigns Module

Create and execute campaigns.

Fields:

* id
* workspace_id
* name
* template_id
* status
* scheduled_at

Features:

* Select contacts
* Send individually
* Rate limiting
* Cancel campaign

Status:

* draft
* queued
* running
* completed
* cancelled

---

# Email Delivery

Flow:

Create campaign

↓

Select contacts

↓

Render template variables

↓

Send email

↓

Save result

Table:

email_jobs

Fields:

* id
* campaign_id
* contact_id
* status
* sent_at

Status:

* queued
* sending
* sent
* failed
* opened
* replied

---

# Follow-up Automation

Simple automation only.

Rules:

Wait X days

IF no reply

Send another template

Example:

Day 0 → Introduction

Day 7 → Reminder

Day 14 → Final follow-up

No visual automation builder.

---

# Notifications

Header notification center.

Events:

* Email replied
* Campaign finished
* Follow-up pending
* Delivery failure

No realtime required initially.

---

# API Routes

/api/send

Send campaign emails

/api/webhooks

Receive email provider events

/api/followup

Execute automated follow-up

---

# Folder Structure

/app
/components
/services
/lib
/supabase
/emails
/types
/public
/docs

---

# Non Goals (Do NOT build)

* Maps
* AI writing
* Prospect discovery
* CRM pipelines
* Analytics
* Multiple users per workspace
* WhatsApp
* Drag and drop builder
* Complex segmentation

---

# Success Criteria

Version 1 is complete when:

* Import 100 contacts
* Create template
* Send campaign
* Track responses
* Execute automated follow-up

No additional features before this works.
