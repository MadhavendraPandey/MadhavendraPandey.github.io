# Madhavendra Pandey — portfolio

A minimal, monochrome technical portfolio with pointer-lit surfaces and restrained
scroll motion. FastAPI + Jinja2 render the pages; YAML holds the project content.
Plain CSS and small JavaScript modules handle the interface. No database or frontend framework is needed.

## Run locally

Use Python 3.10 or newer. From this directory:

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000. FastAPI still serves the Jinja templates and YAML content
for local development; GitHub Pages uses the static export described below.

```powershell
.venv\Scripts\python -m unittest discover -s tests -v
```

Direct dependencies are pinned to the verified versions. `requirements-dev.txt` adds only
HTTPX for FastAPI's test client; tests use Python's built-in unittest.

## Build and publish on GitHub Pages

The build renders the same FastAPI/Jinja pages once, copies `static/`, and writes
`dist/index.html`, `about/index.html`, `work/index.html`, `contact/index.html`,
every `projects/<slug>/index.html`, `404.html`, and `.nojekyll`. No Python server
or FastAPI process runs on GitHub Pages. Locally, from the repository root:

```powershell
.venv\Scripts\python build_static.py
py -m http.server 8001 --directory dist
```

Open http://127.0.0.1:8001/. To preview a project repository path locally,
run `python build_static.py --base-path /your-repository-name/` and serve the
output under that prefix. The build checks that every generated internal link
and asset reference resolves within `dist/`; it fails on a missing target.

Push to the repository's default branch to run `.github/workflows/pages.yml`.
In the repository's **Settings → Pages → Build and deployment**, select
**GitHub Actions** as the source once. The workflow installs the build
dependencies, tests, renders `dist/`, uploads it, and deploys it. The production
workflow builds with `--base-path /` for `MadhavendraPandey.github.io`, publishing
at `https://madhavendrapandey.github.io/`. GitHub Pages is free for public repositories
on GitHub Free. The external GSAP scripts still need network access in the
visitor's browser; the rest of the site is included in `dist/`.

## Layout

```text
app/main.py                 Routes, startup loading, static files, 404
build_static.py             Render routes and verify the Pages output
app/models/project.py       Small Pydantic content schema
app/services/projects.py    YAML discovery, sorting, lookup
content/projects/*/         One project.yaml per project
templates/                  Shared layout, homepage, generic project page
templates/components/       Navigation, cards, sections, footer
static/css/                 Base, layout, components, motion, page styles
static/js/                  Light panels and restrained scroll motion
static/projects/            Your project images (create folders as needed)
tests/                      Route and content tests
```

Routes stay in one short file; separate route modules would add little here.

## How to add a project

1. Create `content/projects/your-project/project.yaml` using the example below.
2. Put optional images in `static/projects/your-project/`.
3. Restart the server for local development, or commit and push to rebuild GitHub Pages.
   YAML is validated and loaded once at startup/build time.
   Python's development reloader does not necessarily watch YAML.

No route, template, CSS, or animation changes are needed. Set `featured: true`
to include a card on the homepage. Nonfeatured projects still have detail URLs.
Projects sort by featured first, then ascending `order`, then slug for stable ties.
Slugs must be unique lowercase words separated by hyphens.

```yaml
title: My Project
slug: my-project
year: 2026
status: In development
featured: true
order: 4
tagline: One sentence describing the useful thing.
summary: A short, honest overview of what exists and what is planned.
stack: [Python, FastAPI]
github: "" # Optional HTTPS repository link
hero_image: "" # Optional /static/projects/my-project/hero.webp
hero_alt: "" # Required when hero_image is present
sections:
  - type: text
    eyebrow: 01 / PROBLEM
    title: The problem being addressed
    content: A readable paragraph.
  - type: architecture
    eyebrow: 02 / SYSTEM
    title: A simple flow
    steps: [Input, Processing, Output]
```

`title`, `slug`, `year`, `status`, `tagline`, and `summary` are required.
Other top-level fields have defaults; extra optional keys are ignored. Invalid
required values, unsupported section types, and duplicate slugs fail startup
with the source filename and validation details. Text is HTML-escaped, not Markdown.
Content files are maintained by the site owner; there is no public write endpoint.

### Section types

All types accept `eyebrow`, `title`, and optional introductory `content`:

- `text`: requires `content`.
- `architecture`: requires a nonempty `steps` list of strings, rendered in order.
- `image`: requires `image: {src: /static/projects/my-project/example.webp, alt: Description, caption: Optional caption}`.
- `gallery`: requires an `images` list using the same image structure.
- `metrics`: requires a `metrics` list, each with quoted `value` and `label` strings.
  Use only supported, measured figures; none are invented in the initial content.

