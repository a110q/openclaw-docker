#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  . "$PROJECT_DIR/.env"
  set +a
fi

SOURCE_TAG="${OPENCLAW_SOURCE_TAG:-v2026.4.5}"
TARGET_IMAGE="openclaw-sandbox-common:bookworm-slim"
SANDBOX_APT_RETRIES="${SANDBOX_APT_RETRIES:-10}"
SANDBOX_APT_HTTP_TIMEOUT="${SANDBOX_APT_HTTP_TIMEOUT:-30}"
SANDBOX_APT_HTTPS_TIMEOUT="${SANDBOX_APT_HTTPS_TIMEOUT:-30}"
SANDBOX_APT_PIPELINE_DEPTH="${SANDBOX_APT_PIPELINE_DEPTH:-0}"
SANDBOX_APT_INSTALL_ATTEMPTS="${SANDBOX_APT_INSTALL_ATTEMPTS:-6}"
SANDBOX_APT_RETRY_SLEEP="${SANDBOX_APT_RETRY_SLEEP:-15}"
SANDBOX_DEBIAN_MIRROR="${SANDBOX_DEBIAN_MIRROR:-}"
SANDBOX_DEBIAN_SECURITY_MIRROR="${SANDBOX_DEBIAN_SECURITY_MIRROR:-}"

fetch_file() {
  local path="$1"
  local output="$2"
  local primary="https://cdn.jsdelivr.net/gh/openclaw/openclaw@${SOURCE_TAG}/${path}"
  local fallback="https://raw.githubusercontent.com/openclaw/openclaw/${SOURCE_TAG}/${path}"

  curl --http1.1 --retry 5 --retry-delay 2 --retry-all-errors --connect-timeout 15 --max-time 180 -fsSL "$primary" -o "$output" \
    || curl --http1.1 --retry 5 --retry-delay 2 --retry-all-errors --connect-timeout 15 --max-time 180 -fsSL "$fallback" -o "$output"
}

