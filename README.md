# TravelTroop · Phase 1

**From group chaos to a bookable trip.**

React + TypeScript + Vite, with Supabase Auth and PostgreSQL. This phase covers **leader sign-in → trip creation → invitation → participant preferences → private leader dashboard**. It does not implement feasibility scoring, AI, bookings, payments, or messaging integrations.

## Status

The real Supabase integration and SQL backend are implemented; there is **no mock persistence or local-data fallback**. Without configuration, data routes show a connection notice instead of claiming to save. A hosted Supabase project has not been configured or verified in this environment. Do not call this a deployed, end-to-end service until the manual acceptance check below passes against your project.

## Develop

Use Node.js 22 LTS or newer (validated here on Node 24.19.0) and npm. The existing editorial palette, typography, buttons, hero photograph, wordmark, ticket animation, experience tabs, and route drawing are reused. The sample routes remain explicitly labeled inspiration; they are never used as saved trips or participant responses.

```sh
npm ci
cp .env.example .env.local
# Fill in your project's public URL and publishable key, then:
npm run dev
```

`npm run build` runs TypeScript and a production Vite build. `npm test` runs form/domain tests. `npm run test:db` needs Docker and runs migration/access-rule tests against an isolated PostgreSQL 17 container. It exposes no host ports and removes the container afterwards. The database test harness supplies a minimal Supabase `auth.users` / `auth.uid()` contract; it does **not** test the hosted Auth service or email delivery.

Branding is centralized in `src/lib/brand.ts`; adjust the static metadata in `index.html` as well for crawlers. `src/saas.css` extends the original styles instead of replacing them.

## Connect Supabase

