// Tiditalk AR, effetto "cresta" — la geometria comune di capelli e barbe sta in _kit_hair.js
// 1.8.9: calzata fuori dalla calotta del cranio vero del motore (useCranium): prima i lati rasati, fatti sul profilo
// piccolo della testa, in cima e sopra la fronte stavano dentro la testa vera.
import { D2R, HC, addHair, fin, headPtDir, mixc, rgb, shortCap, smooth, surfGeo, useCranium } from './_kit_hair.js';
export const meta = { label: 'Cresta punk', labelEn: 'Mohawk', category: 'capelli', icon: '🤘' };
export default function build(THREE, h) { useCranium(0.25); try { return make(THREE, h); } finally { useCranium(0); } }
function make(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const cBase = rgb(THREE, 0x3c0640), cMid = rgb(THREE, 0xd8127a), cTip = rgb(THREE, 0xffc21a);
  // lati rasati: cuffia cortissima scura (copre i capelli veri), sopra la cresta
  shortCap(THREE, g, { pal: [rgb(THREE, 0x0a0706), rgb(THREE, 0x1e1612), rgb(THREE, 0x3a2e28)], vol: 2.6, rim: 0.3, N: 60, relief: 0.08, gloss: 0.3, noise: 0.15, rough: 0.9 });
  // linea mediana sulla testa: dalla fronte (α=+55° verso +Z) alla nuca (α=-118°), α misurato da +Y
  const A0 = 55 * D2R, A1 = -118 * D2R;
  const NS = 9;                                                   // numero di punte
  const Hgt = (u) => 2.4 + 7.5 * Math.pow(Math.sin(Math.PI * u), 0.6) + 2.0 * Math.pow(Math.abs(Math.sin(u * Math.PI * NS)), 1.6) * smooth(0.02, 0.15, u) * (1 - smooth(0.85, 0.98, u));
  const point = (u, w) => {
    const a = A0 + (A1 - A0) * u;
    const d = V(0, Math.cos(a), Math.sin(a));
    const base = headPtDir(THREE, d, 2.2 * smooth(0, 0.25, Math.min(u, 1 - u) + 0.1) + 0.4);
    const n = base.clone().sub(V(HC[0], HC[1], HC[2])).normalize();
    // lean: le punte sono leggermente inclinate all'indietro
    n.add(V(0, 0.1, -0.45 * (0.5 + 0.5 * Math.sin(Math.PI * u)))).normalize();
    const t = 1 - Math.abs(2 * w - 1), side = w < 0.5 ? -1 : 1;
    const hgt = Hgt(u) * Math.pow(t, 0.85);
    const lat = side * (2.6 * Math.pow(1 - t, 0.6) + 0.15) * (0.7 + 0.3 * Math.sin(Math.PI * u));
    return base.add(n.multiplyScalar(hgt)).add(V(lat, 0, 0));
  };
  const color = (u, w) => { const t = 1 - Math.abs(2 * w - 1), s = Math.sin(u * Math.PI * 40) * 0.5 + 0.5; let c = t < 0.45 ? mixc(cBase, cMid, t / 0.45) : mixc(cMid, cTip, (t - 0.45) / 0.55); return mixc(c, cBase, 0.25 * (1 - s) * (1 - t)); };
  const geo = surfGeo(THREE, 150, 20, point, color, () => V(0, 1, 0.2));
  addHair(THREE, g, geo, { roughness: 0.6 }, 0.35);
  return fin(g);
}