rewrite_sandbox_dockerfile() {
  local dockerfile="$1"
  local base_image="$2"

  cat <<'DOCKERFILE' | sed \
    -e "s|__BASE_IMAGE__|$base_image|g" \
    -e "s|__APT_RETRIES__|$SANDBOX_APT_RETRIES|g" \
    -e "s|__APT_HTTP_TIMEOUT__|$SANDBOX_APT_HTTP_TIMEOUT|g" \
    -e "s|__APT_HTTPS_TIMEOUT__|$SANDBOX_APT_HTTPS_TIMEOUT|g" \
    -e "s|__APT_PIPELINE_DEPTH__|$SANDBOX_APT_PIPELINE_DEPTH|g" \
    -e "s|__APT_INSTALL_ATTEMPTS__|$SANDBOX_APT_INSTALL_ATTEMPTS|g" \
    -e "s|__APT_RETRY_SLEEP__|$SANDBOX_APT_RETRY_SLEEP|g" \
    -e "s|__APT_PRIMARY_MIRROR__|$SANDBOX_DEBIAN_MIRROR|g" \
    -e "s|__APT_SECURITY_MIRROR__|$SANDBOX_DEBIAN_SECURITY_MIRROR|g" \
    > "$dockerfile"
FROM __BASE_IMAGE__

ENV DEBIAN_FRONTEND=noninteractive

ARG APT_RETRIES=__APT_RETRIES__
ARG APT_HTTP_TIMEOUT=__APT_HTTP_TIMEOUT__
ARG APT_HTTPS_TIMEOUT=__APT_HTTPS_TIMEOUT__
ARG APT_PIPELINE_DEPTH=__APT_PIPELINE_DEPTH__
ARG APT_INSTALL_ATTEMPTS=__APT_INSTALL_ATTEMPTS__
ARG APT_RETRY_SLEEP=__APT_RETRY_SLEEP__
ARG APT_PRIMARY_MIRROR=__APT_PRIMARY_MIRROR__
ARG APT_SECURITY_MIRROR=__APT_SECURITY_MIRROR__

RUN --mount=type=cache,id=openclaw-sandbox-bookworm-apt-cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,id=openclaw-sandbox-bookworm-apt-lists,target=/var/lib/apt,sharing=locked \
  printf '%s\n' \
    "Acquire::Retries \"${APT_RETRIES}\";" \
    "Acquire::http::Timeout \"${APT_HTTP_TIMEOUT}\";" \
    "Acquire::https::Timeout \"${APT_HTTPS_TIMEOUT}\";" \
    "Acquire::http::Pipeline-Depth \"${APT_PIPELINE_DEPTH}\";" \
    "Acquire::https::Pipeline-Depth \"${APT_PIPELINE_DEPTH}\";" \
    > /etc/apt/apt.conf.d/80-openclaw-retries \
  && primary_mirror="${APT_PRIMARY_MIRROR:-}" \
  && security_mirror="${APT_SECURITY_MIRROR:-}" \
  && if [ -n "${primary_mirror}" ] || [ -n "${security_mirror}" ]; then \
       primary_mirror="${primary_mirror:-http://deb.debian.org/debian}"; \
       security_mirror="${security_mirror:-http://deb.debian.org/debian-security}"; \
       if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
         sed -i "s|http://deb.debian.org/debian|${primary_mirror}|g; s|http://deb.debian.org/debian-security|${security_mirror}|g; s|http://security.debian.org/debian-security|${security_mirror}|g" /etc/apt/sources.list.d/debian.sources; \
       fi; \
       if [ -f /etc/apt/sources.list ]; then \
         sed -i "s|http://deb.debian.org/debian|${primary_mirror}|g; s|http://deb.debian.org/debian-security|${security_mirror}|g; s|http://security.debian.org/debian-security|${security_mirror}|g" /etc/apt/sources.list; \
       fi; \
     fi \
  && attempt=1 \
  && until [ "${attempt}" -gt "${APT_INSTALL_ATTEMPTS}" ]; do \
       echo "APT base install attempt ${attempt}/${APT_INSTALL_ATTEMPTS}"; \
       apt-get update \
       && apt-get upgrade -y --no-install-recommends \
       && apt-get install -y --fix-missing --no-install-recommends \
         bash \
         ca-certificates \
         curl \
         git \
         jq \
         python3 \
         ripgrep \
       && break; \
       if [ "${attempt}" -eq "${APT_INSTALL_ATTEMPTS}" ]; then exit 1; fi; \
       attempt=$((attempt + 1)); \
       sleep "${APT_RETRY_SLEEP}"; \
     done

RUN useradd --create-home --shell /bin/bash sandbox
USER sandbox
WORKDIR /home/sandbox

CMD ["sleep", "infinity"]
DOCKERFILE
}

