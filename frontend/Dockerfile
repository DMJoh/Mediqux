FROM nginx:alpine

# Install bash and gettext for envsubst
RUN apk add --no-cache bash gettext

# Copy nginx configuration
COPY nginx-template.conf /etc/nginx/conf.d/default.conf

# Copy static files
COPY *.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Copy custom entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]