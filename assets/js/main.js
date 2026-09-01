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

/* ---------------------------------------------------------------
   1. Boot sequence  (once per browser session)
   --------------------------------------------------------------- */
(function boot() {
  const el = $('#boot');
  const log = $('#bootlog');
  if (!el) return;

  if (reduced || sessionStorage.getItem('booted')) {
    el.remove();
    return;
  }

  const lines = [
    '[ 0.000 ] taj-portfolio kernel v2.1',
    '[ 0.114 ] mounting /dev/github ............ <i>ok</i>',
    '[ 0.331 ] loading sensor drivers .......... <i>ok</i>',
    '[ 0.502 ] imu calibration ................. <i>ok</i>',
    '[ 0.688 ] slam backend .................... <i>ok</i>',
    '[ 0.910 ] <b>hello. welcome to the workshop.</b>'
  ];

  let i = 0;
  const step = () => {
    if (i >= lines.length) {
      setTimeout(done, 520);
      return;
    }
    log.innerHTML += lines[i++] + '\n';
    setTimeout(step, 130 + Math.random() * 110);
  };
  const done = () => {
    el.classList.add('boot--done');
    sessionStorage.setItem('booted', '1');
    setTimeout(() => el.remove(), 600);
  };

  el.addEventListener('click', done);
  addEventListener('keydown', done, { once: true });
  setTimeout(step, 240);
  setTimeout(done, 4200); // hard ceiling
})();

/* ---------------------------------------------------------------
   2. Clock (West Africa Time, UTC+1)
   --------------------------------------------------------------- */