rewrite_sandbox_common_dockerfile() {
  local dockerfile="$1"

  cat <<'DOCKERFILE' | sed \
    -e "s|__APT_RETRIES__|$SANDBOX_APT_RETRIES|g" \
    -e "s|__APT_HTTP_TIMEOUT__|$SANDBOX_APT_HTTP_TIMEOUT|g" \
    -e "s|__APT_HTTPS_TIMEOUT__|$SANDBOX_APT_HTTPS_TIMEOUT|g" \
    -e "s|__APT_PIPELINE_DEPTH__|$SANDBOX_APT_PIPELINE_DEPTH|g" \
    -e "s|__APT_INSTALL_ATTEMPTS__|$SANDBOX_APT_INSTALL_ATTEMPTS|g" \
    -e "s|__APT_RETRY_SLEEP__|$SANDBOX_APT_RETRY_SLEEP|g" \
    -e "s|__APT_PRIMARY_MIRROR__|$SANDBOX_DEBIAN_MIRROR|g" \
    -e "s|__APT_SECURITY_MIRROR__|$SANDBOX_DEBIAN_SECURITY_MIRROR|g" \
    > "$dockerfile"
ARG BASE_IMAGE=openclaw-sandbox:bookworm-slim
FROM ${BASE_IMAGE}

USER root

ENV DEBIAN_FRONTEND=noninteractive

ARG PACKAGES="curl wget jq coreutils grep nodejs npm python3 git ca-certificates golang-go rustc cargo unzip pkg-config libasound2-dev build-essential file"
ARG INSTALL_PNPM=1
ARG INSTALL_BUN=1
ARG BUN_INSTALL_DIR=/opt/bun
ARG INSTALL_BREW=1
ARG BREW_INSTALL_DIR=/home/linuxbrew/.linuxbrew
ARG FINAL_USER=sandbox
ARG APT_RETRIES=__APT_RETRIES__
ARG APT_HTTP_TIMEOUT=__APT_HTTP_TIMEOUT__
ARG APT_HTTPS_TIMEOUT=__APT_HTTPS_TIMEOUT__
ARG APT_PIPELINE_DEPTH=__APT_PIPELINE_DEPTH__
ARG APT_INSTALL_ATTEMPTS=__APT_INSTALL_ATTEMPTS__
ARG APT_RETRY_SLEEP=__APT_RETRY_SLEEP__
ARG APT_PRIMARY_MIRROR=__APT_PRIMARY_MIRROR__
ARG APT_SECURITY_MIRROR=__APT_SECURITY_MIRROR__

ENV BUN_INSTALL=${BUN_INSTALL_DIR}
ENV HOMEBREW_PREFIX=${BREW_INSTALL_DIR}
ENV HOMEBREW_CELLAR=${BREW_INSTALL_DIR}/Cellar
ENV HOMEBREW_REPOSITORY=${BREW_INSTALL_DIR}/Homebrew
ENV PATH=${BUN_INSTALL_DIR}/bin:${BREW_INSTALL_DIR}/bin:${BREW_INSTALL_DIR}/sbin:${PATH}

RUN --mount=type=cache,id=openclaw-sandbox-common-apt-cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,id=openclaw-sandbox-common-apt-lists,target=/var/lib/apt,sharing=locked \
  printf '%s\n' \
    "Acquire::Retries \"${APT_RETRIES}\";" \
    "Acquire::http::Timeout \"${APT_HTTP_TIMEOUT}\";" \
    "Acquire::https::Timeout \"${APT_HTTPS_TIMEOUT}\";" \
    "Acquire::http::Pipeline-Depth \"${APT_PIPELINE_DEPTH}\";" \
    "Acquire::https::Pipeline-Depth \"${APT_PIPELINE_DEPTH}\";" \
    > /etc/apt/apt.conf.d/80-openclaw-retries \
  && primary_mirror="${APT_PRIMARY_MIRROR:-}" \
  && security_mirror="${APT_SECURITY_MIRROR:-}" \
  && if [ -n "${primary_mirror}" ] || [ -n "${security_mirror}" ]; then \
       primary_mirror="${primary_mirror:-http://deb.debian.org/debian}"; \
       security_mirror="${security_mirror:-http://deb.debian.org/debian-security}"; \
       if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
         sed -i "s|http://deb.debian.org/debian|${primary_mirror}|g; s|http://deb.debian.org/debian-security|${security_mirror}|g; s|http://security.debian.org/debian-security|${security_mirror}|g" /etc/apt/sources.list.d/debian.sources; \
       fi; \
       if [ -f /etc/apt/sources.list ]; then \
         sed -i "s|http://deb.debian.org/debian|${primary_mirror}|g; s|http://deb.debian.org/debian-security|${security_mirror}|g; s|http://security.debian.org/debian-security|${security_mirror}|g" /etc/apt/sources.list; \
       fi; \
     fi \
  && attempt=1 \
  && until [ "${attempt}" -gt "${APT_INSTALL_ATTEMPTS}" ]; do \
       echo "APT common install attempt ${attempt}/${APT_INSTALL_ATTEMPTS}"; \
       apt-get update \
       && apt-get upgrade -y --no-install-recommends \
       && apt-get install -y --fix-missing --no-install-recommends ${PACKAGES} \
       && break; \
       if [ "${attempt}" -eq "${APT_INSTALL_ATTEMPTS}" ]; then exit 1; fi; \
       attempt=$((attempt + 1)); \
       sleep "${APT_RETRY_SLEEP}"; \
     done

RUN if [ "${INSTALL_PNPM}" = "1" ]; then npm install -g pnpm; fi

RUN if [ "${INSTALL_BUN}" = "1" ]; then \
  curl -fsSL https://bun.sh/install | bash; \
  ln -sf "${BUN_INSTALL_DIR}/bin/bun" /usr/local/bin/bun; \
fi

RUN if [ "${INSTALL_BREW}" = "1" ]; then \
  if ! id -u linuxbrew >/dev/null 2>&1; then useradd -m -s /bin/bash linuxbrew; fi; \
  mkdir -p "${BREW_INSTALL_DIR}"; \
  chown -R linuxbrew:linuxbrew "$(dirname "${BREW_INSTALL_DIR}")"; \
  su - linuxbrew -c "NONINTERACTIVE=1 CI=1 /bin/bash -c '$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)'"; \
  if [ ! -e "${BREW_INSTALL_DIR}/Library" ]; then ln -s "${BREW_INSTALL_DIR}/Homebrew/Library" "${BREW_INSTALL_DIR}/Library"; fi; \
  if [ ! -x "${BREW_INSTALL_DIR}/bin/brew" ]; then echo \"brew install failed\"; exit 1; fi; \
  ln -sf "${BREW_INSTALL_DIR}/bin/brew" /usr/local/bin/brew; \
fi

USER ${FINAL_USER}
DOCKERFILE
}

