FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY services/ventas/package.json services/ventas/package.json
COPY backend/prisma backend/prisma

RUN npm ci

COPY services/ventas services/ventas

RUN npm run build -w ventas

FROM node:24.15.0-bookworm-slim AS runtime

WORKDIR /app/services/ventas
ENV NODE_ENV=production

COPY --from=build /app/services/ventas/package.json ./package.json
COPY --from=build /app/services/ventas/dist ./dist

EXPOSE 3006

CMD ["node", "dist/server.js"]
