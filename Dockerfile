FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --no-audit --no-fund
COPY server/bundle-entry.js ./
RUN npm run bundle-client && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libstdc++6 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server ./server
COPY public ./public
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/public/assets/js/mediasoup-client.min.js ./public/assets/js/mediasoup-client.min.js
RUN mkdir -p /app/data /app/public/assets/uploads && chown -R node:node /app
USER node
WORKDIR /app/server
EXPOSE 3010 40000-40400/udp 40000-40400/tcp
CMD ["node", "index.js"]
