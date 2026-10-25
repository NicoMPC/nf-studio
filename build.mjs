#!/usr/bin/env node
// NF STUDIO — générateur statique, zéro dépendance (Node >= 20).
// Lit site.config.json, rend les templates de src/, écrit dist/.
//
// Syntaxe des templates :
//   {{ cle }}     valeur échappée HTML
//   {{{ cle }}}   valeur brute (HTML préparé par ce script)
//   {{> nom }}    inclusion de src/partials/nom.html
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
export const PLACEHOLDER_URL = 'https://site-url-a-definir.invalid';

const warnings = [];
const warn = (msg) => warnings.push(msg);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isSet = (v) => v !== null && v !== undefined && String(v).trim() !== '';

// Champ légal manquant : rendu propre et repérable à l'écran + warning.
function pending(label, key, text = 'À compléter') {
  return `<span class="todo" data-todo="${esc(key)}">${esc(text)}<span class="visually-hidden"> : ${esc(label)}</span></span>`;
}

async function readPartials() {
  const dir = path.join(SRC, 'partials');
  const out = {};
  for (const f of await readdir(dir)) {
    if (f.endsWith('.html')) out[f.replace(/\.html$/, '')] = await readFile(path.join(dir, f), 'utf8');
  }
  return out;
}

function render(tpl, ctx, partials, file) {
  let out = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`${file} : partial inconnu « ${name} »`);
    return partials[name];
  });
  out = out.replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_, k) => {
    if (!(k in ctx)) throw new Error(`${file} : clé brute inconnue « ${k} »`);
    return String(ctx[k]);
  });
  out = out.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
    if (!(k in ctx)) throw new Error(`${file} : clé inconnue « ${k} »`);
    return esc(ctx[k]);
  });
  return out;
}

// Minification CSS sûre : commentaires et espaces, chaînes protégées.
function minifyCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/)
    .map((part, i) => (i % 2 ? part : part
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};,>])\s*/g, '$1')
      .replace(/:\s+/g, ':')
      .replace(/;}/g, '}')))
    .join('')
    .trim() + '\n';
}

