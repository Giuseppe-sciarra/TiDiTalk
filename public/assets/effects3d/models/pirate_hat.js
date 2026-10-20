// Tricorno da pirata: feltro nero, bordo dorato, teschio con ossa sulla falda frontale rialzata.
export const meta = { label: 'Cappello da pirata', labelEn: 'Pirate hat', category: 'costumi', icon: '🏴‍☠️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  const felt = h.mat(0x1f1d22, { roughness: .95, side: THREE.DoubleSide });
  const gold = h.mat(0xd8b24a, { roughness: .35, metalness: .85 });
  const bone = h.mat(0xf2ead6, { roughness: .6 });

  // corona a cupola
  g.add(new THREE.Mesh(lathe([[0, 0], [8.4, 0], [8.5, 2.5], [8.2, 5.5], [7.2, 8.0], [5.2, 9.6], [2.5, 10.3], [0, 10.4]]), felt));

  // falda: anello con tre lati rialzati (davanti e dietro-lati), le tre punte restano basse
  const R0 = 8.3, R1 = 14.2;
  const lift = (th, r) => {   // th: angolo nel piano XZ, 90° = davanti
    const f = Math.min(1, Math.max(0, (r - R0) / (R1 - R0)));
    let m = 0;
    for (const c of [Math.PI / 2, Math.PI / 2 + 2 * Math.PI / 3, Math.PI / 2 + 4 * Math.PI / 3]) {
      let d = Math.abs(((th - c) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);   // distanza angolare
      const w = Math.max(0, 1 - d / 1.05);
      m = Math.max(m, w * w * (3 - 2 * w));
    }
    return 7.2 * m * Math.pow(f, 1.35) + 0.3 * f * f;
  };
  const ring = new THREE.RingGeometry(R0, R1, 96, 10);
  const pos = ring.attributes.position;
  const edge = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getY(i);     // ring è nel piano XY → la Y diventa Z
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    const y = lift(th, r);
    pos.setXYZ(i, x, y, z);
    if (Math.abs(r - R1) < 1e-3) edge.push(new THREE.Vector3(x * 0.985, y, z * 0.985));
  }
  ring.computeVertexNormals();
  const brim = new THREE.Mesh(ring, felt); brim.position.y = 0.15;
  g.add(brim);
  // seconda pelle sotto per dare spessore (evita l'effetto "foglio")
  const under = brim.clone(); under.position.y = -0.25; g.add(under);

  // bordo dorato lungo il contorno della falda
  edge.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const curve = new THREE.CatmullRomCurve3(edge, true, 'catmullrom', 0.5);
  const trim = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.32, 10, true), gold);
  g.add(trim);

  // teschio e ossa sulla falda frontale (appoggiati sulla superficie inclinata)
  const badge = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1.55, 24, 18), bone);
  skull.scale.set(1, 1.08, 0.75);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.9), bone); jaw.position.set(0, -1.35, -0.2);
  const eyeM = h.mat(0x1a1a1a, { roughness: .8 });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), eyeM); eL.position.set(0.6, 0.15, 1.0);
  const eR = eL.clone(); eR.position.x = -0.6;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), eyeM); nose.position.set(0, -0.55, 1.05); nose.rotation.x = Math.PI;
  const boneGeo = new THREE.CylinderGeometry(0.3, 0.3, 6.4, 10);
  const b1 = new THREE.Mesh(boneGeo, bone); b1.rotation.z = Math.PI / 4; b1.position.z = -0.4;
  const b2 = new THREE.Mesh(boneGeo, bone); b2.rotation.z = -Math.PI / 4; b2.position.z = -0.4;
  for (const b of [b1, b2]) for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), bone); k.position.set(t * 0.3, s * 3.2, 0); b.add(k);
  }
  badge.add(skull, jaw, eL, eR, nose, b1, b2);
  // posizione sulla falda: davanti (th=90°), r≈11.6; inclinazione = pendenza della falda
  const rb = 11.3, yb = lift(Math.PI / 2, rb);
  const slope = (lift(Math.PI / 2, rb + 0.3) - lift(Math.PI / 2, rb - 0.3)) / 0.6;
  const n = new THREE.Vector3(0, -1, slope).normalize();      // normale della falda rivolta verso chi guarda
  badge.position.set(0, yb, rb).addScaledVector(n, 0.35);
  badge.rotation.x = Math.atan2(1, slope);                   // il badge giace sul piano della falda
  badge.scale.setScalar(0.9);
  g.add(badge);

  g.position.set(0, 8.6, -2.2);
  g.rotation.x = -0.10;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.0, 6, 8.0); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
