FROM node:24.15.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend-vue/package.json frontend-vue/package.json
COPY backend/prisma backend/prisma
RUN npm install --no-audit --no-fund
COPY frontend-vue frontend-vue
RUN npm run build -w frontend-vue

FROM nginx:stable-alpine
COPY frontend-vue/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend-vue/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
