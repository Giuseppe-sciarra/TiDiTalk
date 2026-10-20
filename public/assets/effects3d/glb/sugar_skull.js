// Sugar skull — CC0-1.0, Kay Lousberg (www.kaylousberg.com)
// Modello: sugar_skull.glb (ottimizzato: <25k triangoli, texture ≤512 px, niente Draco/meshopt).
export const meta = {"label": "Calavera", "labelEn": "Calavera", "category": "personaggi", "icon": "💀"};
export const hideHead = true;
const P = {"c": [0.0, 1.67969, -0.0023], "s": 29.403, "p": [0.0, 2.7, -1.5], "r": [0, 0, 0]};   // c = centro del modello (unità del file), s = scala → cm, p = posizione sulla testa canonica, r = rotazione (gradi)
const O = {"jaw": "Skeleton_Mage_Jaw", "jawAngle": 0.38, "env": 0.6};

export default async function build(THREE, h) {
  const gltf = await new h.GLTFLoader().loadAsync(new URL('./sugar_skull.glb', import.meta.url).href);
  const model = gltf.scene;
  model.position.set(-P.c[0], -P.c[1], -P.c[2]);
  const wrap = new THREE.Group();
  wrap.add(model);
  wrap.scale.setScalar(P.s);
  wrap.position.set(P.p[0], P.p[1], P.p[2]);
  wrap.rotation.set(P.r[0] * Math.PI / 180, P.r[1] * Math.PI / 180, P.r[2] * Math.PI / 180);
  const g = new THREE.Group();
  g.name = 'sugar_skull';
  g.add(wrap);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    if (O.spec != null) {                         // specular ridotto (come i capelli procedurali): MeshPhysicalMaterial
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
      if (O.color) { m.color.setRGB(O.color[0], O.color[1], O.color[2], THREE.SRGBColorSpace); }
      if (O.rough != null && 'roughness' in m) m.roughness = O.rough;
      if (O.metal != null && 'metalness' in m) m.metalness = O.metal;
      if (O.matColor) for (const k in O.matColor) if ((m.name || '').includes(k)) m.color.setRGB(O.matColor[k][0], O.matColor[k][1], O.matColor[k][2], THREE.SRGBColorSpace);
      if (O.tint != null) m.color.multiplyScalar(O.tint);
      if (O.cards && m.map) {                    // ciocche/peli su piani con alpha: niente ordinamento, alpha test
        m.transparent = false; m.alphaTest = O.alphaTest || 0.35; m.depthWrite = true; m.side = THREE.DoubleSide;
      }
      if (m.map) m.map.anisotropy = 4;
      m.needsUpdate = true;
    }
  });
  if (O.clip && gltf.animations.length) {        // animazione di attesa del modello
    const clip = THREE.AnimationClip.findByName(gltf.animations, O.clip) || gltf.animations[0];
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clip).play();
    g.userData.mixer = mixer;
  }
  if (O.jaw) {                                   // mandibola separata: perno (spazio testa, cm) sul bordo alto posteriore
    const jaw = model.getObjectByName(O.jaw);
    if (jaw) {
      g.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(jaw);
      const pivot = new THREE.Object3D();
      pivot.position.set((bb.min.x + bb.max.x) / 2, bb.max.y, bb.min.z + (bb.max.z - bb.min.z) * 0.4);
      g.add(pivot); pivot.updateMatrixWorld(true);
      pivot.attach(jaw);
      g.userData.jaw = pivot;
    }
  }
  return g;
}

export function update(g, bs, t) {
  const u = g.userData;
  if (u.mixer) {
    const dt = u.t0 == null ? 0 : Math.min(0.1, Math.max(0, t - u.t0));
    u.t0 = t;
    u.mixer.update(dt);
  }
  if (u.jaw) u.jaw.rotation.x = (bs.jawOpen || 0) * O.jawAngle;
}
