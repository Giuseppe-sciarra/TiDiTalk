// Calavera — CC0-1.0, Kay Lousberg (www.kaylousberg.com)
// Modello: sugar_skull.glb (KayKit Skeletons). 1.8.0: mascella che si apre con la tua bocca (valori calibrati:
// 1 = bocca spalancata → 14°, prima 22° pieni), sorriso e broncio inclinano un po' la mascella, i lumini degli occhi
// si chiudono quando sbatti/strizzi gli occhi e seguono lo sguardo, le "sopracciglia" (arcate) si alzano e si aggrottano.
import { loadHead } from './_glbhead.js';
export const meta = {"label": "Calavera", "labelEn": "Calavera", "category": "personaggi", "icon": "💀"};
export const hideHead = true;
const P = {"c": [0.0, 1.67969, -0.0023], "s": 29.403, "p": [0.0, 2.7, -1.5], "r": [0, 0, 0]};
const O = {"env": 0.6, "rough": 0.62};
const JAW_MAX = 0.24;          // rad a bocca spalancata (14°)
const JAW_DROP = 1.6;          // cm in giù a bocca spalancata (si vede di fronte)
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const B = (bs, k) => { const v = bs ? bs[k] : 0; return (typeof v === 'number' && v === v) ? c01(v) : 0; };
const sm = (s, k, v, a) => { const p = s[k]; return (s[k] = p === undefined ? v : p + (v - p) * a); };

export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./sugar_skull.glb', import.meta.url).href, P, O, 'sugar_skull');
  const u = g.userData;
  // mandibola: perno sul bordo alto posteriore (cerniera vicino alle orecchie)
  const jaw = model.getObjectByName('Skeleton_Mage_Jaw');
  if (jaw && jaw.geometry) {
    jaw.geometry.computeBoundingBox();
    const b = jaw.geometry.boundingBox;
    const hinge = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, b.min.z + (b.max.z - b.min.z) * 0.3);
    jaw.geometry.translate(-hinge.x, -hinge.y, -hinge.z);
    jaw.position.add(hinge);
    u.jaw = jaw; u.jaw0 = jaw.rotation.x; u.jy0 = jaw.position.y;
  }
  // interno della bocca: scuro dietro i denti (a bocca aperta si vede buio, non il collo)
  const cav = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), new THREE.MeshStandardMaterial({ color: 0x1a0d0c, roughness: 0.9, metalness: 0 }));
  cav.scale.set(5.2, 2.6, 3.2); cav.position.set(0, -5.6, 4.2); g.add(cav); u.cav = cav;
  // occhi: i lumini (materiale emissivo) si schiacciano quando chiudi gli occhi e scivolano con lo sguardo
  const eyes = model.getObjectByName('Skeleton_Mage_Eyes');
  if (eyes && eyes.geometry) {
    const geo = eyes.geometry; geo.computeBoundingBox();
    const pos = geo.attributes.position, n = pos.count;
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    // due occhi: centro di ciascuno (per lato) e morph "chiuso" (schiacciato verso il centro) per lato
    const cen = [new THREE.Vector3(), new THREE.Vector3()], cnt = [0, 0];
    for (let i = 0; i < n; i++) { const k = pos.getX(i) > cx ? 0 : 1; cen[k].x += pos.getX(i); cen[k].y += pos.getY(i); cen[k].z += pos.getZ(i); cnt[k]++; }
    cen[0].multiplyScalar(1 / Math.max(cnt[0], 1)); cen[1].multiplyScalar(1 / Math.max(cnt[1], 1));
    const cl = [new Float32Array(n * 3), new Float32Array(n * 3)], lx = new Float32Array(n * 3), ly = new Float32Array(n * 3);
    const span = (geo.boundingBox.max.x - geo.boundingBox.min.x) * 0.06;
    for (let i = 0; i < n; i++) {
      const k = pos.getX(i) > cx ? 0 : 1, c = cen[k];
      cl[k][i * 3 + 1] = (c.y - pos.getY(i)) * 0.92;            // chiuso: si schiaccia in verticale
      lx[i * 3] = span; ly[i * 3 + 1] = span * 0.7;
    }
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(cl[0], 3), new THREE.Float32BufferAttribute(cl[1], 3),
      new THREE.Float32BufferAttribute(lx, 3), new THREE.Float32BufferAttribute(ly, 3)];
    geo.morphTargetsRelative = true; eyes.updateMorphTargets();
    // lato dell'occhio "0" (x del file maggiore) → x canonica maggiore (scala positiva) = destra di chi guarda
    u.eyes = eyes;
    for (const m of [].concat(eyes.material)) { m.emissiveIntensity = 1.2; m.toneMapped = false; }
  }
  // arcate sopra gli occhi: la parte alta del teschio sopra gli occhi si inclina col broncio (morph sul teschio)
  const skull = model.getObjectByName('Skeleton_Mage_Skull');
  if (skull && skull.geometry) {
    const geo = skull.geometry, pos = geo.attributes.position, n = pos.count;
    const inv = 1 / P.s, d1 = new Float32Array(n * 3), d2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // coordinate canoniche del vertice
      const X = (pos.getX(i) - P.c[0]) * P.s + P.p[0], Y = (pos.getY(i) - P.c[1]) * P.s + P.p[1], Z = (pos.getZ(i) - P.c[2]) * P.s + P.p[2];
      const ax = Math.abs(X);
      // zona delle arcate: davanti, sopra le orbite (y 2.5..6.5), fra x 1 e 8
      const w = (Z > 6 ? 1 : Z > 3 ? (Z - 3) / 3 : 0) * Math.max(0, 1 - Math.abs(Y - 4.2) / 2.6) * (ax > 0.8 && ax < 8.5 ? Math.min(1, (ax - 0.8) / 1.5, (8.5 - ax) / 2) : 0);
      if (w <= 0) continue;
      d1[i * 3 + 1] = w * 1.6 * inv;                                  // su (sorpresa)
      d2[i * 3 + 1] = -w * 1.8 * inv * (1 - Math.min(1, (ax - 0.8) / 5)) - w * 0.4 * inv; // giù verso il naso (broncio)
    }
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(d1, 3), new THREE.Float32BufferAttribute(d2, 3)];
    geo.morphTargetsRelative = true; skull.updateMorphTargets();
    u.skull = skull;
  }
  return g;
}

