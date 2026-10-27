// Teste dai modelli gratuiti (glb/): caricamento comune (stessi materiali di prima) + aggancio di occhi e bocca.
// I file che iniziano per "_" non vanno nel catalogo.
// P = { c: centro del modello (unità del file), s: scala → cm, p: posizione sulla testa canonica, r: rotazione (gradi),
//       k: [kx, ky, kz] scala in più per asse (facoltativa, 1.8.9: fascia ovale come una testa vera) }
// O = opzioni dei materiali (come prima): env, rough, metal, tint, color, matColor, hideMats, cards, alphaTest, spec, clip, jaw, jawAngle

export async function loadHead(THREE, h, url, P, O, name) {
  const gltf = await new h.GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  model.position.set(-P.c[0], -P.c[1], -P.c[2]);
  const wrap = new THREE.Group();
  wrap.add(model);
  wrap.scale.setScalar(P.s);
  if (P.k) wrap.scale.set(P.s * P.k[0], P.s * P.k[1], P.s * P.k[2]);   // 1.8.9: fascia ovale come la testa (scala per asse)
  wrap.position.set(P.p[0], P.p[1], P.p[2]);
  wrap.rotation.set(P.r[0] * Math.PI / 180, P.r[1] * Math.PI / 180, P.r[2] * Math.PI / 180);
  const g = new THREE.Group();
  g.name = name || 'glbHead';
  g.add(wrap);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    // normali lisce con lo spigolo (niente facce piatte sui modelli low poly; gli spigoli veri restano)
    if (O.crease && !o.isSkinnedMesh && h.BufferGeometryUtils && h.BufferGeometryUtils.toCreasedNormals) {
      const g0 = o.geometry; o.geometry = h.BufferGeometryUtils.toCreasedNormals(g0, O.crease * Math.PI / 180); g0.dispose();
    }
    if (O.clearcoat) {     // vernice (caschi, plastica dura): base opaca + strato lucido sottile
      const swap = (m) => new THREE.MeshPhysicalMaterial({ name: m.name, color: m.color, map: m.map, normalMap: m.normalMap, roughness: m.roughness,
        metalness: 0, side: m.side, transparent: m.transparent, opacity: m.opacity, clearcoat: O.clearcoat, clearcoatRoughness: 0.25 });
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    }
    if (O.spec != null) {
      const swap = (m) => {
        const p = new THREE.MeshPhysicalMaterial({ name: m.name, color: m.color, map: m.map, normalMap: m.normalMap, alphaMap: m.alphaMap,
          roughness: m.roughness, metalness: m.metalness, side: m.side, transparent: m.transparent, opacity: m.opacity,
          alphaTest: m.alphaTest, vertexColors: m.vertexColors, specularIntensity: O.spec });
        m.dispose(); return p;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (O.hideMats && O.hideMats.some((n) => (m.name || '').toLowerCase().includes(n))) { o.visible = false; continue; }
      if (O.env != null && 'envMapIntensity' in m) m.envMapIntensity = O.env;
      if (O.color) m.color.setRGB(O.color[0], O.color[1], O.color[2], THREE.SRGBColorSpace);
      if (O.rough != null && 'roughness' in m) m.roughness = O.rough;
      if (O.metal != null && 'metalness' in m) m.metalness = O.metal;
      if (O.matColor) for (const k in O.matColor) if ((m.name || '').includes(k)) m.color.setRGB(O.matColor[k][0], O.matColor[k][1], O.matColor[k][2], THREE.SRGBColorSpace);
      if (O.matRough) for (const k in O.matRough) if ((m.name || '').includes(k)) m.roughness = O.matRough[k];
      if (O.matMetal) for (const k in O.matMetal) if ((m.name || '').includes(k)) m.metalness = O.matMetal[k];
      if (O.emissive != null && m.emissive && m.emissive.getHex() !== 0) m.emissiveIntensity = O.emissive;
      if (O.tint != null) m.color.multiplyScalar(O.tint);
      if (O.cards && m.map) { m.transparent = false; m.alphaTest = O.alphaTest || 0.35; m.depthWrite = true; m.side = THREE.DoubleSide; }
      if (m.map) m.map.anisotropy = 4;
      m.needsUpdate = true;
    }
  });
  if (O.clip && gltf.animations.length) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, O.clip) || gltf.animations[0];
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clip).play();
    g.userData.mixer = mixer;
  }
  g.updateMatrixWorld(true);
  return { g, wrap, model, gltf };
}

