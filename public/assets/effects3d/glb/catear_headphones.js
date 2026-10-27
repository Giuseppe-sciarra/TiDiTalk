// Cat-ear headphones — CC-BY-4.0, miren_max
// Modello: catear_headphones.glb. 1.8.0: materiali opachi (prima metallo cromato: mancava metallicFactor → 1), plastica morbida rosa/bianco, normali lisce.
// 1.8.9: calzate sulla testa vera. Nel modello i padiglioni erano stretti (cuscinetti a 2,9 cm dal centro: dentro la testa)
// e l'archetto stava 4–5 cm sopra la testa: nell'app si vedeva solo il davanti dei padiglioni, vicino alle tempie e agli
// occhi, e l'archetto galleggiava. Ora la forma viene piegata (warp) nello spazio del viso: padiglioni spostati in fuori
// (cuscinetto appoggiato al lato della testa, sull'orecchio vero ~(±7,6, 0,8, −4,5)) e un po' più sottili, archetto
// abbassato di 3,45 cm fino alla calotta del cranio vero del motore e stretto (×0,88) sopra; i fianchi dell'archetto
// scendono in diagonale fino ai padiglioni.
// Riempitivi invisibili con la forma della testa vera: girando la testa il padiglione lontano resta dietro la testa.
import { loadHead, toCanon, realHeadOccluder, faceCopyOccluder } from './_glbhead.js';
export const meta = {"label": "Cuffie con orecchie da gatto", "labelEn": "Cat-ear headphones", "category": "accessori", "icon": "🎧"};
const P = {"c": [0.0, 0.35965, 0.0], "s": 42.974, "p": [0.0, 9.0, -3.3], "r": [0, 0, 0]};
const O = {"env": 0.35, "metal": 0, "matRough": {"Material.001": 0.42, "Material.005": 0.32, "Material.003": 0.3, "Material.006": 0.4, "Material.004": 0.55, "Material.007": 0.6}, "matColor": {"Material.001": [0.93, 0.9, 0.92], "Material.005": [0.96, 0.82, 0.88]}, "emissive": 0.8};
const CREASE = 50;
// warp (cm, spazio del viso): padiglioni sotto y = 5, archetto sopra
const W = { cupX0: 2.9, cupIn: 7.65, cupK: 0.72, drop: 3.45, topK: 0.88, dz: -1.2 };
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function warp(v) {
  const s = Math.sign(v.x) || 1, ax = Math.abs(v.x);
  const cup = W.cupIn + (ax - W.cupX0) * W.cupK;
  if (v.y <= 5.0) v.x = s * cup;
  else {
    const yn = v.y - W.drop * sst(5.0, 12.5, v.y), t = sst(5.0, 8.9, yn);
    v.x = s * (cup * (1 - t) + ax * W.topK * t); v.y = yn;
  }
  v.z += W.dz;
}

export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./catear_headphones.glb', import.meta.url).href, P, O, 'catear_headphones');
  const v = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    const M = toCanon(THREE, g, o), Mi = M.clone().invert(), pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); warp(v); v.applyMatrix4(Mi); pos.setXYZ(i, v.x, v.y, v.z); }
    pos.needsUpdate = true;
    // normali lisce con lo spigolo, ricalcolate sulla forma nuova
    if (h.BufferGeometryUtils?.toCreasedNormals) { const g0 = o.geometry; o.geometry = h.BufferGeometryUtils.toCreasedNormals(g0, CREASE * Math.PI / 180); g0.dispose(); }
    else o.geometry.computeVertexNormals();
    o.geometry.computeBoundingSphere();
  });
  g.add(realHeadOccluder(THREE));
  if (h.face) g.add(faceCopyOccluder(THREE, h));
  return g;
}
