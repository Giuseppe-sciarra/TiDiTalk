// Tiditalk AR, effetto "anime" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, HC, fin, hairMat, headPt, mergeGeo, mixc, rgb, shortCap, tuftGeo } from './_kit_hair.js';
export const meta = { label: 'Capelli anime', labelEn: 'Anime spiky hair', category: 'capelli', icon: '⚡' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pal = [rgb(THREE, 0x06164a), rgb(THREE, 0x1a56d0), rgb(THREE, 0x6aa4ff)], cb = pal[1], cl = mixc(pal[1], pal[2], 0.45), cd = mixc(pal[0], pal[1], 0.5);
  const bot = shortCap(THREE, g, { pal, vol: 3.0, rim: 0.45, N: 16, seed: 2, relief: 0.4, gloss: 0.9, rough: 0.45,
    hairline: [[0, 8.0], [25, 7.7], [45, 6.6], [60, 4.8], [75, 3.0], [90, 2.2], [110, 0.6], [135, -1.4], [160, -3.0], [180, -3.6]] });
  // grandi punte: cima/dietro verso l'alto-indietro, davanti una frangia di punte verso il basso-fuori (sopra le sopracciglia, non sugli occhi)
  const parts = [], tuft = tuftGeo(THREE, 9);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0);
  const spike = (p, dir, len, rad, col) => { q.setFromUnitVectors(up, dir.normalize()); M.compose(p, q, V(rad, len, rad)); parts.push({ geo: tuft, matrix: M.clone(), color: col }); };
  const top = [ // [θ°, φ°, len, lean x, lean y, lean z]
    [0, 10, 9.5, 0, 1, -0.6], [40, 22, 8.5, 0.5, 1, -0.5], [-40, 22, 8.5, -0.5, 1, -0.5], [90, 30, 8, 0.7, 1, -0.4], [-90, 30, 8, -0.7, 1, -0.4],
    [150, 34, 8.5, 0.3, 1, -1.0], [-150, 34, 8.5, -0.3, 1, -1.0], [180, 50, 7.5, 0, 0.8, -1.2], [20, 36, 7, 0.4, 1, 0.3], [-20, 36, 7, -0.4, 1, 0.3],
    [65, 48, 6.5, 1, 0.8, -0.3], [-65, 48, 6.5, -1, 0.8, -0.3], [120, 50, 6.5, 0.9, 0.9, -0.8], [-120, 50, 6.5, -0.9, 0.9, -0.8],
  ];
  top.forEach(([t, p, len, lx, ly, lz], i) => {
    const P = headPt(THREE, t * D2R, p * D2R, 2.4), n = P.clone().sub(V(HC[0], HC[1], HC[2])).normalize();
    spike(P.clone().addScaledVector(n, -0.8), n.clone().multiplyScalar(0.6).add(V(lx, ly, lz)), len, 1.9 + 0.3 * (i % 3), i % 2 ? cl : cb);
  });
  // frangia a punte
  const fr = [[-34, 5.5, -0.6], [-20, 6.0, -0.3], [-6, 6.2, 0], [8, 6.2, 0.2], [22, 6.0, 0.4], [36, 5.5, 0.7]];
  fr.forEach(([t, len, lx], i) => {
    const ph = bot(t * D2R) - 0.25, P = headPt(THREE, t * D2R, ph, 1.4), n = P.clone().sub(V(HC[0], HC[1], HC[2])).normalize();
    spike(P.clone().addScaledVector(n, -0.5), n.clone().multiplyScalar(0.9).add(V(lx, -1.1, 0.4)), len, 1.4, i % 2 ? cb : cd);
  });
  g.add(new THREE.Mesh(mergeGeo(THREE, parts), hairMat(THREE, { roughness: 0.45 })));
  return fin(g);
}
