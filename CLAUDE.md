# Clarisse Bonneu — notes projet

## Suivi / analytics (état actuel)

- **Google Tag Manager** : conteneur `GTM-PL53GMHN`, chargé uniquement après consentement cookies (Consent Mode v2). Code dans `src/js/main.js` (`applyGtmConsent`).
- **Microsoft Clarity** : chargé après consentement analytics (`applyClarityConsent` dans `src/js/main.js`).
- Consentement stocké dans `localStorage` (clé `clarisse-bonneu-cookie-consent:v1`).

## Google Analytics 4 (GA4) — FAIT le 2026-09-30

- **Propriété GA4** : `Clarisse-Bonneu` (compte AngeloPro, propriété `556771048`). Flux web créé pour `https://clarisse-bonneu.fr` (ID de flux `15890244014`).
- **ID de mesure** : `G-GX220ZTQLP`.
- **GTM** (`GTM-PL53GMHN`, compte Clarisse Bonneu) : balise « GA4 - Configuration » (type *Balise Google*, ID `G-GX220ZTQLP`), déclencheur *Initialization - All Pages*, contrôles de consentement intégrés (`analytics_storage`…). Conteneur publié en **version 2**.
- **Site** : aucun changement de code de tracking (Consent Mode v2 déjà géré par `applyGtmConsent`). Politique de confidentialité (FR/EN) et mentions légales mises à jour pour citer Google Analytics 4.
- **Vérifications faites (Playwright)** : avant consentement, aucune requête GA ; après « Tout accepter », `page_view` envoyé vers `region1.google-analytics.com/g/collect` (`gcs=G111`, 204), y compris en visite de retour ; GA4 Temps réel affiche l'utilisateur actif.
- CSP : `netlify.toml` autorise déjà `googletagmanager.com` / `google-analytics.com` (toujours en report-only).
- Reste à faire côté Angelo/plus tard : éventuellement activer le mode Consentement dans GA4 (Admin) et passer la CSP en mode bloquant.
