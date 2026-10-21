// Tiditalk AR, effetto "mullet" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, HC, addHair, fin, furShells, hairMat, hairShade, headPt, keyLerp, lockAt, mergeGeo, mixc, phiForY, rgb, rng, shellGeo, smooth, tuftGeo, vnoise } from './_kit_hair.js';
export const meta = { label: 'Mullet', labelEn: 'Mullet', category: 'capelli', icon: '🦝' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pal = [rgb(THREE, 0x1a0d06), rgb(THREE, 0x56361a), rgb(THREE, 0x9c7440)], cb = pal[1], cl = mixc(pal[1], pal[2], 0.5);
  const hairline = [[0, 8.3], [25, 7.9], [45, 6.6], [60, 4.8], [75, 3.0], [90, 2.2], [110, 0.6], [135, -1.6], [160, -3.4], [180, -4.0]];
  const bot = (th) => phiForY(th, keyLerp(hairline, th / D2R));
  const cap = shellGeo(THREE, {
    segT: 84, segP: 22, bot, soft: { rim: 0.12, tips: 0.3 },
    off: (th, v) => { const L = lockAt(th, 30, 9), back = smooth(95, 130, Math.abs(th) / D2R); return 0.45 + (3.4 + 0.3 * back) * smooth(0, 0.5, 1 - v) + 0.6 * Math.pow(1 - v, 2.5) + (0.3 + 0.4 * back) * L.b * smooth(0.05, 0.35, v) + 0.25 * (vnoise(th * 5, v * 4) - 0.5); },
    rimTuck: 0,
    color: (th, v, ph, s) => { const L = lockAt(th, 30, 9), n = vnoise(th * 8, (v + s) * 3) - 0.5; return hairShade(pal, s > 0 ? 1 : 0.35 + 0.65 * smooth(0, 0.45, v), L.b, (s === 0 ? Math.exp(-(((v - 0.4) / 0.15) ** 2)) : 0.4 * Math.exp(-(((s - 0.3) / 0.2) ** 2))) * (0.7 + n)); },
    drape: {   // "party in the back": lungo solo dietro
      segs: 20,
      bottom: (th) => { const a = Math.abs(th) / D2R, L = lockAt(th, 30, 9); return 99 - (99 + 14 + 1.5 * L.b) * smooth(112, 136, a); },
      point: (th, s, rim, out, y) => { const L = lockAt(th, 30, 9); const f = 0.3 + 1.6 * smooth(0, 0.4, s) + 1.6 * smooth(0.6, 1, s) + 0.8 * (L.b - 0.5) * s; const sx = Math.sign(th) || 1; return V(rim.x + out.x * f + sx * 1.2 * smooth(0.5, 1, s), y + 0.3 * Math.sin(th * 9) * s, rim.z + out.z * f); },
    },
  });
  addHair(THREE, g, cap, { roughness: 0.6 }, 0.3);
  // pelo corto pettinato all'indietro sulla parte alta (solo sopra le orecchie: il "dietro lungo" resta liscio)
  furShells(THREE, g, cap, { layers: 7, len: 0.9, dir: [0, 0.3, -0.4], frizz: 0.25, cell: 0.14, kk: 0.2, rough: 0.65, dens: (x, y, z) => smooth(-1.0, 3.0, y) });
  // "business in the front": ciuffi corti sulla parte alta
  const R = rng(9), parts = [], tuft = tuftGeo(THREE, 8);
  const up = V(0, 1, 0), q = new THREE.Quaternion(), M = new THREE.Matrix4(), sc = new THREE.Vector3();
  let n = 0, guard = 0;
  while (n < 30 && guard++ < 6000) {
    const th = (R() * 2 - 1) * Math.PI, ph = Math.acos(1 - 2 * R());
    const b = bot(th); if (ph > Math.min(b - 0.12, 0.95)) continue;
    const vv = ph / b, capO = 0.45 + 3.4 * smooth(0, 0.5, 1 - vv) + 0.6 * Math.pow(1 - vv, 2.5);
    const p = headPt(THREE, th, ph, capO - 0.2), nrm = p.clone().sub(V(HC[0], HC[1], HC[2])).normalize();
    const fwd = Math.max(0, Math.cos(th)) * (1 - smooth(0.3, 0.9, ph));
    const dir = nrm.clone().multiplyScalar(0.45).add(V((R() - 0.5) * 0.6, 0.5, -0.9 + 1.4 * fwd)).normalize();
    const rr = 1.6 + 0.6 * R(); q.setFromUnitVectors(up, dir); sc.set(rr, 1.8 + 1.0 * R(), rr * 0.6);
    M.compose(p.clone().addScaledVector(nrm, -0.7), q, sc);
    const k = 0.8 + 0.4 * R(); const c = mixc(pal[1], pal[2], 0.45 * R()); parts.push({ geo: tuft, matrix: M.clone(), color: [c[0] * k, c[1] * k, c[2] * k] }); n++;
  }
  g.add(new THREE.Mesh(mergeGeo(THREE, parts), hairMat(THREE, { roughness: 0.6 })));
  return fin(g);
}
