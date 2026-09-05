# ==============================================================================
# Multi-stage Dockerfile for Breakout Maker (造砖厂)
# Build the React / Three.js frontend and the existing AI server separately.
# The production server serves Vite's output from /app/public.
# ==============================================================================

# --- Frontend build ---
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY web/ web/
COPY src/ src/
COPY levels/ levels/
COPY public/ public/
RUN npm run build

# --- Server build ---
FROM node:22-alpine AS server-builder

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/src/ src/
COPY server/tsconfig.json ./
RUN npm run build

# --- Production ---
FROM node:22-alpine

WORKDIR /app

# Install production deps only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy compiled server
COPY --from=server-builder /app/server/dist/ ./server/dist/

# Include index.html, hashed JavaScript/CSS, fonts, and other static assets.
COPY --from=frontend-builder /app/dist/ ./public/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
