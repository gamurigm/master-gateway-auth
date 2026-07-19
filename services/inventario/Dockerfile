FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY services/ventas/package.json services/ventas/package.json
COPY services/inventario/package.json services/inventario/package.json
COPY backend/prisma backend/prisma

RUN npm ci

COPY services/inventario services/inventario

RUN npm run build -w inventario

FROM node:24.15.0-bookworm-slim AS runtime

WORKDIR /app/services/inventario
ENV NODE_ENV=production

COPY --from=build /app/services/inventario/package.json ./package.json
COPY --from=build /app/services/inventario/dist ./dist

EXPOSE 3007

CMD ["node", "dist/server.js"]