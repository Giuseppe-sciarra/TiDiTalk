// Polpo sulla testa: corpo a cupola rosa-viola appoggiato sui capelli, occhioni che sbattono insieme a quelli di chi lo
// indossa, otto tentacoli che scendono sui capelli (quelli davanti si arricciano sulla fronte, non coprono gli occhi).
export const meta = { label: 'Polpo in testa', labelEn: 'Octopus hat', category: 'divertenti', icon: '🐙' };

// superficie "testa + capelli": i tentacoli la seguono un po' staccati
const HC = [0, 1.0, -3.2], HR = [8.6, 13.2, 9.7];
function surf(THREE, th, y, off) {   // th: angolo attorno a Y (π/2 = davanti), y: altezza
  const ay = Math.min(0.995, Math.abs((y - HC[1]) / HR[1])), k = Math.sqrt(1 - ay * ay);
  const p = new THREE.Vector3(Math.cos(th) * HR[0] * k, y, HC[2] + Math.sin(th) * HR[2] * k);
  const n = new THREE.Vector3(p.x / (HR[0] * HR[0]), (y - HC[1]) / (HR[1] * HR[1]), (p.z - HC[2]) / (HR[2] * HR[2])).normalize();
  return p.addScaledVector(n, off);
}
function tubeVar(THREE, curve, rFn, segs, radial) {
  const fr = curve.computeFrenetFrames(segs, false), P = [], C = [], I = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = rFn(t), n = fr.normals[i], b = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a);
      P.push(c.x + r * (cx * n.x + sx * b.x), c.y + r * (cx * n.y + sx * b.y), c.z + r * (cx * n.z + sx * b.z));
      const under = 0.5 + 0.5 * cx;  // lato "sotto" più chiaro (ventose)
      C.push(0.66 + 0.26 * under, 0.16 + 0.38 * under, 0.38 + 0.28 * under);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; I.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); geo.computeVertexNormals(); return geo;
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xc23f7a, roughness: .45, clearcoat: .5, clearcoatRoughness: .4 });
  const tentMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .45, clearcoat: .5, clearcoatRoughness: .4 });
  // corpo (mantello) a cupola un po' a pera, appoggiato in cima ai capelli
  const mantle = new THREE.Mesh(new THREE.LatheGeometry([[0.01, 9.2], [2.6, 8.9], [4.6, 7.8], [5.8, 5.9], [6.2, 3.8], [6.0, 2.0], [5.4, 0.8], [4.8, 0.2]].map(p => new THREE.Vector2(p[0], p[1])), 48), skinMat);
  mantle.position.set(0, 11.6, -3.3); mantle.rotation.x = -0.12; g.add(mantle);
  // macchioline più scure sul mantello
  const spotMat = h.mat(0x8e2257, { roughness: .5 });
  for (let i = 0; i < 14; i++) { const a = i * 2.4, y = 3 + (i * 0.37 % 1) * 5; const r = 0.25 + (i % 3) * 0.12; const sp = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), spotMat); sp.scale.z = 0.4;
    const rr = 6.15 - Math.max(0, y - 4) * 0.35; sp.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); sp.lookAt(Math.cos(a) * 20, y, Math.sin(a) * 20); mantle.add(sp); }
  // occhi: bianco + pupilla + palpebra (scala con il blink)
  const lids = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 2.3, 3.9, 5.25); eye.rotation.y = s * 0.35;
    const white = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), h.mat(0xf3efe8, { roughness: .3 })); white.scale.z = 0.7; eye.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 12), new THREE.MeshPhysicalMaterial({ color: 0x15101a, roughness: .05, clearcoat: 1 })); pupil.position.z = 0.7; pupil.scale.z = 0.5; eye.add(pupil);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(0.25, 0.3, 1.05); eye.add(hl);
    // palpebra chiusa: guscio di pelle appena più grande dell'occhio, con la piega scura; visibile solo durante il battito
    const lid = new THREE.Group(); const sh = new THREE.Mesh(new THREE.SphereGeometry(1.44, 24, 16), skinMat); sh.scale.z = 0.76; lid.add(sh);
    const crease = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 24, Math.PI), spotMat); crease.rotation.z = Math.PI; crease.position.set(0, 0.05, 1.08); crease.scale.y = 0.45; lid.add(crease);
    lid.visible = false; eye.add(lid); lids.push(lid);
    mantle.add(eye);
  }
  // otto tentacoli che scendono sui capelli
  const tentacles = [];
  for (let k = 0; k < 8; k++) {
    const th = Math.PI / 2 + (k + 0.5) / 8 * Math.PI * 2;           // nessun tentacolo esattamente al centro davanti
    const front = Math.max(0, Math.sin(th));                          // 1 davanti, 0 ai lati, <0 dietro
    const yEnd = 9.8 * front + (1 - front) * (Math.sin(th) < 0 ? -1.0 : 2.5);
    const pts = [];
    const N = 9;
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = 12.2 - (12.2 - yEnd) * t;
      const thw = th + 0.18 * Math.sin(t * 3.2 + k);                  // leggero serpeggiare
      pts.push(surf(THREE, thw, y, 0.8 + 0.4 * (1 - t)));
    }
    // ricciolo finale verso l'esterno
    const last = pts[pts.length - 1], prev = pts[pts.length - 2];
    const out = last.clone().sub(new THREE.Vector3(HC[0], last.y, HC[2])).normalize();
    const down = last.clone().sub(prev).normalize();
    pts.push(last.clone().addScaledVector(down, 0.8).addScaledVector(out, 0.8), last.clone().addScaledVector(out, 1.5).addScaledVector(down, 0.2), last.clone().addScaledVector(out, 1.4).addScaledVector(down, -0.6));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const m = new THREE.Mesh(tubeVar(THREE, curve, t => 1.25 * Math.pow(1 - t, 0.8) + 0.12, 72, 14), tentMat);
    g.add(m); tentacles.push(m);
  }
  // occlusore "testa + capelli" (solo profondità): i tentacoli dietro la nuca restano nascosti
  const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
  occ.scale.set(8.3, 12.6, 9.2); occ.position.set(0, 1.0, -3.2); occ.renderOrder = -1; occ.name = 'hairOccluder'; if (!h.preview) g.add(occ);
  g.userData = { mantle, lids, tentacles };
  update(g, {}, 0.3);
  return g;
}

export function update(g, bs, t) {
  const u = g.userData;
  const blink = Math.max(bs.eyeBlinkLeft || 0, bs.eyeBlinkRight || 0, (t % 3.7) > 3.55 ? 1 : 0);
  u.lids.forEach(l => { l.visible = blink > 0.5; });
  u.mantle.rotation.z = Math.sin(t * 1.3) * 0.05; u.mantle.scale.set(1 + 0.02 * Math.sin(t * 2.2), 1 - 0.02 * Math.sin(t * 2.2), 1);
  u.tentacles.forEach((m, i) => { m.rotation.y = Math.sin(t * 1.6 + i) * 0.015; });
}
