# Use Node.js 22 official image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create a volume for node_modules to persist
VOLUME ["/app/node_modules"]

# Expose port
EXPOSE 3000

# Start the application
CMD ["npx", "nodemon", "server.js"]