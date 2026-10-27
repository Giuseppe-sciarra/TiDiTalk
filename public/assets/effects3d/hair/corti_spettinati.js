// Tiditalk AR, effetto "corti_spettinati" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { fin, rgb, shortCap, smooth } from './_kit_hair.js';
export const meta = { label: 'Corti spettinati', labelEn: 'Short spiky hair', category: 'capelli', icon: '🧑' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const pal = [rgb(THREE, 0x0e0603), rgb(THREE, 0x321c0c), rgb(THREE, 0x6e4626)];
  // cuffia che copre i capelli veri + pelo lungo a ciocche (gruppi lunghi e corti) spinto in su e un po' in avanti:
  // le punte "spettinate" vengono dal pelo stesso, niente coni
  shortCap(THREE, g, { pal, vol: 3.0, rim: 0.4, N: 40, seed: 5, relief: 0.3, noise: 0.5,
    fur: { layers: 10, len: 2.4, dir: [0, 1.1, 0.5], frizz: 0.45, droop: 0, cell: 0.15, clump: 0.85, clumpSize: 1.1,
      dens: (x, y, z) => smooth(1.0, 6.5, y) * 0.75 + 0.25 } });
  return fin(g);
}
