# Use Node.js 22 official image
FROM node:22-alpine

# Install required packages
RUN apk add --no-cache shadow su-exec

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies as root
RUN npm install

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p /app/uploads/lab-reports /app/logs

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose port
EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]