# --- Build stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/web/package.json apps/web/

# Install dependencies
RUN npm ci --workspace=apps/web --workspace=packages/shared-types

# Copy source code
COPY packages/shared-types/ packages/shared-types/
COPY apps/web/ apps/web/
COPY AX-XA20_recipes_complete.csv KN-HW24H_recipes_complete_complete.csv ./

# Build shared package and web app
RUN npm --workspace packages/shared-types run build

WORKDIR /app/apps/web
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# --- Production stage (nginx for static serving) ---
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# SPA fallback config
COPY apps/web/nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
