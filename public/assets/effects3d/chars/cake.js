// cake — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Torta di compleanno', labelEn: 'Birthday cake', category: 'divertenti', icon: '🎂' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  const sponge = gradMat(THREE, h, 0xf6d9a8, 0xe9c184, { roughness: .9 });
  const pink = gradMat(THREE, h, 0xffb6d0, 0xf78fb3, { roughness: .6 });
  const cream = M(h, 0xfff7ef, { roughness: .55 });
  const choc = M(h, 0x5a3420, { roughness: .7 });

  // torta a due piani sotto il mento: la testa spunta dal piano superiore
  const CZ = -2.5;
  const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 15.5, 9, 40), sponge); tier1.position.set(0, -26, CZ); root.add(tier1);
  const band1 = new THREE.Mesh(new THREE.CylinderGeometry(15.7, 15.7, 2.2, 40), choc); band1.position.set(0, -27, CZ); root.add(band1);
  const top1 = new THREE.Mesh(new THREE.CylinderGeometry(16.0, 16.0, 1.6, 40), pink); top1.position.set(0, -21.3, CZ); root.add(top1);
  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 11.5, 8, 40), sponge); tier2.position.set(0, -16.5, CZ); root.add(tier2);
  const top2 = new THREE.Mesh(new THREE.CylinderGeometry(12.0, 12.0, 1.6, 40), pink); top2.position.set(0, -12.2, CZ); root.add(top2);
  // colature di glassa lungo i bordi
  for (let tier = 0; tier < 2; tier++) {
    const R = tier ? 11.9 : 15.9, y0 = tier ? -13 : -22.1, n = tier ? 14 : 18;
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * PI + tier * .2; const len = 1.5 + ((i * 7) % 5) * .6; const d = cap(THREE, pink, .9, len, Math.cos(a) * R, y0 - len / 2, CZ + Math.sin(a) * R); root.add(d); }
  }
  // panna attorno al collo (ciuffi) sul piano superiore
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 2 * PI; root.add(ell(THREE, cream, 1.9, 1.4, 1.9, Math.cos(a) * 6.4, -11.2, CZ + .4 + Math.sin(a) * 6.4, 14)); }
  // fragole e ciliegie sul piano superiore (lati e dietro: non davanti al viso)
  const berry = M(h, 0xe0303c, { roughness: .4 });
  for (const a of [0.35, 0.85, 1.45, 1.7, 2.3, 2.8]) { for (const sd of [1, -1]) { const b = ell(THREE, berry, 1.1, 1.3, 1.1, sd * Math.cos(a) * 9.6, -10.6, CZ - Math.sin(a) * 9.6, 12); root.add(b); } }
  // candeline con fiamma (lati e dietro)
  const flames = [];
  const candleCols = [0x60a5fa, 0xf472b6, 0xfbbf24, 0x34d399, 0xa78bfa, 0xfb7185, 0x60a5fa];
  for (let i = 0; i < 7; i++) {
    const ang = -PI * .08 + (i / 6) * PI * 1.16; const cx = Math.cos(ang) * 10.2, cz = CZ - Math.sin(ang) * 10.2;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 5, 12), M(h, candleCols[i], { roughness: .5 })); c.position.set(cx, -9.0, cz); root.add(c);
    for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(new THREE.TorusGeometry(.56, .12, 6, 16), cream); st.rotation.x = PI / 2; st.position.set(cx, -10.5 + k * 1.5, cz); root.add(st); }
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .8, 6), M(h, 0x222222)); wick.position.set(cx, -6.3, cz); root.add(wick);
    const f = ell(THREE, M(h, 0xffc24a, { emissive: 0xff9a1a, emissiveIntensity: 1.6, roughness: .3 }), .5, 1.0, .5, cx, -5.4, cz, 10); root.add(f); flames.push({ f, cx, cz, i });
  }
  P.fx.push((s, t) => {
    const blow = Math.min(1, s.pucker * .9 + s.funnel * .7 + s.puff * .4);  // soffiare (bacio, O, guance gonfie) = fiamme che si piegano
    flames.forEach(({ f, cx, cz, i }) => {
      const fl = 1 + Math.sin(t * 11 + i * 2) * .18 + Math.sin(t * 23 + i) * .08;
      f.scale.set(.5 * (1 + blow * .3), 1.0 * fl * (1 - blow * .55), .5);
      f.position.set(cx, -5.4 + (fl - 1) * .3, cz - blow * 1.8); f.rotation.x = -blow * .8;
      f.material.emissiveIntensity = 1.6 - blow * .9 + Math.sin(t * 15 + i) * .2;
    });
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
