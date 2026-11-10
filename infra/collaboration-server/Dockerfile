# Contexto de build: la RAÍZ del repo (coordinator.js importa ../../../packages/uml-commands).
#   docker build -f infra/collaboration-server/Dockerfile .
FROM node:24-slim

WORKDIR /app/infra/collaboration-server
COPY infra/collaboration-server/package.json infra/collaboration-server/package-lock.json ./
RUN npm ci --omit=dev
COPY infra/collaboration-server/ ./
COPY packages/ /app/packages/

ENV PORT=1234
EXPOSE 1234
CMD ["node", "server.js"]