Images require meaningful alt text. URLs must use HTTPS or `/static/` paths.
Prefer compressed WebP/AVIF images. Below-fold section images are lazy-loaded.
The homepage contains an introduction and selected work; About and Contact have dedicated pages.
Initial content uses conservative project statuses; update them as implementation is confirmed.

## Styling and animation

- Design tokens: `static/css/base.css`. Shared panels/cards: `components.css`.
- `light-panel.js`: every `.light-panel` gets pointer lighting and at most 1° tilt
  per axis, batched into one animation frame only when the pointer moves.
- `scroll.js`: small GSAP project-card entrances; page layouts remain in place.
- `keycap.js`: ties the homepage keycap pose to scroll position and subtle pointer movement.
- `theme.js`: applies the saved theme before paint and handles the theme toggle.
- `app.js`: initializes the page interactions.

The homepage M keycap uses tapered CSS 3D faces, a recessed top, and a printed legend
in `templates/components/keycap.html`. `pages/home.css` supplies its matte material
and static pose when JavaScript is unavailable. `keycap.js` rotates it through the
hero on scroll, with a small pointer offset. Reduced motion uses a fixed pose;
the mobile layout does not pin the hero.

## The tiny coffee pet

This is separate from the large M keycap. Its SVG is in
`templates/components/pet.html`, styles in `static/css/components/pet.css`, and
independent controller in `static/js/pet.js`. No new runtime dependencies or endpoints.

Set `enabled: false` in `content/pet.yaml` and restart to remove the pet.
The pet communicates through physical reactions first. A few contextual comments
can appear after a genuine linger, with cooldowns and session deduplication. Existing
project dialogue metadata supplies those comments without project-specific JavaScript.

The pet begins hidden and makes short, event-driven cameos. The first meaningful
Projects visit is remembered for the tab. Quick pointer visits only direct its eyes;
a 2.2-second hover or keyboard focus can bring it out with a contextual gesture;
comments follow the gesture after a short delay when the dialogue gate allows it.
Leaving, resizing, navigating, or hiding the tab cancels stale linger reactions.
Project/link clicks never delay navigation. Context selectors use `data-pet-context`;
section markers use `data-pet-section`. GitHub gets a nod, LinkedIn/contact a greeting, architecture a thinking pose,
reading a scanning gaze, and repeated interest a double take. Quick hovers stay
visual-only; deeper inspection can earn a short, context-specific line.

Visual reactions have a 2.5-second cooldown and simple priorities: direct pet clicks,
project clicks, linger, section discovery, then wake. Cameos leave after 5.5 seconds unless the visitor is hovering,
dragging, or using keyboard focus on the pet. Drag the mug anywhere; arrow keys move
it 20 pixels (Shift: 5). Its normalized position survives navigation and resize.
The small × dismisses the pet for the tab. Escape hides the current cameo.

Fast scrolling produces a silent tilt/slosh reaction. Meaningful section dwell counts
only visible-tab time with activity in the last eight seconds. At 30 seconds of
inactivity it gets drowsy; at 38 seconds it sleeps. Returning after meaningful sleep
can trigger a small wake-up jump. The sleep state also applies between cameos.
Reduced motion disables jumps, eye tracking, tilt, steam, and slosh while preserving
context handling. Coarse pointers use section entry, taps, and scroll instead of hover.

`static/js/pet.js` owns one controller state and named, replaceable timers. Listeners,
observers, and timers are cleaned up on navigation; back-forward cache restores
initialize fresh controllers. Session storage holds only appearance/dismissal counts,
dialogue history, discovery flags, and position. No cookies, analytics, AI, or endpoints.

Run `node tests/test_pet.mjs` for the event/virtual-clock regression suite covering
hover cancellation, priority, silent gestures, active dwell, scrolling, sleep/wake,
visibility changes, reduced motion, drag bounds, mobile, and cleanup. Run
`.venv\Scripts\python -m unittest discover -s tests -q` for server/template checks.

Typography uses one sans-serif family and four shared size tokens. All pages share
a 1080px maximum content width and consistent spacing. Project lists stack on mobile.

GSAP 3.13.0 and ScrollTrigger load from jsDelivr. Without network access, the
optional GSAP motion is skipped. All content and links work without JavaScript.
Native scroll and cursor remain intact. Touch disables pointer effects;
reduced-motion preferences disable motion and update at runtime.
There are no continuous render loops, webfonts, canvas, WebGL, or video assets.

## Verification

Tests cover routes, 404s, discovery, malformed YAML, duplicate slugs, sorting,
unsafe content URLs, escaping, and all five section types. A temporary fourth
project verifies that content alone creates a homepage card and detail route.

For UI changes, check 1440, 1024, 768, and 390px widths, keyboard focus, pointer
leave/reset, reduced motion, and no-JavaScript navigation.
