// Cappello sushi: un nigiri gigante (riso con chicchi in rilievo, fetta di salmone a venature, striscia di alga) appoggiato
// sui capelli, con due bacchette infilate di traverso.
export const meta = { label: 'Cappello sushi', labelEn: 'Sushi hat', category: 'costumi', icon: '🍣' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const sushi = new THREE.Group();
  // riso: blocco arrotondato (box suddiviso → "gonfiato" verso una superelisse), sotto concavo per calzare la testa
  const rg = new THREE.BoxGeometry(15, 5, 8.5, 48, 16, 28);
  { const p = rg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) / 7.5, y = p.getY(i) / 2.5, z = p.getZ(i) / 4.25;
      const n = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(y), 4) + Math.pow(Math.abs(z), 4), 0.25) || 1;
      x /= n; y /= n; z /= n;
      // chicchi: increspatura
      const grain = 0.11 * (Math.sin(x * 61 + z * 13) * Math.cos(z * 57 - y * 17) + 0.6 * Math.sin(y * 49 + x * 23));
      let X = x * 7.5, Y = y * 2.5, Z = z * 4.25;
      const len = Math.hypot(X, Y, Z) || 1; X += X / len * grain; Y += Y / len * grain; Z += Z / len * grain;
      if (y < 0) Y += 0.035 * (X * X) + 0.07 * Z * Z * 0.5;   // fondo concavo che segue la testa
      p.setXYZ(i, X, Y, Z);
    }
    rg.computeVertexNormals(); }
  const rice = new THREE.Mesh(rg, h.mat(0xebe5d6, { roughness: .9 }));
  sushi.add(rice);
  // salmone: lastra curva sopra il riso, texture a venature
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#f2793e'); gr.addColorStop(1, '#e45a28'); x.fillStyle = gr; x.fillRect(0, 0, 512, 256);
  x.strokeStyle = 'rgba(255,236,220,.85)'; x.lineWidth = 9;
  for (let i = -6; i < 16; i++) { x.beginPath(); x.moveTo(i * 44, 0); x.bezierCurveTo(i * 44 + 30, 80, i * 44 - 10, 170, i * 44 + 40, 256); x.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sg = new THREE.PlaneGeometry(17.5, 9.6, 48, 24);
  { const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i);           // py → profondità (z), si piega sui bordi del riso
      const fx = Math.min(1, Math.abs(px) / 8.75), fz = Math.min(1, Math.abs(py) / 4.8);
      const y = 2.75 - 2.2 * Math.pow(fx, 5) - 1.8 * Math.pow(fz, 6) + 0.12 * Math.sin(px * 1.3 + py);
      p.setXYZ(i, px * (1 - 0.06 * Math.pow(fx, 4)), y, -py * (1 - 0.05 * Math.pow(fz, 4)));
    }
    sg.computeVertexNormals(); }
  const salmon = new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({ map: tex, roughness: .35, clearcoat: .6, clearcoatRoughness: .3, side: THREE.DoubleSide }));
  sushi.add(salmon);
  // striscia di alga nori attorno al centro
  // (sezione a superellisse come il riso, appena più grande; sopra passa sul salmone)
  { const N = 96, P = [], I = [];
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const y = 2.62 * Math.sign(ca) * Math.pow(Math.abs(ca), 0.5), z = 4.4 * Math.sign(sa) * Math.pow(Math.abs(sa), 0.5);
      const yy = y > 0 ? y + 0.45 : y + 0.1 + 0.035 * 0 , k = 1.03;
      for (const x of [-1.5, 1.5]) P.push(x, (y > 0 ? 2.98 * Math.pow(Math.abs(ca), 0.5) : yy * k), z * k + Math.sign(z) * 0.02);
    }
    for (let i = 0; i < N; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ng.setIndex(I); ng.computeVertexNormals();
    sushi.add(new THREE.Mesh(ng, h.mat(0x1f2a1c, { roughness: .75, side: THREE.DoubleSide }))); }
  // bacchette incrociate infilate nel riso
  const wood = h.mat(0xb5874e, { roughness: .6 });
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 20, 10), wood);
    st.position.set(s * 2.2, 4.2, -1.2); st.rotation.set(0.25, 0, s * 1.05); sushi.add(st);
    const tipC = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 2.4, 10), h.mat(0xb3202e, { roughness: .4 })); tipC.position.set(0, 8.6, 0); st.add(tipC);
  }
  sushi.position.set(0, 13.3, -2.8); sushi.rotation.set(-0.12, 0.15, 0.04);
  g.add(sushi);
  const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
  occ.scale.set(8.3, 12.6, 9.2); occ.position.set(0, 1.0, -3.2); occ.renderOrder = -1; occ.name = 'hairOccluder'; if (!h.preview) g.add(occ);
  g.userData.sushi = sushi;
  return g;
}

export function update(g, bs, t) {
  const s = g.userData.sushi; s.rotation.z = 0.04 + Math.sin(t * 1.2) * 0.03;
}
