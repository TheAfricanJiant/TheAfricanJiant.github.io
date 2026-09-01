# TheAfricanJiant — portfolio

A self-updating robotics portfolio. No build step, no framework, no `node_modules`
on your machine — plain HTML, CSS and JS, with a GitHub Action that keeps the
project list in sync with your repos.

**Live:** https://theafricanjiant.github.io

---

## How it updates itself

```
 your repos ──▶ GitHub Action ──▶ data/projects.json ──▶ GitHub Pages
                (nightly 05:10 UTC, on push, or on demand)
```

`scripts/sync-github.mjs` reads every public repo on the account and pulls:

| From GitHub            | Shows up as                    |
|------------------------|--------------------------------|
| Repo name              | Card title (or the `# Heading` in your README, if it has one) |
| Repo description       | Card body text (falls back to the first real paragraph of the README) |
| Repo **topics**        | The tag chips + the filter buttons |
| Language               | The coloured dot on the card   |
| First image in README  | **The card cover photo**       |
| Last push date         | "updated 3d ago"               |

So after setup you never touch this repo again. You just work on your robots.

---

## Setup — once

**1. Create the repo.** On GitHub, make a new **public** repo named exactly:

```
TheAfricanJiant.github.io
```

**2. Push this folder into it:**

```bash
cd my-portfolio
git init -b main
git add .
git commit -m "feat: portfolio"
git remote add origin https://github.com/TheAfricanJiant/TheAfricanJiant.github.io.git
git push -u origin main
```

**3. Turn on Pages.** Repo → **Settings** → **Pages** → *Build and deployment* →
**Source: GitHub Actions**. (Not "Deploy from a branch" — that skips the sync.)

**4. Allow the Action to write.** Repo → **Settings** → **Actions** → **General**
→ *Workflow permissions* → **Read and write permissions** → Save.

Within a couple of minutes the site is live and populated.

---

## Setup — the part that actually makes it look good

The website is only as good as the metadata on your repos. Two things to do
per project, on GitHub itself:

### a) Give every repo a description and topics

Open a repo → the ⚙️ next to *About* → fill in the description and topics.
Topics become the tag chips and the filter bar. Use consistent ones:
`robotics`, `ros2`, `slam`, `embedded`, `cpp`, `arduino`, `esp32`,
`computer-vision`.

Two special topics:

- **`featured`** — pins the project to the top and makes its card double-width.
- **`hidden`** — keeps the repo off the website entirely.

If you have the [`gh` CLI](https://cli.github.com/), you can do all of it from
the terminal instead of clicking:

```bash
gh repo edit TheAfricanJiant/ROS--2-Ten-Months-Challenge \
  --description "Ten months of ROS 2, built in the open: March–December 2025." \
  --add-topic robotics --add-topic ros2 --add-topic cpp --add-topic featured

gh repo edit TheAfricanJiant/ArIa-Roomba \
  --description "Autonomous cleaning robot on Arduino Uno Q + XRP, with encoder and IMU odometry." \
  --add-topic robotics --add-topic arduino --add-topic imu --add-topic odometry

gh repo edit TheAfricanJiant/Project_NYX_ \
  --add-topic esp32 --add-topic csi --add-topic security --add-topic iot

gh repo edit TheAfricanJiant/Pick_and_Place \
  --add-topic robotics --add-topic computer-vision --add-topic manipulation

gh repo edit TheAfricanJiant/MyJourneyToASLAMengineer \
  --add-topic slam --add-topic robotics

gh repo edit TheAfricanJiant/Eviatech_2025 --add-topic cpp --add-topic competition
gh repo edit TheAfricanJiant/epod          --add-topic embedded --add-topic hardware
gh repo edit TheAfricanJiant/Practical-C-  --add-topic cpp --add-topic learning
```

### b) Put a photo or GIF at the top of each README

This is the single highest-leverage thing you can do. The sync grabs the **first
real image** in the README and uses it as the card cover. Badges (shields.io etc.)
are skipped automatically.

```markdown
# ArIa Roomba

![The robot mapping a room](docs/aria-demo.gif)

An autonomous cleaning robot built on...
```

Commit the image into the repo (a `docs/` or `media/` folder is tidy), or just
drag it into a GitHub issue comment and copy the `user-attachments` URL it
generates — both work.

For robotics, a **short GIF of the thing moving** beats any still photo. `ffmpeg`:

```bash
ffmpeg -i clip.mp4 -vf "fps=12,scale=800:-1" -t 6 docs/demo.gif
```

Repos with no image get a generated terracotta placeholder — it looks
deliberate, not broken, so nothing is urgent.

---

## Refreshing on demand

The nightly run covers you automatically. To push an update *right now*:

- **Actions** tab → *Sync GitHub data and deploy* → **Run workflow**, or
- `gh workflow run deploy.yml -R TheAfricanJiant/TheAfricanJiant.github.io`

**Instant updates from any project repo.** Drop this into a robot repo at
`.github/workflows/notify-portfolio.yml` and every push there refreshes the
portfolio within a minute:

```yaml
name: Refresh portfolio
on:
  push:
    branches: [main]
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sX POST \
            -H "Authorization: Bearer ${{ secrets.PORTFOLIO_TOKEN }}" \
            -H "Accept: application/vnd.github+json" \
            https://api.github.com/repos/TheAfricanJiant/TheAfricanJiant.github.io/dispatches \
            -d '{"event_type":"sync"}'
```

`PORTFOLIO_TOKEN` is a [fine-grained PAT](https://github.com/settings/tokens?type=beta)
with **Contents: read-only** on the portfolio repo, saved as a repo secret.

---

## Editing the site itself

| What                                   | Where |
|----------------------------------------|-------|
| Headline, bio, timeline, skills, email | `index.html` |
| Colours, type, spacing                 | `assets/css/style.css` (the `:root` block at the top) |
| Card layout, lidar animation, boot log | `assets/js/main.js` |
| What gets synced / hidden              | `scripts/sync-github.mjs` |

### Preview locally

**Quickest:** just double-click `index.html`. The `file://` protocol blocks the
`data/projects.json` fetch, but the page detects that and falls back to querying
the GitHub API live — so everything renders except README cover images.

**Honest preview** (needs a local server — you have neither Node nor Python
installed right now, so pick one):

- **VS Code** → install the *Live Server* extension → right-click `index.html`
  → *Open with Live Server*. Nothing else to install.
- **Node** ([nodejs.org](https://nodejs.org), LTS) → `npx serve .`
  Installing Node also lets you run `node scripts/sync-github.mjs` locally to
  test the sync before pushing.
- **Python** ([python.org](https://www.python.org/downloads/)) →
  `python -m http.server 8000`, then open <http://localhost:8000>.

None of this is needed to *deploy* — GitHub Actions installs Node in the cloud.

### Colours

```css
--bg:     #14110e;   /* near-black, warm */
--panel:  #1e1915;   /* cards */
--accent: #d97757;   /* terracotta — the whole personality lives here */
--text:   #f4ece4;
```

Change `--accent` and the entire site re-themes: buttons, lidar sweep, filters,
timeline dots, placeholders.

---

## Resilience

If `data/projects.json` is missing or empty, the page queries the GitHub API
directly from the browser. So the site is never blank — worst case it shows repos
without cover images.
