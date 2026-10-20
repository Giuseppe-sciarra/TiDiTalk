// Cappello torta di compleanno: torta a due piani calzata sui capelli, glassa rosa che cola, codette colorate, ciliegia e
// tre candeline a righe con fiammelle che tremolano (si spengono per un attimo se soffi: mouthPucker / mouthFunnel).
export const meta = { label: 'Cappello torta', labelEn: 'Cake hat', category: 'costumi', icon: '🎂' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  const sponge = h.mat(0xe8c79a, { roughness: .9 });
  const icing = new THREE.MeshPhysicalMaterial({ color: 0xf28bb3, roughness: .35, clearcoat: .6 });
  const cream = h.mat(0xf2e8da, { roughness: .6 });

  const tier = (R, H, y0) => {
    const t = new THREE.Group(); t.position.y = y0;
    // pan di spagna con strato di crema
    t.add(new THREE.Mesh(lathe([[R - 0.2, 0], [R, 0.3], [R, H - 0.6], [0.01, H - 0.6]]), sponge));
    const mid = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.22, 6, 72), cream); mid.rotation.x = Math.PI / 2; mid.position.y = H * 0.45; t.add(mid);
    // glassa sopra con colate: cappello di glassa con bordo inferiore ondulato
    const N = 96, rows = 6, P = [], I = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2, f = j / rows;           // f: 0 bordo alto piatto → 1 punta delle colate
      const drip = 0.6 + 1.4 * Math.pow(Math.max(0, Math.sin(a * 9 + Math.sin(a * 4) * 1.5)), 3) + 0.3 * Math.sin(a * 23);
      const y = H - 0.35 - f * drip, r = R + 0.16 + 0.08 * Math.sin(f * Math.PI);
      P.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); dg.setIndex(I); dg.computeVertexNormals();
    t.add(new THREE.Mesh(dg, new THREE.MeshPhysicalMaterial({ color: 0xf28bb3, roughness: .35, clearcoat: .6, side: THREE.DoubleSide })));
    t.add(new THREE.Mesh(lathe([[0.01, H + 0.05], [R - 0.6, H + 0.05], [R + 0.05, H - 0.15], [R + 0.18, H - 0.4]]), icing));
    // cordoncino di panna sul bordo
    const rope = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.32, 8, 96), cream); rope.rotation.x = Math.PI / 2; rope.position.y = H; t.add(rope);
    return t;
  };
  const bottom = tier(9.0, 4.4, 0), top = tier(5.6, 3.6, 4.35);
  g.add(bottom, top);
  // codette colorate sulla glassa (piano basso: anello esterno; piano alto: tutto)
  const sprCols = [0xff4d6d, 0xffd23f, 0x3fb6ff, 0x7ee081, 0xffffff, 0xb59cff].map(c => h.mat(c, { roughness: .5 }));
  const spr = new THREE.CapsuleGeometry(0.1, 0.42, 2, 6);
  for (let i = 0; i < 70; i++) {
    const onTop = i < 30, a = i * 2.399, rr = onTop ? 0.8 + ((i * 37) % 47) / 47 * 4.2 : 6.1 + ((i * 53) % 29) / 29 * 2.4;
    const m = new THREE.Mesh(spr, sprCols[i % 6]); m.position.set(Math.cos(a) * rr, onTop ? 8.05 : 4.5, Math.sin(a) * rr);
    m.rotation.set(Math.PI / 2, 0, a * 3); g.add(m);
  }
  // ciliegia
  const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0xb3001b, roughness: .15, clearcoat: 1 }));
  cherry.position.set(2.6, 8.7, 2.4); g.add(cherry);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(2.6, 9.4, 2.4), new THREE.Vector3(2.9, 10.4, 2.1), new THREE.Vector3(3.5, 11.0, 1.9)]), 10, 0.07, 5), h.mat(0x4c6b22, { roughness: .7 })));
  // candeline a righe (texture) con stoppino e fiamma
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#f7f2e8'; x.fillRect(0, 0, 64, 256); x.fillStyle = '#3fb6ff';
  for (let i = -4; i < 12; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(64, i * 32 + 40); x.lineTo(64, i * 32 + 54); x.lineTo(0, i * 32 + 14); x.fill(); }
  const ctex = new THREE.CanvasTexture(c); ctex.colorSpace = THREE.SRGBColorSpace;
  const flames = [];
  for (const [cx, cz, col] of [[-1.8, 0.6, '#3fb6ff'], [0.6, -1.6, '#ff4d6d'], [0.2, 2.2, '#7ee081']]) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const y = cv.getContext('2d'); y.drawImage(c, 0, 0); y.globalCompositeOperation = 'source-atop'; y.fillStyle = col; y.globalAlpha = .9; y.fillRect(0, 0, 64, 256);
    y.globalCompositeOperation = 'destination-over'; y.globalAlpha = 1; y.fillStyle = '#f7f2e8'; y.fillRect(0, 0, 64, 256);
    const t2 = new THREE.CanvasTexture(cv); t2.colorSpace = THREE.SRGBColorSpace;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.2, 16), new THREE.MeshStandardMaterial({ map: t2, roughness: .5 }));
    candle.position.set(cx, 10.1, cz); g.add(candle);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5), h.mat(0x222222)); wick.position.set(cx, 12.45, cz); g.add(wick);
    const fl = new THREE.Group(); fl.position.set(cx, 12.75, cz);
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffa21a, transparent: true, opacity: .9 })); outer.scale.set(1, 2.1, 1); outer.position.y = 0.55; fl.add(outer);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff3b0 })); inner.scale.set(1, 1.8, 1); inner.position.y = 0.38; fl.add(inner);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.y = 0.6; fl.add(glow);
    g.add(fl); flames.push(fl);
  }
  g.position.set(0, 9.6, -2.6);
  g.rotation.x = -0.12;
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.4, 5, 8.4); occ.position.set(0, -2.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  g.userData.flames = flames;
  return g;
}

export function update(g, bs, t) {
  const blow = Math.max(bs.mouthPucker || 0, bs.mouthFunnel || 0);
  g.userData.flames.forEach((f, i) => {
    const flick = 1 + 0.12 * Math.sin(t * 17 + i * 2) + 0.08 * Math.sin(t * 29 + i);
    f.scale.set(1, flick * (1 - 0.85 * blow), 1);
    f.rotation.z = 0.12 * Math.sin(t * 7 + i) + 0.5 * blow;
    f.visible = blow < 0.75;
  });
}
