#!/usr/bin/env node
/* ===============================================================
   sync-github.mjs
   Reads every public repo on the account and writes
   data/projects.json for the site to render.

   Cover images are found in four passes, so a repo yields a
   thumbnail no matter how it is laid out:

     1. images referenced by the root README
     2. images referenced by any nested README (projects/<name>/README.md
        and friends), with paths resolved relative to that README
     3. any image file anywhere in the repo tree, ranked by name,
        folder and file size
     4. the GitHub OpenGraph social preview, which always exists

   Every candidate is checked with a real request before it is
   written out, so the site never ships a broken <img>.

   Runs in GitHub Actions (Node 20+, zero dependencies).
   Local run:  GITHUB_TOKEN=ghp_xxx node scripts/sync-github.mjs
   =============================================================== */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USER  = process.env.GH_USER || 'TheAfricanJiant';
const TOKEN = process.env.GITHUB_TOKEN || '';
const ROOT  = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT   = resolve(ROOT, 'data/projects.json');

/* Repos to keep off the site entirely (or add the topic "hidden"
   to a repo on GitHub, which does the same thing without editing
   this file). */
const SKIP = new Set([
  `${USER}.github.io`,
  USER,            // profile README repo
  'my-portfolio'
]);

const MAX_IMAGES      = 6;    // kept per project
const MAX_CANDIDATES  = 22;   // checked over the network per project
const MAX_SUB_READMES = 8;    // nested READMEs mined per repo
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': `${USER}-portfolio-sync`,
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
};

async function api(path, raw = false) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: raw ? { ...headers, Accept: 'application/vnd.github.raw' } : headers
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return raw ? res.text() : res.json();
}

/* --- URL plumbing -------------------------------------------- */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

const BADGE = /shields\.io|badgen\.net|badge\.fury|travis-ci|circleci\.com|codecov|forthebadge|img\.shields|visitor-badge|hits\.seeyoufarm/i;

/* Hosts whose images render fine even though the URL carries no file
   extension (GitHub's own attachment CDNs). */
const EXTLESS_OK = /raw\.githubusercontent\.com|user-images\.githubusercontent\.com|github\.com\/user-attachments|githubusercontent\.com|opengraph\.githubassets\.com/i;

/** Percent-encode a path without double-encoding what is already encoded. */
function encodePath(p) {
  return p.split('/').map(seg => {
    if (!seg) return seg;
    let decoded = seg;
    try { decoded = decodeURIComponent(seg); } catch { /* malformed, use as-is */ }
    return encodeURIComponent(decoded);
  }).join('/');
}