/** Matrice da coordinate locali della mesh (o dell'oggetto) a coordinate canoniche (cm) del gruppo dell'effetto. */
export function toCanon(THREE, g, obj) {
  g.updateMatrixWorld(true);
  return new THREE.Matrix4().copy(g.matrixWorld).invert().multiply(obj.matrixWorld);
}

/** Toglie (collassa) i triangoli della mesh per cui test(cx, cy, cz) è vero (baricentro in cm canonici).
 *  Serve a togliere occhi e bocche "dipinti" (decalcomanie) che il kit sostituisce con parti che si muovono. */
export function eraseTris(THREE, g, mesh, test) {
  const geo = mesh.geometry, pos = geo.attributes.position;
  if (!geo.index) return 0;
  const M = toCanon(THREE, g, mesh), v = new THREE.Vector3();
  const arr = geo.index.array; let n = 0;
  for (let t = 0; t < arr.length; t += 3) {
    let x = 0, y = 0, z = 0;
    for (let j = 0; j < 3; j++) { v.fromBufferAttribute(pos, arr[t + j]).applyMatrix4(M); x += v.x; y += v.y; z += v.z; }
    if (test(x / 3, y / 3, z / 3)) { arr[t + 1] = arr[t]; arr[t + 2] = arr[t]; n++; }
  }
  geo.index.needsUpdate = true;
  return n;
}

/** Mandibola come morph target (GPU): i vertici sotto la bocca ruotano attorno alla cerniera (asse x).
 *  o: { hinge: [x,y,z] cm, angle (rad, a bocca spalancata), y0: y sopra cui niente si muove, y1: y sotto cui si muove tutto,
 *       z0: z dietro cui niente si muove (cm), zs: ampiezza della sfumatura in z, drop (cm in giù in più), push (cm in avanti) }
 *  Ritorna { mesh, set(v) } oppure null. Funziona anche con le mesh "skinned". */
export function jawMorph(THREE, g, mesh, o) {
  const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count;
  const M = toCanon(THREE, g, mesh), Mi = M.clone().invert();
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  const d = new Float32Array(n * 3);
  const ca = Math.cos(o.angle), sa = Math.sin(o.angle);
  const hx = o.hinge[0], hy = o.hinge[1], hz = o.hinge[2];
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let any = 0;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    let k = sstep(o.y0, o.y1, v.y);                      // y0 > y1: sotto y1 peso 1
    if (o.z0 != null) k *= sstep(o.z0, o.z0 + (o.zs || 3), v.z);
    if (o.xMax != null) k *= 1 - sstep(o.xMax, o.xMax + (o.xs || 2), Math.abs(v.x));
    if (k <= 0) continue;
    any++;
    const y = v.y - hy, z = v.z - hz;
    // rotazione attorno all'asse x (bocca che si apre: il mento va giù e un po' indietro)
    w.set(v.x, hy + y * ca - z * sa, hz + y * sa + z * ca);   // il davanti (z>0) scende
    w.y -= (o.drop || 0); w.z += (o.push || 0);
    w.lerp(v, 1 - k).applyMatrix4(Mi);
    const b = v.fromBufferAttribute(pos, i);
    d[i * 3] = w.x - b.x; d[i * 3 + 1] = w.y - b.y; d[i * 3 + 2] = w.z - b.z;
  }
  if (!any) return null;
  if (!geo.morphAttributes.position) geo.morphAttributes.position = [];
  geo.morphAttributes.position.push(new THREE.Float32BufferAttribute(d, 3));
  geo.morphTargetsRelative = true;
  mesh.updateMorphTargets();
  const idx = geo.morphAttributes.position.length - 1;
  return { mesh, idx, set(x) { mesh.morphTargetInfluences[idx] = x; } };
}

/** Appende un gruppo (in coordinate canoniche) a un osso del modello, così segue l'animazione dell'osso. */
export function boneRoot(THREE, g, bone) {
  const root = new THREE.Group();
  const M = toCanon(THREE, g, bone).invert();          // canonico → spazio dell'osso
  root.matrixAutoUpdate = false; root.matrix.copy(M);
  bone.add(root);
  return root;
}