(function clock() {
  const el = $('#clock');
  if (!el) return;
  const tick = () => {
    const t = new Date(Date.now() + 3600e3); // UTC+1
    el.textContent = [t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
  };
  tick();
  setInterval(tick, 1000);
})();

/* ---------------------------------------------------------------
   3. Lidar sweep behind the hero
   --------------------------------------------------------------- */
(function lidar() {
  const cv = $('#lidar');
  if (!cv || reduced) return;

  const ctx = cv.getContext('2d');
  let w, h, cx, cy, R, dpr;

  // static "world" the beam discovers
  const points = Array.from({ length: 190 }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = 0.18 + Math.pow(Math.random(), 0.62) * 0.8;
    return { a, r, hit: 0 };
  });

  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = cv.getBoundingClientRect();
    w = rect.width; h = rect.height;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2; cy = h / 2; R = Math.min(w, h) / 2;
  };

  let beam = 0;
  const draw = () => {
    ctx.clearRect(0, 0, w, h);

    // range rings
    ctx.strokeStyle = 'rgba(217,119,87,.14)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // crosshair
    ctx.strokeStyle = 'rgba(217,119,87,.09)';
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    // sweeping wedge
    const grad = ctx.createConicGradient
      ? ctx.createConicGradient(beam, cx, cy)
      : null;
    if (grad) {
      grad.addColorStop(0.00, 'rgba(217,119,87,.30)');
      grad.addColorStop(0.10, 'rgba(217,119,87,0)');
      grad.addColorStop(1.00, 'rgba(217,119,87,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // beam line
    ctx.strokeStyle = 'rgba(232,148,118,.55)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(beam) * R, cy + Math.sin(beam) * R);
    ctx.stroke();

    // returns
    for (const p of points) {
      let d = beam - p.a;
      d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (d < 0.05) p.hit = 1;
      p.hit *= 0.985;
      if (p.hit < 0.02) continue;
      const x = cx + Math.cos(p.a) * p.r * R;
      const y = cy + Math.sin(p.a) * p.r * R;
      ctx.fillStyle = `rgba(244,236,228,${p.hit * 0.85})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    beam = (beam + 0.011) % (Math.PI * 2);
    requestAnimationFrame(draw);
  };

  size();
  addEventListener('resize', size);
  draw();
})();

/* ---------------------------------------------------------------
   4. Nav shadow + reveal on scroll + year
   --------------------------------------------------------------- */
(function chrome() {
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('nav--stuck', scrollY > 24);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();

const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' })
  : null;

const watch = el => io ? io.observe(el) : el.classList.add('in');
$$('.reveal').forEach(watch);

/* ---------------------------------------------------------------
   5. Projects
   --------------------------------------------------------------- */

const PRETTY = {
  'ros2': 'ROS 2', 'ros': 'ROS', 'slam': 'SLAM', 'cpp': 'C++', 'ai': 'AI',
  'iot': 'IoT', 'imu': 'IMU', 'esp32': 'ESP32', 'ml': 'ML', 'csi': 'CSI'
};

const titleize = name => name
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, c => c.toUpperCase());

const prettyTag = t => PRETTY[t.toLowerCase()] || t.replace(/-/g, ' ');

const ago = iso => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cardHTML(p, featured) {
  const initial = esc((p.title || p.name).trim()[0] || '/');
  const cover = p.image
    ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" data-fallback="${initial}">`
    : `<div class="card__ph"><span>${initial}</span></div>`;

  const tags = (p.topics || []).slice(0, 4)
    .map(t => `<span class="tag">${esc(prettyTag(t))}</span>`).join('');

  return `
  <a class="card${featured ? ' card--feature' : ''} reveal"
     href="${esc(p.url)}" target="_blank" rel="noopener"
     data-tags="${esc((p.topics || []).join(' ').toLowerCase())} ${esc((p.language || '').toLowerCase())}">
    <div class="card__media">${cover}</div>
    <div class="card__body">
      <div class="card__top">
        <h3 class="card__name">${esc(p.title || titleize(p.name))}</h3>
        <span class="card__arrow">&#8599;</span>
      </div>
      <p class="card__desc">${esc(p.description || 'Work in progress - open the repo for the latest commits.')}</p>
      ${tags ? `<div class="card__tags">${tags}</div>` : ''}
      <div class="card__meta">
        ${p.language ? `<span class="lang"><i class="dot"></i>${esc(p.language)}</span>` : ''}
        ${p.stars ? `<span>&#9733; ${p.stars}</span>` : ''}
        <span>updated ${esc(ago(p.updated))}</span>
      </div>
    </div>
  </a>`;
}

function renderFilters(projects) {
  const box = $('#filters');
  const counts = new Map();
  for (const p of projects) {
    for (const t of [...(p.topics || []), p.language].filter(Boolean)) {
      const k = t.toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  const top = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([k]) => k);

  if (!top.length) { box.remove(); return; }

  box.innerHTML = [['', 'All'], ...top.map(k => [k, prettyTag(k)])]
    .map(([k, label], i) =>
      `<button class="chip" role="tab" data-f="${esc(k)}" aria-selected="${i === 0}">${esc(label)}</button>`)
    .join('');

  box.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    $$('.chip', box).forEach(c => c.setAttribute('aria-selected', c === btn));
    const f = btn.dataset.f;
    $$('#projects .card').forEach(card => {
      const tokens = card.dataset.tags.split(/\s+/);
      card.style.display = !f || tokens.includes(f) ? '' : 'none';
    });
  });
}

function renderTelemetry(data) {
  const set = (k, v) => { const el = $(`[data-tel="${k}"]`); if (el && v) el.textContent = v; };
  const langs = {};
  for (const p of data.projects) if (p.language) langs[p.language] = (langs[p.language] || 0) + 1;
  const top = Object.entries(langs).sort((a, b) => b[1] - a[1])[0];
  const latest = data.projects.map(p => p.updated).filter(Boolean).sort().pop();

  set('repos', String(data.projects.length).padStart(2, '0'));
  set('lang', top ? top[0] : 'C++');
  set('push', ago(latest));
}

function render(data) {
  const grid = $('#projects');
  const list = [...data.projects].sort((a, b) => {
    if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
    return new Date(b.updated) - new Date(a.updated);
  });

  grid.innerHTML = list.map((p, i) => cardHTML(p, i === 0)).join('');

  // a dead image URL degrades to the generated cover instead of a broken icon
  $$('#projects img[data-fallback]').forEach(img => {
    img.addEventListener('error', () => {
      const ph = document.createElement('div');
      ph.className = 'card__ph';
      ph.innerHTML = `<span>${esc(img.dataset.fallback)}</span>`;
      img.replaceWith(ph);
    }, { once: true });
  });

  $$('#projects .reveal').forEach(watch);

  renderFilters(list);
  renderTelemetry(data);

  const s = $('#synced');
  if (s && data.generated) {
    s.textContent = `// last sync ${new Date(data.generated).toISOString().replace('T', ' ').slice(0, 16)} UTC - regenerated automatically from github.com/${USER}`;
  }
}

/* live fallback: talk to the GitHub API straight from the browser */
async function liveFallback() {
  const r = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`);
  if (!r.ok) throw new Error('github api ' + r.status);
  const repos = await r.json();
  return {
    generated: new Date().toISOString(),
    projects: repos
      .filter(x => !x.fork && !x.archived)
      .map(x => ({
        name: x.name,
        title: titleize(x.name),
        description: x.description,
        url: x.html_url,
        language: x.language,
        topics: x.topics || [],
        stars: x.stargazers_count,
        updated: x.pushed_at,
        image: null
      }))
  };
}

(async function loadProjects() {
  try {
    const r = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error('no snapshot');
    const data = await r.json();
    if (!data.projects || !data.projects.length) throw new Error('empty snapshot');
    render(data);
  } catch {
    try {
      render(await liveFallback());
    } catch (err) {
      $('#projects').innerHTML =
        `<div class="loading">Uplink unavailable. See the repos on
         <a href="https://github.com/${USER}" style="color:var(--accent)">GitHub</a>.</div>`;
      console.warn(err);
    }
  }
})();
