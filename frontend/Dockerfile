FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY frontend/package.json frontend/package.json
COPY services/ventas/package.json services/ventas/package.json
COPY services/inventario/package.json services/inventario/package.json

RUN npm ci

COPY frontend frontend
COPY scripts/configure-frontend-environment.mjs scripts/configure-frontend-environment.mjs

ARG FRONTEND_API_URL=/api
ARG FRONTEND_INVENTARIO_API_URL=/inventario
ENV FRONTEND_API_URL=$FRONTEND_API_URL
ENV FRONTEND_INVENTARIO_API_URL=$FRONTEND_INVENTARIO_API_URL

RUN npm run configure:frontend \
    && npm run build -w frontend

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
