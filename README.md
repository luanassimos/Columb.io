# Columb - Outreach Automation Platform

Columb is an internal outreach automation platform designed for contact management, email campaigns, response tracking, and follow-up drip sequences.

---

## 1. Directory Structure

This project uses Next.js (App Router), TypeScript, and Tailwind CSS. The folder structure is organized as follows:

- `/app` - Page routes (Server Components, Server Actions, layouts, middleware, login, and dashboard pages).
- `/components` - Shared React components (Sidebar navigation, WorkspaceSwitcher, NotificationCenter).
- `/services` - Reusable services (compilers, email adapters).
- `/lib` - Reusable helpers, including the client and server Supabase SDK clients.
- `/supabase` - SQL schema migrations.
- `/emails` - Outreach templates layouts.
- `/types` - TypeScript interfaces.
- `/public` - Static assets and icons.

---

## 2. Supabase Integration Setup

### Environment Variables
Configure your database credentials inside `.env.local` (ensure there are **no** service role keys used on the client/server):

```env
NEXT_PUBLIC_SUPABASE_URL=https://klvcyteazmfgrljlpfdm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdmN5dGVhem1mZ3JsamxwZmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MDc4OTcsImV4cCI6MjA5NzA4Mzg5N30.LaJs3ptUzltUVIr8hpXsU85-bUoqVXORuRBlWzu-_Co
```

### Supabase SDK Clients
The clients are initialized using `@supabase/ssr` under:
- `lib/supabase/client.ts` - Reusable browser client.
- `lib/supabase/server.ts` - Reusable server client (integrating cookie stores).

---

## 3. Database Schema & Row-Level Security (RLS)

Initialize the database by executing the SQL migration located at [/supabase/migrations/20260615000000_init_schema.sql](file:///d:/reposit%C3%B3rios/columb/supabase/migrations/20260615000000_init_schema.sql) in your Supabase SQL editor.

### Schema Tables:
1. `workspaces` (id, name, created_at)
2. `profiles` (id, workspace_id, name, created_at)
3. `contacts` (id, workspace_id, name, company, email, status, etc.)
4. `templates` (id, workspace_id, name, subject, body)
5. `campaigns` (id, workspace_id, name, template_id, status)
6. `email_jobs` (id, workspace_id, campaign_id, contact_id, status)
7. `notifications` (id, workspace_id, type, title, message, read)

### Enforced Policies:
- **Profiles Isolation**: Users can only read/write/edit their own profile (`auth.uid() = id`).
- **Workspace Isolation**: All resource tables enforce that queries and inserts are restricted to the user's active `workspace_id` (`workspace_id = (select workspace_id from profiles where id = auth.uid())`).

---

## 4. Protected Routes & Authentication

Authentication is handled via Supabase Auth and server-side Next.js middleware:

- **Unprotected Pages**: `/login`, `/` (redirects to `/dashboard` or `/login`).
- **Protected Pages**: `/dashboard`, `/contacts`, `/templates`, `/campaigns`, `/settings`, `/notifications`.
- **Sign Up Bootstrapping**: When a new user registers on `/login`, the Server Action automatically generates a default workspace and profile, linking the user without relying on a backend service role.

---

## 5. Development Server

To run the local development server:

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the login and start managing your workspace.
