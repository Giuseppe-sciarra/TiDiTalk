// Tricorno da pirata: feltro nero spesso (falda con il bordo arrotondato e i tre lati rialzati), gallone dorato
// intrecciato lungo il bordo, coccarda con teschio e ossa incrociate modellati sul davanti. Calza sopra la fronte e
// regge a testa inclinata in giù; le parti dietro la testa le nasconde la testa.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js).
import { felt, metal, plastic, tube, headOccluder, faceOccluder, afterFace, smooth, GOLD } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Cappello da pirata', labelEn: 'Pirate hat', category: 'costumi', icon: '🏴‍☠️' };

export default function build(THREE, h) {
  const root = new THREE.Group();
  const g = new THREE.Group(); root.add(g);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const wool = felt(THREE, 0x1c1a1f, [14, 6], { side: THREE.DoubleSide });
  const braid = metal(THREE, GOLD, 0.38);
  const bone = plastic(THREE, 0xeee4cc, 0.25, { roughness: 0.55 });
  const socket = plastic(THREE, 0x161212, 0, { roughness: 0.9 });

  // corona a cupola con un'ammaccatura in cima (come il feltro vero)
  const crown = new THREE.LatheGeometry([[8.45, -0.2], [8.55, 2.5], [8.25, 5.5], [7.3, 8.0], [5.3, 9.6], [2.6, 10.3], [0, 10.4]].map(p => new THREE.Vector2(p[0], p[1])), 72);
  { const p = crown.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const d = Math.exp(-((x * x + (z + 1) ** 2) / 14)); p.setY(i, y - 0.9 * d * smooth(7, 10.4, y)); } crown.computeVertexNormals(); }
  g.add(new THREE.Mesh(crown, wool));

  // falda: anello con i tre lati rialzati; SPESSA (due facce + bordo arrotondato), non un foglio
  const R0 = 8.3, R1 = 14.0, T = 0.32;
  const lift = (th, r) => {
    const f = Math.min(1, Math.max(0, (r - R0) / (R1 - R0)));
    let m = 0;
    for (const c of [Math.PI / 2, Math.PI / 2 + 2 * Math.PI / 3, Math.PI / 2 + 4 * Math.PI / 3]) {
      const d = Math.abs(((th - c) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      const w = Math.max(0, 1 - d / 1.05); m = Math.max(m, w * w * (3 - 2 * w));
    }
    return 7.0 * m * Math.pow(f, 1.35) + 0.3 * f * f;
  };
  // superficie della falda come griglia (angolo × raggio) con la sezione chiusa: sopra, bordo tondo, sotto
  const NA = 120, NR = 10, NE = 5, cols = NA + 1, rows = NR * 2 + NE + 1;
  const pos = [], idx = [], uv = [];
  const pt = (th, r, off) => { const y = lift(th, r); const dr = 0.05, dy = (lift(th, r + dr) - lift(th, r - dr)) / (2 * dr);
    const n = V(-Math.cos(th) * dy, 1, -Math.sin(th) * dy).normalize(); return V(Math.cos(th) * r, y, Math.sin(th) * r).addScaledVector(n, off); };
  for (let j = 0; j < cols; j++) {
    const th = j / NA * Math.PI * 2;
    for (let i = 0; i <= NR; i++) { const r = R0 + (R1 - R0) * i / NR; const p = pt(th, r, T / 2); pos.push(p.x, p.y, p.z); uv.push(j / NA, i / NR * 0.4); }
    for (let e = 1; e < NE; e++) { const a = e / NE * Math.PI; const p = pt(th, R1 + Math.sin(a) * T * 0.55, Math.cos(a) * T / 2); pos.push(p.x, p.y, p.z); uv.push(j / NA, 0.4 + e / NE * 0.1); }
    for (let i = NR; i >= 0; i--) { const r = R0 + (R1 - R0) * i / NR; const p = pt(th, r, -T / 2); pos.push(p.x, p.y, p.z); uv.push(j / NA, 0.5 + (NR - i) / NR * 0.4); }
  }
  const RW = (NR + 1) * 2 + (NE - 1);
  for (let j = 0; j < NA; j++) for (let i = 0; i < RW - 1; i++) { const a = j * RW + i, b = (j + 1) * RW + i; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); bg.setIndex(idx); bg.computeVertexNormals();
  g.add(new THREE.Mesh(bg, wool));

  // gallone dorato: cordone intrecciato sul bordo (rilievo a spirale nella sezione) + filo sottile sopra
  const edge = []; for (let j = 0; j < 240; j++) { const th = j / 240 * Math.PI * 2; edge.push(pt(th, R1 + 0.05, 0)); }
  const cord = tube(THREE, edge, (u) => 0.3 * (1 + 0.16 * Math.sin(u * 600)), { closed: true, segs: 420, rad: 6 });
  g.add(new THREE.Mesh(cord, braid));
  const edge2 = []; for (let j = 0; j < 160; j++) { const th = j / 160 * Math.PI * 2; edge2.push(pt(th, R1 - 0.75, T / 2 + 0.04)); }
  g.add(new THREE.Mesh(tube(THREE, edge2, 0.07, { closed: true, segs: 200, rad: 4 }), braid));

  // coccarda: teschio modellato (cranio + zigomi + mascella con i denti) e ossa con le estremità a due nodi
  const badge = new THREE.Group();
  const sk = new THREE.SphereGeometry(1.5, 28, 20);
  { const p = sk.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < -0.2) { const k = 1 - 0.32 * smooth(-0.2, -1.5, y); x *= k; z *= 0.9 + 0.1 * k; }          // si stringe verso la mascella
      z *= 0.72; p.setXYZ(i, x, y * 1.08, z); } sk.computeVertexNormals(); }
  badge.add(new THREE.Mesh(sk, bone));
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), socket); e.scale.set(1, 1.1, 0.5); e.position.set(s * 0.58, 0.05, 0.95); badge.add(e);
  }
  const nz = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), socket); nz.scale.set(0.8, 1.2, 0.5); nz.position.set(0, -0.6, 1.0); badge.add(nz);
  const jaw = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 14), bone); jaw.rotation.z = Math.PI / 2; jaw.scale.set(1, 1, 0.75); jaw.position.set(0, -1.45, 0.45); badge.add(jaw);
  for (let k = -2; k <= 2; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.1), socket); t.position.set(k * 0.24, -1.45, 0.78); badge.add(t); }
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const b = new THREE.Group(); b.rotation.z = a; b.position.z = -0.35;
    b.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 5.6, 4, 10), bone));
    for (const s of [-1, 1]) for (const t of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), bone); k.position.set(t * 0.28, s * 3.05, 0); b.add(k); }
    badge.add(b);
  }
  const rb = 11.2, yb = lift(Math.PI / 2, rb), slope = (lift(Math.PI / 2, rb + 0.3) - lift(Math.PI / 2, rb - 0.3)) / 0.6;
  const n = V(0, -1, slope).normalize();
  badge.position.set(0, yb, rb).addScaledVector(n, T / 2 + 0.55);
  badge.rotation.x = Math.atan2(1, slope);
  badge.scale.setScalar(0.85);
  g.add(badge);
  g.scale.set(0.885, 0.999, 1.036);
  g.position.set(0, 8.58, -4.78);
  g.rotation.x = -0.076;
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(root), g, { rimY: -0.2, face: false });
}
