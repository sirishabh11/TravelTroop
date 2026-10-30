# Phase 3A · AI Group Leader Assistant

Phase 2 is merged into `main`. Phase 3A extends its private dashboard and **reuses `evaluateFeasibility` / `suggestCompromises`** for server explanations and final briefs. It does not add an itinerary builder, bookings, payments, live assistance, or automatic messages/changes.

## What is implemented

- **AI Group Insights / Ask TravelTroop AI**: on-demand questions about the signed-in leader's saved trip. Facts and suggestions are presented separately. Model-generated selection/order is labeled AI-assisted. Missing credentials, quota, timeout, provider errors, truncation, or invalid output produce an explicitly labeled rule-based fallback.
- **Follow-ups Needed**: deterministic personalized drafts for named invitations without a matched response and for Interested / Unsure responses. General submissions are not matched by name. Confirmed participants are excluded from reminder drafts. No phone numbers are guessed; WhatsApp opens its ordinary recipient chooser and the leader sends manually.
- **Finalize Trip / Trip Brief**: choose a real saved option, preview its current constraints, explicitly check approval, then save. Simulated prices/options cannot be approved here. Non-ready scenarios are labeled **Provisional / Not Yet Ready**. Ready does not mean booked or paid.
- **Persistence**: one approved decision per trip with an authoritative, immutable input snapshot. The existing Phase 2 engine renders the structured brief from that saved snapshot, including its saved dates/cost, eligibility, commitments, pending invites, exclusions, unresolved issues and next steps. No untrusted AI-written brief is stored. Later responses do not silently rewrite the brief. Reload marks it stale if the source data changed. Explicit reapproval replaces the current snapshot.

## 1. Apply the new migration once

In the **existing Supabase project's SQL Editor**, run the complete contents of:

`supabase/migrations/202610300002_leader_assistant.sql`

Do **not** rerun or edit the Phase 1 migration. Alternatively, use the Supabase CLI's `db push` from a trusted linked checkout. This new migration adds:

| Object | Purpose |
| --- | --- |
| `trip_decisions` | Owner-readable selected option and approved brief source snapshot |
| `assistant_usage` | Private atomic per-leader AI request counters |
| `get_leader_context(uuid)` | Owner-only minimal, versioned context, without invitation/edit tokens |
| `get_trip_decision(uuid)` | Owner-only persisted decision retrieval |
| `approve_trip_decision(uuid, uuid, text, boolean)` | Requires ownership, real saved option, unchanged preview version and explicit approval; builds the snapshot in SQL |
| `reserve_assistant_call(uuid)` | Validates ownership and reserves provider usage atomically |

Both new tables enable RLS. Anonymous roles have no table/RPC access. Direct client writes are revoked, including direct writes to snapshots and usage counters. Ownership and approver IDs are derived from `auth.uid()`, never from a browser-supplied identity. The snapshot save RPC does not accept client-written prices, participants or brief text. Public Phase 1 invitation/response flows are unchanged.

## 2. Configure Netlify Functions environment variables

Open the same Netlify project → **Environment variables**. Make these available to the **Functions** scope and to the deployment context you will test:

