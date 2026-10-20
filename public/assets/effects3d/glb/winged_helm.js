// Winged helm — CC-BY-4.0, ArtLeaving
// Modello: winged_helm.glb (ottimizzato: <25k triangoli, texture ≤512 px, niente Draco/meshopt).
export const meta = {"label": "Elmo alato", "labelEn": "Winged helm", "category": "costumi", "icon": "🪽"};
const P = {"c": [0.0, 0.21479, -0.05894], "s": 39.494, "p": [0.0, 7.0, -3.5], "r": [0, 0, 0]};   // c = centro del modello (unità del file), s = scala → cm, p = posizione sulla testa canonica, r = rotazione (gradi)
const O = {"env": 0.6};

export default async function build(THREE, h) {
  const gltf = await new h.GLTFLoader().loadAsync(new URL('./winged_helm.glb', import.meta.url).href);
  const model = gltf.scene;
  model.position.set(-P.c[0], -P.c[1], -P.c[2]);
  const wrap = new THREE.Group();
  wrap.add(model);
  wrap.scale.setScalar(P.s);
  wrap.position.set(P.p[0], P.p[1], P.p[2]);
  wrap.rotation.set(P.r[0] * Math.PI / 180, P.r[1] * Math.PI / 180, P.r[2] * Math.PI / 180);
  const g = new THREE.Group();
  g.name = 'winged_helm';
  g.add(wrap);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
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
  if (O.jaw) {                                   // mandibola separata: perno sul bordo alto posteriore
    const jaw = model.getObjectByName(O.jaw);
    if (jaw && jaw.geometry) {
      jaw.geometry.computeBoundingBox();
      const b = jaw.geometry.boundingBox;
      const hinge = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, b.min.z + (b.max.z - b.min.z) * 0.3);
      jaw.geometry.translate(-hinge.x, -hinge.y, -hinge.z);
      jaw.position.add(hinge);
      g.userData.jaw = jaw;
      g.userData.jaw0 = jaw.rotation.x;
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
  if (u.jaw) u.jaw.rotation.x = u.jaw0 + (bs.jawOpen || 0) * O.jawAngle;
}
