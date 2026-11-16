# Server Setup (run on the VPS)

```bash
# 1. Clone repo & content
git clone https://github.com/UmerFruit/TIL.git
cd TIL
# (content/ is already in the repo; if separate checkout, clone it too)

# 2. Build sandbox image (native arm64 on the VPS)
cd sandbox-images && ./build.sh && cd ..

# 3. Create .env
cat > .env <<'EOF'
APP_PASSWORD=<strong-password>
SESSION_SECRET=<32+ random chars>
COOKIE_SECURE=true
CONTENT_DIR=/path/to/TIL/content
DOCKER_GID=$(getent group docker | cut -d: -f3)
EOF
# Edit .env with your values

# 4. Caddy network & snippet
docker network create caddy 2>/dev/null || true
# Add deploy/Caddyfile.snippet to your Caddyfile, then reload Caddy

# 5. Launch
docker compose -f docker-compose.prod.yml up -d --build

# 6. Verify
docker compose -f docker-compose.prod.yml exec -T app \
  node -e "fetch('http://localhost:3000/health').then(r=>r.text()).then(console.log)"
# Open https://learning.umerfruit.duckdns.org and log in
```

**Upgrade:**
```bash
cd /path/to/TIL
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**Content updates:**
```bash
cd /path/to/content && git pull
# or hit the Sync button in the UI (when implemented)
```