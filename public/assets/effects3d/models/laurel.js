// Corona d'alloro: due rami di foglie che cingono la testa, con bacche e nastro rosso dietro.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
export const meta = { label: "Corona d'alloro", labelEn: 'Laurel wreath', category: 'costumi', icon: '🏛️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const stem = h.mat(0x7a5a2e, { roughness: .9 });
  const leafA = h.mat(0x3f7a3a, { roughness: .85 });
  const leafB = h.mat(0x5a9a46, { roughness: .85 });
  const R = 8.5;

  // due rami: partono dalla nuca e corrono in avanti fino alle tempie/fronte, salendo un po' verso il davanti
  const leafGeo = (() => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.9, 0.6, 1.0, 1.7); s.quadraticCurveTo(0.9, 2.9, 0, 3.6); s.quadraticCurveTo(-0.9, 2.9, -1.0, 1.7); s.quadraticCurveTo(-0.9, 0.6, 0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: .06, bevelThickness: .05, bevelSegments: 1, curveSegments: 8 });
    // leggera curvatura della foglia
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) + 0.12 * x * x + 0.03 * (y - 1.8) ** 2); }
    geo.computeVertexNormals(); return geo;
  })();
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = -Math.PI / 2 + s * (i / 40) * (Math.PI * 0.92);          // da dietro (−90°) verso davanti
      pts.push(new THREE.Vector3(Math.cos(a) * R, 0.9 * (i / 40), Math.sin(a) * R));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.18, 6), stem));
    // foglie a coppie lungo il ramo, inclinate in avanti (verso la punta del ramo) e verso l'esterno
    for (let i = 1; i <= 15; i++) {
      const t = i / 16, a = -Math.PI / 2 + s * t * Math.PI * 0.92;
      for (const up of [1, -1]) {
        const leaf = new THREE.Mesh(leafGeo, (i + (up > 0)) % 2 ? leafA : leafB);
        const r = R + 0.15;
        leaf.position.set(Math.cos(a) * r, 0.9 * t + up * 0.15, Math.sin(a) * r);
        // orientamento: +Z della foglia verso l'esterno, +Y (la punta) lungo il ramo verso la fronte, inclinata in su/giù
        const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const tg = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(s);
        const d = tg.multiplyScalar(Math.cos(up * 0.8)).add(new THREE.Vector3(0, Math.sin(up * 0.8), 0)).normalize();
        const x = new THREE.Vector3().crossVectors(d, n).normalize();
        leaf.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, d, n));
        leaf.scale.setScalar(0.7 + 0.18 * Math.sin(t * Math.PI)); leaf.rotateY((i % 3 - 1) * 0.25);
        g.add(leaf);
      }
    }
    // bacche dorate
    for (let i = 2; i <= 10; i += 3) {
      const t = i / 12, a = -Math.PI / 2 + s * t * Math.PI * 0.92;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), h.mat(0xd9a93a, { roughness: .4, metalness: .5 }));
      b.position.set(Math.cos(a) * (R + 0.5), 0.9 * t + 0.1, Math.sin(a) * (R + 0.5)); g.add(b);
    }
  }
  // nastro rosso annodato dietro
  const ribbon = h.mat(0xb8222c, { roughness: .6 });
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), ribbon); knot.position.set(0, 0, -R - 0.2); g.add(knot);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.35, 8, 20), ribbon); loop.scale.set(1, 0.6, 1); loop.position.set(s * 1.4, 0.2, -R - 0.2); loop.rotation.y = s * 0.3; g.add(loop);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.0, 0.15), ribbon); tail.position.set(s * 0.9, -2.2, -R - 0.1); tail.rotation.z = s * 0.18; g.add(tail);
  }

  g.position.set(0, 7.6, -2.3);
  g.rotation.x = -0.12;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.0, 5, 8.0); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(headOccluder(THREE, h, { scale: [8.1, 10.0, 9.3], center: [0, 2.6, -4.3] }));
  root.add(faceOccluder(THREE, h, 0.2));
  return afterFace(finish(THREE, root));
}
