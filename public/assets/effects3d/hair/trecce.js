// Tiditalk AR, effetto "trecce" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { TAU, bundleGeo, fin, hairMat, hairShade, mergeGeo, mixc, rgb, shortCap, smooth, tintSpec, tubeGeo, tuftGeo } from './_kit_hair.js';
export const meta = { label: 'Trecce', labelEn: 'Twin braids', category: 'capelli', icon: '👧' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const cb = rgb(THREE, 0x3e200c), cl = rgb(THREE, 0x6a3e1c), cd = rgb(THREE, 0x1e0e05);
  const pal = [rgb(THREE, 0x120803), rgb(THREE, 0x3e200c), rgb(THREE, 0x7e4e26)];
  // cuffia liscia con riga in mezzo, abbastanza spessa da coprire i capelli veri
  // (attaccatura alta e tonda sulla fronte, bordo sfumato: niente frangia "a scodella")
  shortCap(THREE, g, { pal, vol: 3.9, rim: 0.35, N: 36, seed: 3, relief: 0.3, part: 0, gloss: 0.8, soft: 0.2, hairline: [[0, 9.3], [6, 9.1], [20, 8.7], [35, 8.0], [50, 6.6], [62, 4.8], [75, 3.0], [90, 1.6], [110, 0.2], [135, -2.0], [160, -3.6], [180, -4.0]] });
  const parts = [];
  const tie = new THREE.MeshStandardMaterial({ color: 0xd62a5a, roughness: 0.7, envMapIntensity: 0.3 });
  for (const sx of [-1, 1]) {
    const path = [V(sx * 5.8, -0.5, -8.4), V(sx * 8.4, -3.6, -4.6), V(sx * 9.4, -7.5, -0.4), V(sx * 9.0, -12.0, 3.6), V(sx * 8.4, -16.5, 5.6), V(sx * 7.8, -21.5, 6.2)];
    const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal', 0.5);
    const SEG = 150, fr = curve.computeFrenetFrames(SEG, false);
    // treccia a 3 capi vera: ogni capo va avanti e indietro (lato-lato) incrociandosi davanti/dietro agli altri due,
    // non una spirale. Capo k: x = sin(φ), z = sin(2φ)/2 con φ sfasato di 2π/3 → la classica "spiga" a incroci.
    const CROSS = 7.5, W = 1.15, D = 0.65;
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG, P = curve.getPointAt(t), ph = t * CROSS * TAU + k * TAU / 3;
        const env = (t < 0.07 ? t / 0.07 : 1) * (1 - 0.5 * smooth(0.85, 1, t));
        pts.push(P.clone().addScaledVector(fr.binormals[i], Math.sin(ph) * W * env).addScaledVector(fr.normals[i], Math.sin(2 * ph) * 0.5 * D * env));
      }
      // ogni capo: fascio con le ciocche in rilievo, più scuro nei punti in cui passa sotto agli altri (ombra)
      const kk = k;
      parts.push(bundleGeo(THREE, pts, (t) => 0.82 * (t < 0.05 ? 0.4 + t / 0.05 * 0.6 : 1) * (1 - 0.4 * smooth(0.85, 1, t)) * (t > 0.985 ? (1 - t) / 0.015 : 1),
        (t, b) => { const ph = t * CROSS * TAU + kk * TAU / 3, under = 0.5 - 0.5 * Math.sin(2 * ph); return hairShade(pal, 0.65 + 0.35 * smooth(0, 0.15, t), b, 0.55 * b * (1 - under)).map(c => c * (1 - 0.45 * under)); },
        SEG, 10, 4, 0.08, 0.2));
    }
    // elastico e nappina finale
    const endP = curve.getPointAt(0.93), tan = curve.getTangentAt(0.93);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.38, 8, 20), tie);
    ring.position.copy(endP); ring.quaternion.setFromUnitVectors(V(0, 0, 1), tan); g.add(ring);
    const tuft = tuftGeo(THREE, 8); const M = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), curve.getTangentAt(1));
    M.compose(curve.getPointAt(0.94), q, V(1.5, 3.2, 1.5)); parts.push({ geo: tuft, matrix: M, color: cb });
  }
  g.add(new THREE.Mesh(mergeGeo(THREE, parts), hairMat(THREE, Object.assign({ roughness: 0.55 }, tintSpec(THREE, pal)))));
  return fin(g);
}
