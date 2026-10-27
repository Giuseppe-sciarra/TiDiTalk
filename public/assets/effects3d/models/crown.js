// Corona reale: fascia d'oro con bordi a cordone, punte a fiordaliso stilizzato con le estremità arrotondate e una
// perla in cima, gemme a cabochon incastonate in castoni con le griffe, velluto rosso imbottito dentro.
// Sta sopra la testa (anche calva e grande) e non scende sulla fronte.
import { metal, gem, felt, tube, softExtrude, headOccluder, faceOccluder, afterFace, plugOccluder, GOLD } from './_kit_acc.js';
export const meta = { label: 'Corona', labelEn: 'Crown', category: 'costumi', icon: '👑' };

export default function build(THREE, h) {
  const root = new THREE.Group();
  const g = new THREE.Group(); root.add(g);
  const gold = metal(THREE, GOLD, 0.2);
  const goldOld = metal(THREE, 0xcf9d36, 0.34);
  const velvet = felt(THREE, 0x5e0a18, [14, 4], { sheen: 0.7, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xb0283c), roughness: 0.9 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xf6f1e7, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, iridescence: 0.6, iridescenceIOR: 1.5, sheen: 0.4, sheenColor: new THREE.Color(0xffe8f0), envMapIntensity: 1.1 });
  const GEMS = [0xc4162c, 0x1d5fd6, 0x15924f];
  const gemW = gem(THREE, 0xffffff, { emissiveIntensity: 0.05 }), gemM = GEMS.map(c => gem(THREE, c));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = 8.7, H = 3.0, N = 8;

  // fascia: anello con profilo bombato (non un cilindro piatto), bordi a cordone ritorto
  const prof = [[R - 0.25, 0], [R + 0.2, 0.05], [R + 0.38, 0.6], [R + 0.45, 1.5], [R + 0.38, 2.4], [R + 0.2, 2.95], [R - 0.25, 3.0]];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 96), gold));
  for (const yy of [0.1, 2.9]) {
    // cordone: toro con la torsione disegnata dal rilievo (meno triangoli di un vero tubo ritorto)
    const cord = new THREE.TorusGeometry(R + 0.42, 0.15, 5, 160); { const p = cord.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(y, x), cx = Math.cos(a) * (R + 0.42), cy = Math.sin(a) * (R + 0.42), k = 1 + 0.35 * Math.sin(a * 90 + Math.atan2(z, Math.hypot(x, y) - (R + 0.42)) * 2); p.setXYZ(i, cx + (x - cx) * k, cy + (y - cy) * k, z * k); } cord.computeVertexNormals(); cord.rotateX(Math.PI / 2); cord.translate(0, yy, 0); }
    g.add(new THREE.Mesh(cord, goldOld));
  }
  // interno: velluto imbottito a cupola (più alto al centro, pieghe morbide) + ermellino alla base
  const vel = new THREE.LatheGeometry([[R - 0.3, 0.4], [R - 0.4, 2.6], [R - 1.2, 5.0], [6.3, 6.6], [4.0, 7.7], [1.6, 8.3], [0, 8.4]].map(p => new THREE.Vector2(p[0], p[1])), 64);
  { const p = vel.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.03 * Math.sin(a * N) * Math.min(1, y / 3); p.setXYZ(i, x * k, y + 0.25 * Math.cos(a * N) * Math.min(1, y / 5), z * k); } vel.computeVertexNormals(); }
  g.add(new THREE.Mesh(vel, velvet));
  // (niente bordo di ermellino: sul viso vero l'anello bianco sotto la fascia tagliava la fronte)

  // punta: sagoma a fiamma con le spalle tonde e la cima a goccia, estrusa con bordo morbido e piegata sul cerchio
  const sh = new THREE.Shape();
  sh.moveTo(-3.3, 0); sh.bezierCurveTo(-3.0, 1.0, -1.9, 1.3, -1.5, 2.4); sh.bezierCurveTo(-1.2, 3.4, -0.6, 4.4, 0, 5.2);
  sh.bezierCurveTo(0.6, 4.4, 1.2, 3.4, 1.5, 2.4); sh.bezierCurveTo(1.9, 1.3, 3.0, 1.0, 3.3, 0); sh.lineTo(-3.3, 0);
  const pg = softExtrude(THREE, sh, 0.35, 0.16, { bevelSegments: 2, curveSegments: 10 });
  { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const a = x / (R + 0.2), rr = R + 0.2 + z + 0.18 * y; p.setXYZ(i, Math.sin(a) * rr, y, Math.cos(a) * rr - (R + 0.2)); } pg.computeVertexNormals(); }
  const gemGeo = new THREE.SphereGeometry(0.62, 14, 10), prongGeo = new THREE.SphereGeometry(0.1, 5, 4), pearlGeo = new THREE.SphereGeometry(0.52, 12, 9), smallGem = new THREE.SphereGeometry(0.42, 8, 6);
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    const tip = new THREE.Group(); tip.rotation.y = a; g.add(tip);
    const m = new THREE.Mesh(pg, gold); m.position.set(0, H - 0.1, R + 0.2); m.rotation.x = 0.1; tip.add(m);
    // perla in cima alla punta e gemma piccola nel foro
    const pr = new THREE.Mesh(pearlGeo, pearl); pr.position.set(0, H + 5.5, R + 0.2 + 0.55); tip.add(pr);
    const g2 = new THREE.Mesh(smallGem, gemW); g2.scale.z = 0.6; g2.position.set(0, H + 2.0, R + 0.2 + 0.2 + 0.45); tip.add(g2);
    // gemma a cabochon sulla fascia fra due punte, con castone e 4 griffe
    const gs = new THREE.Group(); gs.rotation.y = a + Math.PI / N; g.add(gs);
    const cab = new THREE.Mesh(gemGeo, gemM[i % 3]); cab.scale.set(1, 0.8, 0.5); cab.position.set(0, 1.5, R + 0.6); gs.add(cab);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.12, 6, 20), gold); bez.scale.set(1, 0.8, 1); bez.position.set(0, 1.5, R + 0.55); gs.add(bez);
    for (let k = 0; k < 4; k++) { const b = k / 4 * Math.PI * 2 + Math.PI / 4, pr2 = new THREE.Mesh(prongGeo, gold); pr2.position.set(Math.cos(b) * 0.62, 1.5 + Math.sin(b) * 0.5, R + 0.82); gs.add(pr2); }
  }

  // interno chiuso: da sotto non si vede la parte posteriore della corona attraverso lo spazio sopra la testa
  g.add(plugOccluder(THREE, h, R - 0.3, -3.5, 1.2));
  g.position.set(0, 9.4, -2.4);
  g.rotation.x = -0.16;
  // occlusore testa (spazio del viso): copre anche le teste grandi inclinate in giù
  root.add(headOccluder(THREE, h, { scale: [8.1, 10.0, 9.3], center: [0, 2.6, -4.3] }));
  // le punte dietro, a testa inclinata in su, finiscono dietro la fronte: disegnate dopo il viso (che le nasconde)
  root.add(faceOccluder(THREE, h, 0.2));
  return afterFace(root);
}
