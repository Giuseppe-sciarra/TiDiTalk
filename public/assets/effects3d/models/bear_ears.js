// Orecchie da orso: due orecchie tonde marroni con interno chiaro, su cerchietto marrone.
// 1.8.9: il cerchietto segue la calotta del cranio vero del motore (appoggia sulla testa vera, calva o con i capelli).
import { finish } from './_kit_acc.js';
// 1.8.9: calotta del cranio vero sempre accesa: le orecchie sono dischi interi e la metà sotto l'archetto deve sparire
// dietro la testa, come in un cerchietto vero (dalla camera la parte bassa sta dietro la cima della testa).
// Senza calotta la si vedeva davanti alla fronte e ai capelli, sotto l'archetto.
export const cranium = true;
export const meta = { label: 'Orecchie da orso', labelEn: 'Bear ears', category: 'costumi', icon: '🐻' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const brown = h.mat(0x6b4226, { roughness: .95 });
  const tan = h.mat(0xc9a07a, { roughness: .95 });

  const band = [];
  // cerchietto sopra i CAPELLI veri (che sporgono 2–4 cm oltre il cranio): arco largo 8.6, colmo a y≈13.8;
  // sezione schiacciata (larga 1.1 cm in profondità, spessa 0.7) come un cerchietto vero
  // 1.8.9: l'arco segue la calotta del cranio vero (HEAD.cranium del motore) 4,5 mm fuori: sopra un cerchio di raggio
  // 7,98 attorno a (0, 5,6), ai lati scende dritto fino a y = 1 (prima a metà altezza entrava di ~4 mm nella testa vera)
  band.push(new THREE.Vector3(7.9, 1.0, -3.0), new THREE.Vector3(7.98, 3.3, -3.0));
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 7.98, 5.6 + Math.sin(a) * 7.98, -3.0)); }
  band.push(new THREE.Vector3(-7.98, 3.3, -3.0), new THREE.Vector3(-7.9, 1.0, -3.0));
  g.add(new THREE.Mesh((() => { const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.35, 10); const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -3.0 + (p.getZ(i) + 3.0) * 1.6); tg.computeVertexNormals(); return tg; })(), brown));

  const ear = (s) => {
    const e = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.SphereGeometry(3.4, 28, 20), brown); outer.scale.set(1, 0.95, 0.45);
    // superficie leggermente "pelosa"
    const p = outer.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + 0.03 * Math.sin(x * 5 + y * 4) * Math.cos(z * 6); p.setXYZ(i, x * n, y * n, z * n); }
    outer.geometry.computeVertexNormals();
    const inner = new THREE.Mesh(new THREE.SphereGeometry(2.0, 24, 16), tan); inner.scale.set(1.1, 1.0, 0.35); inner.position.set(0, -0.2, 1.25);
    e.add(outer, inner);
    e.position.set(s * 5.8, 10.73, -3.1);   // 1.8.9: stessa altezza rispetto al cerchietto di prima (0,35 sotto l'archetto)
    e.rotation.y = s * 0.25; e.rotation.z = -s * 0.15;
    return e;
  };
  const eL = ear(1), eR = ear(-1);
  g.add(eL, eR); g.userData.ears = [eL, eR];
  return finish(THREE, g);
}

export function update(g, bs, t) {
  const [a, b] = g.userData.ears;
  const w = Math.sin(t * 2.0) * 0.04;
  a.rotation.z = -0.15 + w; b.rotation.z = 0.15 - w;
}
