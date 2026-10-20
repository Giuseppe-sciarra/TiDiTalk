// Occhiali 3D anaglifo: montatura di cartoncino bianco, lente rossa a sinistra (di chi li porta) e ciano a destra.
export const meta = { label: 'Occhiali 3D', labelEn: '3D glasses', category: 'accessori', icon: '🎬' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const card = h.mat(0xd9d2c3, { roughness: .9 });
  const lensR = new THREE.MeshPhysicalMaterial({ color: 0xff2a2a, roughness: .1, transparent: true, opacity: .55, side: THREE.DoubleSide });
  const lensC = new THREE.MeshPhysicalMaterial({ color: 0x19d4e8, roughness: .1, transparent: true, opacity: .55, side: THREE.DoubleSide });

  // montatura frontale: rettangolo arrotondato con due fori rettangolari, poi piegata a seguire il viso
  const rr = (x, y, w, hh, r) => { const s = new THREE.Path(); s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + hh - r); s.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh); s.lineTo(x + r, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const outer = new THREE.Shape(); outer.curves = rr(-7.0, -2.3, 14.0, 4.9, 0.9).curves;
  outer.holes.push(rr(-6.1, -1.6, 5.2, 3.5, 0.5), rr(0.9, -1.6, 5.2, 3.5, 0.5));
  const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.22, bevelEnabled: false, curveSegments: 8 });
  const bend = (geo) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - 0.028 * x * x); } geo.computeVertexNormals(); return geo; };
  const frame = new THREE.Mesh(bend(frameGeo), card);
  g.add(frame);
  // lenti: +X = sinistra di chi indossa → rossa
  const lensGeo = new THREE.PlaneGeometry(5.3, 3.6, 8, 1);
  const lL = new THREE.Mesh(bend(lensGeo.clone().translate(3.5, 0.15, 0)), lensR);
  const lR = new THREE.Mesh(bend(lensGeo.clone().translate(-3.5, 0.15, 0)), lensC);
  lL.position.z = 0.05; lR.position.z = 0.05;
  g.add(lL, lR);
  // scritta decorativa: piccola striscia sul ponte
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 0.1), h.mat(0x333333, { roughness: .8 })); strip.position.set(0, 2.05, 0.2); g.add(strip);
  g.position.set(0, 2.7, 5.9);
  g.rotation.x = -0.05;

  // aste di cartoncino (strisce piatte)
  const outerG = new THREE.Group(); outerG.add(g);
  for (const s of [-1, 1]) {
    const pts = [[s * 6.8, 4.2, 4.4], [s * 7.3, 4.0, 2.5], [s * 7.5, 3.2, -0.5], [s * 7.5, 2.4, -2.6], [s * 7.3, 1.2, -3.8]];
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 32, 0.4, 8);
    const p = geo.attributes.position;   // schiaccio il tubo in X per farne una striscia
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); const cx = s * 7.3; p.setX(i, cx + (x - cx) * 0.25); }
    geo.computeVertexNormals();
    outerG.add(new THREE.Mesh(geo, card));
  }
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; outerG.add(occ); }
  return outerG;
}
