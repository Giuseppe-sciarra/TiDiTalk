// Fiocco gigante sulla testa: nastro rosso a pois crema su cerchietto, due anse gonfie, nodo centrale e code tagliate a V.
export const meta = { label: 'Fiocco', labelEn: 'Hair bow', category: 'accessori', icon: '🎀' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#c11b33'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#f2e7d6';
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(16 + i * 32 + (j % 2) * 16, 16 + j * 32, 7, 0, 6.3); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1);
  const satin = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .4, sheen: .6, sheenColor: 0xffc0c8, side: THREE.DoubleSide });

  // cerchietto sopra i capelli (colmo a y≈13.8)
  const band = [];
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 8.6, 1.0 + Math.sin(a) * 12.8, -3.0)); }
  const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.33, 10);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -3.0 + (p.getZ(i) + 3.0) * 1.6); tg.computeVertexNormals(); }
  g.add(new THREE.Mesh(tg, h.mat(0x9e1529, { roughness: .45 })));

  const bow = new THREE.Group();
  // ansa: nastro (sezione piatta larga) che gira su un percorso a goccia
  const loop = (s) => {
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2, r = 1 - 0.55 * Math.pow(Math.cos(a / 2), 8);   // goccia: stretta al nodo
      pts.push(new THREE.Vector3(s * (2.6 + 2.6 * Math.cos(a)) * r + s * 0.2, 2.1 * Math.sin(a) * r, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const geo = new THREE.TubeGeometry(curve, 80, 1.0, 12, true);
    const p = geo.attributes.position;   // sezione schiacciata: larga in profondità (z), sottile nel piano
    for (let i = 0; i < p.count; i++) { const k = Math.floor(i / 13), cp = curve.getPointAt(k / 80); const dx = p.getX(i) - cp.x, dy = p.getY(i) - cp.y; p.setXYZ(i, cp.x + dx * 0.4, cp.y + dy * 0.4, p.getZ(i) * 1.05); }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, satin);
  };
  bow.add(loop(1), loop(-1));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 14), satin); knot.scale.set(0.95, 1.2, 0.8); bow.add(knot);
  // code a V
  const tail = new THREE.Shape(); tail.moveTo(-0.9, 0); tail.lineTo(0.9, 0); tail.lineTo(1.4, -4.2); tail.lineTo(0.6, -3.5); tail.lineTo(-0.2, -4.4); tail.closePath();
  const tgeo = new THREE.ExtrudeGeometry(tail, { depth: 0.12, bevelEnabled: false });
  for (const s of [-1, 1]) { const m = new THREE.Mesh(tgeo, satin); m.position.set(s * 0.3, -0.6, -0.4); m.rotation.z = s * 0.45; m.scale.x = s; bow.add(m); }
  // sul colmo del cerchietto, un po' in avanti e inclinato verso la camera
  bow.position.set(0, 14.4, -1.8); bow.rotation.x = -0.3; bow.scale.setScalar(1.25);
  g.add(bow);
  g.userData.bow = bow;
  return g;
}

export function update(g, bs, t) {
  const b = g.userData.bow; if (b) { b.rotation.z = Math.sin(t * 1.5) * 0.04; const s = 1.25 + 0.02 * Math.sin(t * 3); b.scale.set(s, s, s); }
}
