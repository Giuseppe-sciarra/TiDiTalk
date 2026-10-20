// Mollette per capelli: barrette colorate (perle, stella, cuore, barretta smaltata) ai lati della fronte, appoggiate sui capelli.
export const meta = { label: 'Mollette', labelEn: 'Hair clips', category: 'accessori', icon: '📎' };

const HC = [0, 1.0, -3.2], HR = [8.5, 13.0, 9.6];
function onHair(THREE, x, y, off = 0) {
  const ax = x / HR[0], ay = (y - HC[1]) / HR[1], rest = Math.max(0, 1 - ax * ax - ay * ay);
  const p = new THREE.Vector3(x, y, HC[2] + HR[2] * Math.sqrt(rest));
  const n = new THREE.Vector3(x / (HR[0] * HR[0]), (y - HC[1]) / (HR[1] * HR[1]), (p.z - HC[2]) / (HR[2] * HR[2])).normalize();
  return { p: p.addScaledVector(n, off), n };
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const gold = h.mat(0xd9b24a, { roughness: .3, metalness: .9 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xece4d6, roughness: .25, sheen: 1, sheenColor: 0xffe6f0, clearcoat: .6 });
  const enamel = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .25, clearcoat: 1 });
  const star = (R, r) => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r : R; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return s; };
  const heart = (k) => { const s = new THREE.Shape(); s.moveTo(0, -k); s.bezierCurveTo(-0.6 * k, -0.5 * k, -1.2 * k, 0, -1.0 * k, 0.5 * k); s.bezierCurveTo(-0.8 * k, 1.0 * k, -0.2 * k, 1.0 * k, 0, 0.55 * k); s.bezierCurveTo(0.2 * k, 1.0 * k, 0.8 * k, 1.0 * k, 1.0 * k, 0.5 * k); s.bezierCurveTo(1.2 * k, 0, 0.6 * k, -0.5 * k, 0, -k); return s; };
  const ext = (shape, d = 0.35) => new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 });
  const bar = (len, w) => { const s = new THREE.Shape(); const r = w / 2; s.moveTo(-len / 2 + r, -r); s.lineTo(len / 2 - r, -r); s.absarc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2); s.lineTo(-len / 2 + r, r); s.absarc(-len / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5); return s; };

  const clips = [];
  const place = (obj, x, y, rotZ) => {
    const { p, n } = onHair(THREE, x, y, 0.35);
    obj.position.copy(p);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().lerp(new THREE.Vector3(0, 0, 1), 0.6).normalize());
    obj.rotateZ(rotZ); g.add(obj); clips.push(obj);
  };
  // lato destro di chi le porta (−X): tre barrette parallele (smalto rosa, perle, oro)
  { const m = new THREE.Group(); m.add(new THREE.Mesh(ext(bar(3.6, 0.7)), enamel(0xe86a92))); place(m, -5.4, 9.9, 0.7); }
  { const m = new THREE.Group(); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), pearl); b.position.x = (i - 2.5) * 0.66; m.add(b); }
    const base = new THREE.Mesh(ext(bar(3.8, 0.35), 0.1), gold); base.position.z = -0.3; m.add(base); place(m, -6.5, 8.5, 0.8); }
  { const m = new THREE.Group(); m.add(new THREE.Mesh(ext(bar(3.4, 0.55)), gold)); place(m, -7.3, 7.0, 0.9); }
  // lato sinistro (+X): stella gialla, cuore azzurro, barretta lilla
  { const m = new THREE.Group(); m.add(new THREE.Mesh(ext(star(1.3, 0.6)), enamel(0xf2c12e))); place(m, 5.6, 9.8, -0.3); }
  { const m = new THREE.Group(); m.add(new THREE.Mesh(ext(heart(1.0)), enamel(0x58a8e6))); place(m, 6.7, 8.3, -0.2); }
  { const m = new THREE.Group(); m.add(new THREE.Mesh(ext(bar(3.2, 0.65)), enamel(0xa58be0))); const st = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), pearl); st.position.set(1.1, 0, 0.45); m.add(st); place(m, 7.4, 6.8, -0.9); }
  g.userData.clips = clips;
  return g;
}

export function update(g, bs, t) {
  // piccolo luccichio: le mollette smaltate "respirano" appena
  g.userData.clips.forEach((c, i) => { const s = 1 + 0.03 * Math.sin(t * 2 + i); c.scale.set(s, s, s); });
}
