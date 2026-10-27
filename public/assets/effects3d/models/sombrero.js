// Sombrero di paglia: tesa larghissima con bordo rialzato, corona alta con incavo, fascia a zig-zag colorata e pon-pon.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js);
// tolto il fondo chiuso/disco sotto la cupola: da sotto si vedeva come un coperchio.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Sombrero', labelEn: 'Sombrero', category: 'costumi', icon: '🪇' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  // paglia: texture procedurale a trama incrociata
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b8853a'; ctx.fillRect(0, 0, 256, 256);
  // trama a spina di pesce morbida (fibre in diagonale alternate), niente griglia regolare
  for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) {
    ctx.strokeStyle = ((x + y) / 8) % 2 ? 'rgba(92,58,20,.28)' : 'rgba(236,196,120,.30)'; ctx.lineWidth = 2;
    ctx.beginPath(); if ((y / 8) % 2) { ctx.moveTo(x, y); ctx.lineTo(x + 8, y + 8); } else { ctx.moveTo(x + 8, y); ctx.lineTo(x, y + 8); } ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 2);
  const straw = new THREE.MeshStandardMaterial({ map: tex, roughness: .95 });
  const strawBrim = new THREE.MeshStandardMaterial({ map: tex, roughness: .95, vertexColors: true });
  const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // corona: alta, leggermente conica, con un incavo in cima
  const crownGeo = lathe([[8.4, 0], [8.5, 3], [8.0, 7], [7.3, 10.5], [6.4, 12.8], [5.2, 13.6], [3.0, 13.2], [0, 12.6]]);
  g.add(new THREE.Mesh(crownGeo, straw));

  // tesa larghissima che si incurva verso l'alto al bordo, con onde leggere
  const R0 = 7.9, R1 = 19.5;
  const brimGeo = lathe([[R0, 0.2], [11.5, -0.1], [15.5, 0.5], [18.2, 2.0], [R1, 3.6], [R1 + 0.4, 3.8], [R1 + 0.1, 4.3], [18.0, 2.6], [15.5, 1.1], [11.5, 0.5], [R0, 0.8], [R0, 0.2]], 112);
  const q = brimGeo.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const x = q.getX(i), z = q.getZ(i), r = Math.hypot(x, z), th = Math.atan2(z, x);
    const f = Math.max(0, (r - R0) / (R1 - R0));
    q.setY(i, q.getY(i) + 0.35 * Math.sin(6 * th) * f * f);
  }
  brimGeo.computeVertexNormals();
  // sotto la tesa più scuro (è all'ombra): colore per vertice in base alla normale
  { const n = brimGeo.attributes.normal, col = [];
    for (let i = 0; i < n.count; i++) { const k = n.getY(i) < -0.2 ? 0.62 : 1.0; col.push(k, k * 0.97, k * 0.93); }
    brimGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  g.add(new THREE.Mesh(brimGeo, strawBrim));
  // orlo bianco lungo il bordo
  const edge = [];
  for (let i = 0; i <= 96; i++) { const th = i / 96 * Math.PI * 2; edge.push(new THREE.Vector3(Math.cos(th) * (R1 + 0.2), 4.05 + 0.35 * Math.sin(6 * th), Math.sin(th) * (R1 + 0.2))); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 160, 0.35, 8, true), h.mat(0xe6dac4, { roughness: .8 })));

  // fascia a zig-zag colorata (texture)
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 64;
  const bctx = bc.getContext('2d');
  bctx.fillStyle = '#c8322b'; bctx.fillRect(0, 0, 512, 64);
  const cols = ['#2f9e5a', '#f2c230', '#2b64c2', '#ffffff'];
  for (let k = 0; k < 4; k++) {
    bctx.fillStyle = cols[k]; bctx.beginPath();
    for (let x = 0; x <= 512; x += 32) { const y = 12 + k * 10 + (((x / 32) % 2) ? 8 : -8); x ? bctx.lineTo(x, y) : bctx.moveTo(x, y); }
    bctx.lineWidth = 5; bctx.strokeStyle = cols[k]; bctx.stroke();
  }
  const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace; btex.wrapS = THREE.RepeatWrapping; btex.repeat.set(3, 1);
  const bandMat = new THREE.MeshStandardMaterial({ map: btex, roughness: .8 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(8.55, 8.68, 2.6, 96, 1, true), bandMat); band.position.y = 2.4; g.add(band);

  // pon-pon colorati appesi al bordo della tesa
  const pomCols = [0xc8322b, 0x2f9e5a, 0xf2c230, 0x2b64c2];
  for (let i = 0; i < 16; i++) {
    const th = i / 16 * Math.PI * 2 + 0.2;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), h.mat(pomCols[i % 4], { roughness: .9 }));
    pom.position.set(Math.cos(th) * (R1 - 0.5), 2.6 + 0.35 * Math.sin(6 * th), Math.sin(th) * (R1 - 0.5)); g.add(pom);
  }
  g.scale.set(0.961, 1.009, 1.115);
  g.position.set(0, 7.60, -4.85);
  g.rotation.x = -0.146;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(7.6, 6, 7.6); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(finish(THREE, root)), g, { rimY: 0.0, face: false });
}
