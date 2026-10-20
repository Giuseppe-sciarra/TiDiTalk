// Maschera da sci: lente unica curva a specchio arancio-viola, telaio in gomma con imbottitura, fascia elastica larga.
export const meta = { label: 'Maschera da sci', labelEn: 'Ski goggles', category: 'accessori', icon: '🎿' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const frameMat = h.mat(0x22252c, { roughness: .55 });
  const foam = h.mat(0x15161a, { roughness: 1 });
  // lente: cilindro (asse Y) che passa davanti agli occhi; sagoma arrotondata ritagliata con alphaMap
  const R = 8.1, CZ = -2.0, H = 6.0, span = 1.18;     // ±68° attorno al davanti
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 512, 256); x.fillStyle = '#fff';
  // contorno: rettangolo molto arrotondato con incavo per il naso in basso al centro
  x.beginPath(); x.moveTo(40, 20); x.lineTo(472, 20); x.quadraticCurveTo(510, 22, 506, 110); x.quadraticCurveTo(500, 220, 420, 236); x.quadraticCurveTo(330, 246, 300, 205);
  x.quadraticCurveTo(256, 160, 212, 205); x.quadraticCurveTo(182, 246, 92, 236); x.quadraticCurveTo(12, 220, 6, 110); x.quadraticCurveTo(2, 22, 40, 20); x.fill();
  const alpha = new THREE.CanvasTexture(c);
  // colore della lente: sfumatura a specchio (texture)
  const c2 = document.createElement('canvas'); c2.width = 4; c2.height = 256; const y = c2.getContext('2d');
  const gr = y.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#6a2bd1'); gr.addColorStop(0.45, '#e2452f'); gr.addColorStop(1, '#f5a623');
  y.fillStyle = gr; y.fillRect(0, 0, 4, 256);
  const map = new THREE.CanvasTexture(c2); map.colorSpace = THREE.SRGBColorSpace;
  const lensGeo = new THREE.CylinderGeometry(R, R, H, 64, 8, true, -span, span * 2);
  // le UV del cilindro vanno da theta=-span a +span: rigiro la U perché la sagoma resti simmetrica davanti
  const lens = new THREE.Mesh(lensGeo, new THREE.MeshPhysicalMaterial({ map, alphaMap: alpha, transparent: true, opacity: .88, roughness: .08, metalness: .65, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
  lens.position.set(0, 2.9, CZ); g.add(lens);
  // telaio: tubo lungo il contorno della lente (stessa sagoma campionata dalla canvas → punti sul cilindro)
  const outline = [[40, 20], [256, 18], [472, 20], [506, 110], [470, 222], [420, 236], [330, 238], [300, 205], [256, 168], [212, 205], [182, 238], [92, 236], [42, 222], [6, 110]];
  const toCyl = ([u, v], off) => { const th = -span + (u / 512) * span * 2, yy = 2.9 + H / 2 - (v / 256) * H; return new THREE.Vector3(Math.sin(th) * (R + off), yy, CZ + Math.cos(th) * (R + off)); };
  const fc = new THREE.CatmullRomCurve3(outline.map(p => toCyl(p, 0.15)), true, 'catmullrom', 0.4);
  const frame = new THREE.TubeGeometry(fc, 160, 0.55, 10, true);
  g.add(new THREE.Mesh(frame, frameMat));
  // imbottitura verso il viso (tubo più grosso, poco più interno)
  const pc = new THREE.CatmullRomCurve3(outline.map(p => toCyl(p, -0.55)), true, 'catmullrom', 0.4);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(pc, 160, 0.6, 8, true), foam));
  // logo sul telaio in alto
  const logo = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 0.2), h.mat(0xffffff, { roughness: .4, emissive: 0x666666, emissiveIntensity: .2 }));
  logo.position.copy(toCyl([256, 18], 0.75)); logo.lookAt(logo.position.clone().multiplyScalar(2)); g.add(logo);
  // fascia elastica larga, colorata a righe (texture), attorno alla testa sopra i capelli
  const c3 = document.createElement('canvas'); c3.width = 256; c3.height = 32; const z = c3.getContext('2d');
  z.fillStyle = '#1f6fd1'; z.fillRect(0, 0, 256, 32); z.fillStyle = '#f2f2f2'; z.fillRect(0, 13, 256, 6); z.fillStyle = '#e2452f'; z.fillRect(0, 4, 256, 3); z.fillRect(0, 25, 256, 3);
  const st = new THREE.CanvasTexture(c3); st.colorSpace = THREE.SRGBColorSpace; st.wrapS = THREE.RepeatWrapping; st.repeat.set(8, 1);
  const N = 72, P = [], UV = [], I = [];
  for (let i = 0; i <= N; i++) {
    const a = span + i / N * (Math.PI * 2 - span * 2);   // dal bordo destro della lente, dietro la testa, al sinistro
    const xx = Math.sin(a), zz = Math.cos(a);
    const rx = 8.35, rz = 8.6, cz = -3.2;
    const px = xx * rx, pz = cz + zz * rz;
    P.push(px, 2.9 - 1.9, pz, px, 2.9 + 1.9, pz); UV.push(i / N, 0, i / N, 1);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); sg.setIndex(I); sg.computeVertexNormals();
  g.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: st, roughness: .85, side: THREE.DoubleSide })));
  // fibbie laterali
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.6, 1.6), frameMat); b.position.set(s * 7.95, 2.9, -0.4); b.rotation.y = s * 0.55; g.add(b); }
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm)
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return g;
}
