# Invitation link deployment troubleshooting

A new visitor requests `/invite/TOKEN` directly from the host. Netlify must serve `index.html` with status 200 for that route; then React opens the public preference form. No account or merged PR is required for a participant. A copied link alone cannot establish which deployment is serving it.

- Netlify’s own 404 page: confirm the deployed branch includes `public/_redirects`, build with `npm run build`, and publish **`dist`**, not the repository root. For manual uploads, upload the complete built `dist` directory including `_redirects`. Trigger a fresh deploy after changing the branch or build settings. Test the invitation in a private browser and refresh it directly.
- TravelTroop’s invitation error: the SPA loaded. Check that the deployment uses the same Supabase URL/public key as the organizer’s site and the trip still exists. Do not weaken RLS or rerun the migration to fix a host 404.
- Localhost or a deployment-preview hostname: create/copy the invitation from the published site your friends can access. Invitation links use the current site origin.

A PR does not have to be merged to use a Netlify feature-branch deployment. Select the branch containing the fix under **Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts** (labels may vary), or merge the fix and deploy the branch that received it. Existing deployments are not updated by a local code change. The shipped fallback rule is `/* /index.html 200`; it preserves the invite path and token without making protected dashboard routes public.
