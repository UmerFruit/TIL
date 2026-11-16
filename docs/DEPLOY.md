# Deploy

Dedicated VPS only. The app mounts the host Docker socket (root-equivalent).

1. Install Docker + git. Clone repo and content checkout.
2. Build sandbox image natively on the VPS (arm64): `cd sandbox-images && ./build.sh`
3. Create `.env`: `APP_PASSWORD` (strong), `SESSION_SECRET` (32+ chars), `COOKIE_SECURE=true`, `CONTENT_DIR=/path/to/content`.
4. `docker compose -f docker-compose.prod.yml up -d --build`
5. Add `deploy/Caddyfile.snippet` to your Caddyfile (reverse_proxy app:3000 on the `caddy` network).
6. Verify: `curl https://learning.umerfruit.duckdns.org/health` → `ok`, then log in.
7. Content updates: `git pull` in the content checkout (or the Sync button).
8. Upgrade: `git pull && docker compose -f docker-compose.prod.yml up -d --build`.

`DOCKER_GID` must match the host docker group (`getent group docker`); set it in `.env` or compose.
