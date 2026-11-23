FROM node:24-bookworm@sha256:9d266751ca3d7fdbe651c878ffd5ad0a42fed49a18c283509267c97f025b7496

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    expect \
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
