// Berretto di lana a coste con risvolto e pompon: maglia vera (punti a V in rilievo, lucentezza della lana), corpo morbido
// che si raccoglie in cima con le pieghe, risvolto spesso, pompon di fili. Calza il cranio: davanti si ferma sopra le
// sopracciglia, dietro copre la nuca anche a testa grande inclinata in giù.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js).
// Con la calotta del cranio vero del motore: il corpo era alto 11,8 cm sopra la fascia (fatto per capelli voluminosi:
// la cima stava a 17–20, una testa calva vera arriva a 13,8–14,5). Ora il corpo segue la calotta 0,6–1,9 cm fuori
// (cima a ~15,2), il risvolto si stringe con la testa e il pompon sta sulla cima nuova.
import { wool, headOccluder, roundBand, smooth } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Berretto di lana', labelEn: 'Beanie', category: 'accessori', icon: '🧶' };

export default function build(THREE, h) {
  const root = new THREE.Group();
  const g = new THREE.Group(); root.add(g);
  const RED = 0x9c1f27, RIBS = 30;
  const knit = wool(THREE, RED, [14, 2.6]);        // 112 colonne di punti attorno (~5 mm), 26 righe (~6,5 mm): punti più alti che larghi
  const knitCuff = wool(THREE, RED, [14, 0.85]);
  const yarn = new THREE.MeshPhysicalMaterial({ color: 0xe8e0d2, roughness: 1, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.25 });

  // corpo: dalla base (sopra le orecchie) alla sommità morbida, coste in rilievo, pieghe verso la cima
  const prof = [[8.75, 0], [8.82, 0.6], [8.85, 1.2], [8.61, 1.8], [8.33, 2.4], [8.0, 3.0], [7.63, 3.6], [7.21, 4.2], [6.72, 4.8], [5.97, 5.4], [4.74, 6.0], [3.3, 6.5], [1.6, 6.78], [0, 6.85]];
  // raggio del corpo all'altezza y (per stringere il risvolto con la testa)
  const profR = (y) => { if (y <= 0) return prof[0][0]; for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0; };
  const body = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 120);
  { const p = body.attributes.position, uv = body.attributes.uv, col = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      // coste: onda arrotondata (non sinusoide pura: il rilievo della maglia è piatto in cima)
      const rib = Math.pow(0.5 + 0.5 * Math.cos(a * RIBS), 0.6);
      const fold = 0.035 * Math.sin(a * 5 + 1.3) * smooth(3, 6, y);                    // pieghe morbide verso la cima
      const k = r < 0.3 ? 1 : 1 + (0.03 * rib + fold) * Math.min(1, r / 4);
      p.setXYZ(i, x * k, y, z * k);
      uv.setXY(i, uv.getX(i), y / 11.8);
      const sh = 0.78 + 0.22 * rib;                                                      // fondo delle coste in ombra
      col.push(sh, sh, sh);
    }
    body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    body.computeVertexNormals(); }
  knit.vertexColors = true;
  g.add(new THREE.Mesh(body, knit));

  // risvolto: anello spesso con bordo superiore e inferiore arrotondati, coste in rilievo
  const cuff = roundBand(THREE, 9.25, 4.3, 0.95, 120, 0.42); cuff.translate(0, -1.3, 0);
  { const q = cuff.attributes.position, uv = cuff.attributes.uv, col = [];
    for (let i = 0; i < q.count; i++) { const x = q.getX(i), z = q.getZ(i), a = Math.atan2(z, x), rib = Math.pow(0.5 + 0.5 * Math.cos(a * RIBS), 0.6), k = 1 + 0.022 * rib;
      const kt = k * Math.max(0.5, 1 - (prof[0][0] - profR(q.getY(i))) / Math.hypot(x, z));   // il risvolto segue il corpo che si stringe
      q.setXYZ(i, x * kt, q.getY(i), z * kt); uv.setXY(i, uv.getX(i), (q.getY(i) + 1.3) / 4.3); const sh = 0.8 + 0.2 * rib; col.push(sh, sh, sh); }
    cuff.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    cuff.computeVertexNormals(); }
  knitCuff.vertexColors = true;
  g.add(new THREE.Mesh(cuff, knitCuff));

  // pompon: palla di fili (sfera con tanti ciuffetti istanziati, più scuri verso l'interno)
  const pomGroup = new THREE.Group(); pomGroup.position.y = 8.3;
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.1, 24, 18), yarn); pomGroup.add(core);
  const strand = new THREE.CylinderGeometry(0.06, 0.14, 1.2, 4, 1); strand.translate(0, 0.6, 0);
  const NS = 300, inst = new THREE.InstancedMesh(strand, yarn, NS), M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < NS; i++) {
    const u = R() * 2 - 1, ph = R() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = new THREE.Vector3(s * Math.cos(ph), u, s * Math.sin(ph));
    const jitter = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.5); const dir = d.clone().add(jitter).normalize();
    q.setFromUnitVectors(up, dir); const L = 0.8 + 0.7 * R();
    M.compose(d.clone().multiplyScalar(1.7 + 0.3 * R()), q, new THREE.Vector3(1, L, 1)); inst.setMatrixAt(i, M);
    const k = 0.75 + 0.3 * R(); c.setRGB(k, k * 0.97, k * 0.92); inst.setColorAt(i, c);
  }
  pomGroup.add(inst);
  g.add(pomGroup);
  g.scale.set(0.876, 1.000, 1.053);
  g.position.set(0, 8.40, -4.45);
  g.rotation.x = -0.067;
  return hatFit(THREE, h, root, g, { rimY: -1.3 });
}
