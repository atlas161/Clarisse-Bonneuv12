[OPEN] Admin invite email not received on Netlify

## Session
- session_id: `admin-invite-email`
- started_at: `2026-06-28`
- scope: `src/js/admin.js`, `server/admin-api.js`, Supabase auth invite flow, Netlify production`

## Symptoms
- Depuis l'admin en production sur Netlify, la creation/invitation d'un compte client ne donne aucun email recu.
- L'utilisateur a verifie les spams et n'a rien recu.
- Le besoin est de verifier la logique complete cote admin, serveur, Supabase Auth et envoi d'email.

## Hypotheses
1. L'endpoint serveur de creation d'utilisateur echoue en production Netlify avant l'appel a Supabase.
2. L'appel Supabase d'invitation reussit mais aucun email n'est emis a cause de la configuration Auth/SMTP.
3. Le redirect ou les parametres d'invitation sont invalides en production et empechent l'envoi.
4. Le front admin ne remonte pas correctement une erreur de reponse et donne l'impression qu'il ne se passe rien.
5. Le flux de creation de compte utilise une methode inadaptee au scenario client en production.

## Plan
1. Inspecter le flux admin -> API -> Supabase sans modifier la logique.
2. Ajouter une instrumentation minimale sur les points critiques.
3. Reproduire en local ou lire les logs runtime disponibles.
4. Confirmer la cause par evidence.
5. Appliquer le correctif minimal puis verifier.

## Status
- awaiting_instrumentation: false
- fix_applied: true
- awaiting_user_verification: true

## Evidence
- Static evidence in `server/admin-api.js`: the previous implementation used `supabase.auth.admin.generateLink({ type: 'invite' })`, then returned `inviteLink` to the frontend.
- Static evidence in `src/js/admin.js`: the admin UI expected `payload.inviteLink` and explicitly displayed `Lien d invitation genere`, confirming the product behavior was "manual link generation" rather than "email invitation sent".
- SDK evidence in `node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts`: `inviteUserByEmail()` is documented as sending an invite link to the user's email address, while `generateLink()` is documented as generating links/OTPs for custom email provider flows.
- Environment check: no local `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, or `ADMIN_INVITE_REDIRECT_TO` were available in the current shell, so a safe local runtime reproduction against the real Supabase project was not possible from this workspace.

## Fix
- Replaced `generateLink({ type: 'invite' })` with `inviteUserByEmail(email, { data, redirectTo })` in `server/admin-api.js`.
- Kept the post-create role update via `updateUserById()` so invited users still receive the intended `client/admin` role.
- Updated admin success copy to say that the invitation email was sent, and stopped surfacing a generated manual link in the normal success path.

## Remaining Checks
1. Verify Supabase Auth `Site URL` and allowed redirect URLs include the production Netlify URL and any preview URLs if used.
2. Verify the Supabase email template for "Invite user" is active and correctly configured.
3. Verify the invite email now arrives after deploying this fix.
