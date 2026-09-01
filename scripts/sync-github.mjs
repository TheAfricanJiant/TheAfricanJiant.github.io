#!/usr/bin/env node
/* ===============================================================
   sync-github.mjs
   Reads every public repo on the account, pulls the README, digs
   out a cover image and a human description, and writes
   data/projects.json for the site to render.

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

/* --- README mining ------------------------------------------- */

const BADGE = /shields\.io|badgen\.net|badge\.fury|travis-ci|circleci\.com|codecov|forthebadge|img\.shields/i;

/** absolute URL for an asset referenced from a repo README */
function absolutize(src, repo, branch) {
  if (!src) return null;
  src = src.trim().replace(/^<|>$/g, '');
  if (/^https?:\/\//i.test(src)) {
    // rewrite blob links to raw so they actually render as images
    return src.replace(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i,
      'https://raw.githubusercontent.com/$1/$2/$3'
    );
  }
  if (src.startsWith('data:')) return null;
  const clean = src.replace(/^\.?\//, '');
  return `https://raw.githubusercontent.com/${USER}/${repo}/${branch}/${encodeURI(clean)}`;
}

function firstImage(md, repo, branch) {
  if (!md) return null;
  const candidates = [];

  for (const m of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) candidates.push(m[1]);
  for (const m of md.matchAll(/<img[^>]+src=["']([^"']+)["']/gi))          candidates.push(m[1]);

  for (const c of candidates) {
    if (BADGE.test(c)) continue;
    if (!/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(c) &&
        !/raw\.githubusercontent|user-images\.githubusercontent|github\.com\/user-attachments/i.test(c)) continue;
    const url = absolutize(c, repo, branch);
    if (url) return url;
  }
  return null;
}

function readmeTitle(md) {
  const m = md?.match(/^\s*#\s+(.+?)\s*$/m);
  if (!m) return null;
  const t = m[1].replace(/[#*`_]/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
  return t.length > 2 && t.length < 60 ? t : null;
}

function readmeBlurb(md) {
  if (!md) return null;
  const body = md
    .replace(/```[\s\S]*?```/g, '')                 // code fences
    .replace(/<!--[\s\S]*?-->/g, '')                // comments
    .replace(/^\s*#{1,6}\s.*$/gm, '')               // headings
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')           // images
    .replace(/<[^>]+>/g, '')                        // html
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');       // links -> text

  for (const para of body.split(/\n\s*\n/)) {
    const p = para.replace(/\s+/g, ' ').trim();
    if (p.length > 40 && !/^[-*|>]/.test(p)) {
      return p.length > 230 ? p.slice(0, 227).replace(/\s+\S*$/, '') + '...' : p;
    }
  }
  return null;
}

const titleize = n => n
  .replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/\b\w/g, c => c.toUpperCase());

/* --- main ---------------------------------------------------- */

const repos = await api(`/users/${USER}/repos?per_page=100&sort=updated`);
if (!repos) throw new Error(`user ${USER} not found`);

const projects = [];

for (const r of repos) {
  if (r.fork || r.archived || r.private) continue;
  if (SKIP.has(r.name)) continue;
  if ((r.topics || []).includes('hidden')) continue;

  let md = null;
  try {
    md = await api(`/repos/${USER}/${r.name}/readme`, true);
  } catch (e) {
    console.warn(`  ! readme ${r.name}: ${e.message.slice(0, 80)}`);
  }

  const branch = r.default_branch || 'main';
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
    image: firstImage(md, r.name, branch),
    featured: (r.topics || []).includes('featured')
  };

  projects.push(project);
  console.log(`  + ${project.name.padEnd(30)} ${project.image ? 'img' : '---'}  ${project.language || ''}`);
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
