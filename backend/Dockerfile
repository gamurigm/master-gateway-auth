FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend-vue/package.json frontend-vue/package.json
COPY services/ventas/package.json services/ventas/package.json

COPY backend/prisma backend/prisma

RUN npm install --no-audit --no-fund

COPY backend backend

COPY frontend-vue frontend-vue

RUN npm run build -w backend \
    && npm run build -w frontend-vue

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
COPY --from=build /app/frontend-vue/dist frontend/dist

RUN mkdir -p /app/keys

VOLUME /app/keys

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy --schema backend/prisma/schema.prisma && node backend/dist/prisma/seed.js && node backend/dist/src/main.js"]
