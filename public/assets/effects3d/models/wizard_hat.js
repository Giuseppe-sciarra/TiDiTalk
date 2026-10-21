// Cappello da mago: cono blu notte con punta piegata, tesa ondulata, stelle e luna dorate.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
export const meta = { label: 'Cappello da mago', labelEn: 'Wizard hat', category: 'costumi', icon: '🧙' };

// tubo a raggio variabile lungo una curva (cono piegato, corna, ecc.)
function tubeVar(THREE, pts, rFn, segs = 48, radial = 32, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', 0.5);
  const fr = curve.computeFrenetFrames(segs, closed);
  const P = [], N = [], UV = [], I = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = rFn(t);
    const n = fr.normals[i], b = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a);
      P.push(c.x + r * (cx * n.x + sx * b.x), c.y + r * (cx * n.y + sx * b.y), c.z + r * (cx * n.z + sx * b.z));
      N.push(cx * n.x + sx * b.x, cx * n.y + sx * b.y, cx * n.z + sx * b.z);
      UV.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    I.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(I); geo.computeVertexNormals();
  return geo;
}

function star(THREE, R, r, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r : R;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false });
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const cloth = h.mat(0x25327f, { roughness: .9 });
  const gold = h.mat(0xf2c744, { roughness: .4, metalness: .6, emissive: 0x6a4a00, emissiveIntensity: .35 });
  const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // cono: sale dritto e poi la punta si piega indietro e di lato
  const spine = [[0, 0, 0], [0, 8, 0], [0.4, 15, -0.8], [1.8, 20.5, -2.6], [4.6, 23.6, -5.0], [7.2, 23.4, -6.4]];
  const cone = new THREE.Mesh(tubeVar(THREE, spine, t => 8.6 * Math.pow(1 - t, 1.15) + 0.04, 56, 40), cloth);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), cloth); tip.position.set(7.2, 23.4, -6.4); g.add(tip);
  g.add(cone);
  // tappo in fondo (chiude il cono per vederlo pieno dal basso)
  g.add(new THREE.Mesh(new THREE.CircleGeometry(8.6, 48), cloth).rotateX(Math.PI / 2));

  // tesa ondulata e larga
  const R0 = 7.8, R1 = 14.8;
  const brimGeo = lathe([[R0, 0.2], [R1, 0.0], [R1 + 0.15, 0.3], [R1, 0.6], [R0, 0.8], [R0, 0.2]], 80);
  const q = brimGeo.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const x = q.getX(i), z = q.getZ(i), r = Math.hypot(x, z), th = Math.atan2(z, x);
    const f = Math.max(0, (r - R0) / (R1 - R0));
    q.setY(i, q.getY(i) + (1.2 * Math.sin(3 * th + 0.6) + 0.9) * f * f);
  }
  brimGeo.computeVertexNormals();
  g.add(new THREE.Mesh(brimGeo, cloth));

  // fascia
  g.add(new THREE.Mesh(lathe([[8.65, 0.6], [8.6, 2.6], [8.0, 2.6], [8.0, 0.6], [8.65, 0.6]]), h.mat(0x5a3f9e, { roughness: .7 })));

  // stelle appiccicate sul cono (orientate verso l'esterno) e sulla tesa
  const big = star(THREE, 1.5, 0.65), small = star(THREE, 0.9, 0.4);
  const L = new THREE.CatmullRomCurve3(spine.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5).getLength();
  const put = (geo, th, yy, scale = 1) => {
    const t = yy / L; const r = 8.6 * Math.pow(1 - t, 1.15) + 0.35;
    const m = new THREE.Mesh(geo, gold);
    m.position.set(Math.cos(th) * r, yy, Math.sin(th) * r);
    m.lookAt(Math.cos(th) * (r + 5), yy + 1.2, Math.sin(th) * (r + 5));
    m.scale.setScalar(scale);
    g.add(m);
  };
  put(big, Math.PI / 2, 6.5); put(small, Math.PI / 2 + 0.75, 10.5); put(small, Math.PI / 2 - 0.9, 12.5, 1.2);
  put(big, Math.PI / 2 + 1.9, 4.5, .8); put(small, Math.PI / 2 - 2.1, 8.5); put(small, Math.PI / 2 + 0.2, 13.0, .9);
  // luna
  const moon = new THREE.Shape(); moon.absarc(0, 0, 1.3, 1.0, Math.PI * 2 - 1.0, false); moon.absarc(0.6, 0, 1.1, Math.PI * 2 - 1.48, 1.48, true); moon.closePath();
  const mn = new THREE.Mesh(new THREE.ExtrudeGeometry(moon, { depth: 0.25, bevelEnabled: false }), gold);
  const rm = 8.6 * Math.pow(1 - 3.2 / L, 1.15) + 0.35;
  mn.position.set(Math.cos(Math.PI / 2 - 0.9) * rm, 3.2, Math.sin(Math.PI / 2 - 0.9) * rm); mn.lookAt(Math.cos(Math.PI / 2 - 0.9) * 20, 4.2, Math.sin(Math.PI / 2 - 0.9) * 20);
  g.add(mn);
  // stelle sulla tesa
  for (const [th, rr] of [[0.3, 12.2], [2.4, 12.6], [4.1, 11.9], [5.4, 12.4]]) {
    const m = new THREE.Mesh(small, gold); m.rotation.x = -Math.PI / 2;
    const f = (rr - R0) / (R1 - R0);
    m.position.set(Math.cos(th) * rr, 0.85 + (1.2 * Math.sin(3 * th + 0.6) + 0.9) * f * f, Math.sin(th) * rr); g.add(m);
  }

  g.position.set(0, 8.6, -2.2);
  g.rotation.x = -0.1;
  g.userData.cone = cone;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(7.5, 6, 7.5); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(headOccluder(THREE, h, { scale: [8.1, 10.0, 9.3], center: [0, 2.6, -4.3] }));
  root.add(faceOccluder(THREE, h, 0.2));
  return afterFace(finish(THREE, root));
}

export function update(g, bs, t) {
  // le stelle "brillano" dolcemente
  g.traverse(o => { if (o.material && o.material.emissive && o.material.emissiveIntensity !== undefined && o.material.metalness > .5) o.material.emissiveIntensity = 0.35 + 0.25 * Math.sin(t * 3); });
}
