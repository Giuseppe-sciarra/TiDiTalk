// Baffi a manubrio: folti al centro e arricciati in su alle punte, fatti di CIOCCHE di peli (tanti fili sottili
// che seguono la stessa curva, sfalsati e di lunghezze diverse) sopra un'anima scura: si legge come pelo, non come un
// corno lucido. Stanno sul labbro superiore: aprendo la bocca il labbro di sopra quasi non si muove (scende appena),
// col sorriso le punte salgono e si allargano ruotando attorno al centro (niente buco sotto il naso).
import { bundleGeo, tubeGeo, mergeGeo, hairMat, mixc, rgb, rng, tintSpec } from '../hair/_kit_hair.js';
export const meta = { label: 'Baffi a manubrio', labelEn: 'Handlebar mustache', category: 'accessori', icon: '👨' };

const CENTER = [0, -2.62, 6.72];      // punto sotto il naso dove i due baffi si toccano (perno del sorriso)

export default function build(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pal = [rgb(THREE, 0x050302), rgb(THREE, 0x140b06), rgb(THREE, 0x3d2718)];
  // curva del baffo (lato +X): dal centro lungo il labbro, poi in fuori e in su con il ricciolo
  const SPINE = [[0.0, -2.62, 6.78], [1.3, -2.82, 6.62], [2.6, -2.98, 6.16], [3.75, -2.62, 5.56], [4.6, -1.78, 5.1], [4.85, -0.82, 4.96], [4.35, -0.22, 5.06]];
  const spine = new THREE.CatmullRomCurve3(SPINE.map(p => V(...p)), false, 'centripetal', 0.5);
  const thick = (t) => 0.95 * Math.pow(1 - t, 0.55) * (1 - 0.4 * Math.max(0, 1 - t * 4)) + 0.07;
  const R = rng(17), parts = [];
  // anima: fascio scuro un po' più sottile (riempie i buchi fra i fili)
  parts.push(bundleGeo(THREE, SPINE.map(p => V(...p)), (t) => thick(t) * 0.82, () => pal[0], 48, 12, 5, 0.3, 0.15));
  // fili: 44 ciocchine sottili, ognuna parte da un punto della sezione e segue la curva, si assottiglia e finisce
  // prima o dopo (punte sfilate), colore che va dal quasi nero alla luce
  const fr = spine.computeFrenetFrames(40, false);
  for (let k = 0; k < 44; k++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.85, end = 0.55 + 0.45 * Math.pow(R(), 0.5), start = 0.02 * R();
    const tw = (R() - 0.5) * 1.2, pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = start + (end - start) * i / 12, j = Math.min(40, Math.round(t * 40)), P = spine.getPointAt(t);
      const ang = a + tw * t * 6, r = rr * thick(t);
      pts.push(P.clone().addScaledVector(fr.normals[j], Math.cos(ang) * r).addScaledVector(fr.binormals[j], Math.sin(ang) * r * 0.85));
    }
    const w = 0.12 + 0.09 * R(), c = mixc(mixc(pal[0], pal[1], 0.5 + 0.5 * R()), pal[2], 0.45 * Math.pow(R(), 2) * (rr > 0.5 ? 1 : 0.4));
    parts.push(tubeGeo(THREE, pts, (t) => w * (1 - 0.85 * t) + 0.012, 10, 4, () => c));
  }
  const geo = mergeGeo(THREE, parts);
  geo.translate(-CENTER[0], -CENTER[1], -CENTER[2]);
  const mat = hairMat(THREE, Object.assign({ roughness: 0.78, hair: { strand: 0.5, kk: [0.025, 0.12], shift: [-0.03, 0.05], exp: [50, 12] } }, tintSpec(THREE, pal, 0.12)));
  const sides = [];
  for (const s of [-1, 1]) {
    const side = new THREE.Group(); side.position.set(...CENTER); g.add(side); sides.push(side);
    const m = new THREE.Mesh(geo, mat); if (s < 0) m.scale.x = -1; side.add(m);       // un lato specchiato: identici
  }
  g.userData.sides = sides;        // [sinistra (-X), destra (+X)]
  return g;
}

// bs calibrati 0..1: sorriso → le punte salgono ruotando attorno al centro; bocca spalancata → il labbro di sopra
// scende appena (≈2 mm); bacio → i baffi si raccolgono e vengono un poco avanti
export function update(g, bs) {
  const jaw = bs.jawOpen || 0, pk = bs.mouthPucker || 0;
  const [l, r] = g.userData.sides;
  for (const [side, s, sm] of [[l, -1, bs.mouthSmileRight || 0], [r, 1, bs.mouthSmileLeft || 0]]) {
    side.position.set(CENTER[0], CENTER[1] - 0.2 * jaw + 0.1 * sm, CENTER[2] + 0.12 * pk);
    side.rotation.set(0, -s * 0.15 * pk, s * (0.14 * sm - 0.04 * jaw));
    side.scale.set(1 + 0.06 * sm - 0.15 * pk, 1, 1);
  }
}
