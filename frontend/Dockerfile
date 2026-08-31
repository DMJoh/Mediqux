FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-fund --no-audit

COPY . .
RUN npm run build

FROM caddy:alpine AS production

COPY --from=builder /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80 || exit 1
