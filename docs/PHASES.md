# TIL - Phased Agent Prompts (HTMX, single app)

Repo reality check (2026-11-16): `api/` (Hono + better-sqlite3, partial) and `database/` exist. There is no `docker-compose.yml`, `.gitattributes` or health route yet, and `web/` is deleted in the working tree. Dev is not dockerized: the app runs directly in WSL. Only production (phase 6) has a Dockerfile and compose.

Run phases in order. Phase 1 writes `docs/ROUTES.md`; after it, phases 3 and 4 (backend) can run in parallel with phase 5 (UI), though they edit the same app, so merge carefully. Review each phase before the next.

**Milestone:** Phases 1-5 = minimal working setup. Phase 6 = deploy.

---

## Common preamble (paste at the top of every prompt)

```
You are building TIL, a personal CTF-style learning platform. Read docs/initial_spec.md first; it is the source of truth.
Rules:
- Keep it as simple as possible. Build only what this phase asks for. No extra features, no speculative abstractions.
- One Hono (TypeScript) app serves server-rendered pages (Hono JSX) and HTMX fragments. No React, no SPA, no frontend build step. HTMX and xterm.js are vendored as pinned static files (no CDN at runtime).
- Layers: routes (HTTP/WS only, thin) -> views (JSX templates, rendering only) -> services (all logic, no rendering) -> adapters (disk, SQLite, Docker) behind interfaces. Services never import routes or views.
- DB: SQLite.
- Dev setup is fixed: no dockerization of the app in dev. It runs directly on the host (WSL) with `tsx watch`, a .env file, content/ and the SQLite file on local disk. Docker is used in dev only for sandbox session containers, through the local Docker socket (/var/run/docker.sock). Only phase 6 adds a Dockerfile and production compose.
- Challenge sandboxes are separate containers started through the Docker socket (in production the app's container gets the host socket, so they are siblings).
- Dev is x86-64; production is arm64 Linux. Use only multi-arch images.
- Scripts and challenge files use LF line endings (.gitattributes).
- Explain what you did briefly. If something in the spec is unclear or conflicts, stop and ask me instead of guessing.
```

---

## Phase 1 - Collapse to one HTMX app, routes doc, content layer

```
Phase 1: single app, routes doc, content layer.
Step 1: remove the separate React/Vite web app. Keep one Hono app (rename api/ to app/ if simple) that serves pages with Hono JSX plus HTMX. Vendor htmx (pinned version) and a small CSS file as static assets. Add a base layout (header, nav, content area). Add npm scripts for dev (`tsx watch`), build and start, one port. Do not add Docker files. Keep GET /api/health or move it to /health.
Step 2: write docs/ROUTES.md replacing the old API contract idea: for each page and HTMX fragment route: method, path, what it renders, which service it calls. Cover login/logout, module list, challenge page, flag submit, view answer, sandbox start/reset/stop, content sync, and the /ws terminal. Add a short root README (how to run, port, layout).
Step 3: content layer. Challenge format from the spec: a folder per challenge with challenge.md (YAML header: id, title, module, tier 1-3, flag, image, order, links[] with type doc|video, url, label; body = briefing, then a guide section revealed by "view answer"), a files/ folder of starter files and a `check` script. Modules are folders with a module.md (id, title, description, order).
Create content/ at the repo root; the app reads it from disk (path from config). Build a content adapter (behind an interface) that reads and validates it with a schema (zod). Invalid challenges are reported clearly on the page and must not crash the app. Render Markdown server-side.
Pages: module list, and a challenge page showing the briefing and links (no terminal yet).
Create one sample module with two tiny sample C++ challenges (e.g. hello-world fix). Write docs/CONTENT-FORMAT.md explaining how to author a challenge, including the check-script convention: each `check` script compiles/runs the learner's work and prints the flag when it passes.
Done when: one container serves the module list and challenge pages, editing a challenge file shows up on refresh without a restart, and a deliberately broken challenge shows a clear error.
```

## Phase 2 - Auth, flags, progress

