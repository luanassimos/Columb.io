# AI Lead Intelligence

AI Lead Intelligence is the planned analysis layer for Columb.io leads. Its job is to help humans qualify leads, understand opportunities, and draft safer outreach without turning the product into an automatic sender.

V1 is intentionally conservative: no external AI provider is called, all analysis can run through a deterministic mock provider, and every outreach step requires human approval.

## Vision

Columb.io should use AI where it creates clear value and avoid AI calls where cheap deterministic checks are enough. The system should analyze both businesses and people over time, but the first commercial offer is focused on low-cost landing pages or websites for businesses that appear to have no website, a weak website, or an outdated online presence.

Future offer angles may include Coachmetric, other services, or Columb.io itself. The schema supports that, but the V1 UI does not need to expose every path at once.

## V1 Scope

V1 creates the safe foundation:

- TypeScript types for analysis statuses, entity types, opportunity types, recommended actions, language decisions, and cost controls.
- A versioned internal prompt file.
- A JSON output schema.
- Cheap scoring helpers.
- A deterministic mock provider.
- Database tables for evidence, analyses, and drafts.
- Human review as a required step before any email or campaign action.

V1 does not:

- Call OpenAI, Anthropic, Gemini, or any other external provider.
- Fetch websites automatically.
- Fetch Instagram or social profiles automatically.
- Send emails.
- Create campaigns automatically.
- Replace workspace/RLS checks.

## Cheap Pipeline Before AI

The intended pipeline is:

1. Lead is captured.
2. Normalize and deduplicate lead data.
3. Run cheap pre-checks without AI:
   - Has name?
   - Has category/tags?
   - Has website evidence?
   - Has phone or email?
   - Has rating or reviews?
   - Has probable country/language?
   - Looks like a business, person, or unknown?
4. Only then use future AI when it is worth the cost.
5. AI or mock analysis returns score, grade, summary, risks, opportunity, language, and optional drafts.
6. Lead goes to human review.
7. Human approves, edits, rejects, or creates a campaign candidate.

This keeps cost low for small batches such as 10, 20, or 50 leads.

## Tables

### `lead_evidence_sources`

Stores evidence used for a lead analysis.

Examples:

- Manual notes.
- Website excerpts.
- Social profile excerpts.
- Directory data.
- CRM data.

The table is workspace-scoped and references `contacts(id)` through `lead_id`, because the current app stores leads as contacts.

### `lead_ai_analyses`

Stores structured analysis output:

- Status.
- Entity type.
- Fit score and grade.
- Confidence.
- Opportunity type.
- Offer angle.
- Country/language decision.
- Facts, inferences, risks, and unknowns.
- Recommended action.
- Evidence used.
- Cost control notes.
- Provider/model/prompt version/input hash.
- Review metadata.

### `lead_ai_drafts`

Stores optional drafts generated for human review. Drafts are not campaigns and are not sent automatically.

Supported channels start with email but leave room for LinkedIn, phone, or other channels later.

## Statuses

Analysis statuses:

- `not_analyzed`
- `prechecked`
- `analyzing`
- `qualified`
- `needs_review`
- `rejected`
- `error`

Draft statuses:

- `draft`
- `approved`
- `rejected`
- `archived`

## Opportunity Types

- `missing_website`
- `weak_website`
- `poor_social_presence`
- `coachmetric_fit`
- `columb_fit`
- `other`
- `unknown`

## Recommended Actions

- `reject`
- `review`
- `draft_email`
- `enrich_more`
- `create_campaign_candidate`

`create_campaign_candidate` is only a candidate state. It must not create or send a campaign automatically.

## Anti-Spam Rules

- AI must never send emails automatically.
- AI must never create a campaign automatically.
- AI drafts must be reviewed by a human before use.
- The system must keep Safe Email Mode protections in place.
- `EMAIL_SEND_MODE=live` must remain blocked unless `ALLOW_LIVE_EMAIL_SENDS=true`.
- Lead analysis must not bypass workspace permissions.

## Human Approval

`AI_REQUIRE_HUMAN_APPROVAL=true` is the default and expected behavior.

Human review should be required before:

- Approving an AI draft.
- Converting a lead into a campaign candidate.
- Creating a campaign from an AI recommendation.
- Sending any email.

## Cost Strategy

The default provider is:

```env
AI_PROVIDER=mock
```

Cost controls:

```env
AI_DAILY_LEAD_LIMIT=50
AI_MAX_EVIDENCE_CHARS=6000
AI_ENABLE_WEBSITE_FETCH=false
AI_ENABLE_SOCIAL_FETCH=false
AI_REQUIRE_HUMAN_APPROVAL=true
```

Future real AI providers should only be called after cheap pre-checks indicate enough value. Evidence should be truncated before analysis, and every response should include `cost_control_notes`.

## Businesses And People

The schema supports:

- `business`
- `person`
- `unknown`

The first sales motion is business-oriented. People can still be analyzed, but weak evidence should produce `unknown`, `enrich_more`, or `review` rather than invented assumptions.

## Website And Instagram Analysis

Website and Instagram analysis must be evidence-based.

Allowed:

- Use fetched excerpts.
- Use known metadata.
- Record URL, title, excerpt, and fetch time.
- Mark uncertainty in `unknowns`.
- Separate facts from inferences.

Not allowed:

- Inventing website quality.
- Inventing Instagram activity.
- Guessing follower counts, engagement, or business health without evidence.
- Treating absence of evidence as proof.

When no reliable country is known, the recommended language fallback is English.
