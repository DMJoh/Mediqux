FROM node:24-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --only=production --no-fund --no-audit && \
    npm cache clean --force

FROM node:24-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set by docker-build.yml from the GitHub Release tag (or a -dev.<sha> suffix
# for develop-branch builds) — this is the actual displayed app version, not
# package.json's, which is a rough in-development indicator only. Baked in at
# build time so it's immutable per image and needs no runtime lookup.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY --from=builder /app/node_modules ./node_modules

COPY --chown=node:node . .

RUN mkdir -p /app/uploads/lab-reports /app/uploads/diagnostic-studies

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && \
    rm -rf \
    /tmp/* \
    /var/tmp/* \
    /usr/share/man \
    /usr/share/doc \
    ~/.npm \
    /root/.npm


EXPOSE 3000

ENTRYPOINT ["dumb-init", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
