FROM node:24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache --virtual .build-deps \
    python3 make g++ \
    && apk add --no-cache dumb-init

COPY package*.json ./

RUN npm ci --only=production --no-fund --no-audit && \
    npm cache clean --force

FROM node:24-alpine AS production

RUN apk add --no-cache \
    dumb-init \
    shadow \
    su-exec \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY --chown=node:node . .

RUN mkdir -p /app/uploads/lab-reports

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

RUN rm -rf \
    /tmp/* \
    /var/tmp/* \
    /usr/share/man \
    /usr/share/doc \
    ~/.npm \
    /root/.npm


EXPOSE 3000

ENTRYPOINT ["dumb-init", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]