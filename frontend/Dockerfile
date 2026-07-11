FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY services/ventas/package.json services/ventas/package.json

RUN npm ci

COPY frontend frontend

RUN npm run build -w frontend

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
