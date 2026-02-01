# ============================================
# MYCSC - Docker Image
# Multi-stage build for production
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY src ./src

# Build TypeScript and React
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S mycsc && \
    adduser -S mycsc -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy public files (downloads, etc.) and set permissions
COPY public ./public
RUN chown -R mycsc:mycsc /app/public

# Create data directory
RUN mkdir -p /app/data && chown -R mycsc:mycsc /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV TCP_PORT=3002
ENV DATA_DIR=/app/data

# OAuth and Email configuration (set via docker-compose or runtime)
ENV GOOGLE_CLIENT_ID=""
ENV GOOGLE_CLIENT_SECRET=""
ENV GITHUB_CLIENT_ID=""
ENV GITHUB_CLIENT_SECRET=""
ENV EMAIL_PASSWORD=""
ENV EMAIL_FROM="mycsc@mail.ru"

# Expose ports
EXPOSE 3001 3002

# Switch to non-root user
USER mycsc

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/config || exit 1

# Start server
CMD ["node", "dist/main/server/server.js"]
