FROM node:22-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Create app directory
WORKDIR /app

# Copy package files from service
COPY package*.json ./
COPY tsconfig.json tsoa.json ./

# Install dependencies (npm install, not ci - workspace packages lack package-lock.json)
RUN npm install && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript (for production)
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whatsapp -u 1001 -G nodejs && \
    chown -R whatsapp:nodejs /app

# Switch to non-root user
USER whatsapp

# Expose port (actual port configured via PORT env var)
EXPOSE 3001

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Default: run production build
# Override with ts-node-dev for development via docker-compose command
CMD ["node", "dist/index.js"]
