// Casco da astronauta: sfera bianca con oblò frontale (visiera trasparente, il viso resta visibile), anello, collare e dettagli.
// Grande (r 14.2) perché deve contenere anche i capelli veri; l'oblò va dalla fronte a sotto il mento.
import { finish } from './_kit_acc.js';
export const meta = { label: 'Casco da astronauta', labelEn: 'Astronaut helmet', category: 'costumi', icon: '👩‍🚀' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const C = new THREE.Vector3(0, 2.0, -2.6);   // centro del casco
  const RAD = 14.2;
  // oblò: ellisse sulla mappa equirettangolare (1024×512): centro (256, WY), semiassi WX, WR
  const WY = 290, WX = 132, WR = 136;
  const CUT = 433;   // sotto questa riga (θ≈2.66 rad, y≈-10.6) la sfera è aperta: lì c'è il collare

  // mappa alpha: bianco ovunque, ellisse nera davanti (= oblò). Sulla sfera u=0.25 è il davanti (+Z).
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(256, WY, WX, WR, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(0, CUT, 1024, 512 - CUT);
  const alpha = new THREE.CanvasTexture(c);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(RAD, 48, 36),
    new THREE.MeshStandardMaterial({ color: 0xe6e4df, roughness: .38, metalness: .05, alphaMap: alpha, alphaTest: .5 }));   // solo esterno: da dentro l'oblò si vede la testa vera
  shell.position.copy(C);
  g.add(shell);
  // (niente sfera interna scura: dietro l'oblò devono vedersi capelli e collo veri, non una maschera a forma di viso)
  // spessore del guscio: anello interno scuro appena dietro il bordo dell'oblò

  // visiera di vetro: stessa sfera, visibile solo nell'oblò (alphaMap invertita)
  const c2 = document.createElement('canvas'); c2.width = 1024; c2.height = 512;
  const x2 = c2.getContext('2d');
  x2.fillStyle = '#000'; x2.fillRect(0, 0, 1024, 512);
  x2.fillStyle = '#fff'; x2.beginPath(); x2.ellipse(256, WY, WX + 2, WR + 2, 0, 0, Math.PI * 2); x2.fill();
  const alpha2 = new THREE.CanvasTexture(c2);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(RAD + 0.05, 48, 36),
    new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, roughness: .05, metalness: 0, transparent: true, opacity: .22, alphaMap: alpha2, depthWrite: false, clearcoat: 1, side: THREE.FrontSide }));
  glass.position.copy(C); g.add(glass);
  // riflesso: striscia chiara leggera sul vetro (ellisse sottile in alto a sinistra dell'oblò)
  const c3 = document.createElement('canvas'); c3.width = 1024; c3.height = 512;
  const x3 = c3.getContext('2d'); x3.fillStyle = '#000'; x3.fillRect(0, 0, 1024, 512);
  x3.fillStyle = '#fff'; x3.save(); x3.translate(205, 222); x3.rotate(-0.5); x3.beginPath(); x3.ellipse(0, 0, 70, 14, 0, 0, Math.PI * 2); x3.fill(); x3.restore();
  const alpha3 = new THREE.CanvasTexture(c3);
  const gleam = new THREE.Mesh(new THREE.SphereGeometry(RAD + 0.1, 40, 30), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35, alphaMap: alpha3, depthWrite: false }));
  gleam.position.copy(C); g.add(gleam);

  // anello dell'oblò: toro adagiato sulla sfera attorno all'apertura
  const ringMat = h.mat(0xc4c8ce, { roughness: .35, metalness: .8 });
  const ringPts = [];
  for (let i = 0; i <= 80; i++) {
    const a = i / 80 * Math.PI * 2;
    // angoli sulla sfera corrispondenti all'ellisse disegnata sulla mappa
    const du = Math.cos(a) * (WX / 1024) * Math.PI * 2, dv = ((WY - 256) / 512) * Math.PI + Math.sin(a) * (WR / 512) * Math.PI;
    const phi = Math.PI / 2 + du, theta = Math.PI / 2 + dv;   // phi attorno a Y (davanti = π/2), theta da sopra
    ringPts.push(new THREE.Vector3(Math.cos(phi) * Math.sin(theta) * RAD, Math.cos(theta) * RAD, Math.sin(phi) * Math.sin(theta) * RAD).add(C));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts, true), 120, 0.55, 12, true), ringMat));
  const lip = ringPts.map(p => C.clone().addScaledVector(p.clone().sub(C), (RAD - 0.6) / RAD));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip, true), 120, 0.5, 8, true), h.mat(0x3a3f48, { roughness: .8 })));
  // bulloni sull'anello
  for (let i = 0; i < 8; i++) { const p = ringPts[i * 10]; const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), h.mat(0x8a8f96, { roughness: .4, metalness: .8 })); b.position.copy(p).addScaledVector(p.clone().sub(C).normalize(), 0.45); g.add(b); }

  // collare alla base
  // collare all'apertura inferiore della sfera (r≈6.5 a y≈-10.6), sul collo: non copre più il mento
  const cutY = C.y + RAD * Math.cos(CUT / 512 * Math.PI), cutR = RAD * Math.sin(CUT / 512 * Math.PI);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(cutR + 0.4, 1.2, 16, 64), ringMat); collar.rotation.x = Math.PI / 2; collar.position.set(0, cutY - 0.4, C.z); g.add(collar);
  const collar2 = new THREE.Mesh(new THREE.CylinderGeometry(cutR + 1.0, cutR + 2.2, 2.4, 64), h.mat(0xdcdad4, { roughness: .5 })); collar2.position.set(0, cutY - 2.6, C.z); g.add(collar2);
  // dettagli laterali: due "orecchie" tecniche e un'antenna
  for (const s of [-1, 1]) {
    // a cupola, solo facce esterne: viste da dentro l'oblò (attraverso il retro) spariscono
    const ear = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), h.mat(0xd2d4d8, { roughness: .4, metalness: .3 }));
    ear.scale.set(1, 0.45, 1); ear.rotation.z = -s * Math.PI / 2; ear.position.set(s * (RAD - 0.35), C.y, C.z); g.add(ear);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), h.mat(0x5a6470, { roughness: .4 })); cap.rotation.y = s * Math.PI / 2; cap.position.set(s * (RAD + 0.75), C.y, C.z); g.add(cap);
  }
  const onShell = (d, off) => C.clone().addScaledVector(new THREE.Vector3(...d).normalize(), RAD + off);
  const antDir = new THREE.Vector3(-0.6, 0.78, -0.2).normalize();
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), ringMat); ant.position.copy(onShell(antDir.toArray(), 1.4)); ant.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), antDir); g.add(ant);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), h.mat(0xff4040, { emissive: 0xff2020, emissiveIntensity: .8 })); antTip.position.copy(onShell(antDir.toArray(), 3.1)); g.add(antTip);
  // bandierina/etichetta sul lato
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), h.mat(0x2e6bd6, { roughness: .5 })); tag.position.copy(onShell([0.72, 0.5, 0.32], 0.12)); tag.lookAt(tag.position.clone().sub(C).multiplyScalar(3).add(C)); g.add(tag);

  g.userData.antTip = antTip;
  return finish(THREE, g);
}

export function update(g, bs, t) {
  const a = g.userData.antTip; if (a) a.material.emissiveIntensity = 0.4 + 0.6 * (Math.sin(t * 4) > 0 ? 1 : 0);
}
