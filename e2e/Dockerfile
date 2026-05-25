FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm link

WORKDIR /workspace

ENV REPO_ROOT=/app
ENV E2E_ROOT=/app/e2e

ENTRYPOINT ["bash", "/app/e2e/scripts/run-all.sh"]
