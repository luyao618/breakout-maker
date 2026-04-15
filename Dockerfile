# ==============================================================================
# Multi-stage Dockerfile for Breakout Maker (造砖厂)
# Stage 1: Build frontend (preview.html) + compile server TypeScript
# Stage 2: Lean production image
# ==============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy everything needed for build
COPY src/ src/
COPY levels/ levels/
COPY build.js .

# Build frontend → preview.html
RUN node build.js

# Build server
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci

COPY server/src/ server/src/
COPY server/tsconfig.json server/
RUN cd server && npm run build

# --- Stage 2: Production ---
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy compiled server
COPY --from=builder /app/server/dist/ ./server/dist/

# Copy built frontend
COPY --from=builder /app/preview.html ./public/index.html

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
