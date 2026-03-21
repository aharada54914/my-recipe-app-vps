# --- Build stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy workspace package.json files for dependency resolution
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/

# Install dependencies
RUN npm ci --workspace=apps/api --workspace=packages/shared-types

# Copy source code
COPY packages/shared-types/ packages/shared-types/
COPY apps/api/ apps/api/

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build TypeScript
RUN npx tsc

# --- Production stage ---
FROM node:22-alpine

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/

# Install production dependencies only
RUN npm ci --workspace=apps/api --workspace=packages/shared-types --omit=dev

# Copy built output
COPY --from=builder /app/apps/api/dist apps/api/dist/
COPY --from=builder /app/apps/api/prisma apps/api/prisma/
COPY --from=builder /app/apps/api/node_modules/.prisma apps/api/node_modules/.prisma/
COPY --from=builder /app/packages/shared-types/ packages/shared-types/

WORKDIR /app/apps/api

# Run migrations then start server
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
