FROM ghcr.io/openclaw/openclaw:2026.4.5

USER root

ARG OPENCLAW_DOCKER_GPG_FINGERPRINT=9DC858229FC7DD38854AE2D88D81803C0EBFCD88
ARG OPENCLAW_CONTROL_UI_DEFAULT_LOCALE=zh-CN
ARG OPENCLAW_CONTROL_UI_FORCE_LOCALE=
ARG OPENCLAW_CONTROL_UI_ENABLED_LOCALES=auto,zh-CN,zh-TW,en
ARG OPENCLAW_CONTROL_UI_SHOW_LOCALE_SWITCHER=true

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

ARG OPENCLAW_CONTROL_UI_TEXT_MODE_DEFAULT=zh-en
ARG OPENCLAW_CONTROL_UI_ENABLED_TEXT_MODES=zh-only,zh-en,en-only

COPY overlays/control-ui/openclaw-locale-init.template.js /opt/openclaw-docker/openclaw-locale-init.template.js
COPY overlays/control-ui/openclaw-bilingual-terms.json /opt/openclaw-docker/openclaw-bilingual-terms.json
COPY overlays/control-ui/openclaw-locale-overlay.css /opt/openclaw-docker/openclaw-locale-overlay.css
COPY scripts/render-control-ui-locale-overlay.mjs /opt/openclaw-docker/render-control-ui-locale-overlay.mjs
COPY scripts/resolve-network-policy.mjs /opt/openclaw-docker/resolve-network-policy.mjs
COPY scripts/openclaw-network-entrypoint.sh /usr/local/bin/openclaw-network-entrypoint.sh
COPY scripts/openclaw-host-bridge.mjs /usr/local/bin/openclaw
RUN chmod 0755 /usr/local/bin/openclaw /usr/local/bin/openclaw-network-entrypoint.sh
RUN node /opt/openclaw-docker/render-control-ui-locale-overlay.mjs

USER node

