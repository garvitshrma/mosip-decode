# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install the workspace, generate Prisma, build the frontend.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
# Prisma's engines need OpenSSL on Alpine.
RUN apk add --no-cache openssl
ENV DATABASE_URL=file:/tmp/build.db

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --no-audit --no-fund

COPY . .
RUN cd backend && npx prisma generate

# Empty by default so the browser calls the same origin; nginx proxies /api.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------------------------------------------------------------------------
# Backend stage: Express + Socket.IO + SQLite. Runs TypeScript through tsx.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS backend
WORKDIR /app
# Prisma's query and schema engines need OpenSSL on Alpine.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/backend
ENV PORT=4000
ENV DATABASE_URL=file:/data/dev.db
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx src/index.ts"]

# ---------------------------------------------------------------------------
# Frontend stage: static Vite build served by nginx, proxying the API and
# websocket traffic to the backend container.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS frontend
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
