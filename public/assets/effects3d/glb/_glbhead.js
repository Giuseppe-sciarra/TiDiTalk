// Teste dai modelli gratuiti (glb/): caricamento comune (stessi materiali di prima) + aggancio di occhi e bocca.
// I file che iniziano per "_" non vanno nel catalogo.
// P = { c: centro del modello (unità del file), s: scala → cm, p: posizione sulla testa canonica, r: rotazione (gradi) }
// O = opzioni dei materiali (come prima): env, rough, metal, tint, color, matColor, hideMats, cards, alphaTest, spec, clip, jaw, jawAngle

export async function loadHead(THREE, h, url, P, O, name) {
  const gltf = await new h.GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  model.position.set(-P.c[0], -P.c[1], -P.c[2]);
  const wrap = new THREE.Group();
  wrap.add(model);
  wrap.scale.setScalar(P.s);
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
