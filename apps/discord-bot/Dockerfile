# --- Build stage ---
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/discord-bot/package.json apps/discord-bot/

RUN npm ci --workspace=apps/discord-bot --workspace=packages/shared-types

COPY packages/shared-types/ packages/shared-types/
COPY apps/discord-bot/ apps/discord-bot/

RUN npm --workspace packages/shared-types run build
RUN rm -f apps/discord-bot/tsconfig.tsbuildinfo && npx tsc -p apps/discord-bot/tsconfig.json

# --- Production stage ---
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/discord-bot/package.json apps/discord-bot/

RUN npm ci --workspace=apps/discord-bot --workspace=packages/shared-types --omit=dev

COPY --from=builder /app/apps/discord-bot/dist apps/discord-bot/dist/
COPY --from=builder /app/packages/shared-types/ packages/shared-types/

WORKDIR /app/apps/discord-bot

CMD ["node", "dist/index.js"]
