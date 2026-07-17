FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_BASE=/api/v1
ARG VITE_MQTT_HOST=iot.rectronx.com
ARG VITE_MQTT_PORT=1883
ARG VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
ARG VITE_MAP_ATTRIBUTION=OpenStreetMap contributors
ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_MQTT_HOST=${VITE_MQTT_HOST}
ENV VITE_MQTT_PORT=${VITE_MQTT_PORT}
ENV VITE_MAP_TILE_URL=${VITE_MAP_TILE_URL}
ENV VITE_MAP_ATTRIBUTION=${VITE_MAP_ATTRIBUTION}
RUN pnpm build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=10 CMD wget -qO- http://localhost/health/frontend || exit 1
