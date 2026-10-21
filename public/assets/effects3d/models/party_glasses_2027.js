// Occhiali da Capodanno "2027": cifre dorate a palloncino sopra due lenti tonde glitterate, stelline e un pennacchio di coriandoli.
import { finish, lens } from './_kit_acc.js';
export const meta = { label: 'Occhiali 2027', labelEn: '2027 party glasses', category: 'accessori', icon: '🎉' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const gold = h.mat(0xe0b545, { roughness: .22, metalness: .95 });
  const pinkGlitter = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#c2185b'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const v = (i * 7919) % 255; x.fillStyle = `rgba(255,${180 + v % 75},${200 + v % 55},${0.25 + (v % 50) / 100})`; x.fillRect((i * 37) % 128, (i * 91) % 128, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: .35, metalness: .6 });
  })();
  const lensMat = lens(THREE, 0x1e1424, 0.62, { side: THREE.DoubleSide });

  // montatura: due cerchi glitterati sugli occhi + ponte + aste
  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    L.add(new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.42, 12, 48), pinkGlitter));
    L.add(new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), lensMat));
    L.position.set(s * 3.15, 2.7, 5.8); L.rotation.y = s * 0.22; g.add(L);
  }
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.3, 10, 20, Math.PI), pinkGlitter); bridge.position.set(0, 2.95, 5.85); g.add(bridge);
  for (const s of [-1, 1]) {
    const pts = [[s * 6.0, 3.3, 5.0], [s * 6.8, 3.2, 4.2], [s * 7.3, 2.8, 1.2], [s * 7.5, 2.3, -1.6], [s * 7.5, 1.9, -2.6], [s * 7.3, 0.8, -4.0]];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 32, 0.25, 8), pinkGlitter));
  }

  // cifre "2 0 2 7" a palloncino (tubi lungo tracciati), appoggiate sopra le lenti
  const digit = (pts, closed = false) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), closed, 'catmullrom', 0.5), 64, 0.42, 10, closed), gold);
  const two = () => digit([[-1.1, 1.3], [-0.6, 2.05], [0.35, 2.15], [1.05, 1.55], [0.9, 0.7], [-0.2, -0.3], [-1.15, -1.25], [1.25, -1.25]]);
  const zero = () => { const pts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push([Math.cos(a) * 1.15, Math.sin(a) * 1.7]); } return digit(pts, true); };
  const seven = () => digit([[-1.15, 2.0], [1.2, 2.0], [0.55, 0.8], [-0.1, -1.3]]);
  const word = new THREE.Group();
  [[two(), -4.2], [zero(), -1.4], [two(), 1.4], [seven(), 4.2]].forEach(([m, x]) => { m.position.x = x; m.rotation.y = -x * 0.045; m.position.z = -Math.abs(x) * 0.12; word.add(m); });
  word.position.set(0, 7.3, 6.2); word.rotation.x = -0.15;
  g.add(word);
  // supporti: due steli dalle lenti alle cifre
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8), gold); st.position.set(s * 2.8, 5.0, 6.0); st.rotation.z = s * 0.1; g.add(st); }
  // stelline e coriandoli sparsi
  const star = (r) => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.45 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false }); };
  const stars = [];
  for (const [x, y, z, r, c] of [[-7.0, 6.0, 4.6, 0.8, 0xe0b545], [7.0, 6.3, 4.6, 0.75, 0xffffff], [-5.8, 9.6, 5.2, 0.55, 0xff7ab8], [5.9, 9.8, 5.2, 0.6, 0x7ad7ff], [0, 10.1, 5.8, 0.5, 0xe0b545]]) {
    const m = new THREE.Mesh(star(r), h.mat(c, { roughness: .3, metalness: c === 0xe0b545 ? .9 : .1, emissive: c, emissiveIntensity: .15 }));
    m.position.set(x, y, z); g.add(m); stars.push(m);
  }
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm)
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  g.userData.stars = stars; g.userData.word = word;
  return finish(THREE, g);
}

export function update(g, bs, t) {
  g.userData.stars.forEach((s, i) => { s.rotation.z = t * (0.8 + i * 0.2); s.position.y += Math.sin(t * 2 + i) * 0.004; });
  g.userData.word.rotation.z = Math.sin(t * 1.4) * 0.03;
}