| Name | Value / purpose |
| --- | --- |
| `SUPABASE_URL` | The same public project URL already used by `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | The same public publishable (or legacy anon) key already used by the frontend |
| `AI_PROVIDER` | `gemini` or `openai`; omitted defaults to OpenAI for existing deployments |
| `GEMINI_API_KEY` | Server-only Google AI Studio Gemini API key when using Gemini |
| `GEMINI_MODEL` | Optional Gemini model ID; defaults to `gemini-2.5-flash` |
| `OPENAI_API_KEY` | Optional **server-only** OpenAI API key for AI-assisted evidence selection |

The server also accepts the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as fallbacks **if those variables are available to Functions**. Their public values are not secrets. Explicit server names make scoping easier. No service-role key or database password is needed.

**Never use `VITE_GEMINI_API_KEY` or `VITE_OPENAI_API_KEY`, put an LLM secret in frontend code, or paste a secret into chat/GitHub.** Enter its value only in the host's secure environment-variable editor. Obtain an API key through your OpenAI API account; API usage is billed separately from a ChatGPT subscription. Without it, insights still work through the labeled rule-based fallback once Supabase and the migration are configured.

The implementation supports Gemini `generateContent` with JSON-schema evidence selection and OpenAI model **`gpt-4.1-mini`**, at most **700 output tokens** per request, a **15-second provider timeout**, questions capped at **500 characters**, and evidence output capped at **8 facts + 4 suggestions**. The database limits provider attempts to **6 per minute and 100 per UTC day per leader across all trips**. Failed provider attempts still consume a reservation. A request without responses or a configured key does not call the model. Review provider usage/billing settings before enabling a shared production key. Netlify invocations, Supabase usage and LLM calls have separate quotas/billing.

The question and bounded aggregate option/date/cost/commitment information are sent only to the selected provider (Google Gemini or OpenAI). Raw participant names, contacts, individual budget values, invitation tokens, private edit tokens and trip descriptions are omitted from the model context. Do not type secret information into questions. Destination strings and questions remain untrusted input; the model has no tools or database access.

## 3. Deploy the branch including Functions

The repository's `netlify.toml` configures `netlify/functions`, esbuild, the production build, and the existing SPA fallback. Deploy `feature/gemini-assistant` as a preview, or merge its PR and deploy the receiving branch. Environment settings must apply to that same preview/production context. Publish `dist` through a normal Git-connected Netlify build so Functions deploy too. **Uploading only the static `dist` folder will not deploy the backend function.**

After adding/changing server variables, trigger a new deploy. Confirm the deployment lists **`leader-assistant`** under Functions. The private endpoint is:

`POST /.netlify/functions/leader-assistant`

It is not a page to open directly: it requires JSON plus the signed-in leader's Supabase access token. It returns JSON with `Cache-Control: no-store`. The frontend adds the token itself; never copy it manually or share it.

No Supabase Auth URL change is needed if your site domain stays the same. For a new preview domain, allow its `/trips` callback as described in the main README. Keep the public invitation site accessible to friends; the assistant itself remains restricted by leader Auth and owner authorization.

## 4. Verify the real hosted journey

1. Sign in as the organizer and open an existing trip with real saved responses.
2. Click **Open leader assistant**. The saved brief starts empty or loads a previous approved snapshot.
3. Click **Explain group conflicts**. Verify costs, exclusions and confirmations against the Phase 2 panel. With no LLM key, expect **Rule-based fallback · not AI-generated**. With a usable key, expect **AI-assisted · verified evidence**; provider failure should fall back rather than invent an answer.
4. Ask “Why are budgets conflicting?” and “Who still needs to confirm?” Compare the facts with actual saved responses.
5. Generate follow-up drafts. Confirm only real named nonrespondents and unconfirmed responses appear. Copy a draft; inspect the WhatsApp recipient chooser without sending until you approve the text/recipient.
6. Choose an existing scenario → **Preview trip brief**. Check the estimate, dates, feasible people, exclusions and provisional/readiness label. The save button stays disabled until the approval checkbox is checked.
7. Approve and save. Refresh the page, reopen the assistant, and verify the saved brief reappears unchanged.
8. Update a participant response in a separate session. Refresh the saved brief: it must be flagged as a stale snapshot. Preview/reapprove to update it. An approval based on a stale preview must be rejected.
9. Sign in as a different leader. Neither the trip context, saved snapshot, AI request nor decision write should be accessible. Participants' public invitation pages must not expose the assistant or snapshot.

## Development and validation

- `npm test`: Phase 1/2 regressions plus domain, HTTP authorization, model-output validation, fallback, client, approval and UI tests. Fixtures are explicitly test-only; the app has no mock persistence mode.
- `npm run build`: type-checks frontend **and the server/function**, then builds the SPA.
- `npm run test:db`: applies migrations in order in a disposable PostgreSQL 17 container, runs the existing access suite and the new decision/quota suite, then removes the container. The test harness emulates the Supabase Auth SQL contract; it does not exercise hosted Auth or email delivery.
- To run the full app/function locally, install/use the Netlify CLI and run **`netlify dev`** in the repository with your public Supabase settings and optional server key supplied through local ignored environment configuration or the host's supported environment binding. Plain `npm run dev` serves the SPA only; it cannot host Netlify Functions and the assistant reports that explicitly. Do not commit local values.

No live hosted Supabase, Gemini or OpenAI credentials were available during implementation. Mocked provider/authorized API tests and actual disposable PostgreSQL tests are distinct from live hosted integration. Complete the checklist above before describing this phase as production-verified.

## Architecture and known limits

`server/leader-assistant.ts` validates JSON body limits, verifies the access token using Supabase `auth.getUser`, obtains and validates owner-only context through narrow RPCs, and explicitly rechecks ownership. `src/lib/assistant/domain.ts` reuses Phase 2 calculations; it never reads a database. `src/lib/assistant/schema.ts` validates context, request and saved snapshot shapes. The Netlify entry point delegates to that handler.

The LLM selects and orders verified **evidence IDs**, not arbitrary claims, prices or actions. The server rejects unknown IDs/extra fields and renders accepted IDs using deterministic fact/suggestion templates. This makes numerical content auditable while allowing the AI to focus an explanation on the question. Follow-up text and final brief formatting remain rule-based. There is no streaming or chat-history persistence; each question uses the current authorized trip data. No AI output can call approval or messaging functions.

The current assistant supports up to 2,000 responses / 20 options / 100 named invitations per trip, and reports an error beyond that response cap rather than silently truncating it. General-link identities cannot be deduplicated just by matching names. Follow-ups are based on stored commitment and invitation IDs, not assumptions about unrecorded conversations. Prices are estimates; “Confirmed” is self-reported, not paid. One approved snapshot per trip is retained; this phase does not implement a decision-history browser. Keep compatibility with the Phase 2 snapshot renderer when introducing future algorithm versions.

## Switching an existing deployment to Gemini

1. Create a key at https://aistudio.google.com/apikey in your own Google project. Check that the chosen model is available to your account/region and review its quotas and billing. A free tier is not unlimited or guaranteed for every account/model.
2. In Netlify → Environment variables, add `AI_PROVIDER` = `gemini` and `GEMINI_API_KEY` = your key. Use Functions scope and your production deployment context. Keep the key out of chat, source control, and all `VITE_` variables.
3. Optionally add `GEMINI_MODEL` = `gemini-2.5-flash`. The default requests JSON-schema output with thinking disabled. A different configured model must support these generation settings. Current model availability was not verified against Google's live documentation from this restricted environment; check your AI Studio model list. Unsupported models/settings safely return the labeled fallback.
4. Deploy the `feature/gemini-assistant` branch (it includes Phase 3A), or merge it into the branch Netlify builds. Open https://app.netlify.com/projects/cozy-entremet-810013/deploys → Trigger deploy → Deploy project. Wait for Published.
5. Open a trip with responses → Open leader assistant → Explain group conflicts. Successful validated Gemini output uses the existing **AI-assisted · verified evidence** label. Otherwise the rule-based label and reason remain visible. No database migration is needed for this provider change if Phase 3A's migration was already applied.
6. To return to OpenAI, set `AI_PROVIDER` = `openai`, provide `OPENAI_API_KEY`, and redeploy. Providers are never silently switched on failure; failures use the rule-based fallback. Remove unused provider keys if desired.

Gemini requests keep the same owner checks, minimized context, output validation, 15-second timeout and shared database quota as OpenAI. The key is sent in the `x-goog-api-key` header, never in a URL. Reminder drafts and approved briefs remain deterministic. This change does not add itineraries or Phase 3B.
