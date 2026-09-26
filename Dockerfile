# TD Meet - Tastiere Digitali srls
FROM node:22-alpine AS builder

RUN apk add --no-cache \
    python3 py3-pip make g++ gcc linux-headers udev

WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund --loglevel=error

# Bundle mediasoup-client per il browser tramite esbuild
# --format=iife + --global-name=mediasoupClient → crea window.mediasoupClient
RUN npx esbuild \
    --bundle \
    --platform=browser \
    --format=iife \
    --global-name=mediasoupClient \
    --minify \
    --outfile=/tmp/mediasoup-client.min.js \
    node_modules/mediasoup-client/lib/index.js

# Runtime stage
FROM node:22-alpine

RUN apk add --no-cache \
    python3 make g++ gcc linux-headers udev libstdc++

WORKDIR /app

ENV NPM_CONFIG_OMIT=dev

COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /tmp/mediasoup-client.min.js ./public/assets/js/mediasoup-client.min.js

COPY server/ ./server/
COPY public/  ./public/

# Ripristina il bundle (COPY public/ non deve sovrascriverlo se non c'era)
COPY --from=builder /tmp/mediasoup-client.min.js ./public/assets/js/mediasoup-client.min.js

WORKDIR /app/server

EXPOSE 3010
EXPOSE 40000-40400/udp
EXPOSE 40000-40400/tcp

CMD ["node", "index.js"]
