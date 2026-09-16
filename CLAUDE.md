# Clarisse Bonneu — portfolio site

Static multi-page site (Vite, vanilla JS, Tailwind) for a photographer's portfolio,
with a custom admin back-office for managing media. Deployed on Netlify.

## Stack

- **Frontend**: Vite + vanilla JS/HTML/CSS (Tailwind). No framework, no SPA router —
  each page is its own HTML entry (`index.html`, `portfolio.html`, `admin.html`, etc.),
  duplicated under `en/` for the English locale.
- **Hosting**: Netlify (static build + serverless functions in `netlify/functions/`).
- **Media storage**: Cloudinary (all portfolio images/videos). `server/admin-api.js`
  talks to the Cloudinary Admin API for uploads, folders, and asset metadata.
- **Auth + admin metadata database**: Supabase.
  - **Auth**: admin login, roles (`admin`/`client`), MFA (TOTP), invite emails —
    all via `supabase.auth.admin.*` in `server/admin-api.js`. This is deep,
    security-sensitive integration; do not attempt to replace it without a very
    good reason and a lot of care (see "Backend decisions" below).
  - **Database**: 5 small Postgres tables holding admin metadata (not the media
    itself, which lives in Cloudinary):
    - `admin_asset_orders` — manual drag-and-drop ordering of assets per folder
    - `admin_asset_metadata` — alt text (FR/EN) and tags per asset
    - `admin_audit_logs` — admin action audit trail
    - `admin_tracked_folders` — which Cloudinary folders are tracked/ordered
    - `admin_external_media` — external YouTube videos embedded in the portfolio
    - Migrations: `supabase/migrations/*.sql`. Each table has RLS enabled with
      `service_role`-only policies (the admin API always uses the service role key,
      never the anon/publishable key, for these tables).

## Backend decisions (read this before touching the data layer)

- **Do not migrate off Supabase to "Netlify DB" (the Neon extension).** This was
  attempted and reverted (see PR #6 history) because Netlify deprecated new
  database provisioning through that extension — the build fails with
  `Build script returned non-zero exit code: 4` because no database can be
  provisioned. If Netlify ships a new DB offering later, re-evaluate then.
- **Supabase free-tier auto-pause mitigation**: Supabase's free tier pauses a
  project after ~7 days without API activity, which silently breaks the admin
  back-office (login, uploads, etc. all fail). This is mitigated by a scheduled
  Netlify function, `netlify/functions/supabase-keepalive.js`, which runs
  `@daily` and issues a lightweight authenticated REST call to the Supabase
  project. **Do not remove this function** unless Supabase is fully replaced
  or the free-tier pause behavior changes. If the admin back-office ever
  reports it's unreachable, check first whether the Supabase project got
  paused (dashboard) and whether the keepalive function is still deployed and
  running (Netlify → Functions → Scheduled).
- If persistence needs to move off Supabase again in the future, prefer a
  provider with **no manual "paused" state on the free tier** (e.g. a
  standalone Neon.tech project with auto-suspend/auto-resume, not a Netlify
  extension) and keep Supabase Auth unless replacing auth is explicitly
  requested and budgeted for.

## Environment variables

See `.env.example` for the full list. Key ones:

- `CLOUDINARY_*` — Cloudinary credentials, upload preset, portfolio root folder.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` —
  used both client-side (publishable key, via `VITE_SUPABASE_*`) and
  server-side (service role key, in `server/admin-api.js` and the store
  modules under `server/admin-*-store.js` / `server/external-media-store.js`).
  The service role key is also required by `supabase-keepalive.js`.
- `ADMIN_ALLOWED_EMAIL` — bootstrap admin email (auto-promoted to the `admin`
  role on first login).
- `ADMIN_MFA_REMEMBER_SECRET` — HMAC secret for the "remember this device"
  MFA cookie.

## Commands

- `npm run dev` — Vite dev server (admin API runs in-process via Vite
  middleware, see `vite.config.js`).
- `npm run build` — production build to `dist/`.
- `npm run preview` — preview the production build locally.

## Local admin/DB fallbacks

Several server store modules (`admin-folder-store.js`, `admin-audit-log-store.js`,
`external-media-store.js`) fall back to local JSON files in `server/*.json`
when Supabase isn't configured (missing `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`),
so local dev works without a live Supabase project for basic testing. This
fallback is best-effort and not a substitute for testing against real Supabase
before shipping data-layer changes.
