FROM node:22-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
ARG BASE_PATH=/duweb
ARG VITE_APP_VERSION=dev
ENV VITE_BASE_PATH=${BASE_PATH}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
RUN npm run build

FROM node:22-alpine AS server-builder

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/duweb

COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package*.json ./server/
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=client-builder /app/client/dist ./client-dist

RUN mkdir -p /app/server/data

EXPOSE 8080
CMD ["node", "server/dist/index.js"]
