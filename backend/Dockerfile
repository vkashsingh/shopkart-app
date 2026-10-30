# Builds the ShopKart Node.js / Express backend service into a minimal production container image.
# Connects to MongoDB, serves REST APIs to the Nginx frontend, and exposes Prometheus metrics on :8080.

# Stage 1: Build stage to prepare application dependencies
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Final stage: Lightweight production runtime environment
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# Install only production dependencies and clean cache to minimize image size and vulnerabilities
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Run as built-in non-root user 'node' for container process isolation
USER node

EXPOSE 8080

# Native Node.js healthcheck: polls /health every 30s without requiring curl or wget binaries
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form CMD runs Node as PID 1 so OS signals (SIGTERM/SIGINT) trigger graceful shutdown
CMD ["node", "src/server.js"]
