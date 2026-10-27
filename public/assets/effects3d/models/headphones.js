// Cuffie over-ear: archetto in metallo spazzolato con imbottitura in similpelle cucita, slitte di regolazione,
// forcelle arrotondate che reggono i padiglioni su un perno, padiglioni ovali in plastica opaca con anello lucido,
// cuscinetti morbidi in similpelle che appoggiano sulle orecchie.
// 1.8.9: archetto e imbottitura seguono la calotta del cranio vero del motore (archi attorno a (0, 5,6)): prima
// l'imbottitura entrava nella testa vera; padiglioni 1 cm più indietro, sulle orecchie.
import { metal, plastic, leather, tube, softExtrude, faceOccluder, afterFace, smooth, GUNMETAL } from './_kit_acc.js';
export const meta = { label: 'Cuffie', labelEn: 'Headphones', category: 'accessori', icon: '🎧' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const shell = plastic(THREE, 0x1d1e22, 0.25);
  const gloss = plastic(THREE, 0x2a2c31, 0.9);
  const steel = metal(THREE, 0x9da1a8, 0.38, { brushed: [1, 1] });
  const dark = metal(THREE, GUNMETAL, 0.4);
  const pad = leather(THREE, 0x1a1b1e, [3, 2], { sheen: 0.12 });
  const accent = metal(THREE, 0xc9553f, 0.35);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ZC = -3.9;                         // piano dei padiglioni (1.8.9: sull'orecchio vero, ~1,5 cm dietro al punto di MediaPipe a z -2,4)

  // archetto: arco ellittico sopra la testa (segue il cranio a 1,3 cm), sezione piatta e larga
  const arc = (rx, ry, y0, a0 = 0, a1 = Math.PI) => { const P = []; for (let i = 0; i <= 48; i++) { const a = a0 + (a1 - a0) * i / 48; P.push(V(Math.cos(a) * rx, y0 + Math.sin(a) * ry, ZC)); } return P; };
  const up = (t, P) => V(0, 0, 1);         // la sezione resta larga in z (come una fascia)
  g.add(new THREE.Mesh(tube(THREE, arc(9.3, 9.3, 5.6, -0.1, Math.PI + 0.1), 0.5, { aspect: 0.36, up, segs: 80, rad: 10 }), gloss));
  g.add(new THREE.Mesh(tube(THREE, arc(9.05, 9.05, 5.6, -0.15, Math.PI + 0.15), 0.36, { aspect: 0.22, up, segs: 80, rad: 8 }), steel));
  // imbottitura superiore: cuscino cucito sotto l'arco (sezione ovale, si assottiglia alle estremità)
  const padArc = arc(8.53, 8.53, 5.6, 0.45, Math.PI - 0.45);
  g.add(new THREE.Mesh(tube(THREE, padArc, (u) => 0.75 * Math.pow(Math.sin(Math.PI * u), 0.35), { aspect: 1.35, up: () => V(0, 0, 1), segs: 60, rad: 12 }), pad));
  // cucitura lungo l'imbottitura
  for (const dz of [-0.75, 0.75]) g.add(new THREE.Mesh(tube(THREE, padArc.map(p => V(p.x * 0.985, p.y * 0.985 - 0.05, p.z + dz)), 0.04, { segs: 50, rad: 3 }), dark));

  for (const s of [-1, 1]) {
    // slitta di regolazione: barretta che esce dall'arco con tacche
    const slideTop = V(s * 9.2, 4.6, ZC), slideBot = V(s * 9.3, 4.2, ZC);
    g.add(new THREE.Mesh(tube(THREE, [V(s * 9.15, 5.6, ZC), slideTop, slideBot], 0.2, { aspect: 1.8, up, segs: 16, rad: 10 }), steel));
    for (let k = 0; k < 4; k++) { const tk = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.05, 4, 10), dark); tk.position.set(s * (9.2 + 0.02 * k), 5.5 - k * 0.3, ZC); tk.rotation.y = Math.PI / 2; tk.scale.set(1, 1, 1.7); g.add(tk); }
    // forcella a U arrotondata che abbraccia il padiglione (davanti e dietro), perno sul davanti/dietro
    const fork = [V(s * 9.0, 1.2, ZC - 3.55), V(s * 9.25, 3.6, ZC - 2.6), V(s * 9.35, 4.4, ZC), V(s * 9.25, 3.6, ZC + 2.6), V(s * 9.0, 1.2, ZC + 3.55)];
    g.add(new THREE.Mesh(tube(THREE, fork, 0.24, { segs: 28, rad: 8 }), dark));
    for (const dz of [-3.6, 3.6]) { const pv = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 18), steel); pv.rotation.x = Math.PI / 2; pv.position.set(s * 9.0, 0.9, ZC + dz); g.add(pv); }
    // padiglione: guscio ovale bombato (lathe schiacciato), anello lucido, placca centrale con un piccolo inserto
    const cup = new THREE.Group();
    const prof = [[4.1, 0], [4.0, 0.7], [3.6, 1.4], [2.8, 2.0], [1.6, 2.28], [0, 2.35]];   // dal bordo verso il centro: facce verso fuori
    const cg = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 48); cg.scale(1, 1, 1.22);
    cup.add(new THREE.Mesh(cg, shell));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.24, 8, 48), gloss); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1.22, 1); cup.add(ring);
    const plate = new THREE.Shape(); plate.absellipse(0, 0, 1.35, 1.65, 0, Math.PI * 2, false);
    const pl = new THREE.Mesh(softExtrude(THREE, plate, 0.14, 0.08, { bevelSegments: 3, curveSegments: 24 }), dark); pl.rotation.x = -Math.PI / 2; pl.position.y = 2.36; cup.add(pl);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), accent); dot.scale.y = 0.4; dot.position.set(0, 2.5, -1.45); cup.add(dot);
    // cuscinetto: toro grosso schiacciato, più gonfio all'esterno, appoggiato sull'orecchio
    const cg2 = new THREE.TorusGeometry(3.0, 1.15, 12, 40); cg2.rotateX(Math.PI / 2); cg2.scale(1, 0.75, 1.2);
    { const p = cg2.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0) p.setY(i, y * 0.85); } cg2.computeVertexNormals(); }
    const cush = new THREE.Mesh(cg2, pad); cush.position.y = -0.55; cup.add(cush);
    // tessuto acustico al centro del cuscinetto (scuro, opaco)
    const fab = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), plastic(THREE, 0x111114, 0)); fab.rotation.x = Math.PI / 2; fab.scale.set(1, 1.2, 1); fab.position.y = -0.2; cup.add(fab);
    cup.rotation.z = -s * Math.PI / 2;
    cup.position.set(s * 9.0, 0.9, ZC);
    g.add(cup);
  }
  // le parti dietro il viso (padiglione lontano quando si gira la testa) vanno nascoste dal viso
  g.add(faceOccluder(THREE, h, 0.4));
  return afterFace(g);
}
