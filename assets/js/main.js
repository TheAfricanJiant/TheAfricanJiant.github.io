/* ===============================================================
   TheAfricanJiant - portfolio runtime
   No build step, no dependencies. Data comes from data/projects.json
   (regenerated nightly by GitHub Actions), with a live GitHub API
   fallback so the page is never empty.
   =============================================================== */

const USER = 'TheAfricanJiant';
const DATA_URL = 'data/projects.json';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------------------------------------------------------
   Toast
   --------------------------------------------------------------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------------------------------------------------------
   1. Boot sequence (once per browser session)
   --------------------------------------------------------------- */
(function boot() {
  const el = $('#boot'), log = $('#bootlog');
  if (!el) return;
  if (reduced || sessionStorage.getItem('booted')) { el.remove(); return; }

  const lines = [
    '[ 0.000 ] taj-portfolio kernel v2.1',
    '[ 0.114 ] mounting /dev/github ............ <i>ok</i>',
    '[ 0.331 ] loading sensor drivers .......... <i>ok</i>',
    '[ 0.502 ] imu calibration ................. <i>ok</i>',
    '[ 0.688 ] slam backend .................... <i>ok</i>',
    '[ 0.910 ] <b>hello. welcome to the workshop.</b>'
  ];

  let i = 0, finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    el.classList.add('boot--done');
    try { sessionStorage.setItem('booted', '1'); } catch {}
    setTimeout(() => el.remove(), 600);
  };
  const step = () => {
    if (finished) return;
    if (i >= lines.length) return void setTimeout(done, 520);
    log.innerHTML += lines[i++] + '\n';
    setTimeout(step, 130 + Math.random() * 110);
  };

  el.addEventListener('click', done);
  addEventListener('keydown', done, { once: true });
  setTimeout(step, 240);
  setTimeout(done, 4600);
})();

/* ---------------------------------------------------------------
   2. Theme
   --------------------------------------------------------------- */
$('#theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
  toast(next === 'light' ? 'Paper theme' : 'Workshop theme');
});

/* ---------------------------------------------------------------
   3. Clock (West Africa Time, UTC+1)
   --------------------------------------------------------------- */
(function clock() {
  const el = $('#clock');
  const tick = () => {
    const t = new Date(Date.now() + 3600e3);
    el.textContent = [t.getUTCHours(), t.getUTCMinutes()]
      .map(n => String(n).padStart(2, '0')).join(':');
  };
  tick();
  setInterval(tick, 20000);
})();

/* ---------------------------------------------------------------
   4. Lidar sweep behind the hero
   --------------------------------------------------------------- */
(function lidar() {
  const cv = $('#lidar');
  if (!cv || reduced) return;
  const ctx = cv.getContext('2d');
  let w, h, cx, cy, R;

  const points = Array.from({ length: 190 }, () => ({
    a: Math.random() * Math.PI * 2,
    r: 0.18 + Math.pow(Math.random(), 0.62) * 0.8,
    hit: 0
  }));

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = cv.getBoundingClientRect();
    w = rect.width; h = rect.height;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2; cy = h / 2; R = Math.min(w, h) / 2;
  };

  const ink = () => getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim() || '#d97757';

  let beam = 0, running = true;
  const draw = () => {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    const A = ink();

    ctx.globalAlpha = .16; ctx.strokeStyle = A; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = .10;
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(beam, cx, cy);
      g.addColorStop(0.00, A); g.addColorStop(0.10, 'transparent'); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = .30; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalAlpha = .55; ctx.strokeStyle = A;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(beam) * R, cy + Math.sin(beam) * R);
    ctx.stroke();

    for (const p of points) {
      let d = ((beam - p.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (d < 0.05) p.hit = 1;
      p.hit *= 0.985;
      if (p.hit < 0.02) continue;
      ctx.globalAlpha = p.hit * .8; ctx.fillStyle = A;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(p.a) * p.r * R, cy + Math.sin(p.a) * p.r * R, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    beam = (beam + 0.011) % (Math.PI * 2);
    requestAnimationFrame(draw);
  };

  size();
  addEventListener('resize', size);
  // stop burning frames when the hero is off screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; draw(); }
      else running = e.isIntersecting;
    }, { threshold: 0 }).observe(cv);
  }
  draw();
})();

