FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY apps/admin-ui/package*.json ./
RUN npm install

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/admin-ui ./
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG OPENCLAW_DOCKER_GPG_FINGERPRINT=9DC858229FC7DD38854AE2D88D81803C0EBFCD88
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /tmp/docker.gpg.asc \
 && expected_fingerprint="$(printf '%s' "$OPENCLAW_DOCKER_GPG_FINGERPRINT" | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]')" \
 && actual_fingerprint="$(gpg --batch --show-keys --with-colons /tmp/docker.gpg.asc | awk -F: '$1 == "fpr" { print toupper($10); exit }')" \
 && if [ -z "$actual_fingerprint" ] || [ "$actual_fingerprint" != "$expected_fingerprint" ]; then \
      echo "ERROR: Docker apt key fingerprint mismatch (expected $expected_fingerprint, got ${actual_fingerprint:-<empty>})" >&2; \
      exit 1; \
    fi \
 && gpg --dearmor -o /etc/apt/keyrings/docker.gpg /tmp/docker.gpg.asc \
 && rm -f /tmp/docker.gpg.asc \
 && chmod a+r /etc/apt/keyrings/docker.gpg \
 && printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable\n' "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    docker-ce-cli \
    docker-compose-plugin \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
