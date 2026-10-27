// Tiditalk AR, effetto "grigi" — la geometria comune di capelli e barbe sta in _kit_hair.js
// 1.8.9: calzata fuori dalla calotta del cranio vero del motore (useCranium): prima la cuffia corta, fatta sul profilo
// piccolo della testa, in cima e sopra la fronte stava dentro la testa vera (il 14 % della superficie si sarebbe perso).
import { HC, fin, hairMat, headPt, mergeGeo, mixc, rgb, rng, shortCap, smooth, tintSpec, tuftGeo, vnoise, useCranium } from './_kit_hair.js';
export const meta = { label: 'Capelli grigi con basette', labelEn: 'Grey hair with sideburns', category: 'capelli', icon: '👴' };
export default function build(THREE, h) { useCranium(0.25); try { return make(THREE, h); } finally { useCranium(0); } }
function make(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // grigio "sale e pepe": radici più scure, punte chiare (mai bianco puro), tempie stempiate, basette fino a metà orecchio
  const pal = [rgb(THREE, 0x18181a), rgb(THREE, 0x55555b), rgb(THREE, 0xa6a6ae)];
  const bot = shortCap(THREE, g, { pal, vol: 2.8, rim: 0.35, N: 56, seed: 12, relief: 0.5, gloss: 0.4, noise: 0.35, rough: 0.8,
    fur: { layers: 7, len: 0.7, dir: [0, 0.1, -0.5], frizz: 0.15, cell: 0.13 },
    hairline: [[0, 9.6], [12, 9.4], [24, 8.4], [34, 8.9], [46, 7.6], [60, 5.4], [70, 3.6], [75, 1.0], [79, -2.4], [87, -2.6], [91, 0.4], [110, 0.2], [135, -1.8], [160, -3.6], [180, -4.2]],
    tint: (c, th, v) => { const n = vnoise(th * 23, v * 9); return mixc(mixc(c, pal[0], 0.4 * smooth(0.6, 0.9, n)), pal[2], 0.3 * smooth(0.65, 0.95, 1 - n)); } });
  // ciuffi corti pettinati all'indietro (rompono la sagoma liscia della cuffia)
  const R = rng(31), parts = [], tuft = tuftGeo(THREE, 7);
  const up = V(0, 1, 0), q = new THREE.Quaternion(), M = new THREE.Matrix4(), sc = new THREE.Vector3();
  let n = 0, guard = 0;
  while (n < 26 && guard++ < 9000) {
    const th = (R() * 2 - 1) * Math.PI, ph = Math.acos(1 - 2 * R());
    const b = bot(th); if (ph > Math.min(b - 0.25, 1.0)) continue;
    const vv = ph / b, capO = 0.35 + 2.65 * smooth(0, 0.5, 1 - vv) + 0.8 * Math.pow(1 - vv, 2.5);
    const p = headPt(THREE, th, ph, capO - 0.2), nrm = p.clone().sub(V(HC[0], HC[1], HC[2])).normalize();
    const back = V(0, 0.1, -1).addScaledVector(nrm, 0.35).normalize();
    q.setFromUnitVectors(up, back); const rr = 1.3 + 0.6 * R(); sc.set(rr, 2.0 + 1.2 * R(), rr * 0.6);
    M.compose(p.clone().addScaledVector(nrm, -0.6), q, sc);
    const c = mixc(pal[1], pal[2], 0.6 * R()); parts.push({ geo: tuft, matrix: M.clone(), color: c }); n++;
  }
  g.add(new THREE.Mesh(mergeGeo(THREE, parts), hairMat(THREE, Object.assign({ roughness: 0.8 }, tintSpec(THREE, pal, 0.3)))));
  return fin(g);
}
