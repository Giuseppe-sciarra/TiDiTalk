// Cuffie con orecchie da gatto: corpo bianco/rosa, orecchie e anelli LED rosa che pulsano.
// 1.8.9: l'archetto (fatto sul cranio piccolo dell'occlusore) stava ~2 cm dentro una testa vera: su una testa calva
// tagliava la parte alta della fronte. Ora segue la calotta del cranio vero del motore (arco di 9,12 cm attorno a
// (0, 5,6)); padiglioni 1 cm più indietro e 0,6 più in fuori: i cuscinetti appoggiano sul lato della testa, sulle orecchie.
import { finish } from './_kit_acc.js';
export const meta = { label: 'Cuffie gatto LED', labelEn: 'Cat-ear headphones', category: 'accessori', icon: '🐾' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const body = h.mat(0xf6f3f7, { roughness: .4 });
  const pad = h.mat(0x2b2630, { roughness: .9 });
  const pinkM = h.mat(0xf29ac0, { roughness: .5 });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xff7ad9, emissive: 0xff3fc8, emissiveIntensity: 1.2, roughness: .3 });
  const leds = [];

  const arc = [];
  arc.push(new THREE.Vector3(9.9, 2.4, -4.0), new THREE.Vector3(9.5, 4.2, -4.0));
  for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI; arc.push(new THREE.Vector3(Math.cos(a) * 9.12, 5.6 + Math.sin(a) * 9.12, -4.0)); }
  arc.push(new THREE.Vector3(-9.5, 4.2, -4.0), new THREE.Vector3(-9.9, 2.4, -4.0));
  const bandGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 96, 0.8, 12);
  const bp = bandGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) { bp.setZ(i, -4.0 + (bp.getZ(i) + 4.0) * 1.6); }
  bandGeo.computeVertexNormals();
  g.add(new THREE.Mesh(bandGeo, body));
  const padArc = arc.slice(20, 49).map(p => p.clone().setY(p.y - 0.45));
  const padGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(padArc), 48, 0.9, 12);
  const pp = padGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) { pp.setZ(i, -4.0 + (pp.getZ(i) + 4.0) * 1.7); }
  padGeo.computeVertexNormals();
  g.add(new THREE.Mesh(padGeo, pinkM));

  // orecchie da gatto sull'archetto (triangoli bianchi con inserto LED)
  const tri = (w, hgt) => { const s = new THREE.Shape(); s.moveTo(-w, 0); s.lineTo(w, 0); s.quadraticCurveTo(w * 0.5, hgt * 0.6, 0.3, hgt); s.quadraticCurveTo(-0.3, hgt, -w * 0.5, hgt * 0.6); s.closePath(); return s; };
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(3.2, 5.6), { depth: 1.4, bevelEnabled: true, bevelSize: .4, bevelThickness: .3, bevelSegments: 3 }), body); outer.position.z = -0.7;
    const led = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(2.0, 3.8), { depth: 0.3, bevelEnabled: false }), ledMat); led.position.set(0, 0.6, 0.75);
    const ledB = led.clone(); ledB.position.set(0, 0.6, -1.05);
    e.add(outer, led, ledB); leds.push(led.material);
    const a = Math.PI / 2 - s * 0.52;                   // posizione lungo l'archetto
    e.position.set(Math.cos(a) * 9.12, 5.6 + Math.sin(a) * 9.12 - 0.4, -4.0);
    e.rotation.z = -s * 0.5;
    g.add(e);
  }

  for (const s of [-1, 1]) {
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.5, 1.5), body); yoke.position.set(s * 10.2, 3.6, -4.0); g.add(yoke);
    const cup = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(4.4, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2.4), body); shell.scale.set(1, 0.55, 1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.28, 10, 48), ledMat); ring.rotation.x = Math.PI / 2; ring.position.y = 1.55;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.35, 10, 48), pinkM); rim.rotation.x = Math.PI / 2;
    const cushion = new THREE.Mesh(new THREE.TorusGeometry(3.4, 1.25, 16, 48), pad); cushion.rotation.x = Math.PI / 2; cushion.position.y = -1.3;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), pinkM); mesh.rotation.x = Math.PI / 2; mesh.position.y = -1.3;
    const paw = new THREE.Group();   // zampetta sul guscio
    const pad0 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), pinkM); pad0.scale.set(1.1, 0.3, 0.9); paw.add(pad0);
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), pinkM); t.scale.y = 0.3; const a = -0.9 + i * 0.6; t.position.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25 - 0.2); paw.add(t); }
    paw.position.y = 2.2;
    cup.add(shell, ring, rim, cushion, mesh, paw);
    cup.rotation.z = -s * Math.PI / 2;
    cup.position.set(s * 10.2, 1.0, -4.0);
    g.add(cup);
  }
  g.userData.leds = [ledMat];
  return finish(THREE, g);
}

export function update(g, bs, t) {
  for (const m of g.userData.leds) m.emissiveIntensity = 0.8 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.5));
}
