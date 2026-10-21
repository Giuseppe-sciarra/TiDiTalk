// Tiditalk AR, effetto "chignon" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { fin, hairMat, hairShade, pulledCap, rgb, smooth } from './_kit_hair.js';
export const meta = { label: 'Chignon', labelEn: 'Top-knot bun', category: 'capelli', icon: '👩‍🦳' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pal = [rgb(THREE, 0x120804), rgb(THREE, 0x3a2114), rgb(THREE, 0x7e5434)];
  const KNOT = V(0, 13.0, -6.4), AX = V(0, 0.93, -0.36).normalize();
  pulledCap(THREE, g, { knot: KNOT, axis: AX, pal, vol: 3.8, N: 26 });
  // chignon: sfera schiacciata con un "nastro" di capelli avvolto a spirale (solchi + vertex color)
  const sph = new THREE.SphereGeometry(1, 48, 28), pos = sph.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(x, z), sw = Math.sin(a * 2 + y * 9), b = Math.pow(0.5 + 0.5 * sw, 0.7);
    const r = 1 + 0.06 * b; pos.setXYZ(i, x * r, y * r, z * r);
    const c = hairShade(pal, 0.6 + 0.4 * smooth(-1, 0.3, y), b, 0.6 * Math.max(0, y) * b); col.push(c[0], c[1], c[2]);
  }
  sph.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); sph.computeVertexNormals();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), AX);
  const bun = new THREE.Mesh(sph, hairMat(THREE, { roughness: 0.5 }));
  bun.position.copy(KNOT).addScaledVector(AX, 2.6); bun.scale.set(4.2, 3.2, 4.2); bun.quaternion.copy(q); g.add(bun);
  const base = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), hairMat(THREE, { vertexColors: false, color: new THREE.Color().setRGB(...pal[1]), roughness: 0.55 }));
  base.position.copy(KNOT).addScaledVector(AX, 0.4); base.scale.set(3.4, 1.8, 3.4); base.quaternion.copy(q); g.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.32, 8, 40), new THREE.MeshStandardMaterial({ color: 0x8a1c3a, roughness: 0.6 }));
  ring.position.copy(KNOT).addScaledVector(AX, 0.95); ring.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2)); g.add(ring);
  return fin(g);
}