// ── 1.8.9: cappelli e caschi calzati sulla testa vera ──────────────────────────────────────────────────────────────
// L'ellissoide di sempre del motore è piccolo (7,4 × 8,9 × 7,5 cm, cima y 10,4): una testa vera, calva, arriva a
// y ≈ 13–14,5 e dietro a z ≈ −13,5. Il motore 1.8.9 ha la calotta del cranio vero (HEAD.cranium in faceAR.js) e la
// accende per un effetto solo se ne nasconde meno del 4 % della superficie esterna: i cappelli si calzano FUORI dalla
// calotta (REAL_HEAD, stessa forma, + la fronte del viso canonico) e la fascia la tocca tutto intorno. Poi, con hatFit():
//  • riempitivo invisibile (solo profondità) con la forma della testa vera: da sotto e girando la testa non si vede
//    l'interno o il retro del cappello là dove nella realtà c'è la testa;
//  • tappo invisibile sull'apertura della fascia (dove la fascia è più larga della testa, sulla fronte): da sotto
//    l'interno della cupola non si vede mai come un "coperchio" chiaro;
//  • fodera scura dentro la cupola (shader: facce interne scurite), come nei cappelli veri;
//  • copia rigida del viso (solo profondità): le parti dietro al viso non si vedono attraverso la fronte.
export const REAL_HEAD = { center: [0, 5.6, -4.8], scale: [7.7, 7.7, 8.7] };   // = HEAD.cranium del motore (faceAR.js)
function occMat(THREE) { return new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }); }
export function realHeadOccluder(THREE, opt = {}) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), occMat(THREE));
  const s = opt.scale || REAL_HEAD.scale, c = opt.center || REAL_HEAD.center;
  o.scale.set(s[0], s[1], s[2]); o.position.set(c[0], c[1], c[2]); o.renderOrder = -1; o.name = 'realHeadOccluder';
  return o;
}
export function faceCopyOccluder(THREE, h, inset = 0.25) {
  const f = h.face, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
  const pp = geo.attributes.position, nn = geo.attributes.normal;
  for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * inset, pp.getY(i) - nn.getY(i) * inset, pp.getZ(i) - nn.getZ(i) * inset);
  const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); o.renderOrder = -1; o.name = 'faceOccluder';
  return o;
}
// fodera: attributo tdLin per vertice (+1 = faccia interna con la normale verso dentro, -1 = verso fuori: dentro si
// vede il retro, 0 = fuori dalla cupola) e materiale che scurisce le facce che guardano l'interno
function liningMaterial(m, dark) {
  if (m.userData.tdLining) return m;
  const prev = m.onBeforeCompile, key0 = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  const d = dark.toFixed(3);
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float tdLin;\nvarying float vTdLin;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTdLin = tdLin;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTdLin;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  float tdL = clamp(gl_FrontFacing ? vTdLin : -vTdLin, 0.0, 1.0);
  diffuseColor.rgb *= 1.0 - tdL * ${(1 - dark).toFixed(3)};`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, tdL);');
  };
  m.customProgramCacheKey = () => key0 + 'tdLin' + d;
  m.userData.tdLining = true; m.needsUpdate = true;
  return m;
}
/** Cappello dal modello calzato: tappo sull'apertura della fascia, fodera scura, riempitivi.
 *  o.rimY: altezza dell'apertura (cm, lungo l'asse del cappello, da P.p, scala già applicata);
 *  o.band: spessore in cm sopra rimY in cui cercare la parete interna (default 1.6);
 *  o.wall: quanto fuori dalla parete interna arriva ancora la cupola (default 1.0); o.top: altezza della cupola (cm);
 *  o.dark: quanto scura la fodera (0,22); o.head / o.face: riempitivi (default sì); o.plug: tappo (default sì). */
export function hatFit(THREE, h, g, wrap, o = {}) {
  g.updateMatrixWorld(true);
  // sistema del cappello: posizione e rotazione di wrap, in cm (niente scala)
  const F = new THREE.Matrix4().compose(wrap.position, wrap.quaternion, new THREE.Vector3(1, 1, 1));
  const Fi = F.clone().invert(), gInv = g.matrixWorld.clone().invert();
  const NB = 64, rIn = new Float32Array(NB).fill(1e9), rimY = o.rimY ?? 0, band = o.band ?? 1.6, wall = o.wall ?? 1.0;
  // (solo le parti che si vedono: gli occlusori del cappello, solo profondità, non sono pareti)
  const meshes = []; wrap.traverse(m => { if (m.isMesh && m.visible && m.geometry?.attributes.position && ![].concat(m.material).every(x => x.colorWrite === false)) meshes.push(m); });
  const v = new THREE.Vector3(), q = new THREE.Vector3(), nv = new THREE.Vector3();
  const bin = (x, z) => ((Math.floor((Math.atan2(x, z) + Math.PI) / (2 * Math.PI) * NB) % NB) + NB) % NB;
  let top = -1e9;
  const toHat = (m) => new THREE.Matrix4().multiplyMatrices(Fi, new THREE.Matrix4().multiplyMatrices(gInv, m.matrixWorld));
  for (const m of meshes) {
    const M = toHat(m), pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      q.fromBufferAttribute(pos, i).applyMatrix4(M); top = Math.max(top, q.y);
      if (q.y < rimY - 0.4 || q.y > rimY + band) continue;
      const k = bin(q.x, q.z), r = Math.hypot(q.x, q.z); if (r < rIn[k]) rIn[k] = r;
    }
  }
  // settori senza parete (modelli con pochi vertici: lì si trovava la tesa o la visiera, molto più fuori): scartati e
  // presi dai vicini, così il tappo non copre mai la tesa
  const ok = Array.from(rIn).filter(r => r < 1e8).sort((a, b) => a - b), med = ok.length ? ok[ok.length >> 1] : 0;
  for (let k = 0; k < NB; k++) if (rIn[k] > med * 1.35) rIn[k] = 1e9;   // (una fascia ovale arriva a ~1,3 volte la mediana)
  for (let pass = 0; pass < NB; pass++) for (let k = 0; k < NB; k++) if (rIn[k] > 1e8) { const a = rIn[(k + 1) % NB], b = rIn[(k + NB - 1) % NB]; if (Math.min(a, b) < 1e8) rIn[k] = Math.min(a, b); }
  const H = (o.top ?? top) - rimY, cy = rimY + 0.35 * H;
  // fodera
  if (o.dark !== 0) {
    const dark = o.dark ?? 0.22;
    for (const m of meshes) {
      const M = toHat(m), Nm = new THREE.Matrix3().getNormalMatrix(M), pos = m.geometry.attributes.position, nrm = m.geometry.attributes.normal;
      if (!nrm) continue;
      const a = new Float32Array(pos.count); let any = false;
      for (let i = 0; i < pos.count; i++) {
        q.fromBufferAttribute(pos, i).applyMatrix4(M);
        if (q.y < rimY - 0.05) continue;
        const k = bin(q.x, q.z), r = Math.hypot(q.x, q.z);
        if (r > rIn[k] + wall) continue;
        nv.fromBufferAttribute(nrm, i).applyMatrix3(Nm).normalize();
        // verso dentro: parete con la normale verso l'asse, oppure soffitto della cupola con la normale in giù
        const nr = r > 1e-3 ? (nv.x * q.x + nv.z * q.z) / r : 0;
        const inward = nr < -0.3 || (nv.y < -0.5 && q.y > cy);
        // sfuma verso il bordo (niente stacco netto sull'orlo)
        const f = Math.min(1, (q.y - rimY + 0.05) / 0.5);
        a[i] = (inward ? 1 : -1) * f; any = true;
      }
      if (!any) continue;
      m.geometry.setAttribute('tdLin', new THREE.Float32BufferAttribute(a, 1));
      // (materiale modificato sul posto: le altre mesh senza l'attributo leggono 0 = niente fodera; i ganci di shader
      // già presenti, es. le fibre del feltro, restano). Due facce: dentro una cupola a guscio singolo si vede il retro.
      for (const x of [].concat(m.material)) { if (x.colorWrite === false) continue; liningMaterial(x, dark); x.side = THREE.DoubleSide; }
    }
  }
  // tappo sull'apertura (a ventaglio, poco dentro la parete interna)
  if (o.plug !== false) {
    const pts = [0, rimY + 0.25, 0], idx = [];
    for (let k = 0; k < NB; k++) { const t = -Math.PI + (k + 0.5) / NB * 2 * Math.PI, r = Math.max(0.5, rIn[k] - 0.15); pts.push(Math.sin(t) * r, rimY + 0.25, Math.cos(t) * r); }
    for (let k = 0; k < NB; k++) idx.push(0, 1 + k, 1 + (k + 1) % NB);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setIndex(idx);
    const plug = new THREE.Mesh(geo, occMat(THREE)); plug.renderOrder = -1; plug.name = 'rimPlug';
    plug.matrixAutoUpdate = false; plug.matrix.copy(F); g.add(plug);
  }
  if (o.head !== false) g.add(realHeadOccluder(THREE, o.headShape || {}));
  if (o.face !== false && h.face) g.add(faceCopyOccluder(THREE, h));
  g.userData.rim = { rIn: Array.from(rIn), rimY, top };
  return g;
}
