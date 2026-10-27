// Cappellino con l'elica: spicchi colorati, visierina, elica che gira (più veloce quando si sorride o si apre la bocca).
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js).
// Con la calotta del cranio vero del motore: la cupola arrivava a y 17,5 (fatta per capelli voluminosi; una testa calva
// vera arriva a 13,8–14,5): ora segue la testa 0,5–1 cm fuori (cima a ~14,5) e l'elica scende con lei.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Cappellino con elica', labelEn: 'Propeller cap', category: 'costumi', icon: '🚁' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // cupola a 6 spicchi colorati (colori per vertice, transizione netta)
  const PROF = [[8.7, -0.8], [8.75, 0.0], [8.64, 0.6], [8.16, 1.2], [7.8, 1.8], [7.37, 2.4], [6.86, 3.0], [6.25, 3.6], [5.52, 4.2], [4.6, 4.8], [3.4, 5.3], [1.8, 5.62], [0, 5.72]];
  const dome = lathe(PROF);
  const cols = [0xd8262f, 0xf2b705, 0x1f6fd1, 0x2a9d4b, 0xd8262f, 0xf2b705].map(c => new THREE.Color(c));
  const p = dome.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    let a = Math.atan2(p.getZ(i), p.getX(i)); if (a < 0) a += Math.PI * 2;
    const c = cols[Math.floor(a / (Math.PI / 3)) % 6]; col.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  dome.toNonIndexed && null;
  g.add(new THREE.Mesh(dome, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 })));
  // cuciture tra gli spicchi
  const seam = h.mat(0x23252c, { roughness: .8 });
  const prof = PROF;
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, pts = [];
    for (const [r, y] of prof) pts.push(new THREE.Vector3(Math.cos(a) * (r + 0.08), y + 0.02, Math.sin(a) * (r + 0.08)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.07, 5), seam));
  }
  // bordino
  const band = new THREE.Mesh(new THREE.TorusGeometry(8.75, 0.25, 8, 96), seam); band.rotation.x = Math.PI / 2; band.position.y = -0.7; g.add(band);
  // visierina corta (giallo), attaccata sotto il bordo
  const sh = new THREE.Shape();
  sh.moveTo(-6.4, -7.0); sh.absellipse(0, -7.0, 6.4, 4.0, Math.PI, 2 * Math.PI, false); sh.lineTo(6.4, -5.2); sh.absarc(0, 0, 8.4, -0.9, -2.24, true); sh.closePath();
  const vis = new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: true, bevelSize: .1, bevelThickness: .08, bevelSegments: 2, curveSegments: 24 });
  vis.rotateX(Math.PI / 2); vis.rotateY(Math.PI); vis.translate(0, 0, -8.4); vis.computeVertexNormals();
  const visor = new THREE.Mesh(vis, h.mat(0x1f6fd1, { roughness: .7 })); visor.position.set(0, -0.75, 8.4); visor.rotation.x = 0.12; g.add(visor);

  // elica: perno + mozzo + due pale svergolate
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.4, 12), h.mat(0xb9bcc2, { roughness: .3, metalness: .9 })); post.position.y = 6.77; g.add(post);
  const prop = new THREE.Group(); prop.position.y = 7.97;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), h.mat(0xd8262f, { roughness: .4 })); prop.add(hub);
  const bladeShape = new THREE.Shape(); bladeShape.moveTo(0.3, -0.6); bladeShape.quadraticCurveTo(4.2, -1.9, 7.6, -0.8); bladeShape.quadraticCurveTo(8.4, 0, 7.6, 0.8); bladeShape.quadraticCurveTo(4.2, 1.9, 0.3, 0.6); bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.12, bevelEnabled: true, bevelSize: .05, bevelThickness: .04, bevelSegments: 1 });
  bladeGeo.rotateX(Math.PI / 2);
  const bp = bladeGeo.attributes.position;   // svergolatura lungo la pala
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i), tw = 0.55 * Math.min(1, x / 4); bp.setY(i, bp.getY(i) + z * Math.sin(tw)); bp.setZ(i, z * Math.cos(tw)); }
  bladeGeo.computeVertexNormals();
  for (const [r, c] of [[0, 0xf2b705], [Math.PI, 0x2a9d4b]]) { const b = new THREE.Mesh(bladeGeo, h.mat(c, { roughness: .5, side: THREE.DoubleSide })); b.rotation.y = r; prop.add(b); }
  g.add(prop);
  g.scale.set(0.885, 0.979, 1.068);
  g.position.set(0, 8.90, -4.50);
  g.rotation.x = -0.091;
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.2, 5, 8.2); occ.position.set(0, -2.2, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  g.userData.prop = prop; g.userData.ang = 0; g.userData.last = null;
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(finish(THREE, root)), g, { rimY: -0.77, face: false });
}

export function update(g, bs, t) {
  const u = g.userData; const dt = u.last == null ? 0.016 : Math.min(0.1, t - u.last); u.last = t;
  // gira più forte col sorriso o soffiando (bacio/bocca a "o"); parlare non deve farla impazzire
  const boost = Math.min(1, Math.max(((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2, bs.mouthPucker || 0, bs.mouthFunnel || 0, 0.4 * (bs.jawOpen || 0)));
  u.ang += dt * (4 + 16 * boost);
  u.prop.rotation.y = u.ang;
}
