# Tiditalk — self-hosted video meetings (AGPL-3.0-or-later)
FROM node:22-alpine AS builder

RUN apk add --no-cache \
    python3 py3-pip make g++ gcc linux-headers udev

WORKDIR /app/server
# Header di Node per i moduli nativi: sono GIÀ nell'immagine (/usr/local/include/node).
# Senza questa riga node-gyp li scarica da unofficial-builds.nodejs.org (l'immagine
# alpine punta lì) e, se quel sito non risponde, la build fallisce anche quando non
# c'è niente da compilare (es. better-sqlite3 13.0.0/13.0.1: "gyp ERR! configure
# error … FetchError … headers.tar.gz").
ENV npm_config_nodedir=/usr/local
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

# 1.8.9: Node con la correzione della falla Brotli (CVE-2026-111497, ottobre 2026:
# 22.23.4 / 24.22.1 / 26.12.1). Docker tiene in cache l'immagine node:22-alpine
# scaricata la prima volta: se è quella vecchia la build si ferma qui e dice cosa fare.
RUN node -e "const [a,b,c]=process.versions.node.split('.').map(Number); const min={22:[23,4],24:[22,1],26:[12,1]}[a]; if (min && (b<min[0] || (b===min[0] && c<min[1]))) { console.error('\n  Node '+process.versions.node+' ha la falla Brotli (CVE-2026-111497).\n  Ricostruisci scaricando la nuova immagine di Node:  docker compose build --pull\n'); process.exit(1); }"

RUN apk add --no-cache \
    python3 make g++ gcc linux-headers udev libstdc++

WORKDIR /app

ENV NPM_CONFIG_OMIT=dev
# Express in produzione: niente stack trace nelle risposte d'errore
ENV NODE_ENV=production

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
