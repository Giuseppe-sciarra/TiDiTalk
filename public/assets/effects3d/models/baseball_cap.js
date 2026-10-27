// Cappellino da baseball: cupola morbida a 6 spicchi di cotone (trama, cuciture doppie in rilievo), bottone rivestito,
// occhielli ricamati, visiera curva con bordo arrotondato e sottovisiera verde, fascia interna. Calza sopra le orecchie,
// la visiera resta sopra le sopracciglia anche a testa inclinata in giù.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js).
import { cloth, tube, headOccluder, smooth } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Cappellino da baseball', labelEn: 'Baseball cap', category: 'accessori', icon: '🧢' };

export default function build(THREE, h) {
  const root = new THREE.Group();
  const g = new THREE.Group(); root.add(g);
  const BLUE = 0x2a5aa8;
  const fabric = cloth(THREE, BLUE, [18, 6]);
  const fabricDark = cloth(THREE, 0x1f4685, [18, 2]);
  const thread = cloth(THREE, 0x173468, [40, 1], { bumpScale: 0.3 });
  const under = cloth(THREE, 0x264a33, [10, 10]);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // profilo della cupola (raggio, altezza): più profonda dietro grazie all'inclinazione del gruppo
  const PROF = [[8.65, -1.2], [8.82, 0.6], [8.75, 2.6], [8.35, 4.6], [7.4, 6.4], [5.8, 7.8], [3.8, 8.65], [1.8, 9.05], [0.0, 9.15]];
  const rAt = (y) => { for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][1]) { const [r0, y0] = PROF[i - 1], [r1, y1] = PROF[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0; };
  // cupola: spicchi leggermente gonfi fra una cucitura e l'altra (la stoffa tira sulle cuciture)
  const dome = new THREE.LatheGeometry(PROF.map(p => new THREE.Vector2(p[0], p[1])), 96, 0, Math.PI * 2);
  { const p = dome.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 0.05) continue;
      const a = Math.atan2(z, x) - Math.PI / 6, f = Math.abs(Math.sin(a * 3));          // 0 sulla cucitura, 1 al centro dello spicchio
      const k = 1 + 0.022 * Math.pow(f, 0.6) * smooth(-1.2, 1.0, y) * (1 - smooth(7.5, 9.1, y));
      p.setXYZ(i, x * k, y, z * k);
    }
    dome.computeVertexNormals();
    // ombre morbide dipinte nei vertici: più scuro in basso (vicino alla testa) e nei solchi delle cuciture
    const col = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x) - Math.PI / 6, f = Math.abs(Math.sin(a * 3));
      const k = (0.72 + 0.28 * smooth(-1.2, 2.5, y)) * (0.86 + 0.14 * Math.pow(f, 0.4)); col.push(k, k, k); }
    dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  fabric.vertexColors = true;
  g.add(new THREE.Mesh(dome, fabric));
  // fascia interna (si vede da sotto la visiera e ai lati): anello spesso con bordo tondo
  g.add(new THREE.Mesh(new THREE.TorusGeometry(8.7, 0.28, 10, 120), fabricDark).rotateX(Math.PI / 2).translateZ(1.15));
  // cuciture: doppia linea in rilievo lungo i 6 meridiani + punti cuciti (righe brevi) attorno alla base
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + Math.PI / 6;
    for (const d of [-0.11, 0.11]) {
      const pts = [];
      for (let i = 0; i <= 18; i++) { const y = -0.6 + i * (9.1 / 18), r = rAt(y) + 0.06; if (r < 0.3) break; const aa = a + d / Math.max(r, 0.8); pts.push(V(Math.cos(aa) * r, y, Math.sin(aa) * r)); }
      g.add(new THREE.Mesh(tube(THREE, pts, 0.045, { segs: 24, rad: 4 }), thread));
    }
  }
  // bottone in cima, rivestito di stoffa
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), fabric); btn.scale.y = 0.5; btn.position.y = 9.1; g.add(btn);
  // occhielli ricamati (anello di filo in rilievo) su 6 spicchi
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, y = 6.9, r = rAt(y) + 0.03;
    const e = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 18), thread);
    e.position.set(Math.cos(a) * r, y, Math.sin(a) * r); e.lookAt(Math.cos(a) * 30, y + 12, Math.sin(a) * 30); g.add(e);
  }

  // visiera: sagoma ovale davanti, bordo posteriore ad arco sulla cupola; curva ai lati; spessa con bordo tondo
  const sh = new THREE.Shape();
  sh.moveTo(-8, -7.5); sh.absellipse(0, -7.5, 8, 6.6, Math.PI, 2 * Math.PI, false);
  sh.lineTo(8, -2.6); sh.absarc(0, 0, 8.4, -0.315, -2.826, true); sh.closePath();
  const vis = new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: true, bevelSize: 0.16, bevelThickness: 0.14, bevelSegments: 3, curveSegments: 28 });
  vis.rotateX(Math.PI / 2); vis.rotateY(Math.PI);
  const bend = (x, z) => { const f = Math.min(1, Math.max(0, (Math.hypot(x, z) - 8.4) / 4.5)); return -0.032 * x * x * f - 0.006 * Math.max(0, z - 9) ** 2; };
  { const vp = vis.attributes.position, uv = vis.attributes.uv, col = [];
    for (let i = 0; i < vp.count; i++) { const x = vp.getX(i), z = vp.getZ(i); vp.setY(i, vp.getY(i) + bend(x, z)); uv.setXY(i, x / 16 + 0.5, z / 16);
      const k = 0.7 + 0.3 * smooth(8.4, 11.5, Math.hypot(x, z)); col.push(k, k, k); }
    vis.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  vis.translate(0, 0, -8.5); vis.computeVertexNormals();
  const visor = new THREE.Mesh(vis, cloth(THREE, BLUE, [6, 6], { vertexColors: true }));
  visor.position.set(0, -1.25, 8.5); visor.rotation.x = 0.1; g.add(visor);
  // sottovisiera verde (come i cappellini veri), appena sotto la faccia inferiore
  const ug = new THREE.ShapeGeometry(sh, 40); ug.rotateX(Math.PI / 2); ug.rotateY(Math.PI);
  { const up = ug.attributes.position; for (let i = 0; i < up.count; i++) { const x = up.getX(i) * 0.985, z = up.getZ(i) * 0.985 + 0.1; up.setXYZ(i, x, -0.36 + bend(x, z), z - 8.5); } ug.computeVertexNormals(); }
  const um = new THREE.Mesh(ug, under); um.position.copy(visor.position); um.rotation.copy(visor.rotation); g.add(um);
  // cuciture concentriche sulla visiera (5 righe), seguono la curvatura
  for (let j = 0; j < 5; j++) {
    const kx = 8 - 0.55 - j * 0.55, kz = 6.6 - 0.55 - j * 0.55, pts = [];
    for (let i = 0; i <= 48; i++) { const a = Math.PI + i / 48 * Math.PI; const x = Math.cos(a) * kx, z = 7.5 - Math.sin(a) * kz; if (Math.hypot(x, z) < 8.7) continue; pts.push(V(x, 0.36 + bend(x, z), z - 8.5)); }
    if (pts.length > 3) { const m = new THREE.Mesh(tube(THREE, pts, 0.035, { segs: 60, rad: 4, cap: false }), thread); m.position.copy(visor.position); m.rotation.copy(visor.rotation); g.add(m); }
  }
  g.scale.set(0.948, 1.168, 1.156);
  g.position.set(0, 6.42, -4.00);
  g.rotation.x = -0.168;
  // riempitivo con la forma della testa vera, tappo sull'apertura e fodera scura (1.8.9)
  return hatFit(THREE, h, root, g, { rimY: -1.4 });
}
