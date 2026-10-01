'use strict';
const connlog = require('./connlog');

const uuidv4 = () => require('crypto').randomUUID(); // ex-uuid: ora nativo Node

class Peer {
  constructor(socketId, displayName) {
    this.id = socketId;
    this.displayName = displayName;
    this.joinedAt = Date.now();
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.audioMuted = false;
    this.videoOff = false;
    this.handRaised = false;
    this.isScreenSharing = false;
    this.isGuest = false;
  }

  addTransport(t) { this.transports.set(t.id, t); }
  addProducer(p) { this.producers.set(p.id, p); }
  addConsumer(c) { this.consumers.set(c.id, c); }
  removeProducer(id) { this.producers.delete(id); }
  removeConsumer(id) { this.consumers.delete(id); }

  close() { this.transports.forEach((t) => t.close()); }

  toJSON() {
    return {
      id: this.id,
      displayName: this.displayName,
      joinedAt: this.joinedAt,
      audioMuted: this.audioMuted,
      videoOff: this.videoOff,
      handRaised: this.handRaised,
      isScreenSharing: this.isScreenSharing,
      isGuest: this.isGuest,
      producers: Array.from(this.producers.values()).map((p) => ({
        id: p.id, kind: p.kind, appData: p.appData,
      })),
    };
  }
}

class Room {
  constructor(roomId, router) {
    this.id = roomId;
    this.router = router;
    this.onBroadcast = null; // impostato da index.js: (event, data) => io.to(roomId).emit(...)
    this.onEmitTo = null;    // impostato da index.js: (socketId, event, data) => io.to(socketId).emit(...)
    this.peers = new Map();
    this.chatHistory = [];
    this.createdAt = Date.now();
    this.maxPeers = 20;
    // Annotazioni: Map<sid, stroke[]> — sid = socket di chi condivide lo schermo
    this.annotations = new Map();
    this.annOpen = new Map(); // sid → true se tutti possono disegnare su quello schermo
    // ── Lobby: guest in attesa di un host ────────────────────────────────────
    // Map<socketId, { displayName }>
    this.lobby = new Map();
    // ⭐ FIX BUG 9: audioLevelObserver server-side per speaking detection.
    // Sostituisce il polling consumer.getStats() lato client (ogni 100ms per ogni
    // peer remoto = drain CPU pesante su mobile). Ora il server calcola UNA volta
    // chi sta parlando e notifica tutti i client via socket 'activeSpeaker' / 'silence'.
    this.audioLevelObserver = null;
    this._initAudioLevelObserver();
  }

  async _initAudioLevelObserver() {
    try {
      this.audioLevelObserver = await this.router.createAudioLevelObserver({
        maxEntries: 1,        // ci interessa solo il dominant speaker
        threshold: -65,       // dBov: -127 (silenzio assoluto) ... 0 (max). -65 = parlato normale
        interval: 200,        // ogni 200ms (bilanciamento responsività/banda socket)
      });
      // Gli eventi vengono inoltrati ai socket dal layer superiore (index.js)
      // tramite this.audioLevelObserver.on('volumes' / 'silence', ...)
    } catch (e) {
      console.warn(`[Room ${this.id}] audioLevelObserver non disponibile:`, e.message);
    }
  }

  // ─── Host detection ─────────────────────────────────────────────────────────
  hasHost() {
    for (const peer of this.peers.values()) {
      if (!peer.isGuest) return true;
    }
    return false;
  }

  // ─── Lobby ──────────────────────────────────────────────────────────────────
  addToLobby(socketId, displayName) {
    this.lobby.set(socketId, { displayName });
  }
  removeFromLobby(socketId) {
    this.lobby.delete(socketId);
  }
  hasInLobby(socketId) {
    return this.lobby.has(socketId);
  }
  getLobbySocketIds() {
    return Array.from(this.lobby.keys());
  }
  // True se la stanza è completamente inattiva (no peers, no lobby)
  isFullyEmpty() {
    return this.peers.size === 0 && this.lobby.size === 0;
  }

