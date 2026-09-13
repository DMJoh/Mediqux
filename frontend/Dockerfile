FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-fund --no-audit

COPY . .
RUN npm run build

FROM caddy:alpine AS production

RUN addgroup -g 1000 -S mediqux && adduser -u 1000 -S mediqux -G mediqux

COPY --from=builder /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile

USER mediqux

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080 || exit 1