/* ---------------------------------------------------------------
   5. Chrome: progress bar, sticky nav, burger, scroll-spy
   --------------------------------------------------------------- */
(function chrome() {
  const nav = $('#nav'), bar = $('#progress');
  const links = $$('#navlinks a[data-spy]');
  const sections = links.map(a => $('#' + a.dataset.spy)).filter(Boolean);

  const onScroll = () => {
    nav.classList.toggle('nav--stuck', scrollY > 24);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';

    let active = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= 140) active = s.id;
    links.forEach(a => a.classList.toggle('on', a.dataset.spy === active));
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const burger = $('#burger'), menu = $('#navlinks');
  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
  });
  menu.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      menu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  $('#year').textContent = new Date().getFullYear();
})();

/* ---------------------------------------------------------------
   6. Reveal on scroll + skill bars
   --------------------------------------------------------------- */
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((es, obs) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' })
  : null;

const watch = el => io ? io.observe(el) : el.classList.add('in');
$$('.reveal').forEach(watch);

$$('.spec li[data-lv]').forEach(li => {
  const bar = document.createElement('span');
  bar.className = 'bar';
  bar.style.setProperty('--w', li.dataset.lv + '%');
  li.appendChild(bar);
});

/* ---------------------------------------------------------------
   7. Copy email
   --------------------------------------------------------------- */
$('#copymail').addEventListener('click', async function () {
  const mail = this.dataset.mail;
  try {
    await navigator.clipboard.writeText(mail);
    this.classList.add('ok');
    $('.copymail__label', this).textContent = 'Copied';
    toast(mail + ' copied');
    setTimeout(() => {
      this.classList.remove('ok');
      $('.copymail__label', this).textContent = 'Copy email';
    }, 2200);
  } catch {
    location.href = 'mailto:' + mail;
  }
});

/* ---------------------------------------------------------------
   8. Projects
   --------------------------------------------------------------- */
const PRETTY = {
  ros2: 'ROS 2', ros: 'ROS', slam: 'SLAM', cpp: 'C++', ai: 'AI', iot: 'IoT',
  imu: 'IMU', esp32: 'ESP32', ml: 'ML', csi: 'CSI', tinyml: 'TinyML', pcb: 'PCB'
};

const titleize = n => n.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/\b\w/g, c => c.toUpperCase());
const prettyTag = t => PRETTY[t.toLowerCase()] || t.replace(/-/g, ' ');

const ago = iso => {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return d + 'd ago';
  if (d < 365) return Math.floor(d / 30) + 'mo ago';
  return Math.floor(d / 365) + 'y ago';
};
const dateOf = iso => iso
  ? new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  : '—';

let ALL = [];
const state = { q: '', tag: '', sort: 'recent', view: 'grid' };

