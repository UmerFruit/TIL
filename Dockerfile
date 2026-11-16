# Multi-stage build for TIL production
# Build stage: compile TypeScript, install build deps for better-sqlite3
# Final stage: production deps only, non-root user

# ---- Build stage ----
FROM node:26-bookworm-slim AS builder

# Install build dependencies for better-sqlite3 (python3, make, g++)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY api/package*.json ./api/
COPY api/tsconfig.json ./api/

# Install all dependencies (including devDependencies for build)
RUN cd api && npm ci

# Copy source code
COPY api/src ./api/src
COPY api/public ./api/public
COPY database ./database

# Build TypeScript, then drop devDependencies (keeps compiled better-sqlite3)
RUN cd api && npm run build && npm prune --omit=dev

# ---- Production stage ----
FROM node:26-bookworm-slim AS production

# Install runtime dependencies: git (for sync)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# The node image ships a non-root `node` user (uid 1000). Add it to the docker group.
ARG DOCKER_GID=999
RUN groupadd -g ${DOCKER_GID} docker || true
RUN usermod -aG docker node

WORKDIR /app

# Copy production node_modules (already pruned) and built output
COPY --from=builder /app/api/node_modules ./api/node_modules
COPY --from=builder /app/api/package*.json ./api/
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/api/public ./api/public
COPY --from=builder /app/database ./database

# Create data directory for SQLite (will be mounted as volume)
RUN mkdir -p /app/data && chown -R node:node /app/data

# Switch to non-root user
USER node

# Environment variables (can be overridden at runtime)
ENV PORT=3000 \
    CONTENT_DIR=/app/content \
    DB_PATH=/app/data/til.db \
    DOCKER_SOCKET=/var/run/docker.sock \
    NODE_ENV=production

# Health check (node is present; wget/curl are not in slim)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3000

# Run the app
CMD ["node", "api/dist/index.js"]