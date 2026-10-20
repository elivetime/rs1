# syntax=docker/dockerfile:1
# aiuniverse.rsvp on Railway. Three stages: install deps, build, slim runtime.

# ---- 1. dependencies --------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- 2. build ---------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# /pitch is a static route, so lib/config.ts is evaluated at build time for it.
# Railway exposes service variables to Docker builds only through ARG; declare
# the two that feed static output so a changed value is baked in correctly.
# Both have in-code defaults that match production today, so they are optional.
ARG SITE_URL
ARG PITCH_VIDEO_URL
ENV SITE_URL=${SITE_URL} PITCH_VIDEO_URL=${PITCH_VIDEO_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The repo has no public/ directory today; create it so the runtime COPY never fails.
RUN mkdir -p public && npm run build

# ---- 3. runtime -------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# Next's standalone server.js listens on process.env.PORT (Railway injects it) and HOSTNAME.
CMD ["node", "server.js"]
