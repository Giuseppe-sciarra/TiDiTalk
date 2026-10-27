// Basco francese: disco di feltro morbido inclinato da un lato, piccolo picciolo in cima, bordino in pelle.
// 1.8.9: calzato sulla testa vera (prima da un lato restava 2–3 cm sopra la testa); riempitivo invisibile con la forma
// della testa vera, tappo sull'apertura e fodera scura (hatFit in glb/_glbhead.js).
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Basco', labelEn: 'Beret', category: 'accessori', icon: '🎨' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const felt = h.mat(0x9c1c2b, { roughness: .95 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // bordino che calza la testa (sopra i capelli)
  g.add(new THREE.Mesh(lathe([[8.55, -0.6], [8.75, 0.0], [8.75, 0.9], [8.5, 1.2], [8.3, 1.2], [8.3, -0.6], [8.55, -0.6]]), h.mat(0x3a1a12, { roughness: .6 })));

  // corpo: disco gonfio più largo della testa (r 11.5), sezione morbida
  const body = lathe([[8.4, 1.0], [10.0, 1.6], [11.3, 2.6], [11.7, 3.5], [11.2, 4.4], [9.4, 5.2], [6.0, 5.75], [2.5, 5.95], [0, 6.0]]);
  // un po' di "floscio": il disco si abbassa da un lato (+X, sinistra di chi lo indossa) e ondula leggermente
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const f = Math.max(0, (r - 7) / 4.7);
    p.setY(i, y - 1.6 * f * Math.max(0, x / 11.7) + 0.25 * f * Math.sin(a * 3 + 0.7));
  }
  body.computeVertexNormals();
  g.add(new THREE.Mesh(body, felt));
  // picciolo in cima
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.2, 10), felt); stalk.position.y = 6.5; stalk.rotation.z = -0.3; g.add(stalk);

  g.scale.set(0.994, 1.000, 1.196);
  g.position.set(0, 7.42, -4.97);
  g.rotation.set(-0.189, 0, -0.22);   // inclinato indietro e verso il lato
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.1, 5, 8.1); occ.position.set(0, -2.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(finish(THREE, root)), g, { rimY: -0.6, face: false });
}
