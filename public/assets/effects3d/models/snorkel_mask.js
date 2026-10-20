// Maschera da sub con boccaglio: vetro ovale su occhi e naso (il viso si vede), bordo in silicone giallo, cinghia, boccaglio laterale con bolle.
export const meta = { label: 'Maschera da sub', labelEn: 'Snorkel mask', category: 'costumi', icon: '🤿' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const yellow = h.mat(0xf2b705, { roughness: .45 });
  const black = h.mat(0x1d1f24, { roughness: .55 });
  const f = h.face, fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); fgeo.setIndex(Array.from(f.idx)); fgeo.computeVertexNormals();
  const faceMesh = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); faceMesh.updateMatrixWorld();
  const ray = new THREE.Raycaster(), dn = new THREE.Vector3(0, 0, -1);
  const onFace = (x, y, off) => { ray.set(new THREE.Vector3(x, y, 20), dn); const hit = ray.intersectObject(faceMesh, false)[0]; return hit ? new THREE.Vector3(x, y, hit.point.z + off) : new THREE.Vector3(x, y, off); };

  // contorno della maschera: ovale largo su occhi e naso (sotto il naso stretto), seguito sul viso
  const outline = [];
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const rx = 7.0 - (s < 0 ? 2.6 * s * s : 0), ry = s > 0 ? 3.4 : 4.2;
    outline.push([c * rx, 2.9 + s * ry]);
  }
  const skirt = new THREE.CatmullRomCurve3(outline.map(([x, y]) => onFace(x, y, 0.5)), true);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(skirt, 128, 0.75, 10, true), yellow));
  // vetro: superficie bombata davanti (z = piano + bombatura), visibile attraverso
  const glassZ = (x, y) => 7.6 - 0.035 * x * x - 0.05 * (y - 2.6) ** 2;
  const sh = new THREE.Shape(); outline.forEach(([x, y], i) => i ? sh.lineTo(x * 0.93, 2.9 + (y - 2.9) * 0.93) : sh.moveTo(x * 0.93, 2.9 + (y - 2.9) * 0.93)); sh.closePath();
  const gg = new THREE.ShapeGeometry(sh, 24);
  // suddivido il vetro in una griglia per la bombatura: ricampiono con PlaneGeometry ritagliato
  const pg = new THREE.PlaneGeometry(13.6, 7.8, 40, 24); pg.translate(0, 2.6, 0);
  { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, glassZ(p.getX(i), p.getY(i))); pg.computeVertexNormals(); }
  const c = document.createElement('canvas'); c.width = 512; c.height = 294; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 512, 294); x.fillStyle = '#fff'; x.beginPath();
  outline.forEach(([ox, oy], i) => { const u = (ox * 0.95 + 6.8) / 13.6 * 512, v = (1 - (2.9 + (oy - 2.9) * 0.95 - 2.6 + 3.9) / 7.8) * 294; i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath(); x.fill();
  const alpha = new THREE.CanvasTexture(c);
  g.add(new THREE.Mesh(pg, new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: .03, metalness: 0, transparent: true, opacity: .2, alphaMap: alpha, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide })));
  gg.dispose();
  // cornice del vetro (anello nero tra vetro e silicone)
  const rim = new THREE.CatmullRomCurve3(outline.map(([ox, oy]) => { const X = ox * 0.95, Y = 2.9 + (oy - 2.9) * 0.95; return new THREE.Vector3(X, Y, glassZ(X, Y)); }), true);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(rim, 128, 0.32, 8, true), black));
  // raccordo silicone → cornice (fascia gialla che chiude lo spazio tra i due tubi)
  { const N = 128, P = [], I = [];
    for (let i = 0; i <= N; i++) { const a = skirt.getPointAt((i % N) / N), b = rim.getPointAt((i % N) / N); P.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    for (let i = 0; i < N; i++) { const a = i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setIndex(I); bg.computeVertexNormals();
    g.add(new THREE.Mesh(bg, h.mat(0xe0a800, { roughness: .45, side: THREE.DoubleSide }))); }
  // cinghia (nera) dalle tempie attorno alla testa, sopra i capelli
  const band = [[7.2, 3.6, 0.8], [7.95, 3.7, -2.4], [8.2, 3.9, -5.5], [7.0, 4.2, -9.0], [3.8, 4.4, -11.3], [0, 4.5, -11.95], [-3.8, 4.4, -11.3], [-7.0, 4.2, -9.0], [-8.2, 3.9, -5.5], [-7.95, 3.7, -2.4], [-7.2, 3.6, 0.8]];
  const bc = new THREE.CatmullRomCurve3(band.map(p => new THREE.Vector3(...p)));
  const sg = new THREE.TubeGeometry(bc, 80, 0.9, 8);
  { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const cc = bc.getPointAt(Math.min(1, Math.floor(i / 9) / 80)); p.setX(i, cc.x + (p.getX(i) - cc.x) * 0.3); p.setZ(i, cc.z + (p.getZ(i) - cc.z) * 0.3); } sg.computeVertexNormals(); }
  g.add(new THREE.Mesh(sg, black));
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 1.6), yellow); b.position.set(s * 7.3, 3.4, 0.6); b.rotation.y = s * 0.7; g.add(b); }

  // boccaglio: boccaglio in bocca, tubo che esce di lato (destra di chi indossa, −X), sale lungo la guancia e sopra la testa
  const tube = new THREE.CatmullRomCurve3([[-1.4, -4.3, 6.6], [-3.6, -4.8, 6.0], [-6.3, -4.0, 4.0], [-8.3, -1.0, 1.8], [-9.2, 3.5, 0.6], [-9.4, 9.0, -0.6], [-8.9, 14.5, -1.4], [-8.2, 17.0, -1.6]].map(p => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(tube, 96, 0.75, 14), h.mat(0x1f6fd1, { roughness: .4 })));
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.45, 10, 24), black); mouth.position.set(-0.9, -4.3, 6.4); mouth.rotation.y = 0.35; mouth.scale.set(1.3, 0.8, 1); g.add(mouth);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 1.6, 16), h.mat(0xff6a00, { roughness: .4 })); top.position.set(-8.2, 17.4, -1.6); g.add(top);
  const clip = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.25, 8, 16), black); clip.position.set(-9.1, 4.2, 0.4); clip.rotation.x = Math.PI / 2; g.add(clip);
  // bolle che salgono dalla punta del boccaglio
  const bubbles = [];
  const bm = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: .05, transparent: true, opacity: .35, clearcoat: 1, depthWrite: false });
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5 + 0.12 * i, 14, 10), bm.clone()); g.add(b); bubbles.push(b); }
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): il boccaglio dietro la guancia sparisce girando la testa
  { const geo = fgeo.clone(); const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  g.userData.bubbles = bubbles;
  return g;
}

export function update(g, bs, t) {
  g.userData.bubbles.forEach((b, i) => {
    const ph = (t * 0.45 + i / 5) % 1;
    b.position.set(-8.2 + Math.sin(ph * 9 + i) * 0.8, 18.4 + ph * 9, -1.6 + Math.cos(ph * 7) * 0.5);
    b.material.opacity = 0.4 * (1 - ph); b.scale.setScalar(0.6 + ph);
  });
}
