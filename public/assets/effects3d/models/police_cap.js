// Berretto da poliziotto: calotta blu notte, fascia a scacchi bianco/nero, visiera nera lucida, sottogola e stemma argentati.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
export const meta = { label: 'Berretto da poliziotto', labelEn: 'Police cap', category: 'costumi', icon: '👮' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const navy = h.mat(0x1d2a48, { roughness: .82 });
  const black = h.mat(0x15161b, { roughness: .7 });
  const gloss = h.mat(0x0f1014, { roughness: .18, metalness: .1 });
  const silver = h.mat(0xc9ced6, { roughness: .28, metalness: .95 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // fascia che calza la testa (sopra i capelli): base nera + banda a scacchi (texture procedurale)
  g.add(new THREE.Mesh(lathe([[8.5, -1.2], [8.75, 0.5], [8.75, 2.8], [8.3, 3.6], [0, 3.6]]), black));
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 32; i++) for (let j = 0; j < 3; j++) { x.fillStyle = (i + j) % 2 ? '#efece6' : '#17181c'; x.fillRect(i * 16, j * 21.3, 16, 21.4); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
  const check = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 8.8, 2.1, 96, 1, true), new THREE.MeshStandardMaterial({ map: tex, roughness: .6 }));
  check.position.y = 1.55; g.add(check);

  // calotta blu: si allarga sopra la fascia e si alza davanti
  const crownGeo = lathe([[8.3, 3.3], [9.5, 4.0], [10.4, 5.1], [10.6, 5.9], [10.1, 6.6], [7.9, 7.2], [4.0, 7.55], [0, 7.65]]);
  const p = crownGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i), lift = Math.max(0, z / 10.6);
    p.setY(i, y + 2.2 * lift * lift * ((y - 3.3) / 4.35) + 0.5 * lift);
  }
  crownGeo.computeVertexNormals();
  g.add(new THREE.Mesh(crownGeo, navy));
  // filetto bianco sul bordo della calotta
  const pip = new THREE.Mesh(new THREE.TorusGeometry(10.55, 0.1, 6, 96), h.mat(0xd9d6cf, { roughness: .6 }));
  pip.rotation.x = Math.PI / 2; pip.position.y = 5.75; pip.scale.set(1, 1, 1); g.add(pip);
  // il filetto segue la calotta che davanti sale: lo deformo come la calotta
  { const q = pip.geometry.attributes.position; pip.updateMatrix();
    for (let i = 0; i < q.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(q, i).applyMatrix4(pip.matrix); const lift = Math.max(0, v.z / 10.6); v.y += 2.2 * lift * lift * ((v.y - 3.3) / 4.35) + 0.5 * lift; q.setXYZ(i, v.x, v.y, v.z); }
    pip.position.set(0, 0, 0); pip.rotation.set(0, 0, 0); pip.geometry.computeVertexNormals(); }

  // visiera nera lucida, attaccata sotto la fascia (perno sul bordo posteriore)
  const sh = new THREE.Shape();
  sh.moveTo(-7.4, -7.2); sh.absellipse(0, -7.2, 7.4, 5.4, Math.PI, 2 * Math.PI, false);
  sh.lineTo(7.4, -4.1); sh.absarc(0, 0, 8.45, -0.507, -2.634, true); sh.closePath();
  const vis = new THREE.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: true, bevelSize: .1, bevelThickness: .08, bevelSegments: 2, curveSegments: 28 });
  vis.rotateX(Math.PI / 2); vis.rotateY(Math.PI);
  const vp = vis.attributes.position;
  for (let i = 0; i < vp.count; i++) { const x0 = vp.getX(i), z0 = vp.getZ(i), f = Math.min(1, Math.max(0, (Math.hypot(x0, z0) - 8.45) / 4)); vp.setY(i, vp.getY(i) - 0.028 * x0 * x0 * f); }
  vis.translate(0, 0, -8.45); vis.computeVertexNormals();
  const visor = new THREE.Mesh(vis, gloss); visor.position.set(0, -1.12, 8.45); visor.rotation.x = 0.3; g.add(visor);

  // sottogola argentato sopra la visiera, con due bottoni
  const cord = [];
  for (let i = 0; i <= 48; i++) { const a = Math.PI * 0.14 + i / 48 * Math.PI * 0.72; cord.push(new THREE.Vector3(Math.cos(a) * 8.92, 0.05, Math.sin(a) * 8.92)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cord), 80, 0.22, 8), silver));
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), silver); b.position.set(s * 8.35, 0.2, 3.4); g.add(b); }

  // stemma: scudo argentato con stella, in rilievo sulla calotta davanti
  const shield = new THREE.Shape();
  shield.moveTo(0, -1.9); shield.quadraticCurveTo(1.6, -1.2, 1.6, 0.4); shield.lineTo(1.6, 1.5); shield.quadraticCurveTo(0.8, 1.2, 0, 1.75);
  shield.quadraticCurveTo(-0.8, 1.2, -1.6, 1.5); shield.lineTo(-1.6, 0.4); shield.quadraticCurveTo(-1.6, -1.2, 0, -1.9);
  const badge = new THREE.Group();
  badge.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shield, { depth: 0.25, bevelEnabled: true, bevelSize: .1, bevelThickness: .08, bevelSegments: 2 }), silver));
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.38 : 0.9; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const st = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.15, bevelEnabled: false }), h.mat(0xd9b24a, { roughness: .3, metalness: .9 }));
  st.position.set(0, 0.05, 0.38); badge.add(st);
  badge.position.set(0, 4.9, 9.05); badge.rotation.x = -0.32; badge.scale.setScalar(1.3); g.add(badge);

  g.position.set(0, 7.9, -2.3);
  g.rotation.x = -0.08;
  // occlusore "testa + capelli" (solo profondità): nasconde il retro della fascia visto dal basso. In h.preview è marrone.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.1, 5, 8.1); occ.position.set(0, -2.2, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(headOccluder(THREE, h, { scale: [8.1, 10.0, 9.3], center: [0, 2.6, -4.3] }));
  root.add(faceOccluder(THREE, h, 0.2));
  return afterFace(finish(THREE, root));
}