```
Phase 2: auth, flags, progress.
Add SQLite (adapter behind an interface); the DB file path comes from config (default under a gitignored data/ folder). Single-user auth: one password from an environment variable (via an uncommitted .env, with a committed .env.example), login page, session cookie, logout. All pages except login require auth.
Progress: a flag form on the challenge page submits via HTMX (hx-post) and returns a result fragment. The submitted flag (format TIL{...}) is compared to the challenge's flag; the first correct solve records solved + timestamp + points (points = tier). The module list shows solved marks and total points. "View answer" is an HTMX button that loads the guide fragment. Viewing the guide or resetting never changes progress.
Done when: a wrong flag shows an error, the right flag awards points once, a second correct submit does not award again, and data survives an app restart.
```

## Phase 3 - Sandbox (C++ first; no Docker-in-Docker needed)

```
Phase 3: sandbox.
Build a sandbox service with a Docker adapter behind an interface (Docker address and runtime options from config so it can later point elsewhere).
The app talks to the local Docker socket (path configurable). Do not rely on host path bind mounts to deliver challenge files (production runs the app in a container, so its paths are not host paths); copy files into the session container through the Docker API (tar stream).
Create the C++ workspace image in sandbox-images/cpp: a multi-arch gcc base (pinned version) with g++, make, vim, nano. Document how to build it.
Routes: POST /sandbox/start (challenge id), /sandbox/reset, /sandbox/stop, GET /sandbox/status; they return HTMX fragments (status + buttons) for the challenge page.
Behavior: one session at a time (starting another stops the current one). Start creates a container from the challenge's image, copies the challenge's files/ and check script into it, with memory (1 GB), CPU (1) and PID limits, all configurable. Reset destroys and recreates it. Auto-destroy after 2 hours idle (configurable). No inbound network access to sessions. Label every session container so leftovers are cleaned up when the app starts.
Done when: Start/Reset/Stop buttons on the challenge page work, files are present inside the container, limits are applied, leftover sessions are cleaned up on app start, and idle cleanup is verified (short timeout via config).
```

## Phase 4 - Terminal

```
Phase 4: terminal.
Add a WebSocket endpoint (/ws) that attaches to the running session container (exec with a TTY) and bridges input/output/resize. Auth required. Disconnect and reconnect to the same session must work. Add a small vendored xterm.js script and a terminal element on the challenge page that connects to /ws once a session is running (HTMX swaps in the terminal when the session starts; make sure the terminal reconnects cleanly after swaps).
Done when: on the challenge page I can type in the browser, run g++ inside the session, close the tab, reopen, and still see my files.
```

## Phase 5 - Challenge page layout and polish

```
Phase 5: boot.dev-style challenge page, desktop only.
Two-column layout: left = briefing (rendered Markdown), optional doc/video links, "View answer" button, flag input + submit, Start/Reset; right = the terminal, full height. Module list shows tier, solved marks and total points. Keep styling plain and clean (one CSS file, no framework).
Done when: I can log in, open a challenge, start a session, fix the code in the terminal, run `check`, paste the flag, and see points go up, with no full page reloads during the flow.
```

## Phase 6 - Sync and deploy

```
Phase 6: sync and deploy.
Add POST /content/sync (git pull on the content checkout) with a Sync button that returns an HTMX fragment showing what changed and any validation errors (git must be available in the container).
Production (first containerization in the project): one Dockerfile for the app (arm64-compatible, pinned base image, no bind-mounted code) and a separate production docker-compose. Content is a mounted git checkout; the app gets the host Docker socket. Add a Caddy site snippet for learning.umerfruit.duckdns.org that reverse-proxies everything (including /ws) to the app and only serves requests from Tailscale addresses (100.64.0.0/10), refusing others. Write docs/DEPLOY.md with the steps, and a README warning that the app uses the host Docker socket (root-equivalent) and TIL should run on a dedicated VPS.
Done when: the production compose builds for arm64, and the Caddy snippet and deploy steps are documented and reviewed by me.
```