/** Resolve "../assets/x.png" against the directory a README lives in. */
function resolveRelative(baseDir, src) {
  const parts = [];
  const all = (baseDir ? baseDir.split('/') : []).concat(src.split('/'));
  for (const part of all) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/**
 * Absolute, renderable URL for an asset referenced from a README.
 * `baseDir` is the repo-relative directory of the README doing the
 * referencing ('' for the root README).
 */
function absolutize(src, repo, branch, baseDir = '') {
  if (!src) return null;
  src = src.trim().replace(/^<|>$/g, '');
  if (src.startsWith('data:') || src.startsWith('#')) return null;

  // strip a trailing markdown title, then the fragment, then the query
  src = src.replace(/\s+["'][^"']*["']$/, '').split('#')[0];
  const qIndex = src.indexOf('?');
  const query = qIndex >= 0 ? src.slice(qIndex) : '';
  if (qIndex >= 0) src = src.slice(0, qIndex);
  if (!src) return null;

  if (/^https?:\/\//i.test(src)) {
    // rewrite blob/raw page links to the raw CDN so they render as images
    return src.replace(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/i,
      'https://raw.githubusercontent.com/$1/$2/$3'
    );
  }
  if (src.startsWith('//')) return 'https:' + src;

  const clean = resolveRelative(src.startsWith('/') ? '' : baseDir,
                                src.replace(/^\//, ''));
  if (!clean) return null;
  return `https://raw.githubusercontent.com/${USER}/${repo}/${branch}/${encodePath(clean)}${query}`;
}

function usableImageUrl(u) {
  if (!u) return false;
  if (BADGE.test(u)) return false;
  const bare = u.split('#')[0].split('?')[0];
  return IMAGE_EXT.test(bare) || EXTLESS_OK.test(u);
}

/* --- README mining ------------------------------------------- */

/** Every image referenced by a markdown document, in document order. */
function imagesFromMarkdown(md, repo, branch, baseDir = '') {
  if (!md) return [];
  const raw = [];

  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g)) raw.push(m[1]);
  for (const m of md.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) raw.push(m[1]);
  for (const m of md.matchAll(/<source[^>]+srcset=["']([^"']+)["']/gi)) {
    raw.push(m[1].split(',')[0].trim().split(/\s+/)[0]);
  }
  // reference-style definitions:  [cover]: assets/cover.png
  for (const m of md.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)) raw.push(m[1]);

  const out = [];
  for (const c of raw) {
    const url = absolutize(c, repo, branch, baseDir);
    if (usableImageUrl(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

/** bullet points from the README - shown as "Highlights" in the dossier */
function highlights(md) {
  if (!md) return [];
  const out = [];
  const body = md.replace(/```[\s\S]*?```/g, '');
  for (const m of body.matchAll(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(?!\[)(.{12,140})$/gm)) {
    const t = m[1]
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_#]/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (t && !/^https?:/i.test(t) && !out.includes(t)) out.push(t);
    if (out.length >= 6) break;
  }
  return out;
}

function readmeTitle(md) {
  const m = md?.match(/^\s*#\s+(.+?)\s*$/m);
  if (!m) return null;
  const t = m[1]
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*`_]/g, '')
    .trim();
  return t.length > 2 && t.length < 60 ? t : null;
}

function readmeBlurb(md, max = 230, take = 1) {
  if (!md) return null;
  const body = md
    .replace(/```[\s\S]*?```/g, '')                 // code fences
    .replace(/<!--[\s\S]*?-->/g, '')                // comments
    .replace(/^\s*#{1,6}\s.*$/gm, '')               // headings
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')           // images
    .replace(/<[^>]+>/g, '')                        // html
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');       // links -> text

  const paras = [];
  for (const para of body.split(/\n\s*\n/)) {
    const p = para.replace(/\s+/g, ' ').trim();
    if (p.length > 40 && !/^[-*|>=]/.test(p)) paras.push(p);
    if (paras.length >= take) break;
  }
  if (!paras.length) return null;
  const joined = paras.join('\n\n');
  return joined.length > max
    ? joined.slice(0, max - 3).replace(/\s+\S*$/, '') + '...'
    : joined;
}

const titleize = n => n
  .replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/\b\w/g, c => c.toUpperCase());

/* --- repo tree ------------------------------------------------ */

/** Flat list of every blob in the repo. One request, any structure. */
async function repoTree(repo, branch) {
  try {
    const t = await api(`/repos/${USER}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (!t?.tree) return [];
    if (t.truncated) console.warn(`  ! tree truncated for ${repo}`);
    return t.tree.filter(n => n.type === 'blob');
  } catch (e) {
    console.warn(`  ! tree ${repo}: ${e.message.slice(0, 80)}`);
    return [];
  }
}

/* Files that look like a deliberate cover shot. */
const NAME_STRONG = /(cover|hero|banner|social|preview|thumb|thumbnail|screenshot|demo|showcase|poster|header|overview)/i;
/* Files that are almost never a good thumbnail. */
const NAME_WEAK   = /(icon|favicon|logo|mark|badge|avatar|sprite|qr|arrow|bullet|divider|spacer|placeholder)/i;
/* Folders where people park presentable media. */
const DIR_GOOD    = /^(assets|asset|images|image|img|media|docs|doc|screenshots|screens|pictures|pics|static|public|resources|\.github)(\/|$)/i;

function scoreTreeImage(node) {
  const path = node.path;
  const file = path.split('/').pop();
  const depth = path.split('/').length - 1;
  let s = 0;

  if (NAME_STRONG.test(file)) s += 60;
  if (NAME_WEAK.test(file))   s -= 45;
  if (DIR_GOOD.test(path))    s += 25;
  if (depth === 0)            s += 15;          // sitting at the repo root
  s -= depth * 6;                               // buried deep is less likely a cover

  // size is a decent proxy for "a real screenshot" vs "a 2 kB icon"
  const kb = (node.size || 0) / 1024;
  if (kb < 6)         s -= 30;
  else if (kb < 40)   s += 5;
  else if (kb < 2000) s += 20;

  if (/\.svg$/i.test(file)) s -= 10;            // usually a logo or diagram
  if (/\.gif$/i.test(file)) s += 5;             // often a demo capture

  return s;
}

/* --- candidate verification ----------------------------------- */

const liveCache = new Map();

/** Does this URL actually serve an image? */
async function isLive(url) {
  if (liveCache.has(url)) return liveCache.get(url);
  let ok = false;
  try {
    const ua = { 'User-Agent': headers['User-Agent'] };
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: ua });
    // some CDNs dislike HEAD - retry with a 1-byte ranged GET
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { headers: { ...ua, Range: 'bytes=0-0' } });
    }
    const type = res.headers.get('content-type') || '';
    ok = res.ok && (!type || /^image\//i.test(type) || /octet-stream/i.test(type));
  } catch {
    ok = false;
  }
  liveCache.set(url, ok);
  return ok;
}

/** Check candidates in order, keep the first `limit` that resolve. */
async function verify(candidates, limit) {
  const seen = new Set();
  const kept = [];
  let checked = 0;
  for (const url of candidates) {
    if (kept.length >= limit || checked >= MAX_CANDIDATES) break;
    if (seen.has(url)) continue;
    seen.add(url);
    checked++;
    if (await isLive(url)) kept.push(url);
  }
  return kept;
}

/* --- main ---------------------------------------------------- */

const repos = await api(`/users/${USER}/repos?per_page=100&sort=updated`);
if (!repos) throw new Error(`user ${USER} not found`);

const projects = [];

for (const r of repos) {
  if (r.fork || r.archived || r.private) continue;
  if (SKIP.has(r.name)) continue;
  if ((r.topics || []).includes('hidden')) continue;

  const branch = r.default_branch || 'main';

  /* root README */
  let md = null;
  try {
    md = await api(`/repos/${USER}/${r.name}/readme`, true);
  } catch (e) {
    console.warn(`  ! readme ${r.name}: ${e.message.slice(0, 80)}`);
  }

  const tree = await repoTree(r.name, branch);

  /* pass 1 - root README */
  const fromRoot = imagesFromMarkdown(md, r.name, branch, '');

  /* pass 2 - nested READMEs, shallowest first (projects/01_x/README.md ...) */
  const subReadmes = tree
    .filter(n => /(^|\/)readme[^/]*\.(md|markdown)$/i.test(n.path) && n.path.includes('/'))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length ||
                    a.path.localeCompare(b.path))
    .slice(0, MAX_SUB_READMES);

  const fromSubs = [];
  const sections = [];
  for (const node of subReadmes) {
    let sub = null;
    try {
      sub = await api(
        `/repos/${USER}/${r.name}/contents/${encodePath(node.path)}?ref=${encodeURIComponent(branch)}`,
        true
      );
    } catch { /* skip unreadable */ }
    if (!sub) continue;

    const dir = node.path.split('/').slice(0, -1).join('/');
    fromSubs.push(...imagesFromMarkdown(sub, r.name, branch, dir));

    const title = readmeTitle(sub);
    const blurb = readmeBlurb(sub, 180, 1);
    if (title || blurb) {
      sections.push({
        title: title || titleize(dir.split('/').pop() || node.path),
        path: node.path,
        blurb: blurb || null,
        url: `${r.html_url}/blob/${branch}/${node.path}`
      });
    }
  }

  /* pass 3 - anything image-shaped in the tree, best guess first */
  const fromTree = tree
    .filter(n => IMAGE_EXT.test(n.path) && (n.size || 0) <= MAX_IMAGE_BYTES)
    .map(n => ({ n, s: scoreTreeImage(n) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .map(({ n }) => `https://raw.githubusercontent.com/${USER}/${r.name}/${branch}/${encodePath(n.path)}`);

  /* pass 4 - always available */
  const og = `https://opengraph.githubassets.com/1/${USER}/${r.name}`;

  const candidates = [...fromRoot, ...fromSubs, ...fromTree];
  let images = await verify(candidates, MAX_IMAGES);
  const usedOg = images.length === 0;
  if (usedOg) images = [og];

  const project = {
    name: r.name,
    title: readmeTitle(md) || titleize(r.name),
    description: r.description || readmeBlurb(md) || null,
    url: r.html_url,
    homepage: r.homepage || null,
    language: r.language || null,
    topics: r.topics || [],
    stars: r.stargazers_count,
    forks: r.forks_count,
    updated: r.pushed_at,
    created: r.created_at,
    image: images[0],
    images,
    og,                       // client-side last resort, never 404s
    readme: readmeBlurb(md, 620, 2),
    highlights: highlights(md),
    sections: sections.slice(0, 8),
    featured: (r.topics || []).includes('featured')
  };

  projects.push(project);
  console.log(
    `  + ${project.name.padEnd(30)} ${String(images.length).padStart(2)} img` +
    `${usedOg ? ' (og)' : '    '}  ${String(sections.length).padStart(2)} sect  ${project.language || ''}`
  );
}

projects.sort((a, b) =>
  (b.featured - a.featured) || (new Date(b.updated) - new Date(a.updated)));

const profile = await api(`/users/${USER}`);

const payload = {
  generated: new Date().toISOString(),
  profile: {
    login: profile.login,
    name: profile.name,
    bio: profile.bio,
    avatar: profile.avatar_url,
    location: profile.location,
    followers: profile.followers,
    url: profile.html_url
  },
  projects
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`\nwrote ${projects.length} projects -> data/projects.json`);
