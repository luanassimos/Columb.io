# Columb Outreach Platform - Getting Started Guide

Columb is an internal outreach automation platform designed for managing contacts, sending personalized cold email campaigns, tracking responses, and automating follow-ups.

---

## 1. Database Setup (Supabase)

Columb uses Supabase as its primary database. To initialize the schema:

1. Log into your Supabase Dashboard.
2. Navigate to the **SQL Editor**.
3. Create a new query.
4. Copy the complete schema and policies defined in [init_schema.sql](file:///d:/reposit%C3%B3rios/columb/supabase/migrations/20260615000000_init_schema.sql) and execute it.
5. In your project root, create a `.env.local` file containing your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key (for webhooks & cron follow-ups)
```

---

## 2. Email Integration (Resend)

By default, Columb abstracts Resend email delivery:

- If you provide the `RESEND_API_KEY` in your `.env.local`, email campaigns will be sent via Resend's API.
- If no key is provided, Columb operates in **Mock Logging Mode** which writes outgoing compiled templates directly to the server terminal console.

```env
RESEND_API_KEY=re_your_api_key
NEXT_PUBLIC_FROM_EMAIL=Columb Outreach <onboarding@resend.dev>
```

---

## 3. CSV Import Format

To bulk import 100+ contacts on the **Contacts** tab, create a CSV file using either English or Portuguese headers. The parser automatically detects comma (`,`) or semicolon (`;`) separators.

### English Header Schema
```csv
name,company,email,phone,city,tags
Academia Flex,Flex Gym,contact@flexgym.com,+5511999999999,São Paulo,"gym,crossfit,lead"
```

### Portuguese Header Schema
```csv
nome,empresa,email,telefone,cidade,tags
Paróquia Central,Igreja São José,secretaria@saojose.org,,Rio de Janeiro,"church,lead"
```

---

## 4. Drip sequences & variables

When creating templates or campaigns, you can insert dynamic variables that are compiled in real-time before delivery:

- `{{nome}}` or `{{name}}` → Recipient's name.
- `{{empresa}}` or `{{company}}` → Recipient's company.
- `{{cidade}}` or `{{city}}` → Recipient's city.

---

## 5. Follow-up automation & Sandbox testing

### How to test the end-to-end flow:
1. **Import contacts**: Upload your CSV file or add contacts manually.
2. **Create templates**: Build a sequence of cold outreach templates (e.g. Day 0, Day 7, Day 14).
3. **Launch campaign**:
   - Create a campaign, select target contacts, define the drip delay sequence, and click **Start Sending**.
   - Review sent logs under the campaign collapsible card.
4. **Simulate recipient response**:
   - Next to a delivered email job in the campaign ledger, click **Simulate Reply**.
   - Type in a mock reply message.
   - The platform will transition the lead status to `replied` and issue a notification in the header popover.
5. **Run follow-ups**:
   - For contacts who did not reply, click the **Trigger Follow-ups** action in the Dashboard, or trigger `/api/followup?force=true` in your browser.
   - This bypasses the delay days and immediately delivers step 1/step 2 follow-up emails to non-replied leads, while skipping anyone who has replied!