  // Estrae tutti i peer guest dalla stanza e li sposta in lobby.
  // Ritorna array di { socketId, displayName } dei peer mossi.
  // Da usare quando l'ultimo host esce.
  evictGuestsToLobby() {
    const moved = [];
    for (const [socketId, peer] of this.peers) {
      if (peer.isGuest) {
        peer.close();
        this.clearSurface(socketId);
        moved.push({ socketId, displayName: peer.displayName });
      }
    }
    for (const m of moved) {
      this.peers.delete(m.socketId);
      this.lobby.set(m.socketId, { displayName: m.displayName });
    }
    return moved;
  }

  // ─── Peers ──────────────────────────────────────────────────────────────────

  addPeer(socketId, displayName, isGuest = false) {
    if (this.peers.size >= this.maxPeers) throw new Error('Stanza piena (max 20)');
    const peer = new Peer(socketId, displayName);
    peer.isGuest = isGuest;
    this.peers.set(socketId, peer);
    return peer;
  }

  getPeer(socketId) { return this.peers.get(socketId); }
  hasPeer(socketId) { return this.peers.has(socketId); }
  isEmpty() { return this.peers.size === 0; }

  /** Emette un evento a tutta la stanza (via callback impostata da index.js) */
  broadcast(event, data) {
    try { this.onBroadcast?.(event, data); } catch (e) { /* ignore */ }
  }

  /** Snapshot stats transport+producer di un peer (per diagnostica cadute) */
  async peerStatsSnapshot(socketId) {
    const peer = this.getPeer(socketId);
    if (!peer) return null;
    const transports = [], producers = [];
    for (const t of peer.transports.values()) {
      if (t.closed) continue;
      const s = await connlog.transportSnapshot(t);
      if (s) transports.push(s);
    }
    for (const p of peer.producers.values()) {
      if (p.closed) continue;
      const s = await connlog.producerSnapshot(p);
      if (s) producers.push(s);
    }
    return { transports, producers };
  }

  removePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (!peer) return null;
    peer.close();
    this.peers.delete(socketId);
    this.clearSurface(socketId); // annotazioni sul suo schermo
    return peer;
  }

  getPeersData(excludeSocketId = null) {
    return Array.from(this.peers.values())
      .filter((p) => p.id !== excludeSocketId)
      .map((p) => p.toJSON());
  }

  // ─── Transport ──────────────────────────────────────────────────────────────

  async createWebRtcTransport(socketId, isScreenShare = false) {
    const config = require('./config');
    const opts = isScreenShare
      ? config.mediasoup.screenShareTransportOptions
      : config.mediasoup.webRtcTransportOptions;

    const transport = await this.router.createWebRtcTransport(opts);

    // ⭐ FIX BUG 3: applica il throttle di banda in entrata.
    // Il valore in config.maxIncomingBitrate era dichiarato ma mai applicato → un peer
    // su rete veloce poteva saturare la stanza inviando a piena potenza.
    if (opts.maxIncomingBitrate) {
      try { await transport.setMaxIncomingBitrate(opts.maxIncomingBitrate); }
      catch (e) { console.warn('[Room] setMaxIncomingBitrate fallito:', e.message); }
    }

    // ⭐ FIX BUG 5: gestione robusta di ICE/DTLS state.
    // Prima si chiudeva il transport solo su DTLS 'closed'. Ora:
    //  - su ICE 'disconnected' aspetta 35s prima di chiudere (rete instabile, switch wifi/4G,
    //    galleria → il client può tornare e fare restartIce);
    //  - su DTLS 'failed' o 'closed' chiude subito;
    //  - rimuove i listener su close per evitare memory leak.
    let iceDisconnectTimer = null;

    // ⭐ Diagnostica: nome peer + direzione per i log [CONN]
    const _peerName = () => this.getPeer(socketId)?.displayName || socketId;
    const _dir = () => transport.appData?.direction || (isScreenShare ? 'screen' : '?');

    // Tuple selezionato: proto UDP/TCP + IP remoto. Se remoteIp è il coturn → RELAY
    // (rete restrittiva / NAT simmetrico → connessione più fragile e lenta).
    transport.on('iceselectedtuplechange', (t) => {
      connlog.log(this.id, _peerName(), 'tuple', { dir: _dir(), proto: t?.protocol, remote: t?.remoteIp ? `${t.remoteIp}:${t.remotePort}` : undefined });
    });

    transport.on('icestatechange', (state) => {
      connlog.log(this.id, _peerName(), 'ice', { dir: _dir(), state });
      if (state === 'disconnected') {
        iceDisconnectTimer = setTimeout(() => {
          iceDisconnectTimer = null;
          if (transport.iceState === 'disconnected' && !transport.closed) {
            console.warn(`[Room ${this.id}] ICE disconnesso 35s, chiudo transport ${transport.id}`);
            transport.close();
          }
        }, 35000);
      } else {
        if (iceDisconnectTimer) {
          clearTimeout(iceDisconnectTimer);
          iceDisconnectTimer = null;
        }
        if (state === 'closed' && !transport.closed) transport.close();
      }
    });

    transport.on('dtlsstatechange', (s) => {
      if (s !== 'connecting' && s !== 'connected') connlog.log(this.id, _peerName(), 'dtls', { dir: _dir(), state: s });
      if (s === 'failed' || s === 'closed') {
        if (!transport.closed) transport.close();
      }
    });

    // ⭐ FIX: mediasoup NON emette 'close' sul transport a livello app — solo
    // su transport.observer. Il vecchio transport.on('close') era codice morto:
    // timer ICE mai clearato, listener mai rimossi, Map del peer mai pulita.
    transport.observer.on('close', () => {
      if (iceDisconnectTimer) { clearTimeout(iceDisconnectTimer); iceDisconnectTimer = null; }
      transport.removeAllListeners();
      const p = this.getPeer(socketId);
      if (p) p.transports.delete(transport.id);
    });

    const peer = this.getPeer(socketId);
    if (peer) peer.addTransport(transport);

    return {
      transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      },
    };
  }

  getTransport(socketId, transportId) {
    return this.getPeer(socketId)?.transports.get(transportId);
  }

  // ⭐ FIX BUG 5: ICE restart su transport esistente.
  // Permette al client di rinegoziare ICE quando il transport va in 'disconnected'
  // (switch wifi/4G, rete instabile) senza dover ri-joinare la stanza.
  async restartIce(socketId, transportId) {
    const transport = this.getTransport(socketId, transportId);
    if (!transport) throw new Error('Transport non trovato');
    if (transport.closed) throw new Error('Transport chiuso');
    return await transport.restartIce();
  }

  // ─── Producers ──────────────────────────────────────────────────────────────

  async createProducer(socketId, transportId, rtpParameters, kind, appData) {
    const transport = this.getTransport(socketId, transportId);
    if (!transport) throw new Error('Transport non trovato');

    const producer = await transport.produce({ kind, rtpParameters, appData });
    const peer = this.getPeer(socketId);
    peer.addProducer(producer);

    if (appData?.mediaType === 'screen') peer.isScreenSharing = true;

    // ⭐ FIX BUG 9: aggancia ogni producer audio (NON quello dello screen share audio,
    // se mai lo aggiungerai) all'audioLevelObserver per la dominant-speaker detection.
    if (kind === 'audio' && appData?.mediaType === 'audio' && this.audioLevelObserver) {
      try { await this.audioLevelObserver.addProducer({ producerId: producer.id }); }
      catch (e) { console.warn('[Room] addProducer to ALO fallito:', e.message); }
    }

    // ⭐ Indicatore qualità rete: mediasoup assegna a ogni producer uno score
    // 0-10 (qualità dell'UPLINK del peer). Lo mappiamo su 3 livelli e lo
    // broadcastiamo alla stanza SOLO quando il livello cambia (throttle 3s).
    if (appData?.mediaType !== 'screen') {
      producer.on('score', (scores) => {
        const worst = Math.min(...scores.map(s => s.score).filter(n => typeof n === 'number'));
        if (!isFinite(worst)) return;
        const level = worst >= 7 ? 3 : worst >= 4 ? 2 : 1; // 3=buona 2=media 1=scarsa
        const now = Date.now();
        if (!peer._netQ) peer._netQ = { level: 0, ts: 0 };
        if (peer._netQ.level === level || now - peer._netQ.ts < 3000) return;
        peer._netQ = { level, ts: now };
        this.broadcast('peerNetQuality', { peerId: peer.id, level, score: worst });
      });
    }

    producer.on('transportclose', () => {
      // ⭐ FIX BUG 9: rimuovi dall'observer prima della chiusura.
      // Promise: in mediasoup recente removeProducer ritorna Promise. Se il producer
      // è già stato rimosso (es. la stanza si sta chiudendo, observer già closed),
      // mediasoup rejecta con "Producer not found" → unhandled rejection → process crash.
      // Fix: catch sia sync che async, e skip se observer/producer già closed.
      this._safeRemoveFromAlo(producer);
      producer.close();
      peer.removeProducer(producer.id);
      if (appData?.mediaType === 'screen') { peer.isScreenSharing = false; this.clearSurface(socketId); }
    });

    return producer;
  }

  // ⭐ FIX BUG 9 hotfix: helper centralizzato per rimuovere un producer dall'observer
  // in modo safe. Cattura sia errori sync che Promise rejection (mediasoup 3.13+
  // ritorna Promise). Skippa se observer chiuso o producer già rimosso.
  _safeRemoveFromAlo(producer) {
    if (!producer || producer.kind !== 'audio') return;
    if (!this.audioLevelObserver || this.audioLevelObserver.closed) return;
    try {
      const result = this.audioLevelObserver.removeProducer({ producerId: producer.id });
      // Se è una Promise, attaccaci .catch() per evitare unhandled rejection
      if (result && typeof result.then === 'function') {
        result.catch((e) => {
          // "Producer not found" è ok: è già stato rimosso dall'observer
          if (!/not found/i.test(e?.message || '')) {
            console.warn('[Room] removeProducer ALO async error:', e.message);
          }
        });
      }
    } catch (e) {
      if (!/not found/i.test(e?.message || '')) {
        console.warn('[Room] removeProducer ALO sync error:', e.message);
      }
    }
  }

  closeProducer(socketId, producerId) {
    const peer = this.getPeer(socketId); if (!peer) return;
    const producer = peer.producers.get(producerId); if (!producer) return;
    // ⭐ FIX BUG 9: usa l'helper safe (gestisce Promise + producer già rimossi)
    this._safeRemoveFromAlo(producer);
    producer.close();
    peer.removeProducer(producerId);
    if (producer.appData?.mediaType === 'screen') { peer.isScreenSharing = false; this.clearSurface(socketId); }
  }

  // ─── Consumers ──────────────────────────────────────────────────────────────

  async createConsumer(consumerSocketId, producerPeerId, producerId, rtpCapabilities) {
    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume: RTP capabilities incompatibili');
    }

    const consumerPeer = this.getPeer(consumerSocketId);
    if (!consumerPeer) throw new Error('Consumer peer non trovato');

    // Cerca il transport recv (direction impostata da index.js dopo la creazione)
    let recvTransport = null;
    consumerPeer.transports.forEach((t) => {
      if (t.appData?.direction === 'recv') recvTransport = t;
    });
    if (!recvTransport) throw new Error('Recv transport non trovato');

    // ⭐ FIX guard screen-audio: senza appData il consumer non sa se sta
    // consumando il microfono o l'audio dello schermo, e la pausa dell'uno
    // finiva per mutare l'altro. Copiamo l'appData del producer originale.
    const _srcProducer = this.getPeer(producerPeerId)?.producers.get(producerId);
    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      appData: { ..._srcProducer?.appData, producerPeerId },
      // ⭐ FIX BUG 1+2: ignoreDtx + enableRtx.
      // Il producer audio attiva opusDtx (non trasmette in silenzio): senza ignoreDtx
      // sul consumer, Firefox/Safari (e Chrome con OPUS) tagliano l'audio quando
      // l'utente riprende a parlare → questa è la causa principale dei "non sento".
      // enableRtx attiva il NACK per OPUS: recovery automatico dei pacchetti audio
      // persi su rete con packet loss. Senza, anche l'1-2% di loss rende l'audio
      // scattoso/incomprensibile.
      enableRtx: true,
      ignoreDtx: true,
      paused: true, // il client fa resume quando è pronto
    });

    consumerPeer.addConsumer(consumer);

    // ⭐ FIX mute-fantasma: mediasoup-client NON emette mai 'producerpause' /
    // 'producerresume' (esistono solo sul Consumer SERVER-side). Il fix
    // "mute-decoupling" lato client era quindi codice morto: lo stato mute
    // dipendeva solo da 'peerMediaState', che è rate-limited e droppabile —
    // e una volta disallineato restava appiccicato finché l'utente non
    // toccava il microfono. Qui inoltriamo gli eventi VERI al client.
    const _mt = _srcProducer?.appData?.mediaType || consumer.appData?.mediaType
                || (consumer.kind === 'audio' ? 'audio' : 'video');
    // ⭐ FIX R11: prima era un broadcast a TUTTA la stanza per OGNI consumer
    // → con N peer un singolo mute generava (N-1)×N eventi. Ora va solo al
    // socket che possiede questo consumer: stessa informazione, fan-out lineare.
    const _emitState = (paused) => {
      const payload = { peerId: producerPeerId, kind: consumer.kind, mediaType: _mt, paused };
      if (this.onEmitTo) this.onEmitTo(consumerSocketId, 'consumerProducerState', payload);
      else this.onBroadcast?.('consumerProducerState', payload);
    };
    consumer.on('producerpause', () => _emitState(true));
    consumer.on('producerresume', () => _emitState(false));

    // ⭐ FIX BUG 4: per simulcast video, parti dal layer medio (r1, 540p).
    // Senza setPreferredLayers, mediasoup consegna il layer più alto disponibile
    // (1080p) anche su mobile in 4G, sprecando banda. r1+t2 è un buon compromesso
    // di partenza: r0=270p/150kbps, r1=540p/600kbps, r2=1080p/2Mbps.
    if (consumer.kind === 'video' && consumer.type === 'simulcast') {
      try {
        await consumer.setPreferredLayers({ spatialLayer: 1, temporalLayer: 2 });
      } catch (e) {
        console.warn('[Room] setPreferredLayers fallito:', e.message);
      }
    }

    consumer.on('transportclose', () => consumerPeer.removeConsumer(consumer.id));
    consumer.on('producerclose', () => consumerPeer.removeConsumer(consumer.id));

    return {
      consumer,
      params: {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        producerPeerId,
        appData: consumer.appData,
      },
    };
  }

  // ─── Annotazioni ─────────────────────────────────────────────────────────────
  addAnnotation(stroke) {
    const list = this.annotations.get(stroke.sid) || [];
    const { live, append, ...rest } = stroke;
    // 'append' = seguito di uno stroke lungo già salvato (stesso id): unisci i punti
    const prev = append ? list.find(s => s.id === rest.id && s.peerId === rest.peerId) : null;
    if (prev) { if (prev.pts.length + rest.pts.length <= 4000) prev.pts.push(...rest.pts); }
    else list.push(rest);
    while (list.length > 1500) list.shift();
    this.annotations.set(stroke.sid, list);
  }
  getAnnotations(sid) { return this.annotations.get(sid) || []; }
  undoAnnotation(sid, peerId) {
    const list = this.annotations.get(sid);
    if (!list) return false;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].peerId === peerId) { list.splice(i, 1); return true; }
    }
    return false;
  }
  clearAnnotations(sid) { this.annotations.set(sid, []); }
  clearSurface(sid) { this.annotations.delete(sid); this.annOpen.delete(sid); }
  annotationsSnapshot() {
    const out = {};
    for (const [sid, list] of this.annotations) if (list.length) out[sid] = list;
    return out;
  }

  // ─── Chat ────────────────────────────────────────────────────────────────────

  addChatMessage(peerId, displayName, message, type = 'text') {
    const msg = { id: uuidv4(), peerId, displayName, message, type, timestamp: Date.now() };
    this.chatHistory.push(msg);
    if (this.chatHistory.length > 200) this.chatHistory.shift();
    return msg;
  }

  // ⭐ FIX BUG 9: helper per trovare il peer dato un producerId.
  // Serve a index.js per inoltrare gli eventi di audioLevelObserver ai client.
  getPeerByProducerId(producerId) {
    for (const peer of this.peers.values()) {
      if (peer.producers.has(producerId)) return peer;
    }
    return null;
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  close() {
    this.peers.forEach((p) => p.close());
    // ⭐ FIX BUG 9: chiudi anche l'observer
    if (this.audioLevelObserver && !this.audioLevelObserver.closed) {
      try { this.audioLevelObserver.close(); } catch {}
    }
    this.router.close();
  }

  toJSON() {
    return {
      id: this.id,
      peers: this.peers.size,
      createdAt: this.createdAt,
    };
  }
}

module.exports = Room;