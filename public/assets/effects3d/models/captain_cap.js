// Berretto da capitano: calotta bianca ampia e rialzata davanti, fascia nera, visiera lucida, cordone e stemma dorati.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
export const meta = { label: 'Berretto da capitano', labelEn: "Captain's cap", category: 'costumi', icon: '⚓' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const white = h.mat(0xe9e5dc, { roughness: .8 });
  const black = h.mat(0x15151a, { roughness: .7 });
  const gloss = h.mat(0x101014, { roughness: .2, metalness: .1 });
  const gold = h.mat(0xd9b24a, { roughness: .3, metalness: .9 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // fascia nera che calza la testa
  g.add(new THREE.Mesh(lathe([[8.5, -1.2], [8.75, 0.5], [8.75, 2.8], [8.3, 3.6], [0, 3.6]]), black));

  // calotta bianca: si allarga sopra la fascia e si alza davanti (il classico "piatto" inclinato)
  const crownGeo = lathe([[8.3, 3.3], [9.6, 4.0], [10.6, 5.2], [10.8, 6.0], [10.3, 6.7], [8.0, 7.3], [4.0, 7.65], [0, 7.75]]);
  const p = crownGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i);
    const lift = Math.max(0, z / 10.8);                  // davanti sale
    p.setY(i, y + 2.4 * lift * lift * ((y - 3.3) / 4.45) + 0.6 * lift);
  }
  crownGeo.computeVertexNormals();
  g.add(new THREE.Mesh(crownGeo, white));
  // cucitura/filetto lungo il bordo della calotta
  g.add(new THREE.Mesh(lathe([[8.45, 3.25], [8.6, 3.25], [8.6, 3.55], [8.45, 3.55], [8.45, 3.25]]), h.mat(0xd8d2c4, { roughness: .8 })));

  // visiera nera lucida: ovale davanti, bordo posteriore che segue la fascia
  const sh = new THREE.Shape();
  sh.moveTo(-7.4, -7.2); sh.absellipse(0, -7.2, 7.4, 5.2, Math.PI, 2 * Math.PI, false);
  sh.lineTo(7.4, -4.1); sh.absarc(0, 0, 8.45, -0.507, -2.634, true); sh.closePath();
  const vis = new THREE.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: true, bevelSize: .1, bevelThickness: .08, bevelSegments: 2, curveSegments: 28 });
  vis.rotateX(Math.PI / 2); vis.rotateY(Math.PI);
  const vp = vis.attributes.position;
  // curvatura solo oltre la fascia (r > 8.45), perno sul bordo posteriore: la visiera parte esattamente sotto la fascia
  for (let i = 0; i < vp.count; i++) { const x = vp.getX(i), z = vp.getZ(i), f = Math.min(1, Math.max(0, (Math.hypot(x, z) - 8.45) / 4)); vp.setY(i, vp.getY(i) - 0.028 * x * x * f); }
  vis.translate(0, 0, -8.45);
  vis.computeVertexNormals();
  const visor = new THREE.Mesh(vis, gloss); visor.position.set(0, -1.12, 8.45); visor.rotation.x = 0.3; g.add(visor);

  // cordone dorato intrecciato sopra la visiera (due tubi attorcigliati)
  for (const ph of [0, Math.PI]) {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const a = Math.PI * 0.12 + i / 60 * Math.PI * 0.76;       // da un lato all'altro passando davanti
      const r = 8.9, tw = Math.sin(i / 60 * Math.PI * 12 + ph) * 0.18;
      pts.push(new THREE.Vector3(Math.cos(a) * (r + tw), 0.2 + Math.cos(i / 60 * Math.PI * 12 + ph) * 0.18, Math.sin(a) * (r + tw)));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.2, 8), gold));
  }
  // bottoncini dorati ai capi del cordone
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), gold); b.position.set(s * 8.4, 0.5, 3.2); g.add(b); }

  // stemma frontale: corona di alloro + ancora stilizzata
  const badge = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.25, 8, 32), gold); badge.add(ring);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.3, 8), gold); badge.add(shaft);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.26, 0.26), gold); stock.position.y = 0.7; badge.add(stock);
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.18, 8, 24, Math.PI), gold); arm.rotation.z = Math.PI; arm.position.y = -0.2; badge.add(arm);
  const top = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 6, 14), gold); top.position.y = 1.35; badge.add(top);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), gold); leaf.scale.set(1, 1.9, 0.5);
    const a = -0.9 + i * 0.42; leaf.position.set(s * (1.6 + 0.55) * Math.cos(a), (1.6 + 0.55) * Math.sin(a) - 0.3, 0); leaf.rotation.z = s * (0.5 - i * 0.2); badge.add(leaf);
  }
  badge.position.set(0, 4.9, 9.1); badge.rotation.x = -0.35; badge.scale.setScalar(0.95);
  g.add(badge);

  g.position.set(0, 7.9, -2.3);
  g.rotation.x = -0.08;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.1, 6, 8.1); occ.position.set(0, -3.2, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(headOccluder(THREE, h, { scale: [8.1, 10.0, 9.3], center: [0, 2.6, -4.3] }));
  root.add(faceOccluder(THREE, h, 0.2));
  return afterFace(finish(THREE, root));
}
