# TIL (Today I Learned) - Architecture and Sandbox Spec (v1, draft)

## Scope
Single user (you). No guest, no audit log, no backups. All challenges unlocked.
Points by tier (1/2/3). Flag format `TIL{...}`, static, printed by the container.

## Containers (all on the Caddy Docker network, no published ports)
| Container | Role |
|---|---|
| app | One Hono (TS) app: server-rendered Hono JSX pages, HTMX fragments, WebSocket terminal bridge, SQLite file. htmx and xterm.js are vendored, pinned static files. No SPA, no frontend build step. |
| content | Git checkout, mounted into app (dev: live edits, no restart) |

Production: Caddy reverse-proxies `learning.umerfruit.duckdns.org` (including `/ws`) to the single app container.
Dev is not dockerized: the app runs on the host (`npm run dev`); Docker is used only for sandbox session containers.

## Backend layers
1. Routes (HTTP/WS only, no logic)
2. Services: challenges (read content), progress (points, solved), sandbox (lifecycle), flags (compare)
3. Adapters: content-from-disk, SQLite, sandbox-runtime (Docker API)
Services never import from routes. Adapters sit behind interfaces so they can be replaced.

## Routes (v1)
Pages and HTMX fragments (HTML), not a JSON API. `docs/ROUTES.md` holds the full list; `GET /api/progress` remains as a JSON debug endpoint.
- Pages: module list, challenge page (briefing, links, tier; never the flag)
- Fragments: sandbox start / reset / stop / status, flag submit result, view answer (guide)
- WS `/ws`: terminal (attach to the running sandbox)
- POST content sync (git pull)
- Login / logout

## Sandbox design
Problem: the api must create containers, but mounting the host Docker socket is root on the VPS.

Solution, two layers:
1. **Sandbox host daemon:** a dedicated *rootless* Docker daemon on the VPS under a separate unprivileged user. The api gets only this daemon's socket. If the api is compromised, the attacker is that user, not root.
2. **Session container:** one per session, started on that daemon from an image running rootless Docker-in-Docker, with the challenge files and tools (vim, nano, docker CLI) baked in. The learner's `docker` commands hit the inner daemon only.

Terminal: api runs `exec -it` into the session container and bridges it to the browser over WebSocket.

Lifecycle: start (create container, copy challenge files) -> work -> reset (destroy and recreate) -> auto-destroy after 2h idle. One session at a time.

Limits per session: ~1 GB RAM, 1 CPU, PID limit, disk quota, wall-clock cap. Inbound: none. Outbound: allowed (image pulls) for v1.

Flag flow: the challenge's check command prints `TIL{...}` when the fix is correct. The learner pastes it, the api compares it with the metadata flag, and points are awarded once.

## Challenge format
Folder per challenge: `challenge.md` (YAML header: id, title, module, tier 1-3, flag, image, order, links[]), body = briefing, then a `## Guide` section shown only by "view answer"; plus `files/` and a `check` script.
Links: optional, `type` doc|video, `url`, `label`.
Module: folder with `module.md` (id, title, description, order).
The flag is never sent to the browser in list or detail pages. Invalid content is reported on the page and never crashes the app.

## Risks / spike first
1. **Rootless-in-rootless DinD** (inner daemon inside a rootless outer daemon) is fiddly: needs user namespaces, and a storage driver such as fuse-overlayfs or vfs. Spike this before anything else, on the ARM VPS. If it fails, fallback: Sysbox runtime, or a single shared inner daemon.
2. Inner daemons need a privileged container; it is only privileged relative to the sandbox user. Keep that user minimal.
3. Image pins must be arm64 (`node:20-alpine`, `alpine:3.20`).
4. 250ms ping: keystroke echo lag is unavoidable. Keep the WS direct.

## Further decisions
- Sandbox v1: **privileged `docker:dind`** session containers, created by the api through the host Docker socket. Chosen deliberately: rootless DinD failed on the VPS (user-namespace error, kernel 7.0.0-oracle), and v1 has one trusted user. Hardening is deferred.
- Consequence: the api holds the host Docker socket, which is root-equivalent on the VPS, so api compromise = host compromise. The auth password must be strong, and the docs must say to run TIL on a dedicated VPS (the project is open source, bring-your-own-VPS).
- Access model v1: **Tailscale-only for TIL.** Caddy serves `learning.*` only to Tailscale addresses (100.64.0.0/10); other requests are refused. Vaultwarden and other sites keep their public hostnames, unaffected. Tailscale is needed on the VPS and on the device used to study. The password is a second layer.
- For the open-source release, access mode is a documented option: private via Tailscale (default) or public with strong auth.
- Keep the sandbox adapter behind an interface (Docker address + runtime options) so hardening later means swapping config: rootless, Sysbox, or a second VM.
- Every challenge ships a `check` script that prints the flag when fixed.
- One shared workspace image. Pinned images are pre-pulled for fast starts.
- One session at a time: opening another challenge stops the current session.
- Auth: single password from an env var, session cookie.
- Module map: plain list per module first (roadmap-style visual later; a view-only change).
- Progress stored: solved status, points, timestamp. Reset and "view answer" do not change it.
- Content sync: dev mode bind-mounts the content folder; "Sync" button runs `git pull`.
- Challenge validation (testing that a challenge works): open, decide after module 1 is designed.

## Dev rule
- Line endings: `.gitattributes` forces LF for scripts and challenge files, so a CRLF `check` script never breaks (`#!/bin/sh` "not found"). Dev happens in WSL, which makes this a safety net.

## Deferred
SSH into the sandbox (workspace image keeps sshd ready), guest, audit log, backups, spaced repetition, AI helper, hints, unlock order.
