# TIL (Today I Learned)

A personal CTF-style learning platform. Fix broken code, run `check`, capture the flag, earn points.

## What It Is

- **Module list** → pick a challenge
- **Challenge page** → read the briefing, start a sandbox, edit code in the browser terminal
- **Run `./check`** → if it passes, it prints a flag like `TIL{...}`
- **Submit the flag** → earn points (tier = points)
- **View answer** → reveals the guide (Markdown) without reloading

All server-rendered with Hono + HTMX. No SPA, no frontend build step.

---

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- Docker (for sandbox containers)
- SQLite (bundled via better-sqlite3)

### Setup

```bash
# 1. Clone and enter the repo
cd til

# 2. Install dependencies
cd api && npm install

# 3. Create .env file (see .env.example for reference)
cp .env.example .env
# Edit .env with your values:
#   APP_PASSWORD=your-strong-password
#   SESSION_SECRET=at-least-32-random-chars
#   CONTENT_DIR=../content  (optional, defaults to ../content)

# 4. Build the sandbox image (one-time)
cd ../sandbox-images/cpp && ./build.sh

# 5. Start the dev server
cd ../../api && npm run dev
```

The app runs on **http://localhost:3000** (or `PORT` env var).

### .env Example

```env
APP_PASSWORD=your-strong-password-here
SESSION_SECRET=0123456789abcdef0123456789abcdef
COOKIE_SECURE=false
CONTENT_DIR=../content
DOCKER_SOCKET=/var/run/docker.sock
SANDBOX_MEMORY_MB=1024
SANDBOX_CPUS=1
SANDBOX_PIDS=256
SANDBOX_IDLE_MINUTES=120
SANDBOX_JANITOR_SECONDS=60
```

---

## Repo Layout

```
til/
├── api/                    # Hono app (TypeScript)
│   ├── src/
│   │   ├── routes/         # HTTP routes (thin)
│   │   ├── services/       # Business logic
│   │   ├── adapters/       # Disk, SQLite, Docker (behind interfaces)
│   │   └── views/          # JSX templates (server-rendered)
│   ├── package.json
│   └── tsconfig.json
├── content/                # Challenges (git-tracked)
│   └── <module>/           # e.g., cpp-basics/
│       ├── module.md
│       └── <challenge>/    # e.g., hello-fix/
│           ├── challenge.md
│           ├── check
│           └── files/
├── sandbox-images/         # Docker images for sandboxes
│   └── cpp/                # til-cpp image (gcc, g++, make, vim, nano)
├── database/               # SQLite migrations
├── docs/                   # Documentation
│   ├── ROUTES.md           # All HTTP routes
│   ├── CONTENT-FORMAT.md   # How to author challenges
│   └── ...
└── README.md               # This file
```

---

## Building the Sandbox Image

The `til-cpp` image is used by C++ challenges. Build it once:

```bash
cd sandbox-images/cpp
./build.sh
```

This creates a multi-arch image (`til-cpp:latest`) with gcc, g++, make, vim, nano.

---

## Documentation

- [Routes Reference](docs/ROUTES.md) — every HTTP route, method, renderer, service, auth
- [Content Format](docs/CONTENT-FORMAT.md) — module/challenge structure, validation, check script convention
- [Initial Spec](docs/initial_spec.md) — architecture overview
- [Phases](docs/PHASES.md) — development phases

---

## ⚠️ Security Warning

**This application uses the host Docker socket (`/var/run/docker.sock`).**

- The Docker socket is **root-equivalent** on the host. Anyone who can talk to it can start privileged containers, mount the host filesystem, and take full control of the machine.
- The app authenticates with a single password (from `APP_PASSWORD`), but a vulnerability in the app = host compromise.
- **Run TIL on a dedicated machine or VPS.** Do not run it on a shared host with other services.
- Use a **strong password** for `APP_PASSWORD` (generated, 32+ chars).
- In production, the app is intended to run behind **Tailscale** (Caddy restricts to 100.64.0.0/10). The password is a second layer.

---

## Production Deployment

See [Phase 6](docs/PHASES.md#phase-6---sync-and-deploy) for:
- Dockerfile (arm64)
- docker-compose.yml
- Caddy site snippet (Tailscale-only)
- DEPLOY.md (to be written)

---

## License

MIT — do whatever you want.