/* -- card ---------------------------------------------------- */
function cardHTML(p, featured) {
  const initial = esc((p.title || p.name).trim()[0] || '/');
  const cover = p.image
    ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" data-fallback="${initial}">`
    : `<div class="card__ph"><span>${initial}</span></div>`;
  const tags = (p.topics || []).filter(t => t !== 'featured').slice(0, 4)
    .map(t => `<span class="tag">${esc(prettyTag(t))}</span>`).join('');

  return `
  <article class="card${featured ? ' card--feature' : ''} reveal" data-name="${esc(p.name)}"
           role="button" tabindex="0" aria-label="Open dossier for ${esc(p.title || p.name)}">
    <div class="card__media">
      ${p.featured ? '<span class="pin">Featured</span>' : ''}
      ${cover}
    </div>
    <div class="card__body">
      <div class="card__top">
        <h3 class="card__name">${esc(p.title || titleize(p.name))}</h3>
        <span class="card__arrow">&#8599;</span>
      </div>
      <p class="card__desc">${esc(p.description || 'Work in progress — open the dossier for the latest.')}</p>
      ${tags ? `<div class="card__tags">${tags}</div>` : ''}
      <div class="card__meta">
        ${p.language ? `<span class="lang"><i class="dot"></i>${esc(p.language)}</span>` : ''}
        ${p.stars ? `<span>&#9733; ${p.stars}</span>` : ''}
        <span>updated ${esc(ago(p.updated))}</span>
      </div>
    </div>
  </article>`;
}

/* -- drawer -------------------------------------------------- */
const drawer = $('#drawer');
let lastFocus = null;

function openDrawer(name) {
  const p = ALL.find(x => x.name === name);
  if (!p) return;
  lastFocus = document.activeElement;

  const gallery = (p.images || []).filter(u => u !== p.image).slice(0, 4);
  const tags = (p.topics || []).filter(t => t !== 'featured');

  $('#d-body').innerHTML = `
    ${p.image ? `<figure class="d-hero"><img src="${esc(p.image)}" alt=""></figure>` : ''}
    <p class="d-kicker">${esc(p.language || 'Project')} · updated ${esc(ago(p.updated))}</p>
    <h2 class="d-title" id="d-title">${esc(p.title || titleize(p.name))}</h2>
    <p class="d-desc">${esc(p.description || 'No description on the repository yet.')}</p>
    ${tags.length ? `<div class="d-tags">${tags.map(t => `<span class="tag">${esc(prettyTag(t))}</span>`).join('')}</div>` : ''}

    <dl class="d-stats">
      <div><dt>Language</dt><dd>${esc(p.language || '—')}</dd></div>
      <div><dt>Started</dt><dd>${esc(dateOf(p.created))}</dd></div>
      <div><dt>Stars</dt><dd>${p.stars ?? 0}</dd></div>
      <div><dt>Forks</dt><dd>${p.forks ?? 0}</dd></div>
    </dl>

    ${p.highlights?.length ? `
      <h3 class="d-h">Highlights</h3>
      <ul class="d-list">${p.highlights.slice(0, 6).map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}

    ${p.readme ? `<h3 class="d-h">From the README</h3><p class="d-readme">${esc(p.readme)}</p>` : ''}

    ${gallery.length ? `
      <h3 class="d-h">Gallery</h3>
      <div class="d-gallery">${gallery.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}

    <div class="d-actions">
      <a class="btn btn--solid" href="${esc(p.url)}" target="_blank" rel="noopener">Open on GitHub <span>↗</span></a>
      ${p.homepage ? `<a class="btn" href="${esc(p.homepage)}" target="_blank" rel="noopener">Live demo <span>↗</span></a>` : ''}
    </div>`;

  drawer.hidden = false;
  document.body.classList.add('locked');
  requestAnimationFrame(() => drawer.classList.add('open'));
  $('.drawer__x').focus();
}

function closeDrawer() {
  drawer.classList.remove('open');
  document.body.classList.remove('locked');
  setTimeout(() => { drawer.hidden = true; $('#d-body').innerHTML = ''; }, 380);
  lastFocus?.focus();
}

drawer.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDrawer(); });

/* -- render -------------------------------------------------- */
function visible() {
  const q = state.q.toLowerCase().trim();
  let list = ALL.filter(p => {
    if (state.tag) {
      const tokens = [...(p.topics || []), p.language || ''].map(t => t.toLowerCase());
      if (!tokens.includes(state.tag)) return false;
    }
    if (!q) return true;
    return [p.name, p.title, p.description, p.language, ...(p.topics || [])]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const cmp = {
    recent: (a, b) => new Date(b.updated) - new Date(a.updated),
    name:   (a, b) => (a.title || a.name).localeCompare(b.title || b.name),
    stars:  (a, b) => (b.stars || 0) - (a.stars || 0)
  }[state.sort];

  list.sort(cmp);
  if (state.sort === 'recent') list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || 0);
  return list;
}

function paint() {
  const grid = $('#projects');
  const list = visible();

  grid.dataset.view = state.view;
  grid.innerHTML = list.map((p, i) =>
    cardHTML(p, state.view === 'grid' && i === 0 && !state.q && !state.tag)).join('');
  $('#empty').hidden = list.length > 0;

  $$('#projects img[data-fallback]').forEach(img => {
    img.addEventListener('error', () => {
      const ph = document.createElement('div');
      ph.className = 'card__ph';
      ph.innerHTML = `<span>${esc(img.dataset.fallback)}</span>`;
      img.replaceWith(ph);
    }, { once: true });
  });

  $$('#projects .reveal').forEach(watch);
}

function buildFilters() {
  const box = $('#filters');
  const counts = new Map();
  for (const p of ALL)
    for (const t of [...(p.topics || []), p.language].filter(Boolean)) {
      if (t === 'featured') continue;
      const k = t.toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    }

  const top = [...counts.entries()].filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]).slice(0, 7);

  if (!top.length) { box.hidden = true; return; }

  box.innerHTML = `<button class="chip" data-f="" aria-selected="true">All <small>${ALL.length}</small></button>` +
    top.map(([k, n]) => `<button class="chip" data-f="${esc(k)}" aria-selected="false">${esc(prettyTag(k))} <small>${n}</small></button>`).join('');

  box.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    $$('.chip', box).forEach(c => c.setAttribute('aria-selected', String(c === btn)));
    state.tag = btn.dataset.f;
    paint();
  });
}

function telemetry(data) {
  const langs = {};
  for (const p of ALL) if (p.language) langs[p.language] = (langs[p.language] || 0) + 1;
  const top = Object.entries(langs).sort((a, b) => b[1] - a[1])[0];
  const latest = ALL.map(p => p.updated).filter(Boolean).sort().pop();

  const repos = $('[data-tel="repos"]');
  const n = ALL.length;
  if (reduced) repos.textContent = String(n).padStart(2, '0');
  else {
    let i = 0;
    const t = setInterval(() => {
      repos.textContent = String(++i).padStart(2, '0');
      if (i >= n) clearInterval(t);
    }, 70);
  }
  $('[data-tel="lang"]').textContent = top ? top[0] : 'C++';
  $('[data-tel="push"]').textContent = ago(latest);

  if (data.profile) {
    if (data.profile.avatar) {
      $('#avatar-sm').src = data.profile.avatar + '&s=96';
      $('#avatar-lg').src = data.profile.avatar;
    }
    if (data.profile.location) $('#f-loc').textContent = data.profile.location;
  }
  if (data.generated) {
    $('#synced').textContent =
      `// last sync ${new Date(data.generated).toISOString().replace('T', ' ').slice(0, 16)} UTC — regenerated automatically from github.com/${USER}`;
  }
}

