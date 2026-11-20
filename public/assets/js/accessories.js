'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   TIDITALK 1.9.0 — Accessori personali negli effetti 3D
   ───────────────────────────────────────────────────────────────────────────
   • «Immagine»: un PNG (meglio con lo sfondo trasparente: il logo dell'azienda,
     uno sticker, una scritta) indossato sulla testa. Posizione: sopra la testa,
     fronte, occhi, naso, bocca, guancia; grandezza − / +.
   • «Modello 3D»: un file .glb dal computer o da un link https (il sito deve
     permetterlo: CORS). Si adatta da solo alla testa (cappello sopra la testa,
     occhiali sugli occhi…), con le stesse posizioni e grandezze.
   • Restano in questo browser (IndexedDB), fino a 12: niente va al server.
     Gli altri vedono l'accessorio nel tuo video come gli altri effetti 3D.
   • Come entra nel motore: ogni accessorio è un effetto con id «custom-…»
     registrato in FaceEffects3D.byId con type 'custom' e una build(THREE, h);
     faceAR.js setEffect lo monta come gli altri. applyFaceEffect(id) di
     room.js fa il resto (stessa coda, stessi controlli).
   • Interfaccia: sezione «I tuoi accessori» in cima alla scheda Effetti 3D
     (sopra la griglia, che room.js può riempire di nuovo).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const MAX_ITEMS = 12, MAX_IMG = 8 * 1024 * 1024, MAX_GLB = 25 * 1024 * 1024;
  const DB = 'tdt-accessories', STORE = 'items';
  const PLACES = [
    ['top', 'Sopra la testa'], ['forehead', 'Fronte'], ['eyes', 'Occhi'], ['nose', 'Naso'], ['mouth', 'Bocca'], ['cheek', 'Guancia'],
  ];
  const SIZES = [0.6, 0.75, 0.88, 1, 1.15, 1.32, 1.5];
  const svg = (d, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    img: svg('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5.5-5 3.5 3 3-2.5L21 18"/><path d="M18 2.5v4M16 4.5h4"/>'),
    glb: svg('<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/>'),
    link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
    x: svg('<path d="M7 7l10 10M17 7L7 17"/>', 14),
    minus: svg('<path d="M6 12h12"/>', 16), plus: svg('<path d="M12 6v12M6 12h12"/>', 16),
    up: svg('<path d="M12 18V6M7 11l5-5 5 5"/>', 16), down: svg('<path d="M12 6v12M7 13l5 5 5-5"/>', 16),
    top: svg('<circle cx="12" cy="14" r="6"/><path d="M7 7.5h10l-1.5-4h-7z" fill="currentColor"/>'),
    forehead: svg('<circle cx="12" cy="13" r="7"/><rect x="8.5" y="7.5" width="7" height="3" rx="1" fill="currentColor"/>'),
    eyes: svg('<circle cx="12" cy="12" r="8"/><rect x="6.5" y="9.5" width="4.5" height="3" rx="1" fill="currentColor"/><rect x="13" y="9.5" width="4.5" height="3" rx="1" fill="currentColor"/>'),
    nose: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="13" r="2" fill="currentColor"/>'),
    mouth: svg('<circle cx="12" cy="12" r="8"/><rect x="9" y="14.5" width="6" height="2.6" rx="1.2" fill="currentColor"/>'),
    cheek: svg('<circle cx="12" cy="12" r="8"/><circle cx="16" cy="13.5" r="2" fill="currentColor"/>'),
  };

  // ── Archivio nel browser ─────────────────────────────────────────────────
  let items = [];            // { id, kind:'img'|'glb', name, blob, place, size, url (object URL) }
  const idb = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res) => {
        try {
          const r = indexedDB.open(DB, 1);
          r.onupgradeneeded = () => { try { r.result.createObjectStore(STORE, { keyPath: 'id' }); } catch (_) { } };
          r.onsuccess = () => { this.db = r.result; res(this.db); };
          r.onerror = () => res(null);
        } catch (_) { res(null); }
      });
    },
    async all() {
      const db = await this.open(); if (!db) return [];
      return new Promise((res) => { try { const q = db.transaction(STORE).objectStore(STORE).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch (_) { res([]); } });
    },
    async put(it) {
      const db = await this.open(); if (!db) return;
      const { url, ...rec } = it;
      try { db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec); } catch (_) { }
    },
    async del(id) {
      const db = await this.open(); if (!db) return;
      try { db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); } catch (_) { }
    },
  };
  const uid = () => 'custom-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const urlOf = (it) => it.url || (it.url = URL.createObjectURL(it.blob));

  // ── Dove va sulla testa (spazio del viso del motore, in cm) ──────────────
  function anchor(h, place) {
    const L = (i) => h.lm(i);
    const C = { c: [0, 5.6, -4.8], r: [7.7, 7.7, 8.7] };   // calotta del cranio (HEAD.cranium)
    switch (place) {
      case 'forehead': { const f = L(10), b = L(9); return { x: 0, y: (f.y + b.y) / 2 - 0.4, z: Math.max(f.z, b.z) + 0.55, rx: -16, ry: 0, w: 8.5 }; }
      case 'eyes': { const a = L(33), b = L(263), n = L(168); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 0.15, z: n.z + 1.25, rx: 0, ry: 0, w: a.distanceTo(b) * 1.5 }; }
      case 'nose': { const n = L(1); return { x: n.x, y: n.y, z: n.z + 0.7, rx: 0, ry: 0, w: 4.2 }; }
      case 'mouth': { const t = L(13), b = L(14), l = L(61), r = L(291); return { x: (l.x + r.x) / 2, y: (t.y + b.y) / 2 + 0.1, z: Math.max(t.z, b.z) + 0.6, rx: 0, ry: 0, w: l.distanceTo(r) * 1.35 }; }
      case 'cheek': { const c = L(280); return { x: c.x + 0.4, y: c.y - 0.2, z: c.z + 0.5, rx: 0, ry: 36, w: 4.6 }; }
      default: return { x: 0, y: C.c[1] + C.r[1] - 1.3, z: C.c[2] + 2.6, rx: -8, ry: 0, w: 17, top: true };
    }
  }

  // punto più sporgente del viso dentro un rettangolo (x0..x1, y0..y1): il foglio va davanti a
  // quello, altrimenti naso o sopracciglia lo «bucano». Con R il foglio è curvo (bordi indietro).
  function faceZ(h, x0, x1, y0, y1, R) {
    const P = h.face && h.face.pos; if (!P) return -Infinity;
    const cx = (x0 + x1) / 2; let m = -Infinity;
    for (let i = 0; i + 2 < P.length; i += 3) {
      const x = P[i], y = P[i + 1]; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const z = P[i + 2] + (R ? ((x - cx) * (x - cx)) / (2 * R) : 0);
      if (z > m) m = z;
    }
    return m;
  }
  const DY = 0.7;   // un passo di «Altezza», in cm

  // immagine: un foglio con l'immagine (trasparenze comprese), colori come nel file
  function buildImage(it) {
    return async (THREE, h) => {
      const tex = await new THREE.TextureLoader().loadAsync(urlOf(it));
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const iw = tex.image.width || 1, ih = tex.image.height || 1, ar = iw / ih;
      const a = anchor(h, it.place), k = SIZES[it.size] || 1;
      const w = a.w * k * (ar < 1 ? Math.max(0.55, ar) : 1), hh = w / ar;
      // colori esatti del file (un logo deve restare del suo colore), niente luci della scena
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat);
      const g = new THREE.Group(); g.name = 'customImage';
      const R = it.place === 'top' ? 26 : it.place === 'forehead' ? 11 : 0;
      // leggera curvatura sulla fronte, così non sembra un foglio piatto incollato
      if (R) {
        const pos = m.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, -(x * x) / (2 * R)); }
        pos.needsUpdate = true; m.geometry.computeVertexNormals();
      }
      // sopra la testa: il bordo di sotto appoggiato alla calotta; altrove davanti al viso
      const cy = (a.top ? a.y + hh / 2 : a.y) + (it.dy || 0) * DY;
      let z = a.z;
      if (!a.top && it.place !== 'cheek') z = Math.max(z, faceZ(h, a.x - w / 2, a.x + w / 2, cy - hh / 2, cy + hh / 2, R) + 0.35);
      m.position.set(a.x, cy, z);
      m.rotation.set(a.rx * Math.PI / 180, a.ry * Math.PI / 180, 0);
      // davanti al viso: sempre visibile sopra la maschera del viso del motore (che segue il viso
      // vero e sporge più del viso medio: sopracciglia e naso «bucavano» l'immagine)
      if (!a.top && it.place !== 'cheek') { mat.depthTest = false; m.renderOrder = 20; }
      g.add(m);
      return g;
    };
  }

  // modello .glb: si centra, si porta alla misura giusta per la posizione scelta
  function buildGlb(it) {
    return async (THREE, h) => {
      const gltf = await new h.GLTFLoader().loadAsync(urlOf(it));
      const model = gltf.scene;
      model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      const box = new THREE.Box3().setFromObject(model), sz = new THREE.Vector3(), c = new THREE.Vector3();
      box.getSize(sz); box.getCenter(c);
      const a = anchor(h, it.place), k = SIZES[it.size] || 1;
      const wide = Math.max(sz.x, 1e-6);
      // cappelli larghi e bassi (falda: pescatore, cowboy, sombrero) vanno più grandi e più giù:
      // la falda scende sotto l'apertura che calza sulla testa
      const flat = a.top ? Math.max(0, Math.min(1, (sz.x / Math.max(sz.y, 1e-6) - 1.6) / 1.0)) : 0;
      const target = (a.top ? 19 * (1 + 0.65 * flat) : it.place === 'eyes' ? Math.max(14, a.w * 1.1) : a.w) * k;
      const s = target / wide;
      const wrap = new THREE.Group();
      model.position.set(-c.x, a.top ? -box.min.y : -c.y, -c.z);
      wrap.add(model);
      wrap.scale.setScalar(s);
      // sopra la testa: il fondo all'altezza della fronte, centrato sul cranio (come un cappello
      // vero, la calotta ne nasconde l'interno); altrimenti davanti al punto scelto
      const dy = (it.dy || 0) * DY;
      if (a.top) { const f = h.lm(10); wrap.position.set(0, f.y - 0.6 - 3.8 * flat + dy, -3.9); }
      else {
        // occhiali (con le stanghette) e oggetti profondi: il davanti all'altezza del viso, il resto
        // dietro (la testa lo nasconde); oggetti piccoli (un naso, un fiocco): appoggiati davanti
        const deep = it.place === 'eyes' || sz.z > sz.x * 0.6;
        wrap.position.set(a.x, a.y + dy, deep ? a.z + 0.3 - (sz.z * s) / 2 : a.z + (sz.z * s) / 2 - 0.3);
      }
      wrap.rotation.set(a.top ? 0 : a.rx * Math.PI / 180, a.ry * Math.PI / 180, 0);
      const g = new THREE.Group(); g.name = 'customGlb'; g.add(wrap);
      return g;
    };
  }

  function register(it) {
    const cat = window.FaceEffects3D || (window.FaceEffects3D = { sections: [], byId: {} });
    cat.byId = cat.byId || {};
    cat.byId[it.id] = { id: it.id, type: 'custom', label: it.name, build: it.kind === 'glb' ? buildGlb(it) : buildImage(it) };
  }

  // ── Aggiunta ─────────────────────────────────────────────────────────────
  async function add(kind, blob, name) {
    if (!blob || !blob.size) throw new Error(T('File vuoto'));
    if (kind === 'img' && blob.size > MAX_IMG) throw new Error(T('Immagine troppo grande (max 8 MB)'));
    if (kind === 'glb' && blob.size > MAX_GLB) throw new Error(T('Modello troppo grande (max 25 MB)'));
    // controllo del contenuto, non del nome: glTF binario inizia con «glTF», le immagini coi loro byte
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const ascii = (a, b) => String.fromCharCode(...head.slice(a, b));
    if (kind === 'glb' && ascii(0, 4) !== 'glTF') throw new Error(T('Non è un modello .glb'));
    if (kind === 'img') {
      const png = head[0] === 0x89 && ascii(1, 4) === 'PNG', jpg = head[0] === 0xFF && head[1] === 0xD8, webp = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
      if (!png && !jpg && !webp) throw new Error(T('Usa un\'immagine PNG, JPG o WebP'));
    }
    const it = { id: uid(), kind, name: String(name || (kind === 'glb' ? 'Modello' : 'Immagine')).slice(0, 40), blob, place: kind === 'glb' ? 'top' : 'forehead', size: 3, at: Date.now() };
    items.unshift(it);
    while (items.length > MAX_ITEMS) { const old = items.pop(); idb.del(old.id); if (old.url) URL.revokeObjectURL(old.url); }
    register(it);
    await idb.put(it);
    paint();
    await wear(it.id);
    return it;
  }
  async function addFromLink(url) {
    let u;
    try { u = new URL(url); } catch (_) { throw new Error(T('Link non valido')); }
    if (u.protocol !== 'https:') throw new Error(T('Serve un link https'));
    let r;
    try { r = await fetch(u.href, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); }
    catch (_) { throw new Error(T('Quel sito non permette di scaricare il modello da qui: scaricalo e caricalo dal computer')); }
    if (!r.ok) throw new Error(T('Download non riuscito') + ' (' + r.status + ')');
    const len = +r.headers.get('content-length') || 0;
    if (len > MAX_GLB) throw new Error(T('Modello troppo grande (max 25 MB)'));
    const blob = await r.blob();
    const name = decodeURIComponent((u.pathname.split('/').pop() || 'modello').replace(/\.glb$/i, ''));
    return add('glb', blob, name);
  }
  async function remove(id) {
    const i = items.findIndex(x => x.id === id); if (i < 0) return;
    const [it] = items.splice(i, 1);
    if (current() === id) { try { await applyFaceEffect('none'); } catch (_) { } } // eslint-disable-line no-undef
    if (window.FaceEffects3D?.byId) delete window.FaceEffects3D.byId[id];
    idb.del(id);
    if (it.url) URL.revokeObjectURL(it.url);
    paint();
  }
  const current = () => (typeof _currentFaceEffectId !== 'undefined' ? _currentFaceEffectId : null); // eslint-disable-line no-undef

  async function wear(id) {
    if (typeof applyFaceEffect !== 'function') return; // eslint-disable-line no-undef
    sec?.classList.add('busy');
    try { await applyFaceEffect(id); } catch (_) { } // eslint-disable-line no-undef
    sec?.classList.remove('busy');
    try { if (typeof _fxSyncActive === 'function') _fxSyncActive(); } catch (_) { } // eslint-disable-line no-undef
    paint();
  }
  async function update(id, patch) {
    const it = items.find(x => x.id === id); if (!it) return;
    Object.assign(it, patch);
    register(it);
    idb.put(it);
    paint();
    if (current() === id) await wear(id);
  }

  // ── Interfaccia ──────────────────────────────────────────────────────────
  let sec = null, fileImg = null, fileGlb = null;
  function mount() {
    const grid = document.getElementById('effects3dPickerGrid');
    if (!grid || !grid.parentNode) return false;
    if (!sec) {
      sec = document.createElement('div');
      sec.className = 'acc-sec';
      sec.setAttribute('data-i18n-skip', '');
      sec.innerHTML = `
        <h4 class="fx-h">${T('I tuoi accessori')}</h4>
        <div class="acc-add">
          <button type="button" class="acc-add-btn" data-act="img">${ICON.img}<span>${T('Immagine')}</span></button>
          <button type="button" class="acc-add-btn" data-act="glb">${ICON.glb}<span>${T('Modello 3D')}</span></button>
          <button type="button" class="acc-add-btn" data-act="link">${ICON.link}<span>${T('Da un link')}</span></button>
        </div>
        <form class="acc-link hidden" novalidate>
          <input type="url" inputmode="url" placeholder="https://…/modello.glb" aria-label="${T('Link del modello .glb')}" maxlength="500">
          <button type="submit" class="acc-link-go">${T('Aggiungi')}</button>
        </form>
        <div class="acc-list"></div>
        <div class="acc-tune hidden"></div>
        <div class="fx-hint acc-hint">${T('Un logo o uno sticker in PNG con lo sfondo trasparente, oppure un modello .glb. Restano solo in questo browser. Nel tuo riquadro le scritte si vedono allo specchio: gli altri le vedono dritte.')}</div>`;
      fileImg = document.createElement('input'); fileImg.type = 'file'; fileImg.accept = 'image/png,image/jpeg,image/webp'; fileImg.hidden = true;
      fileGlb = document.createElement('input'); fileGlb.type = 'file'; fileGlb.accept = '.glb,model/gltf-binary'; fileGlb.hidden = true;
      sec.append(fileImg, fileGlb);
      const pick = (input, kind) => input.addEventListener('change', async () => {
        const f = input.files && input.files[0]; input.value = '';
        if (!f) return;
        try { await add(kind, f, f.name.replace(/\.[^.]+$/, '')); }
        catch (e) { window.showToast?.(e.message || String(e), 4000); }
      });
      pick(fileImg, 'img'); pick(fileGlb, 'glb');
      sec.querySelector('.acc-add').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'img') fileImg.click();
        else if (b.dataset.act === 'glb') fileGlb.click();
        else { const f = sec.querySelector('.acc-link'); f.classList.toggle('hidden'); if (!f.classList.contains('hidden')) f.querySelector('input').focus(); }
      });
      sec.querySelector('.acc-link').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;   // dopo un await currentTarget è già null
        const inp = form.querySelector('input'), go = form.querySelector('button');
        const v = inp.value.trim(); if (!v) { inp.focus(); return; }
        go.disabled = true;
        try { await addFromLink(v); inp.value = ''; form.classList.add('hidden'); }
        catch (err) { window.showToast?.(err.message || String(err), 5000); }
        go.disabled = false;
      });
      // le scorciatoie della stanza non scattano scrivendo il link
      sec.addEventListener('keydown', (e) => e.stopPropagation());
    }
    if (!sec.isConnected) { grid.parentNode.insertBefore(sec, grid); return 'inserted'; }
    return 'ok';
  }

  function paint() {
    if (!sec) return;
    const list = sec.querySelector('.acc-list'), cur = current();
    list.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('div');
      b.className = 'acc-item' + (cur === it.id ? ' on' : '');
      const wearBtn = document.createElement('button');
      wearBtn.type = 'button'; wearBtn.className = 'acc-wear';
      wearBtn.setAttribute('aria-pressed', cur === it.id ? 'true' : 'false');
      wearBtn.setAttribute('aria-label', it.name);
      wearBtn.dataset.tip = it.name;
      if (it.kind === 'img') { const im = document.createElement('img'); im.src = urlOf(it); im.alt = ''; wearBtn.appendChild(im); }
      else wearBtn.insertAdjacentHTML('beforeend', `<span class="acc-glb">${ICON.glb}</span>`);
      const nm = document.createElement('span'); nm.className = 'acc-name'; nm.textContent = it.name; nm.translate = false;
      wearBtn.appendChild(nm);
      wearBtn.addEventListener('click', () => wear(cur === it.id ? 'none' : it.id));
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'acc-del'; del.innerHTML = ICON.x;
      del.setAttribute('aria-label', T('Togli dagli accessori') + ': ' + it.name); del.dataset.tip = T('Togli dagli accessori');
      del.addEventListener('click', (e) => { e.stopPropagation(); remove(it.id); });
      b.append(wearBtn, del);
      list.appendChild(b);
    }
    // regolazioni dell'accessorio che hai addosso
    const tune = sec.querySelector('.acc-tune'), it = items.find(x => x.id === cur);
    tune.classList.toggle('hidden', !it);
    if (!it) { tune.innerHTML = ''; return; }
    tune.innerHTML = `
      <div class="acc-tune-l">${T('Posizione')}</div>
      <div class="acc-places" role="radiogroup" aria-label="${T('Posizione')}">${PLACES.map(([k, l]) => `<button type="button" role="radio" class="acc-place${it.place === k ? ' on' : ''}" data-place="${k}" aria-checked="${it.place === k}" data-tip="${T(l)}" aria-label="${T(l)}">${ICON[k]}</button>`).join('')}</div>
      <div class="acc-tune-row">
        <div class="acc-tune-col">
          <div class="acc-tune-l">${T('Grandezza')}</div>
          <div class="acc-size">
            <button type="button" class="acc-size-btn" data-d="-1" aria-label="${T('Più piccolo')}" data-tip="${T('Più piccolo')}" ${it.size <= 0 ? 'disabled' : ''}>${ICON.minus}</button>
            <span class="acc-size-v" translate="no">${Math.round((SIZES[it.size] || 1) * 100)}%</span>
            <button type="button" class="acc-size-btn" data-d="1" aria-label="${T('Più grande')}" data-tip="${T('Più grande')}" ${it.size >= SIZES.length - 1 ? 'disabled' : ''}>${ICON.plus}</button>
          </div>
        </div>
        <div class="acc-tune-col">
          <div class="acc-tune-l">${T('Altezza')}</div>
          <div class="acc-size">
            <button type="button" class="acc-dy-btn acc-size-btn" data-d="-1" aria-label="${T('Più in basso')}" data-tip="${T('Più in basso')}" ${(it.dy || 0) <= -6 ? 'disabled' : ''}>${ICON.down}</button>
            <span class="acc-size-v" translate="no">${(it.dy || 0) > 0 ? '+' : ''}${it.dy || 0}</span>
            <button type="button" class="acc-dy-btn acc-size-btn" data-d="1" aria-label="${T('Più in alto')}" data-tip="${T('Più in alto')}" ${(it.dy || 0) >= 6 ? 'disabled' : ''}>${ICON.up}</button>
          </div>
        </div>
      </div>`;
    tune.querySelectorAll('.acc-place').forEach(b => b.addEventListener('click', () => update(it.id, { place: b.dataset.place, dy: 0 })));
    tune.querySelectorAll('.acc-size-btn:not(.acc-dy-btn)').forEach(b => b.addEventListener('click', () => update(it.id, { size: Math.max(0, Math.min(SIZES.length - 1, it.size + (+b.dataset.d))) })));
    tune.querySelectorAll('.acc-dy-btn').forEach(b => b.addEventListener('click', () => update(it.id, { dy: Math.max(-6, Math.min(6, (it.dy || 0) + (+b.dataset.d))) })));
  }

  // ── Avvio ────────────────────────────────────────────────────────────────
  async function start() {
    try {
      const recs = await idb.all();
      items = recs.filter(r => r && r.id && r.blob && (r.kind === 'img' || r.kind === 'glb')).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, MAX_ITEMS);
      items.forEach(register);
    } catch (_) { items = []; }
    // la sezione sta sopra la griglia (fuori da lei): room.js la può riempire di nuovo
    // senza toccarla; se qualcuno la stacca la si rimette
    const tryMount = () => { const r = mount(); if (r === 'inserted') paint(); return r; };
    if (!tryMount()) {
      const mo = new MutationObserver(() => { if (tryMount()) { mo.disconnect(); watch(); } });
      mo.observe(document.body, { childList: true, subtree: true });
    } else watch();
    function watch() {
      const parent = document.getElementById('effects3dPickerGrid')?.parentNode;
      if (parent) new MutationObserver(() => tryMount()).observe(parent, { childList: true });
    }
    // l'effetto acceso può cambiare anche da fuori (griglia, «Nessuno»): si ridisegna
    document.addEventListener('click', (e) => { if (e.target.closest?.('#fxPanel')) setTimeout(paint, 400); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.TdtAccessories = { add, addFromLink, remove, wear, update, list: () => items.map(({ blob, ...r }) => r), PLACES };
})();