1. Create a Supabase project. In its SQL editor, execute **`supabase/migrations/202610300001_phase1.sql` once**, or use the Supabase CLI (`supabase link --project-ref YOUR_PROJECT_REF`, then `supabase db push`) from a trusted development machine. Do not apply `supabase/tests/access.sql` to a real project: the test script creates a disposable database specifically for that fixture.
2. In Supabase **Authentication → Providers**, enable Email / Password. Leave email confirmation enabled for hosted use. Set **Site URL** to your app origin and allow the exact `/trips` callback URL for local and deployed origins under **URL Configuration**. Supabase account email confirmation should return to `/trips`. The app accepts the auth callback using Supabase JS and then requires the leader session for private routes.
3. Set these **public build-time** values in `.env.local` (or your host's environment settings):
   - `VITE_SUPABASE_URL`: the project's HTTPS URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: a Supabase publishable key (a legacy anon key also works).
4. Restart Vite after changing configuration. For deployed builds, rebuild after changing these variables.

Never put a service-role key, secret API key, database password, access token, or signing key in a `VITE_*` variable or commit one. The frontend only requires a public key. No service-role credentials are needed by this implementation: the database functions execute privileged operations with narrow checks. Keep any migration/deployment credentials in your trusted tooling or hosting secret store.

Allow HTTPS access to your project's Supabase hostname for Auth and REST requests. Optional photos/fonts use `images.unsplash.com`, `fonts.googleapis.com`, and `fonts.gstatic.com`. These do not affect database persistence; font CSS loads without blocking the application, and the hero has a visual fallback if the photo is unavailable.

## Data model

| Table | Purpose | Access |
| --- | --- | --- |
| `trips` | Owner, title/description, minimum group size, 256-bit invitation token | Owning authenticated leader reads |
| `trip_options` | Destination + departure/return + estimated INR cost | Owning leader reads; public metadata through RPC only |
| `invitations` | Optional named invitation list, each with its own 256-bit token | Owning leader reads; one invitee name may be prefilled by its own link |
| `responses` | Name, available option IDs, budget, preferred destinations, interests, commitment, optional matched invitation, hashed private edit capability | Owning leader reads preferences; participant reads/updates only with private capability |

Trip creation is atomic. A trip has 1–20 options, a minimum of 2–1,000 people, and optionally up to 100 named invitations. Budgets are INR with up to two decimal places. Repeating a destination across date options is supported. The minimum is a planning target; organizers are not silently counted as respondents. A leader can respond through their own invitation if they want their preferences counted.

### Public access and edit security

All four tables enable RLS. Anonymous roles have no direct table access; another signed-in leader cannot read someone else's rows. Direct inserts/updates/deletes are not granted. The migration explicitly revokes PostgreSQL's default PUBLIC function execution. Security-definer functions pin `search_path` and validate payloads server-side:

- `create_trip(payload)` and `add_invitees(target_trip, names)` require the authenticated owner. Creation and invitation insertion run in a single transaction.
- `get_invitation(invitation_token)` returns only trip metadata/options (and, for a personal link, its own invitee name). It never returns participant rows, other invitees, owner identity, or reusable invitation tokens.
- `submit_response(invitation_token, payload, edit_token)` accepts an anonymous participant's validated preferences. New submissions generate a cryptographically random 256-bit edit token. Only its SHA-256 digest is stored.
- `get_own_response(edit_token)` returns only the response bound to that capability. Updates require that capability and the matching trip/invitation. A shared invitation cannot be used as an edit token.

After submission, participants must save the private edit link. The token is held in a URL **fragment**, which is not sent in HTTP requests or referrer headers. Do not share it or add analytics that capture URL fragments. The application does not persist the capability in browser storage. Losing it means there is no anonymous recovery flow in Phase 1. Named invitations cannot submit a replacement without their private edit token; the UI explains this error. Links are bearer capabilities, not identity verification. A recipient can forward them. General links allow multiple submissions; named links allow one response per invitation. Do not infer identity from a typed name. Internet-facing production hardening may add abuse controls/rate limiting at the gateway; Phase 1 has payload limits but no CAPTCHA or per-IP rate limiting.

Named response progress is based on the invitation ID derived **server-side from the personal link**, never a client-supplied name or invitation ID. General responses are counted separately. Nonrespondents are shown only when the leader has actually created a named list. There are no fictional missing participants.

## Routes and behavior

- `/`: adapted product landing and illustrative inspiration.
- `/auth`: leader email/password sign-up and sign-in.
- `/trips`: the signed-in leader's trips.
- `/trips/new`: trip creation, multiple options, optional invitation list.
- `/trips/:id`: owner-only dashboard, responses, commitment, options, refresh, share/copy link, copyable WhatsApp text, named invitations and response progress.
- `/invite/:token`: account-free preference form.
- `/invite/:token#edit=PRIVATE_CAPABILITY`: view/update one's own response.

The UI handles loading, validation, empty lists, backend failures, clipboard fallback, and expired/invalid invitations. Dashboard refresh is explicit; realtime subscriptions and automatic follow-up messages are outside this phase. WhatsApp support means copying a message, not sending messages or using an integration.

## Deployment

Use a static host that supports **SPA fallback rewrites**. The repository includes `netlify.toml` to build `dist`, serve deep links through `index.html`, and set a restrictive referrer policy. Connect your feature/main branch as appropriate, set the two public Supabase build variables, and build with `npm ci && npm run build`. Require HTTPS for production. Configure the deployed origin and callback in Supabase Auth, then complete the acceptance check.

The previous GitHub Pages publishing workflow is replaced with validation CI because Pages cannot provide the BrowserRouter fallback used by these private and invitation routes. CI installs locked dependencies, runs unit/form tests, database/RLS tests, and the production build. It does not deploy or apply production database migrations. Run the migration separately before launching the frontend. If you choose another host, configure a rewrite from all unknown paths to `/index.html` (status 200) while preserving actual static asset requests. Vite's `preview` command is for local build inspection, not a production server.

## Hosted acceptance checklist (still required)

1. Configure a real project, apply the migration, configure email/callback URLs, and restart/rebuild the app.
2. Sign up as leader A, confirm the email, and sign in. Create a trip with two destinations/date ranges, costs, and named invitees. Refresh the page and verify persistence.
3. Open the general invite in a separate/private mobile browser. Submit preferences. Save the private edit link, reopen it, change commitment/budget, and verify the dashboard has one updated response, not a duplicate.
4. Open a personal invite in a separate browser. Submit. Verify only that named invite is marked responded and a general response does not mark anyone as responded by name.
5. Sign in as leader B. Verify leader A's trip/dashboard/participant rows remain inaccessible, including direct REST requests. An invitation may show only trip metadata; it must never list responses.
6. Verify invalid links and a bad private edit token fail. Test copy/share and the mobile layout. Reopen deep links directly on the deployed host to verify SPA routing.

## Project layout

- `src/components/SiteVisuals.tsx`: extracted existing visual components.
- `src/components/UI.tsx`, `src/saas.css`: shared accessible fields/notices and product styles.
- `src/lib/{brand,types,validation,supabase,api,auth}.*`: branding, domain, validation, data boundary, and leader session.
- `src/pages/*`: landing, auth, trip list/create, participant response, leader dashboard.
- `supabase/migrations/*`: schema, RLS, validation and capability RPCs.
- `supabase/tests/access.sql`, `scripts/test-db.sh`: real PostgreSQL access tests in disposable Docker.
- `src/**/*.test.*`: important form and domain tests.

Future feasibility or AI modules can consume the owner-authorized trip/options/responses through this data boundary. None are implemented here.
