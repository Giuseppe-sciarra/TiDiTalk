// Tiditalk AR, effetto "coda_di_cavallo" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { TAU, bundleGeo, fin, hairMat, hairShade, mergeGeo, pulledCap, rgb, rng, smooth, tubeGeo } from './_kit_hair.js';
export const meta = { label: 'Coda di cavallo', labelEn: 'Ponytail', category: 'capelli', icon: '🎀' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pal = [rgb(THREE, 0x0e0603), rgb(THREE, 0x301a0c), rgb(THREE, 0x7a4e2a)];
  const KNOT = V(0, 13.6, -8.0), AX = V(0, 0.8, -0.6).normalize();   // punto dove la coda è raccolta (alto, dietro)
  pulledCap(THREE, g, { knot: KNOT, axis: AX, pal, vol: 3.8, N: 28 });
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), AX);
  // nodo: i capelli raccolti
  const knotM = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), hairMat(THREE, { vertexColors: false, color: new THREE.Color().setRGB(...pal[1]), roughness: 0.55 }));
  knotM.position.copy(KNOT).addScaledVector(AX, 0.2); knotM.quaternion.copy(q); knotM.scale.set(2.5, 1.9, 2.5); g.add(knotM);
  // elastico (scrunchie): toro gonfio con pieghe
  const tg = new THREE.TorusGeometry(2.0, 0.95, 14, 36), tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i); const a = Math.atan2(y, x), k = 1 + 0.12 * Math.sin(a * 11); const cx = Math.cos(a) * 2.0, cy = Math.sin(a) * 2.0; tp.setXYZ(i, cx + (x - cx) * k, cy + (y - cy) * k, z * k); }
  tg.computeVertexNormals();
  const scr = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0xd8336a, roughness: 0.8, envMapIntensity: 0.3 }));
  scr.position.copy(KNOT).addScaledVector(AX, 1.5); scr.quaternion.copy(q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2))); g.add(scr);
  // coda: fascio principale con solchi (si assottiglia verso la punta) + qualche ciocca libera attorno
  const R = rng(42), parts = [];
  const start = KNOT.clone().addScaledVector(AX, 1.6);
  const spine = [start, V(0, 17.6, -10.6), V(0.2, 16.6, -14.6), V(0.5, 10.5, -17.0), V(0.4, 3.0, -16.6), V(0.0, -4.0, -15.4), V(-0.4, -10.5, -14.2)];
  const shadeT = (t, b) => hairShade(pal, 0.45 + 0.55 * smooth(0, 0.25, t), b, 0.75 * Math.exp(-(((t - 0.22) / 0.12) ** 2)) + 0.25 * Math.exp(-(((t - 0.55) / 0.15) ** 2)));
  parts.push(bundleGeo(THREE, spine, (t) => 2.0 * (t < 0.1 ? 0.75 + 2.5 * t : 1) * (1 + 0.15 * Math.sin(Math.PI * t)) * (1 - 0.75 * smooth(0.45, 1, t)) * (t > 0.985 ? (1 - t) / 0.015 : 1), shadeT, 56, 20, 7, 0.25, 0.22));
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU, ox = Math.cos(a) * 1.4, oz = Math.sin(a) * 1.1, sw = (R() - 0.5) * 1.6;
    const pts = spine.map((p, k) => k === 0 ? p.clone().add(V(ox * 0.4, 0, oz * 0.4)) : p.clone().add(V(ox * (1 + 0.15 * k) + sw * k * 0.12, -R() * 0.5 * k, oz * (1 + 0.1 * k))));
    pts[pts.length - 1].y -= 1.5 * R();
    const w = 0.7 + 0.3 * R();
    parts.push(tubeGeo(THREE, pts, (t) => w * (t < 0.1 ? 0.5 + 5 * t : 1) * (1 - 0.7 * smooth(0.5, 1, t)) * (t > 0.97 ? (1 - t) / 0.03 : 1), 40, 8, (t) => shadeT(t, 0.85)));
  }
  g.add(new THREE.Mesh(mergeGeo(THREE, parts), hairMat(THREE, { roughness: 0.5 })));
  return fin(g);
}
