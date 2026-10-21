// Occhiali da nerd: montatura tonda spessa in acetato nero lucido (bordo arrotondato, più spessa in alto), lenti
// trasparenti curve con riflesso, ponte a sella, cerniere con i perni metallici, aste robuste fino dietro l'orecchio
// e un cerotto di stoffa sul ponte.
import { plastic, lens, metal, tube, temple, curvedLensGeo, cloth, faceOccluder, afterFace, SILVER } from './_kit_acc.js';
export const meta = { label: 'Occhiali da nerd', labelEn: 'Nerd glasses', category: 'accessori', icon: '🤓' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const acetate = plastic(THREE, 0x121214, 0.95);
  const pin = metal(THREE, SILVER, 0.25);
  const glass = lens(THREE, 0xe6eef6, 0.08);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = 2.7;
  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    // cerchio della montatura: anello con sezione ovale (più spesso in alto, "sopracciglio" della montatura)
    const pts = [];
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; pts.push(V(Math.cos(a) * R, Math.sin(a) * R * 0.93, -(Math.cos(a) ** 2 * R * R) / 18)); }
    const rim = tube(THREE, pts, (u) => 0.36 + 0.12 * Math.max(0, Math.sin(u * Math.PI * 2)), { closed: true, segs: 144, rad: 12, aspect: 0.75, up: () => V(0, 0, 1) });
    L.add(new THREE.Mesh(rim, acetate));
    const sh = new THREE.Shape(); sh.absellipse(0, 0, R - 0.05, (R - 0.05) * 0.93, 0, Math.PI * 2, false);
    const ln = new THREE.Mesh(curvedLensGeo(THREE, sh, 9, 40), glass); ln.renderOrder = 3; L.add(ln);
    L.position.set(s * 3.2, 2.7, 5.85);
    L.rotation.set(-0.05, s * 0.2, 0);
    g.add(L);
  }
  // ponte a sella spesso
  g.add(new THREE.Mesh(tube(THREE, [[-0.8, 3.05, 5.95], [-0.45, 3.45, 6.1], [0.45, 3.45, 6.1], [0.8, 3.05, 5.95]], 0.3, { segs: 20, rad: 12, aspect: 0.8 }), acetate));
  // naselli integrati (gocce di acetato sul lato del naso)
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), acetate); p.scale.set(0.35, 1, 0.6); p.position.set(s * 0.95, 2.35, 5.3); p.rotation.set(0.25, s * 0.5, s * 0.3); g.add(p); }
  // cerniere: blocchetto tondo che esce dalla montatura + due perni, poi aste spesse e piatte
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(tube(THREE, [[s * 5.75, 3.35, 5.3], [s * 6.25, 3.3, 4.95], [s * 6.5, 3.25, 4.55]], 0.34, { segs: 10, rad: 12, aspect: 0.7 }), acetate));
    for (const dy of [0.18, -0.18]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), pin); r.position.set(s * 6.55, 3.25 + dy, 4.75); r.rotation.z = Math.PI / 2; g.add(r); }
    g.add(new THREE.Mesh(temple(THREE, s, [6.5, 3.25, 4.5], 0.24, 0.6), acetate));
  }
  // cerotto di stoffa bianca avvolto sul ponte (un poco storto)
  const tape = tube(THREE, [[-0.48, 3.42, 6.36], [0, 3.56, 6.44], [0.48, 3.42, 6.36]], 0.33, { segs: 12, rad: 14, aspect: 1.25, cap: false });
  g.add(new THREE.Mesh(tape, cloth(THREE, 0xefece2, [2, 2])));
  g.add(faceOccluder(THREE, h));
  return afterFace(g);
}
