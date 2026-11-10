# Contexto de build: la RAÍZ del repo (el frontend importa ../packages/uml-commands).
#   docker build -f frontend/Dockerfile --build-arg VITE_YJS_WS_URL=ws://<IP>/ws .
FROM node:24-slim AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY packages/ /app/packages/
ARG VITE_YJS_WS_URL
ENV VITE_YJS_WS_URL=$VITE_YJS_WS_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
