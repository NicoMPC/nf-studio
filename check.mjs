#!/usr/bin/env node
// NF STUDIO — vérifications automatiques sur dist/ (zéro dépendance).
// Code de retour 1 si au moins une erreur. Les avertissements ne bloquent pas.
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(ROOT, 'dist');
const PLACEHOLDER_HOST = 'site-url-a-definir.invalid';
// Le site peut être servi sous un sous-chemin (ex. GitHub Pages : /nf-studio/)
const SITE_URL = (JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8')).siteUrl || '').replace(/\/+$/, '');
const SITE_BASE = SITE_URL ? new URL(SITE_URL).pathname.replace(/\/+$/, '') : '';
const sitePath = (u) => new URL(u).pathname.slice(SITE_BASE.length).replace(/^\//, '');

const errors = [];
const warnings = [];
const ok = [];
const err = (f, m) => errors.push(`${f} : ${m}`);
const warn = (f, m) => warnings.push(`${f} : ${m}`);

const stripComments = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3]) : null;
};
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const textOf = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

async function listFiles(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) out.push(...await listFiles(f)); else out.push(f);
  }
  return out;
}

async function main() {
  if (!existsSync(DIST)) { console.error('✗ dist/ absent : lancez d’abord npm run build'); process.exit(1); }
  const all = await listFiles(DIST);
  const pages = all.filter((f) => f.endsWith('.html'));
  const ids = {};
  const sources = {};
  for (const f of pages) {
    const rel = path.relative(DIST, f);
    sources[rel] = stripComments(await readFile(f, 'utf8'));
    ids[rel] = new Set([...sources[rel].matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]));
  }

  let mailtoCount = 0;
  const inlineScripts = new Set();
  for (const [rel, html] of Object.entries(sources)) {
    // IDs dupliqués
    const allIds = [...html.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
    const dup = allIds.filter((v, i) => allIds.indexOf(v) !== i);
    if (dup.length) err(rel, `id dupliqué(s) : ${[...new Set(dup)].join(', ')}`);

    // lang
    if (!/<html[^>]*\slang="[a-z]{2}/i.test(html)) err(rel, 'attribut lang manquant sur <html>');

    // H1 unique + hiérarchie
    const heads = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ lvl: +m[1], txt: textOf(m[2]) }));
    const h1 = heads.filter((h) => h.lvl === 1).length;
    if (h1 !== 1) err(rel, `${h1} H1 trouvé(s), 1 attendu`);
    else ok.push(`${rel} : H1 unique`);
    if (heads.length && heads[0].lvl !== 1) err(rel, `le premier titre est un H${heads[0].lvl}, pas un H1`);
    let prev = 0; let jumps = 0;
    for (const h of heads) {
      if (h.lvl > prev + 1) { err(rel, `saut de hiérarchie H${prev} → H${h.lvl} (« ${h.txt.slice(0, 50)} »)`); jumps++; }
      if (!h.txt) err(rel, `titre H${h.lvl} vide`);
      prev = h.lvl;
    }
    if (!jumps) ok.push(`${rel} : hiérarchie Hn sans saut (${heads.length} titres)`);

    // images
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const t = m[0];
      const src = attr(t, 'src');
      if (attr(t, 'alt') === null) err(rel, `image sans alt : ${src}`);
      if (!attr(t, 'width') || !attr(t, 'height')) err(rel, `image sans width/height : ${src}`);
    }

    // liens & ressources
    const refs = [];
    for (const m of html.matchAll(/<(a|link|script|img|source)\b[^>]*>/gi)) {
      const t = m[0];
      for (const a of ['href', 'src']) { const v = attr(t, a); if (v !== null) refs.push({ tag: m[1].toLowerCase(), attr: a, v }); }
      const ss = attr(t, 'srcset');
      if (ss) for (const part of ss.split(',')) refs.push({ tag: m[1].toLowerCase(), attr: 'srcset', v: part.trim().split(/\s+/)[0] });
    }
    let internalOk = 0;
    for (const r of refs) {
      const v = decode(r.v);
      if (r.tag === 'link' && /canonical/.test(v)) continue;
      if (v === '') { err(rel, `${r.attr} vide sur <${r.tag}>`); continue; }
      if (v.startsWith('mailto:')) {
        mailtoCount++;
        const addr = v.slice(7).split('?')[0];
        if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(decodeURIComponent(addr))) err(rel, `mailto invalide : ${v}`);
        continue;
      }
      if (/^(https?:)?\/\//i.test(v)) {
        if (v.includes(PLACEHOLDER_HOST) || (SITE_URL && v.startsWith(SITE_URL))) continue; // URLs absolues du site : gérées plus bas
        if (r.tag !== 'a') err(rel, `ressource externe chargée : ${v} (tout doit être auto-hébergé)`);
        continue;
      }
      if (v.startsWith('tel:')) { if (!/^tel:\+\d{8,15}$/.test(v)) err(rel, `lien tel invalide : ${v}`); continue; }
      if (v.startsWith('data:')) continue;
      const [p, hash] = v.split('#');
      const target = p === '' ? rel : path.normalize(path.join(path.dirname(rel), p));
      if (p !== '' && !existsSync(path.join(DIST, target))) { err(rel, `lien interne cassé : ${v}`); continue; }
      if (hash !== undefined) {
        if (!ids[target]) { err(rel, `ancre vers une page non HTML : ${v}`); continue; }
        if (!ids[target].has(hash)) { err(rel, `ancre introuvable : ${v}`); continue; }
      }
      internalOk++;
    }
    ok.push(`${rel} : ${internalOk} liens/ressources internes valides`);

    // liens nouvel onglet : rel noopener + annonce accessible
    for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>([\s\S]*?)<\/a>/gi)) {
      if (!/rel="[^"]*noopener/.test(m[0])) err(rel, `target=_blank sans noopener : ${m[0].slice(0, 80)}`);
      if (!/nouvel onglet/i.test(m[1])) err(rel, `lien nouvel onglet non annoncé : ${m[0].slice(0, 80)}`);
    }

    // aria-controls / aria-labelledby pointent vers des id existants
    for (const m of html.matchAll(/\saria-(controls|labelledby|describedby)="([^"]+)"/g)) {
      for (const id of m[2].split(/\s+/)) if (!ids[rel].has(id)) err(rel, `aria-${m[1]} vers un id absent : ${id}`);
    }

    // placeholders non rendus / valeurs fantômes
    const leftovers = html.replace(/<script[\s\S]*?<\/script>/gi, '').match(/\{\{[^}]*\}\}?|\}\}/g);
    if (leftovers) err(rel, `placeholder(s) non rendu(s) : ${[...new Set(leftovers)].join(' ')}`);
    else ok.push(`${rel} : aucun placeholder non rendu`);
    for (const m of html.matchAll(/<script\b(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)) if (/\{\{/.test(m[1])) err(rel, 'placeholder non rendu dans un script');
    const visible = textOf(html);
    for (const bad of ['null', 'undefined', 'NaN', '[object Object]']) {
      if (new RegExp(`(^|\\s)${bad.replace(/[[\]]/g, '\\$&')}(\\s|$|[.,;:])`).test(visible)) err(rel, `texte visible suspect : « ${bad} »`);
    }
    for (const m of html.matchAll(/\s(href|src|content|alt)="(null|undefined)"/g)) err(rel, `attribut ${m[1]}="${m[2]}"`);

    // champs à compléter (rendus proprement, mais signalés)
    const todos = [...html.matchAll(/data-todo="([^"]+)"/g)].map((m) => m[1]);
    if (todos.length) warn(rel, `${todos.length} élément(s) « à compléter » : ${[...new Set(todos)].join(', ')}`);

    // title & description
    const title = html.match(/<title>([\s\S]*?)<\/title>/i);
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (!title || !textOf(title[1])) err(rel, '<title> manquant');
    else {
      const n = [...decode(title[1].trim())].length;
      if (n < 25 || n > 70) err(rel, `title de ${n} caractères (hors 25-70)`);
      else if (n < 45 || n > 62) warn(rel, `title de ${n} caractères (idéal ≈ 50-60)`);
      else ok.push(`${rel} : title ${n} car.`);
    }
    if (!desc || !desc[1].trim()) err(rel, 'meta description manquante');
    else {
      const n = [...decode(desc[1].trim())].length;
      if (n < 80 || n > 180) err(rel, `meta description de ${n} caractères (hors 80-180)`);
      else if (n < 130 || n > 162) warn(rel, `meta description de ${n} caractères (idéal ≈ 140-160)`);
      else ok.push(`${rel} : description ${n} car.`);
    }
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
    if (!canonical) err(rel, 'canonical manquant');
    else if (canonical[1].includes(PLACEHOLDER_HOST)) warn(rel, `canonical sur l’URL provisoire ${canonical[1]}`);

    // og:image : le fichier doit exister dans dist/
    const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (!og) warn(rel, 'og:image absente');
    else {
      const f = sitePath(og[1]);
      if (!existsSync(path.join(DIST, f))) err(rel, `og:image introuvable dans dist : ${f}`);
      else ok.push(`${rel} : og:image présente (${f})`);
    }
    // scripts inline : leur hash doit figurer dans la CSP de _headers
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) inlineScripts.add(m[1]);

    // JSON-LD
    const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    if (!blocks.length) warn(rel, 'aucun JSON-LD');
    for (const b of blocks) {
      try {
        const data = JSON.parse(b[1]);
        const s = JSON.stringify(data);
        if (/:null\b/.test(s)) err(rel, 'JSON-LD contient une valeur null');
        ok.push(`${rel} : JSON-LD parsable (${data['@graph'] ? data['@graph'].map((n) => n['@type']).join(' + ') : data['@type']})`);
      } catch (e) { err(rel, `JSON-LD invalide : ${e.message}`); }
    }
  }

  // mailto
  if (mailtoCount === 0) warnings.push('site : aucun lien mailto (contact.email non renseigné)');
  else ok.push(`site : ${mailtoCount} lien(s) mailto valides`);

  // sitemap & robots
  const smPath = path.join(DIST, 'sitemap.xml');
  if (!existsSync(smPath)) err('sitemap.xml', 'absent');
  else {
    const sm = await readFile(smPath, 'utf8');
    if (!/^<\?xml[\s\S]*<urlset[\s\S]*<\/urlset>\s*$/.test(sm)) err('sitemap.xml', 'structure XML inattendue');
    const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const toFile = (u) => { const p = sitePath(u); return p === '' ? 'index.html' : p; };
    const listed = new Set(locs.map(toFile));
    for (const l of locs) if (!sources[toFile(l)]) err('sitemap.xml', `URL sans page correspondante : ${l}`);
    for (const p of Object.keys(sources)) if (!listed.has(p)) err('sitemap.xml', `page absente du sitemap : ${p}`);
    const hosts = new Set(locs.map((l) => new URL(l).host));
    if (hosts.size > 1) err('sitemap.xml', `plusieurs domaines : ${[...hosts].join(', ')}`);
    if (hosts.has(PLACEHOLDER_HOST)) warn('sitemap.xml', 'URLs sur le domaine provisoire (siteUrl à renseigner)');
    ok.push(`sitemap.xml : ${locs.length} URL cohérentes avec ${Object.keys(sources).length} pages`);
  }
  const rb = path.join(DIST, 'robots.txt');
  if (!existsSync(rb)) err('robots.txt', 'absent');
  else if (!/Sitemap:\s*\S+sitemap\.xml/.test(await readFile(rb, 'utf8'))) err('robots.txt', 'ligne Sitemap manquante');
  else ok.push('robots.txt : présent avec Sitemap');

  // _headers : présence, CSP couvrant les scripts inline
  const hp = path.join(DIST, '_headers');
  if (!existsSync(hp)) warn('_headers', 'absent (en-têtes HTTP à configurer chez l’hébergeur)');
  else {
    const h = await readFile(hp, 'utf8');
    const { createHash } = await import('node:crypto');
    const csp = (h.match(/Content-Security-Policy:\s*(.+)/) || [])[1] || '';
    if (!csp) err('_headers', 'pas de Content-Security-Policy');
    for (const sc of inlineScripts) {
      const hs = `'sha256-${createHash('sha256').update(sc).digest('base64')}'`;
      if (!csp.includes(hs)) err('_headers', `script inline non autorisé par la CSP : ${sc.slice(0, 40)}`);
    }
    if (/style=/.test(Object.values(sources).join('')) && !/style-src[^;]*unsafe-inline/.test(csp)) err('_headers', 'attribut style= présent mais bloqué par la CSP');
    ok.push(`_headers : CSP présente, ${inlineScripts.size} script(s) inline autorisé(s) par hash`);
  }

  // budget polices
  const fonts = all.filter((f) => f.endsWith('.woff2'));
  let fontBytes = 0; for (const f of fonts) fontBytes += (await stat(f)).size;
  if (fontBytes > 150 * 1024) err('fonts', `${Math.round(fontBytes / 1024)} Ko de polices (budget 150 Ko)`);
  else ok.push(`polices : ${fonts.length} woff2, ${Math.round(fontBytes / 1024)} Ko (budget 150 Ko)`);

  // sortie
  console.log(`Vérifications sur dist/ (${pages.length} pages)\n`);
  for (const o of ok) console.log(`  ✓ ${o}`);
  if (warnings.length) { console.log(`\n⚠ ${warnings.length} avertissement(s)`); for (const w of warnings) console.log(`  - ${w}`); }
  if (errors.length) { console.log(`\n✗ ${errors.length} erreur(s)`); for (const e of errors) console.log(`  - ${e}`); process.exit(1); }
  console.log('\n✓ check OK : aucune erreur');
}

main().catch((e) => { console.error('✗ check planté :', e); process.exit(1); });