if docker image inspect "$TARGET_IMAGE" >/dev/null 2>&1; then
  echo "$TARGET_IMAGE already exists. Remove it first if you want a rebuild."
  exit 0
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/scripts"

echo "Downloading OpenClaw sandbox build files for $SOURCE_TAG ..."
fetch_file "scripts/sandbox-setup.sh" "$TMP_DIR/scripts/sandbox-setup.sh"
fetch_file "scripts/sandbox-common-setup.sh" "$TMP_DIR/scripts/sandbox-common-setup.sh"
fetch_file "Dockerfile.sandbox" "$TMP_DIR/Dockerfile.sandbox"
fetch_file "Dockerfile.sandbox-common" "$TMP_DIR/Dockerfile.sandbox-common"

for dockerfile in "$TMP_DIR/Dockerfile.sandbox" "$TMP_DIR/Dockerfile.sandbox-common"; do
  tail -n +2 "$dockerfile" > "$dockerfile.tmp"
  mv "$dockerfile.tmp" "$dockerfile"
done

chmod +x "$TMP_DIR/scripts/sandbox-setup.sh" "$TMP_DIR/scripts/sandbox-common-setup.sh"

SANDBOX_BASE_IMAGE="$(awk '/^FROM / { print $2; exit }' "$TMP_DIR/Dockerfile.sandbox" | tr -d '\r')"
if [ -z "$SANDBOX_BASE_IMAGE" ]; then
  echo "Unable to determine sandbox base image from official Dockerfile.sandbox"
  exit 1
fi

rewrite_sandbox_dockerfile "$TMP_DIR/Dockerfile.sandbox" "$SANDBOX_BASE_IMAGE"
rewrite_sandbox_common_dockerfile "$TMP_DIR/Dockerfile.sandbox-common"

if [ -n "$SANDBOX_DEBIAN_MIRROR" ] || [ -n "$SANDBOX_DEBIAN_SECURITY_MIRROR" ]; then
  echo "Using custom Debian mirrors:"
  echo "  primary : ${SANDBOX_DEBIAN_MIRROR:-http://deb.debian.org/debian}"
  echo "  security: ${SANDBOX_DEBIAN_SECURITY_MIRROR:-http://deb.debian.org/debian-security}"
fi

echo "APT retry config: retries=$SANDBOX_APT_RETRIES install_attempts=$SANDBOX_APT_INSTALL_ATTEMPTS sleep=${SANDBOX_APT_RETRY_SLEEP}s"

echo "Pre-pulling sandbox base image: $SANDBOX_BASE_IMAGE"
docker pull "$SANDBOX_BASE_IMAGE" || {
  case "$SANDBOX_BASE_IMAGE" in
    */*) docker pull "$SANDBOX_BASE_IMAGE" ;;
    *) docker pull "docker.io/library/$SANDBOX_BASE_IMAGE" ;;
  esac
}

export BUILDKIT_PROGRESS="${BUILDKIT_PROGRESS:-plain}"

echo "Building $TARGET_IMAGE ..."
(cd "$TMP_DIR" && ./scripts/sandbox-common-setup.sh)

echo "Built $TARGET_IMAGE"