// Minification JS prudente (sans dépendance) : commentaires et espaces hors chaînes.
// Hypothèses : pas de littéral regex, instructions terminées par « ; ». Le résultat est vérifié par node --check.
function minifyJs(src) {
  let out = '', i = 0, q = null, pend = false;
  const id = (c) => /[A-Za-z0-9_$]/.test(c || '');
  while (i < src.length) {
    const c = src[i];
    if (q) { // dans une chaîne ou un gabarit
      out += c;
      if (c === '\\') { out += src[i + 1]; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; pend = true; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; pend = true; continue; }
    if (/\s/.test(c)) { pend = true; i++; continue; }
    if (pend && id(out[out.length - 1]) && id(c)) out += ' ';
    pend = false;
    if (c === '"' || c === "'" || c === '`') q = c;
    out += c; i++;
  }
  return out + '\n';
}

function validEmail(e) {
  return /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(e);
}

async function main() {
  const config = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
  const partials = await readPartials();

  // --- URL du site
  let siteUrl = config.siteUrl;
  if (!isSet(siteUrl)) {
    warn(`siteUrl est null : canonical, og:url, sitemap et JSON-LD utilisent le placeholder ${PLACEHOLDER_URL}`);
    siteUrl = PLACEHOLDER_URL;
  }
  siteUrl = siteUrl.replace(/\/+$/, '');
  const abs = (p) => `${siteUrl}/${p}`;

  // --- Contact
  const email = config.contact?.email;
  const linkedin = config.contact?.linkedin;
  const hasEmail = isSet(email);
  if (hasEmail && !validEmail(email)) throw new Error(`contact.email invalide : ${email}`);
  if (!hasEmail) warn('contact.email est null : le bouton « Parlons-en » n’est pas affiché, la section Contact affiche une mention d’attente.');
  if (!isSet(linkedin)) warn('contact.linkedin est null : aucun lien LinkedIn n’est affiché.');

  const mailto = hasEmail
    ? `mailto:${email}?subject=${encodeURIComponent(config.contact.mailSubject || 'Projet')}`
    : null;

  // Lien externe ouvert dans un nouvel onglet, annoncé aux lecteurs d'écran
  const extLink = (href, label, rel = 'noopener') =>
    `<a href="${esc(href)}" target="_blank" rel="${rel}">${label}<span class="visually-hidden"> (nouvel onglet)</span><span class="ext" aria-hidden="true">↗</span></a>`;
  const linkedinLink = isSet(linkedin) ? extLink(linkedin, 'LinkedIn', 'me noopener') : '';

  let contactBlock;
  if (hasEmail) {
    contactBlock = `<div class="contact-actions">
          <a class="btn btn-large" href="${esc(mailto)}">Parlons-en <span aria-hidden="true">→</span></a>
          <p class="contact-direct"><span class="mono-label">E-mail</span> <a class="contact-email" href="mailto:${esc(email)}">${esc(email)}</a></p>
        </div>`;
  } else {
    contactBlock = `<div class="contact-actions">
          <p class="contact-pending" data-todo="contact.email"><span class="mono-label">E-mail</span> Adresse de contact bientôt en ligne.</p>
        </div>`;
  }
  const footerLinkedin = isSet(linkedin) ? `<li>${linkedinLink}</li>` : '';

  // --- Mentions légales
  const L = config.legal || {};
  const H = L.host || {};
  const isEI = isSet(L.legalForm) && /\bEI\b|entrepreneur individuel/i.test(L.legalForm);
  const group = (v, sizes) => { // 837763713 -> 837 763 713 (insécables)
    const d = String(v).replace(/\s+/g, ''); if (!/^\d+$/.test(d)) return String(v);
    const out = []; let i = 0; for (const n of sizes) { out.push(d.slice(i, i + n)); i += n; }
    if (i < d.length) out.push(d.slice(i));
    return out.filter(Boolean).join('\u00a0');
  };
  const HOST_TODO = 'À compléter lors de la mise en ligne';
  const legalFields = [
    ['legalName', 'nom de l’exploitant', isSet(L.legalName) ? L.legalName + (isEI ? ' (EI)' : '') : null],
    ['tradeName', 'nom commercial', L.tradeName],
    ['legalForm', 'forme juridique', L.legalForm],
    ['address', 'adresse', L.address],
    ['siren', 'SIREN', isSet(L.siren) ? group(L.siren, [3, 3, 3]) : null],
    ['siret', 'SIRET', isSet(L.siret) ? group(L.siret, [3, 3, 3, 5]) : null],
    ['ape', 'code APE', L.ape],
    ['registration', 'immatriculation', L.registration],
    ['publicationDirector', 'directeur de la publication', L.publicationDirector],
    ['host.name', 'nom de l’hébergeur', H.name, HOST_TODO],
    ['host.address', 'adresse de l’hébergeur', H.address, HOST_TODO],
  ];
  const missingLegal = [];
  const lg = {};
  for (const [key, label, val, todoText] of legalFields) {
    const ctxKey = 'lg_' + (key === 'host.name' ? 'hostName' : key === 'host.address' ? 'hostAddress' : key);
    if (isSet(val)) lg[ctxKey] = esc(val).replace(/\n/g, '<br>');
    else { lg[ctxKey] = pending(label, `legal.${key}`, todoText); missingLegal.push(`legal.${key}`); }
  }
  // TVA : numéro, ou mention (ex. franchise en base), sinon à compléter
  if (isSet(L.vatNumber)) lg.lg_vat = esc(L.vatNumber) + (isSet(L.vatNote) ? ` — ${esc(L.vatNote)}` : '');
  else if (isSet(L.vatNote)) lg.lg_vat = esc(L.vatNote);
  else { lg.lg_vat = pending('numéro de TVA ou mention applicable', 'legal.vatNumber'); missingLegal.push('legal.vatNumber / legal.vatNote'); }
  // Hébergeur : téléphone et/ou site
  const hostBits = [];
  if (isSet(H.phone)) hostBits.push(esc(H.phone));
  if (isSet(H.url)) hostBits.push(extLink(H.url, esc(H.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))));
  if (hostBits.length) lg.lg_hostContact = hostBits.join(' · ');
  else { lg.lg_hostContact = pending('téléphone ou site de l’hébergeur', 'legal.host.phone', HOST_TODO); missingLegal.push('legal.host.phone / legal.host.url'); }
  // Téléphone : affiché uniquement dans les mentions légales (rubrique Éditeur)
  const phone = config.contact?.phone, phoneIntl = config.contact?.phoneIntl;
  if (isSet(phone) && isSet(phoneIntl) && !/^\+\d{8,15}$/.test(phoneIntl)) throw new Error(`contact.phoneIntl invalide : ${phoneIntl}`);
  lg.lg_phone = isSet(phone) && isSet(phoneIntl)
    ? `<a href="tel:${esc(phoneIntl)}">${esc(phone).replace(/ /g, '&nbsp;')}</a>`
    : pending('téléphone', 'contact.phone');
  if (!isSet(phone)) warn('contact.phone est null : téléphone « À compléter » dans les mentions légales.');
  lg.lg_email = hasEmail ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : pending('adresse e-mail de contact', 'contact.email');
  lg.lg_controller = isSet(L.legalName)
    ? `${esc(L.legalName)}${isEI ? ' (EI)' : ''}${isSet(L.tradeName) ? `, exerçant sous le nom commercial ${esc(L.tradeName)}` : ''}`
    : pending('responsable du traitement (exploitant)', 'legal.legalName');

  if (missingLegal.length) warn(`Mentions légales : ${missingLegal.length} champ(s) à compléter → ${missingLegal.join(', ')}`);
  const onlyHostMissing = missingLegal.length && missingLegal.every((k) => k.startsWith('legal.host'));
  const legalPendingNotice = !missingLegal.length && hasEmail ? ''
    : onlyHostMissing && hasEmail
      ? `<p class="legal-notice" data-todo="legal.host">Les informations sur l’hébergeur seront complétées lors de la mise en ligne du site.</p>`
      : `<p class="legal-notice" data-todo="legal">Certaines informations sont en cours de vérification et seront complétées prochainement.</p>`;
  const founderLegal = config.founder.name + (isEI ? ' (EI)' : '');

  // --- JSON-LD (uniquement des informations vraies et présentes dans la config)
  const orgId = `${siteUrl}/#studio`;
  const personId = `${siteUrl}/#nicolas-follezou`;
  const person = {
    '@type': 'Person',
    '@id': personId,
    name: config.founder.name,
    jobTitle: config.founder.jobTitle,
    ...(isSet(config.founder.description) ? { description: config.founder.description } : {}),
    image: abs('assets/img/nicolas-follezou-512.jpg'),
    worksFor: { '@id': orgId },
  };
  if (isSet(linkedin)) person.sameAs = [linkedin];
  if (hasEmail) person.email = email;
  const org = {
    '@type': 'Organization',
    '@id': orgId,
    name: config.name,
    url: `${siteUrl}/`,
    description: config.seo.organizationDescription,
    founder: { '@id': personId },
    knowsAbout: config.seo.services,
    makesOffer: config.seo.services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s } })),
  };
  if (hasEmail) org.email = email;
  // Adresse volontairement absente du JSON-LD : domicile personnel, affiché seulement dans les mentions légales (obligation LCEN).
  if (isSet(L.tradeName) && isSet(L.legalName)) org.legalName = `${L.legalName}${isEI ? ' (EI)' : ''}`;
  if (isSet(L.siret)) org.identifier = { '@type': 'PropertyValue', propertyID: 'SIRET', value: String(L.siret).replace(/\s+/g, '') };
  const website = {
    '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: `${siteUrl}/`, name: config.name,
    inLanguage: config.lang, publisher: { '@id': orgId },
  };
  const jsonLdHome = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, person, website] })}</script>`;
  const jsonLdLegal = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage', name: config.seo.legal.title, url: abs('mentions-legales.html'),
    isPartOf: { '@id': `${siteUrl}/#website` }, inLanguage: config.lang,
  })}</script>`;

  // --- Assets versionnés : CSS minifiée + hash dans le nom, JS hashé (cache long possible)
  const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);
  const cssSrc = await readFile(path.join(SRC, 'assets/css/style.css'), 'utf8');
  const cssMin = process.env.NO_MINIFY ? cssSrc : minifyCss(cssSrc);
  const cssHref = `assets/css/style.${hash(cssMin)}.css`;
  const jsSrc = minifyJs(await readFile(path.join(SRC, 'assets/js/menu.js'), 'utf8'));
  const jsHref = `assets/js/menu.${hash(jsSrc)}.js`;
  const animSrc = minifyJs(await readFile(path.join(SRC, 'assets/js/anim.js'), 'utf8'));
  const animHref = `assets/js/anim.${hash(animSrc)}.js`;
  if (Buffer.byteLength(animSrc) > 6000) warn(`anim.js dépasse 6 000 octets (${Buffer.byteLength(animSrc)} o)`);

  // --- Contexte commun
  const now = new Date();
  const buildDate = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const base = {
    lang: config.lang, locale: config.locale, siteName: config.name,
    founderName: config.founder.name, year: String(now.getFullYear()), buildDate,
    ogImage: abs('assets/img/og-image.jpg'), ogImageAlt: config.seo.ogImageAlt || config.seo.home.title,
    cssHref, jsHref,
    contactBlock, footerLinkedin, legalPendingNotice, founderLegal, ...lg,
  };

  const pages = [
    {
      src: 'index.html', out: 'index.html', url: `${siteUrl}/`,
      ctx: { pageTitle: config.seo.home.title, pageDescription: config.seo.home.description, canonical: `${siteUrl}/`, jsonLd: jsonLdHome, homeHref: '', logoHref: '#top', animScript: `<script src="${animHref}" defer></script>` },
    },
    {
      src: 'mentions-legales.html', out: 'mentions-legales.html', url: abs('mentions-legales.html'),
      ctx: { pageTitle: config.seo.legal.title, pageDescription: config.seo.legal.description, canonical: abs('mentions-legales.html'), jsonLd: jsonLdLegal, homeHref: 'index.html', logoHref: 'index.html', animScript: '' },
    },
  ];

  // --- Écriture
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await cp(path.join(SRC, 'assets'), path.join(DIST, 'assets'), { recursive: true });
  await rm(path.join(DIST, 'assets/css/style.css'));
  await rm(path.join(DIST, 'assets/js/menu.js'));
  await rm(path.join(DIST, 'assets/js/anim.js'));
  await writeFile(path.join(DIST, animHref), animSrc);
  await writeFile(path.join(DIST, cssHref), cssMin);
  await writeFile(path.join(DIST, jsHref), jsSrc);
  const inlineHashes = new Set();

  for (const p of pages) {
    const tpl = await readFile(path.join(SRC, p.src), 'utf8');
    const html = render(tpl, { ...base, ...p.ctx }, partials, p.src);
    await writeFile(path.join(DIST, p.out), html);
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      inlineHashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
    }
  }

  // --- _headers (Netlify / Cloudflare Pages)
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${[...inlineHashes].join(' ')}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  const headers = `# En-têtes HTTP (format Netlify / Cloudflare Pages), généré par build.mjs
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Content-Security-Policy: ${csp}

# Pages HTML : toujours revalidées
/
  Cache-Control: public, max-age=0, must-revalidate
/*.html
  Cache-Control: public, max-age=0, must-revalidate

# Polices (fichiers stables) et CSS/JS versionnés par hash : cache long
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/css/*
  Cache-Control: public, max-age=31536000, immutable
/assets/js/*
  Cache-Control: public, max-age=31536000, immutable

# Images non versionnées : cache d'une semaine
/assets/img/*
  Cache-Control: public, max-age=604800
`;
  await writeFile(path.join(DIST, '_headers'), headers);

  const lastmod = now.toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${esc(p.url)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap);
  await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

  // --- Rapport
  const files = [];
  const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const f = path.join(d, e.name); e.isDirectory() ? await walk(f) : files.push(f); } };
  await walk(DIST);
  console.log(`✓ build : ${pages.length} pages, ${files.length} fichiers dans dist/`);
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} avertissement(s) :`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
}

main().catch((e) => { console.error('✗ build échoué :', e.message); process.exit(1); });
