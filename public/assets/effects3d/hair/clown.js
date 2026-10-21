// Tiditalk AR, effetto "clown" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, TAU, addHair, clamp, fin, furShells, mixc, phiForY, rgb, shellGeo, smooth, vnoise } from './_kit_hair.js';
export const meta = { label: 'Parrucca da clown', labelEn: 'Clown wig', category: 'capelli', icon: '🎪' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const pal = [rgb(THREE, 0x500808), rgb(THREE, 0xd0201c), rgb(THREE, 0xff6a3a)];
  // corona di riccioli attorno alla testa: sopra la calotta resta la testa vera (calvo)
  const TH0 = 52 * D2R, TH1 = TAU - TH0;
  const topY = (th) => { const a = Math.abs(th) / D2R; return 7.8 - 1.4 * smooth(100, 180, a); };
  const botY = (th) => { const a = Math.abs(th) / D2R; return -1.2 - 1.8 * smooth(100, 180, a) + 0.8 * (1 - smooth(52, 70, a)); };
  const top = (th) => phiForY(th, topY(th)), bot = (th) => phiForY(th, botY(th));
  const VOL = 5.0;
  // 1.8.0: due "nuvole" crespe ai lati (non più palline): guscio a grumi + pelo crespo, colore più scuro dentro
  const lump = (th, v) => 1.1 * (vnoise(th * 5 + 3, v * 4) - 0.5) + 0.5 * (vnoise(th * 12 + 9, v * 9) - 0.5);
  const base = shellGeo(THREE, {
    thMin: TH0, thMax: TH1, segT: 80, segP: 18, top, bot, soft: { rim: 0.2 },
    off: (th, v) => VOL * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * clamp(0.05 + 0.9 * v, 0, 1)), 0.6)) * (0.9 + 0.1 * Math.cos(th * 2)) + 0.3 + lump(th, v) * (0.4 + 0.6 * Math.sin(Math.PI * v)),
    rimTuck: 0.3,
    color: (th, v) => { const l = lump(th, v) + 0.5, t = th < 0 ? th + TAU : th, e = smooth(0, 0.35, Math.min(t - TH0, TH1 - t)); const c = mixc(mixc(pal[0], pal[1], 0.4 + 0.6 * smooth(0.2, 0.8, l)), pal[2], 0.25 * smooth(0.6, 1, l)); return [c[0], c[1], c[2], e]; },   // le estremità davanti si diradano
  });
  addHair(THREE, g, base, { roughness: 0.92, specularIntensity: 0.15, hair: { strand: 0, kk: [0, 0.1] } }, 0.3);
  furShells(THREE, g, base, { layers: 8, len: 1.6, droop: 0.1, cell: 0.14, frizz: 0.55, kk: 0.12, rough: 0.92 });
  return fin(g);
}
