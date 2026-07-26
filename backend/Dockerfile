FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Se copian los package.json de TODOS los workspaces declarados en el package.json
# raíz. Si faltan (antes sólo se copiaban backend y ventas), npm construye un
# árbol de dependencias incompleto y algunas deps hoisted del backend —como
# `jose`— no se instalan, haciendo que el contenedor caiga en runtime.
COPY backend/package.json backend/package.json
COPY services/ventas/package.json services/ventas/package.json
COPY frontend/package.json frontend/package.json
COPY frontend-vue/package.json frontend-vue/package.json

COPY backend/prisma backend/prisma

RUN npm install --no-audit --no-fund

COPY backend backend

RUN npm run build -w backend

FROM node:24.15.0-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma

RUN mkdir -p /app/keys

VOLUME /app/keys

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy --schema backend/prisma/schema.prisma && node backend/dist/prisma/seed.js && node backend/dist/src/main.js"]
