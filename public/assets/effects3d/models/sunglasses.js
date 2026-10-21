// Occhiali da sole aviator: lenti a goccia curve e sfumate (più scure in alto, riflesso ai bordi), montatura in metallo
// dorato sottile con doppio ponte, naselli in silicone, aste che seguono la testa fino dietro l'orecchio con terminali in acetato.
import { metal, plastic, lens, tube, temple, curvedLensGeo, faceOccluder, afterFace, GOLD } from './_kit_acc.js';
export const meta = { label: 'Occhiali da sole', labelEn: 'Sunglasses', category: 'accessori', icon: '🕶️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const gold = metal(THREE, GOLD, 0.22);
  const pad = plastic(THREE, 0xeef0f2, 0.4, { transparent: true, opacity: 0.75 });
  const tip = plastic(THREE, 0x2a2420, 0.6);
  // lente sfumata: grigio-verde, più scura in alto (sfumatura nei colori dei vertici)
  const lensM = lens(THREE, 0xffffff, 0.86, { vertexColors: true });

  // sagoma a goccia: più piatta sopra, più tonda sotto, allungata verso l'esterno in basso
  const dropPts = (s, k = 1) => {
    const P = [];
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2, sn = Math.sin(a), c = Math.cos(a);
      const lo = Math.max(0, -sn);
      const rx = (2.75 + 0.3 * lo) * k, ry = (2.25 + 0.55 * lo) * k;
      P.push(new THREE.Vector2(c * rx + s * 0.45 * lo * Math.max(0, c * s) * k, sn * ry * (sn > 0 ? 0.86 : 1)));
    }
    return P;
  };
  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    const shape = new THREE.Shape(dropPts(s, 0.985));
    const lg = curvedLensGeo(THREE, shape, 8.5, 28);
    // colori (lineari, molto scuri: una lente da sole assorbe la luce): in alto quasi nera, in basso più chiara →
    // sfumatura classica degli aviator, con una punta di verde
    const p = lg.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getY(i) + 2.8) / 5.2)), k = 0.03 - 0.026 * t; col.push(k * 0.85, k, k * 0.8); }
    lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const ln = new THREE.Mesh(lg, lensM); ln.renderOrder = 3; L.add(ln);
    // montatura: filo metallico tondo che segue il bordo della lente (anche lui sulla curvatura)
    const rim = dropPts(s, 1.0).map(v => new THREE.Vector3(v.x, v.y, -(v.x * v.x + 0.6 * v.y * v.y) / 17));
    L.add(new THREE.Mesh(tube(THREE, rim, 0.12, { closed: true, segs: 96, rad: 8 }), gold));
    L.position.set(s * 3.15, 2.75, 5.95);
    L.rotation.set(-0.06, s * 0.2, 0);
    g.add(L);
  }
  // doppio ponte: barra alta dritta e ponte basso ad arco
  g.add(new THREE.Mesh(tube(THREE, [[-1.15, 4.15, 5.95], [0, 4.22, 6.05], [1.15, 4.15, 5.95]], 0.11, { segs: 16, rad: 8 }), gold));
  g.add(new THREE.Mesh(tube(THREE, [[-1.0, 3.25, 5.85], [-0.45, 3.6, 5.95], [0.45, 3.6, 5.95], [1.0, 3.25, 5.85]], 0.13, { segs: 16, rad: 8 }), gold));
  // naselli: bracciolo metallico + cuscinetto trasparente
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(tube(THREE, [[s * 1.05, 3.2, 5.8], [s * 1.12, 2.75, 5.55], [s * 0.98, 2.35, 5.3]], 0.06, { segs: 10, rad: 6 }), gold));
    const pd = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), pad); pd.scale.set(0.42, 1, 0.75); pd.position.set(s * 0.92, 2.25, 5.18); pd.rotation.set(0.25, s * 0.5, s * 0.2); g.add(pd);
  }
  // aste: dal bordo esterno alla tempia, poi dritte fino all'orecchio e giù dietro; terminale in acetato
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(tube(THREE, [[s * 5.85, 3.55, 5.25], [s * 6.2, 3.45, 5.0], [s * 6.45, 3.35, 4.55]], 0.15, { segs: 10, rad: 8 }), gold));   // cerniera
    const arm = temple(THREE, s, [6.45, 3.35, 4.5], 0.11, 1.4);
    g.add(new THREE.Mesh(arm, gold));
    const end = tube(THREE, [[s * 7.62, 2.4, -2.2], [s * 7.62, 2.05, -2.9], [s * 7.45, 1.0, -4.0], [s * 7.2, 0.0, -4.5]], (u) => 0.19 * (1 - 0.3 * u), { segs: 20, rad: 10, aspect: 1.3 });
    g.add(new THREE.Mesh(end, tip));
  }
  g.add(faceOccluder(THREE, h));
  return afterFace(g);
}