export function update(g, bs) {
  const u = g.userData, s = u.s || (u.s = {}), k = 0.5;
  const jaw = sm(s, 'j', B(bs, 'jawOpen'), k);
  const smile = sm(s, 's', (B(bs, 'mouthSmileLeft') + B(bs, 'mouthSmileRight')) / 2, k);
  const pk = sm(s, 'p', B(bs, 'mouthPucker'), k);
  if (u.jaw) { u.jaw.rotation.x = u.jaw0 + jaw * JAW_MAX * (1 - pk * 0.4) + smile * 0.03; u.jaw.position.y = u.jy0 - jaw * JAW_DROP / P.s; }
  if (u.cav) { u.cav.scale.y = 1.2 + jaw * 2.2; u.cav.position.y = -5.0 - jaw * 1.4; }
  if (u.eyes) {
    const I = u.eyes.morphTargetInfluences;
    const blL = sm(s, 'bl', c01(B(bs, 'eyeBlinkLeft') + B(bs, 'eyeSquintLeft') * 0.4), 0.7), blR = sm(s, 'br', c01(B(bs, 'eyeBlinkRight') + B(bs, 'eyeSquintRight') * 0.4), 0.7);
    // occhio "0" = x maggiore = destra di chi guarda = occhio sinistro della persona (immagine a specchio)
    I[0] = blL; I[1] = blR;
    I[2] = sm(s, 'lx', ((B(bs, 'eyeLookOutLeft') - B(bs, 'eyeLookInLeft')) + (B(bs, 'eyeLookInRight') - B(bs, 'eyeLookOutRight'))) / 2, k);
    I[3] = sm(s, 'ly', ((B(bs, 'eyeLookUpLeft') + B(bs, 'eyeLookUpRight')) - (B(bs, 'eyeLookDownLeft') + B(bs, 'eyeLookDownRight'))) / 2, k);
  }
  if (u.skull) {
    const I = u.skull.morphTargetInfluences;
    I[0] = sm(s, 'bu', Math.max(B(bs, 'browInnerUp'), (B(bs, 'browOuterUpLeft') + B(bs, 'browOuterUpRight')) / 2), k);
    I[1] = sm(s, 'bd', (B(bs, 'browDownLeft') + B(bs, 'browDownRight')) / 2, k);
  }
}
