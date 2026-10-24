# Adl 5:8

React + TypeScript debt-management frontend with RU/TJ/EN localization, persistent Dark/Light themes and a same-origin API gateway.

## Local development

Use Node.js 22.12 or newer and install the locked dependencies:

```sh
npm ci
npm run dev
```

Vite development mode provides `/api` through `dev-gateway.mjs`. Both gateways currently target `https://debt-back-cvif.onrender.com`. The backend URL is configured in `dev-gateway.mjs` and `worker.mjs`; no frontend token or backend URL environment variable is required.

## Verify and build

```sh
npm run check
npm run build
npm test
```

`check` runs TypeScript and Vite. `build` creates `dist` and copies `worker.mjs` to `dist/_worker.js`. Tests require the built output and use isolated data or mocked upstream responses, never live credentials or financial writes. They cover CRUD/session validation, gateway refresh/cookies, routing, signed balances, Dashboard calculations, Archive/Users isolation, translations and theme persistence. Phase-numbered filenames are retained because these scripts still protect current behavior; `test-ui-support.mjs` is their shared translation shim.

## Production hosting

The target is Vercel. Deploy this project directory, including `vercel.json`, the root `api` directory and `worker.mjs`, using the Vite preset and `npm run build`. The first rewrite routes all `/api/*` requests to `api/gateway.js`; the SPA fallback explicitly excludes API paths. The Node adapter reuses the existing Worker authentication/gateway logic and preserves multiple HttpOnly cookies and server-side refresh. On Vercel, cookies are Secure. No QA credentials are required in production. Vercel hosting itself has not been deployed or browser-verified in this task.

**Plain static hosting and `npm run preview` do not execute the API gateway.** Vite preview serves frontend assets only; `/api` may receive the HTML fallback instead of JSON. Uploading only `dist` does not deploy the Vercel function. The previous Cloudflare configuration and Worker copy remain for compatibility; `.openai/hosting.json` is preserved hosting metadata, not a Vercel API deployment.

Gateway authentication uses HttpOnly cookies and server-side refresh. Do not move JWT handling into browser code. GET `/api/health` checks connectivity; protected routes return 401 without a valid session. Sign in on the same origin used for the application.

## Supported behavior and limits

- Live registration uses only the supported name/email/password fields. Login, session checks, Contacts/Folders/Debts CRUD, per-debt payments, current-user name updates and logout use the gateway. Public `/`, `/login` and `/register` check the session with a themed MUI loader: authenticated users enter Dashboard; a normal 401 keeps the visitor on the chosen public route, including Home at `/`. Only protected-route 401 responses redirect to Login. No tokens are stored in localStorage or frontend state.
- Dashboard FAB offers exactly two debt directions. Both choices and the Debts Add button use `AddDebtDialog`. Its MUI autocomplete filters existing contacts, uses contact IDs as option keys and permits an explicit Create choice for a new name. Typing never creates a contact. Create intent is staged until Save so cancellation before submission makes no writes. Save rechecks trimmed, case-insensitive names before posting only name and optionally the supported contact folder ID. The returned contact ID is then used for the debt. Double submissions are locked; no automatic retries or fabricated phone/email fields. Cross-client duplicate creation is not an atomic server guarantee. If contact creation succeeds but debt creation fails, the selected returned ID is retained for retry rather than creating another contact.
- Successful shared creation refreshes the active financial page; other pages fetch current records when opened. The Dashboard greeting uses the supported current-user name, without inventing a username field. Existing debt editing remains on Debts; creation has one shared implementation.
- Payments beyond principal are valid. Original amount minus payments is a signed balance; crossing zero reverses the financial direction. Positive balances contribute to receivables, negative balances to payables after applying the debt's original direction. TJS totals do not mix currencies. Progress may exceed 100%; backend `paid` does not imply a zero reversed balance or an archived record.
- The monthly chart currently aggregates original debt amounts by UTC creation month, direction and selected year. Exact original-product aggregation and reversed-balance/refund wording still require confirmation. No refund endpoint or automatic second debt is implemented.
- Normal application usage is live-only. Demo login and mode controls are absent. A legacy localStorage demo flag cannot activate demo requests after a fresh load; only explicit in-memory enablement used by regression tests can do so. No API/network/auth failure falls back to demo data. `demoStore.ts`, API test branches and inline Archive/Users prototype fixtures remain for existing tests; they are not yet independently removable. Archive/Users render their existing empty/disabled structure in normal live use, with no fabricated management/archive endpoints. Business/username registration, password recovery, roles and sync remain unsupported.
- Tajik uses internal locale `tg` and displayed label TJ. Language/theme preferences remain local. Browser visual comparison and native-speaker terminology review are still required; automated tests are not proof of pixel parity.

## Local-only files

Keep `.env`, `.env.*` (including `.env.local`), `node_modules`, `dist`, logs and generated deployment state out of commits. `.env.example` is the sole allowed environment-file template and must contain placeholders only if added. Never commit credentials, tokens, cookies, live QA results or account records. Local QA credentials are not required by the application or retained regression tests.

Essential runtime/config files, the favicon, hosting metadata and regression tests are intentionally retained. `debt-flow-check.mjs` exercises the actual shared form handlers with mocked APIs; `vercel-gateway-check.mjs` exercises the production adapter with mocked upstreams. Both are included in `npm test`.

The existing Home page includes header/branding/appearance controls and Login/Register navigation, hero, six feature cards, an information section, four getting-started steps, final CTA and footer. Start Free links to `/login`; Create Account links to `/register`. Information cards describe implemented language/theme/export options, not unverified usage statistics. No demo entry or financial-preview mock data is shown. Layout follows the confirmed section composition; exact visual/copy parity with the original site remains unverified.

`SessionLoading` supplies the MUI CircularProgress for initial session checks and lazy-route fallback. `ContentSkeleton` supplies MUI Skeletons for Dashboard cards/chart/recent payments, Contacts rows, Folders cards and Debts cards/rows. Workspace route Suspense stays inside the content region to retain the shell. Archive/Users do not make live data requests and have no simulated data-loading state. Loading uses aria-busy and translated status text; errors replace loading and keep retry actions. `auth-loading-check.mjs` covers anonymous/authenticated/slow/error routing, translated landing structure/CTAs, loader/skeleton rendering and responsive/theme-token rules. Browser refresh, visual transitions, native keyboard behavior and mobile screenshot comparison still require manual browser verification.

`qa-runtime-check.mjs --run-authorized-qa` is a separately gated live-write tool for an explicitly authorized disposable account only. It reads QA_EMAIL/QA_PASSWORD locally in memory, verifies account identity before writes, and targets only records created by that run. Its sanitized `qa-runtime-result.json` is ignored. It must never be used against another account or production financial records without authorization.

The authorized live run through the local Vercel adapter against Render passed login/session/logout/relogin; Contacts/Folders create/update/delete; shared form creation in both directions; name-only contact creation; duplicate recheck; cancellation before Save without writes; debt update/delete; partial/exact/excess payments and both signed reversals; Dashboard totals/recent ordering; profile update/restore. Cleanup removed all four debts, two contacts and one folder and logged out (eight cleanup checks, none unresolved). Actual browser FAB interaction/keyboard behavior and deployed Vercel routing/cookies still require browser/deployment verification. Demo internals are retained until explicitly separated from test dependencies and authorized for removal.
