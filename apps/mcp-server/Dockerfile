# --- Build stage ---
FROM node:24-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy workspace package.json files for dependency resolution
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/mcp-server/package.json apps/mcp-server/

# Install dependencies
RUN npm ci --workspace=apps/mcp-server --workspace=packages/shared-types

# Copy source code
COPY packages/shared-types/ packages/shared-types/
COPY apps/mcp-server/ apps/mcp-server/
COPY apps/api/prisma/ apps/api/prisma/

# Build shared package and mcp-server
RUN npm --workspace packages/shared-types run build

RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN rm -f apps/mcp-server/tsconfig.tsbuildinfo && npx tsc -p apps/mcp-server/tsconfig.json

# --- Production stage ---
FROM node:24-alpine

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/mcp-server/package.json apps/mcp-server/

# Install production dependencies only
RUN npm ci --workspace=apps/mcp-server --workspace=packages/shared-types --omit=dev

# Copy built output
COPY --from=builder /app/apps/mcp-server/dist apps/mcp-server/dist/
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma/
COPY --from=builder /app/packages/shared-types/ packages/shared-types/

WORKDIR /app/apps/mcp-server

EXPOSE 3002
CMD ["node", "dist/index.js"]
