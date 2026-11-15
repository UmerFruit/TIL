# TIL (Today I Learned) - Architecture and Sandbox Spec (v1, draft)

## Scope
Single user (you). No guest, no audit log, no backups. All challenges unlocked.
Points by tier (1/2/3). Flag format `TIL{...}`, static, printed by the container.

## Containers (all on the Caddy Docker network, no published ports)
| Container | Role |
|---|---|
| web | Static React SPA (Vite build), xterm.js terminal |
| api | Hono (TS) JSON API + WebSocket terminal bridge, SQLite file |
| content | Git checkout, bind-mounted into api (dev mode: live edits, no restart) |

Caddy routes `learning.umerfruit.duckdns.org`: `/` to web, `/api` and `/ws` to api.
Frontend only talks to the API (JSON). It never knows how the backend works, so it can be swapped.

## Backend layers
1. Routes (HTTP/WS only, no logic)
2. Services: challenges (read content), progress (points, solved), sandbox (lifecycle), flags (compare)
3. Adapters: content-from-disk, SQLite, sandbox-runtime (Docker API)
Services never import from routes. Adapters sit behind interfaces so they can be replaced.

## API surface (v1)
- GET challenges (list by module), GET challenge (briefing, links, tier)
- POST sandbox start / reset / stop, GET sandbox status
- WS terminal (attach to the running sandbox)
- POST flag submit, GET progress, GET answer (guide)
- POST content sync (git pull)

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
Folder per challenge: `challenge.md` (YAML header: id, title, module, tier, flag, image, links[]), body = briefing + guide, plus broken files.
Links: optional docs/videos with label.

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
- Module map: plain list per module first (roadmap-style visual later; frontend-only change).
- Progress stored: solved status, points, timestamp. Reset and "view answer" do not change it.
- Content sync: dev mode bind-mounts the content folder; "Sync" button runs `git pull`.
- Challenge validation (testing that a challenge works): open, decide after module 1 is designed.

## Dev rule
- Line endings: `.gitattributes` forces LF for scripts and challenge files, so a CRLF `check` script never breaks (`#!/bin/sh` "not found"). Dev happens in WSL, which makes this a safety net.

## Deferred
SSH into the sandbox (workspace image keeps sshd ready), guest, audit log, backups, spaced repetition, AI helper, hints, unlock order.
