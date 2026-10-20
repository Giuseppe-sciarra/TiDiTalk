// Farfalle che volano attorno alla testa: 5 farfalle (monarca, morpho blu, rosa, gialla, lilla) con ali che battono,
// orbita inclinata che passa davanti alla fronte e dietro la nuca (nascoste dalla testa+capelli).
export const meta = { label: 'Farfalle', labelEn: 'Butterflies', category: 'divertenti', icon: '🦋' };

function wingTexture(THREE, base, edge, spots) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  // ala anteriore (in alto) e posteriore (in basso) disegnate nella stessa texture, attacco al corpo sul bordo sinistro
  const up = new Path2D(); up.moveTo(6, 128); up.bezierCurveTo(40, 20, 170, -10, 246, 30); up.bezierCurveTo(250, 80, 200, 120, 6, 128);
  const lo = new Path2D(); lo.moveTo(6, 128); lo.bezierCurveTo(120, 128, 210, 160, 200, 210); lo.bezierCurveTo(170, 250, 70, 250, 6, 128);
  for (const p of [up, lo]) {
    x.save(); x.clip(p);
    const gr = x.createRadialGradient(10, 128, 10, 10, 128, 250); gr.addColorStop(0, base[0]); gr.addColorStop(0.7, base[1]); gr.addColorStop(1, edge);
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    // venature
    x.strokeStyle = 'rgba(20,10,10,.55)'; x.lineWidth = 3;
    for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(8, 128); x.quadraticCurveTo(110, 128 + (i - 2.5) * 30, 240, 128 + (i - 2.5) * 46); x.stroke(); }
    // bordo scuro con puntini chiari
    x.lineWidth = 16; x.strokeStyle = edge; x.stroke(p);
    x.fillStyle = spots; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; x.beginPath(); x.arc(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112, 4, 0, 6.3); x.fill(); }
    x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const kinds = [
    [['#ffb347', '#f07a12'], '#1c1410', '#f6efe2'],   // monarca
    [['#7fd6ff', '#1f6fd1'], '#0d1630', '#cfe8ff'],   // morpho
    [['#ffd1e6', '#ef5d9a'], '#5a1235', '#ffffff'],   // rosa
    [['#fff2a8', '#f2c12e'], '#3a2a08', '#fffbe0'],   // gialla
    [['#e6d6ff', '#9a6be0'], '#2a1650', '#f4ecff'],   // lilla
  ];
  const bodyMat = h.mat(0x1d1714, { roughness: .6 });
  const flies = [];
  kinds.forEach((k, i) => {
    const tex = wingTexture(THREE, ...k);
    const wm = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, roughness: .55 });
    const b = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(3.2, 3.2); wingGeo.translate(1.6, 0, 0);     // cerniera sul bordo sinistro
    const wl = new THREE.Mesh(wingGeo, wm), wr = new THREE.Mesh(wingGeo, wm);
    wl.rotation.x = -Math.PI / 2; wr.rotation.x = -Math.PI / 2;
    const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr); pr.scale.x = -1;
    b.add(pl, pr);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 2.0, 4, 8), bodyMat); body.rotation.x = Math.PI / 2; b.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bodyMat); head.position.z = 1.2; b.add(head);
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 1.3), new THREE.Vector3(s * 0.35, 0.3, 2.0), new THREE.Vector3(s * 0.6, 0.45, 2.5)]), 8, 0.04, 4), bodyMat);
      b.add(ant);
    }
    b.scale.setScalar(1.55 - i * 0.07);
    g.add(b);
    flies.push({ b, pl, pr, ph: i / kinds.length * Math.PI * 2, sp: 0.55 + i * 0.07, r: 11.5 + (i % 2) * 1.2, y: 12.5 + (i % 3) * 1.1, fl: 9 + i * 1.3 });
  });
  // occlusore testa + capelli (solo profondità): le farfalle dietro la nuca spariscono dietro i capelli veri
  const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occ.scale.set(8.5, 13.0, 9.6); occ.position.set(0, 1.0, -3.2); occ.renderOrder = -1; occ.name = 'hairOccluder'; if (!h.preview) g.add(occ);   // nell'harness coprirebbe il manichino
  g.userData.flies = flies;
  update(g, {}, 0.8);
  return g;
}

export function update(g, bs, t) {
  for (const f of g.userData.flies) {
    const a = f.ph + t * f.sp;
    // orbita inclinata: davanti più bassa (fronte), dietro più alta (sopra la nuca)
    const x = Math.cos(a) * f.r, z = -3.2 + Math.sin(a) * f.r * 0.95;
    const y = f.y - 1.6 * Math.sin(a) + 0.6 * Math.sin(t * 2.3 + f.ph * 3);
    f.b.position.set(x, y, z);
    // guarda nella direzione del volo
    const tx = -Math.sin(a), tz = Math.cos(a) * 0.95;
    f.b.rotation.set(0, Math.atan2(tx, tz), 0);
    f.b.rotateX(-0.25 + 0.15 * Math.sin(t * 2.3 + f.ph * 3));
    f.b.rotateZ(-0.75);            // virata verso l'esterno: le ali si vedono dalla camera, non di taglio
    const flap = 0.1 + 1.15 * (0.5 + 0.5 * Math.sin(t * f.fl));
    f.pl.rotation.z = flap; f.pr.rotation.z = flap;
  }
}
