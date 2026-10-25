# NF STUDIO — site vitrine

Site statique (HTML + CSS + quelques lignes de JS vanilla), sans framework ni dépendance npm.

## Prérequis

- Node.js ≥ 20 (build, vérifications, serveur local)
- Pour régénérer les images (facultatif) : ImageMagick (`convert`), Google Chrome, Python 3

## Commandes

| Commande | Rôle |
|---|---|
| `npm run build` | Génère `dist/` à partir de `src/` et `site.config.json`. Affiche les warnings (champs manquants). |
| `npm run check` | Vérifie `dist/` : H1 unique, hiérarchie Hn, alt, ancres et liens internes, placeholders non rendus, title et description, JSON-LD, sitemap, mailto, og:image, CSP de `_headers`, budget polices. Code retour ≠ 0 en cas d’erreur. |
| `npm run dev` | Build puis serveur local sur http://localhost:8080 (`node serve.mjs [port]`). |

## Où modifier quoi

- **Coordonnées, SEO, mentions légales** : `site.config.json` uniquement.
  - `siteUrl` : URL de production, sans slash final (ex. `https://www.exemple.fr`). Tant qu’elle vaut `null`, canonical, og:url, sitemap et JSON-LD utilisent `https://site-url-a-definir.invalid` et le build l’indique.
  - `contact.email`, `contact.linkedin` : un champ à `null` fait simplement disparaître le lien.
  - `legal` : identité de l’entreprise (source : `docs/legal.json` et `docs/infos-legales.md`) et bloc `host` (hébergeur). Un champ `null` s’affiche « À compléter » dans la page et le build le signale.
- **Textes** : `src/index.html`, `src/mentions-legales.html`, en-tête et pied dans `src/partials/`.
- **Styles** : `src/assets/css/style.css`. Au build, la CSS est minifiée et prend un nom versionné (`style.<hash>.css`), comme `menu.<hash>.js`.

## Régénérer les images

- **Portrait** : `bash tools/photo.sh` (depuis `docs/photo-originale.jpeg` : recadrage 4:5, WebP et JPEG en 320, 448 et 512 px).
- **Image de partage (1200×630) et apple-touch-icon** : `bash tools/og.sh` (rend `tools/og.html` avec Chrome headless).
- **Captures de contrôle** : lancer `node serve.mjs 8791` dans un terminal, puis `bash tools/captures.sh 8791` → `_suivi/captures/` (320, 360, 390 et 1440 px, accueil et mentions).

## Mise en ligne

1. **Choisir un hébergeur statique.** Netlify ou Cloudflare Pages lisent directement le fichier `dist/_headers` (CSP, sécurité, cache). Ailleurs (OVH, o2switch, GitHub Pages…), il faut reporter ces en-têtes dans la configuration du serveur. Activer la compression (gzip ou brotli) et HTTPS.
2. **Renseigner `site.config.json`** : `siteUrl` et le bloc `legal.host` (nom, adresse, téléphone ou URL de l’hébergeur).
3. **Reconstruire et vérifier** : `npm run build && npm run check`. Il ne doit plus rester de warning sur siteUrl ni sur l’hébergeur.
4. **Déployer le contenu de `dist/`** (et seulement lui) à la racine du site.
5. **Vérifications après déploiement :**
   - PageSpeed Insights (https://pagespeed.web.dev/) sur les deux pages, en mobile et en desktop ;
   - test des résultats enrichis (https://search.google.com/test/rich-results) pour le JSON-LD ;
   - Google Search Console : valider le domaine, puis soumettre `https://<domaine>/sitemap.xml` ;
   - LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/) pour l’aperçu de partage (og:image) ;
   - vérifier les en-têtes réellement servis (`curl -I https://<domaine>/` et `/assets/fonts/...`) et que la CSP ne bloque rien (console du navigateur).

## Suivi

Le journal de construction est dans `_suivi/build.md`, les captures dans `_suivi/captures/`.
