// Tiara d'argento: cerchietto sottile, archetti ornamentali crescenti verso il centro e gemme azzurre.
// 1.8.9: appoggiata sulla testa vera: prima davanti e ai lati restava ~2 cm sopra la testa.
import { finish } from './_kit_acc.js';
export const meta = { label: 'Tiara', labelEn: 'Tiara', category: 'costumi', icon: '💎' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const silver = h.mat(0xe8ecf2, { roughness: .2, metalness: 1 });
  const gemMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .05, metalness: 0, clearcoat: 1, emissive: c, emissiveIntensity: .3 });
  const R = 8.5;

  // cerchietto: arco frontale (da tempia a tempia passando sulla fronte) + arco che prosegue sopra le orecchie
  const base = [];
  for (let i = 0; i <= 64; i++) { const a = -0.15 + i / 64 * (Math.PI + 0.3); base.push(new THREE.Vector3(Math.cos(a) * R, -0.6 * Math.abs(Math.cos(a)) * 0 + 0, Math.sin(a) * R)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(base), 96, 0.22, 8), silver));
  const base2 = base.map(p => p.clone().setY(-0.7));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(base2), 96, 0.18, 8), silver));

  // archetti: 5 picchi (il centrale più alto) formati da due fili che si incontrano in cima, con gemma
  const peaks = [[Math.PI / 2, 5.2], [Math.PI / 2 - 0.42, 3.6], [Math.PI / 2 + 0.42, 3.6], [Math.PI / 2 - 0.84, 2.3], [Math.PI / 2 + 0.84, 2.3]];
  for (const [a, hgt] of peaks) {
    const w = 0.2;
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, aa = a + s * w * (1 - t);
        const bulge = Math.sin(t * Math.PI) * 0.1;
        pts.push(new THREE.Vector3(Math.cos(aa) * (R + bulge), t * hgt * (1 - 0.15 * (1 - t)), Math.sin(aa) * (R + bulge)));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 6), silver));
    }
    // piccola voluta ai lati di ogni picco
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; const aa = a + s * (w + 0.06 + 0.1 * Math.sin(t * Math.PI)); pts.push(new THREE.Vector3(Math.cos(aa) * (R + 0.05), 0.2 + t * hgt * 0.45, Math.sin(aa) * (R + 0.05))); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.11, 6), silver));
    }
    // gemma in cima
    const gem = new THREE.Mesh(new THREE.SphereGeometry(hgt > 5 ? 0.62 : 0.42, 16, 12), gemMat(hgt > 5 ? 0x5ec8ff : 0xc9e8ff));
    gem.position.set(Math.cos(a) * (R + 0.1), hgt + 0.1, Math.sin(a) * (R + 0.1)); g.add(gem);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(gem.geometry.parameters.radius + 0.06, 0.09, 6, 20), silver);
    bezel.position.copy(gem.position); bezel.lookAt(Math.cos(a) * 40, hgt, Math.sin(a) * 40); g.add(bezel);
  }
  // perline sul cerchietto
  for (let i = 0; i < 14; i++) {
    const a = Math.PI / 2 + (i - 6.5) * 0.17;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), gemMat(0xffffff));
    p.position.set(Math.cos(a) * (R + 0.15), -0.35, Math.sin(a) * (R + 0.15)); g.add(p);
  }

  g.scale.set(0.885, 1.000, 1.006);
  g.position.set(0, 8.80, -6.00);
  g.rotation.x = -0.292;
  return finish(THREE, g);
}