/* -- controls ------------------------------------------------ */
$('#q').addEventListener('input', e => { state.q = e.target.value; paint(); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; paint(); });
$('#clearq').addEventListener('click', () => {
  state.q = ''; state.tag = ''; $('#q').value = '';
  $$('#filters .chip').forEach(c => c.setAttribute('aria-selected', String(!c.dataset.f)));
  paint();
});
$$('.viewtog .icobtn').forEach(b => b.addEventListener('click', () => {
  state.view = b.dataset.view;
  $$('.viewtog .icobtn').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  paint();
}));

$('#projects').addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) openDrawer(card.dataset.name);
});
$('#projects').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.card');
  if (!card) return;
  e.preventDefault();
  openDrawer(card.dataset.name);
});
$('#projects').addEventListener('pointermove', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  card.style.setProperty('--my', (e.clientY - r.top) + 'px');
});

addEventListener('keydown', e => {
  if (e.key === 'Escape' && !drawer.hidden) return closeDrawer();
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    $('#q').focus();
  }
});

/* -- load ---------------------------------------------------- */
async function liveFallback() {
  const r = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`);
  if (!r.ok) throw new Error('github api ' + r.status);
  const repos = await r.json();
  return {
    generated: new Date().toISOString(),
    profile: { avatar: `https://github.com/${USER}.png?size=560`, location: 'Buea, Cameroon' },
    projects: repos.filter(x => !x.fork && !x.archived && !/\.github\.io$/.test(x.name))
      .map(x => ({
        name: x.name, title: titleize(x.name), description: x.description,
        url: x.html_url, homepage: x.homepage, language: x.language,
        topics: x.topics || [], stars: x.stargazers_count, forks: x.forks_count,
        updated: x.pushed_at, created: x.created_at, image: null,
        featured: (x.topics || []).includes('featured')
      }))
  };
}

(async function load() {
  let data;
  try {
    const r = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error('no snapshot');
    data = await r.json();
    if (!data.projects?.length) throw new Error('empty snapshot');
  } catch {
    try { data = await liveFallback(); }
    catch (err) {
      $('#projects').innerHTML =
        `<div class="loading">Uplink unavailable. See the repos on
          <a href="https://github.com/${USER}" style="color:var(--accent)">GitHub</a>.</div>`;
      return void console.warn(err);
    }
  }
  ALL = data.projects;
  buildFilters();
  telemetry(data);
  paint();
})();
