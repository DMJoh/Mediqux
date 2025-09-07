# =============================================================================
# Multi-stage build for optimized production image
# =============================================================================

# Stage 1: Builder - Install dependencies and build tools
FROM node:24-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \
    python3 make g++ \
    && apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --no-fund --no-audit && \
    npm cache clean --force

# Stage 2: Production - Create minimal runtime image
FROM node:24-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    shadow \
    su-exec \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy built dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code (using .dockerignore to exclude unnecessary files)
COPY --chown=node:node . .

# Create required directories (ownership will be handled by entrypoint)
RUN mkdir -p /app/uploads/lab-reports

# Copy and set executable permissions for entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Remove unnecessary files to reduce size
RUN rm -rf \
    /tmp/* \
    /var/tmp/* \
    /usr/share/man \
    /usr/share/doc \
    ~/.npm \
    /root/.npm

# Note: User switching handled by entrypoint.sh based on PUID/PGID

EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]