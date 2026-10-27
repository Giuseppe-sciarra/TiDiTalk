// Tiditalk AR, effetto "elvis" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { TAU, fin, hairMat, hairShade, lockAt, rgb, shortCap, surfGeo, tintSpec } from './_kit_hair.js';
export const meta = { label: 'Ciuffo rock anni 50', labelEn: 'Rockabilly pompadour', category: 'capelli', icon: '🎸' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // nero vero: riflesso blu-nero contenuto (un riflesso grigio su video vero lo fa sembrare grigio)
  const pal = [rgb(THREE, 0x010102), rgb(THREE, 0x070709), rgb(THREE, 0x2e3240)];
  // basette: tra 76° e 90° l'attaccatura scende fino a metà orecchio
  shortCap(THREE, g, { pal, vol: 3.0, rim: 0.35, N: 30, seed: 8, relief: 0.35, gloss: 1.0, rough: 0.32, matOpt: { specularIntensity: 0.7 },
    hairline: [[0, 8.4], [25, 8.0], [45, 6.9], [60, 5.2], [70, 3.6], [75, 1.0], [79, -2.4], [87, -2.6], [91, 0.4], [110, 0.4], [135, -1.6], [160, -3.4], [180, -4.0]] });
  // il ciuffo: un grande "rotolo" sopra la fronte con le ciocche che girano attorno alla sezione (pettinate su e indietro),
  // alto al centro e stretto alle tempie, più una seconda onda dietro che raccorda il rotolo alla cuffia
  const tube = (pts, R0, R1, NL) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5), fr = curve.computeFrenetFrames(60, false);
    return surfGeo(THREE, 60, 22, (u, v) => {
      const i = Math.round(u * 60), P = curve.getPointAt(u), a = v * TAU;
      const L = lockAt(u * TAU, NL, 4), r = (R0 + (R1 - R0) * Math.pow(Math.sin(Math.PI * u), 0.8)) * (1 + 0.035 * L.b);
      // sezione schiacciata: più alta che profonda
      return P.clone().addScaledVector(fr.normals[i], Math.cos(a) * r * 0.85).addScaledVector(fr.binormals[i], Math.sin(a) * r);
    }, (u, v) => { const L = lockAt(u * TAU, NL, 4), up = 0.5 + 0.5 * Math.sin(v * TAU); return hairShade(pal, 0.85, L.b, 0.8 * up * L.b); }, () => V(0, 1, 0));
  };
  const qm = hairMat(THREE, Object.assign({ roughness: 0.32, side: THREE.DoubleSide }, tintSpec(THREE, pal, 0.7)));
  g.add(new THREE.Mesh(tube([V(-6.8, 6.6, 0.8), V(-4.8, 10.2, 4.0), V(-1.7, 12.0, 5.4), V(1.7, 12.0, 5.4), V(4.8, 10.2, 4.0), V(6.8, 6.6, 0.8)], 0.5, 3.0, 34), qm));
  g.add(new THREE.Mesh(tube([V(-6.6, 8.2, -1.6), V(-4.4, 11.8, 0.6), V(-1.5, 12.9, 2.0), V(1.5, 12.9, 2.0), V(4.4, 11.8, 0.6), V(6.6, 8.2, -1.6)], 0.5, 2.8, 30), qm));
  return fin(g);
}
