// Cappellino da festa: cono a righe colorate con pompon animato.
export const meta = { label: 'Cappellino da festa', labelEn: 'Party hat', category: 'costumi', icon: '🥳' };

export default function build(THREE, h) {
  const g = new THREE.Group();

  // texture procedurale a righe diagonali
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const cols = ['#f0386f', '#ffbf1a', '#1f9be8', '#35bf5a'];
  ctx.fillStyle = cols[0]; ctx.fillRect(0, 0, 512, 256);
  for (let i = -8; i < 20; i++) {
    ctx.fillStyle = cols[((i % 4) + 4) % 4];
    ctx.beginPath(); ctx.moveTo(i * 48, 0); ctx.lineTo(i * 48 + 48, 0); ctx.lineTo(i * 48 + 48 + 90, 256); ctx.lineTo(i * 48 + 90, 256); ctx.closePath(); ctx.fill();
  }
  // puntini bianchi
  ctx.fillStyle = 'rgba(255,250,235,.7)';
  for (let i = 0; i < 90; i++) { const x = (i * 97) % 512, y = (i * 61) % 256; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 6.3); ctx.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
  const paper = new THREE.MeshStandardMaterial({ map: tex, roughness: .7 });

  const H = 17, R = 6.4;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(R, H, 48, 1, false), paper);
  g.add(new THREE.Mesh(new THREE.CircleGeometry(R, 48), h.mat(0xe8e0d0, { roughness: .7 })).rotateX(Math.PI / 2));
  cone.position.y = H / 2;
  g.add(cone);
  // bordo inferiore con un orlo bianco
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 10, 48), h.mat(0xeee6d8, { roughness: .6 }));
  rim.rotation.x = Math.PI / 2; g.add(rim);

  // pompon "peloso": sfera con spostamento casuale deterministico dei vertici
  const pomGeo = new THREE.SphereGeometry(2.1, 28, 20);
  const p = pomGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.16 * Math.sin(x * 9.1 + y * 7.3) * Math.cos(z * 8.7 - y * 5.1);
    p.setXYZ(i, x * n, y * n, z * n);
  }
  pomGeo.computeVertexNormals();
  const pom = new THREE.Mesh(pomGeo, h.mat(0xffd23f, { roughness: 1 })); pom.position.y = H + 1.0; g.add(pom);

  // (niente elastico sotto il mento: su un viso vero si vedeva come una riga davanti alla mandibola)
  const outer = new THREE.Group();

  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(6.6, 5, 6.6); occ.position.set(0, -2.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  g.position.set(0, 9.2, -2.0);
  g.rotation.x = -0.18;
  g.rotation.z = 0.12;
  outer.add(g);
  outer.userData.pom = pom;
  return outer;
}

export function update(g, bs, t) {
  const p = g.userData.pom; if (!p) return;
  p.rotation.y = t * 0.6; p.position.x = Math.sin(t * 2.2) * 0.15;
}
