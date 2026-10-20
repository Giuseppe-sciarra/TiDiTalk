#!/usr/bin/env python3
"""Costruisce il catalogo degli effetti viso 3D e le miniature.

Legge i moduli in public/assets/effects3d/{chars,models,hair,paints}/*.js (export const meta),
renderizza una miniatura per ognuno con three.js (Chromium headless via Playwright) e scrive:
  public/assets/effects3d/catalog.js      (window.FaceEffects3D: sezioni + indice per id)
  public/assets/effects3d/thumbs/<id>.webp
  (stampa le etichette nuove da aggiungere alle traduzioni)

Richiede: node, python3 con playwright (pip install playwright && playwright install chromium) e Pillow,
e i vendor scaricati da setup-mediapipe.sh (three.js).

Uso:  python3 tools/build-effects3d.py            # tutto
      python3 tools/build-effects3d.py --no-thumbs # solo catalogo
      python3 tools/build-effects3d.py --only pig  # una miniatura sola
"""
import os, sys, json, subprocess, io, base64, http.server, socketserver, threading, functools
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, 'public', 'assets', 'effects3d')
PUB = os.path.join(ROOT, 'public')
NO_THUMBS = '--no-thumbs' in sys.argv
ONLY = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None

# ordine e titoli delle sezioni del pannello (le categorie le dichiarano i moduli in meta.category)
SECTIONS = [
    ('novita', 'Novità'), ('personaggi', 'Personaggi'), ('divertenti', 'Divertenti'), ('costumi', 'Costumi'),
    ('capelli', 'Capelli'), ('barba', 'Barba'), ('accessori', 'Accessori'), ('maschere', 'Maschere'),
]
FOLDERS = [('chars', 'model'), ('models', 'model'), ('hair', 'model'), ('glb', 'model'), ('paints', 'paint')]
PREFIX = {'chars': 'char', 'models': 'acc', 'hair': 'hair', 'glb': 'cc', 'paints': 'paint'}

def read_meta(path):
    """Importa il modulo in node e restituisce meta (+ hideHead)."""
    js = f"import('{path}').then(m => console.log(JSON.stringify({{ meta: m.meta || null, hideHead: !!m.hideHead, hasUpdate: typeof m.update === 'function' }}))).catch(e => {{ console.error(e); process.exit(1); }})"
    out = subprocess.run(['node', '--input-type=module', '-e', js], capture_output=True, text=True)
    if out.returncode != 0: raise SystemExit(f'{path}: {out.stderr.strip()[:400]}')
    return json.loads(out.stdout.strip())

items = []
for folder, typ in FOLDERS:
    d = os.path.join(FX, folder)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        if not f.endswith('.js') or f.startswith('_'): continue
        fid = f[:-3]
        info = read_meta(os.path.join(d, f))
        m = info['meta'] or {}
        items.append({
            'id': f'3d-{PREFIX[folder]}-{fid}', 'type': typ, 'path': f'{folder}/{f}', 'folder': folder,
            'label': m.get('label', fid), 'labelEn': m.get('labelEn', m.get('label', fid)),
            'labelFr': m.get('labelFr'), 'labelDe': m.get('labelDe'),
            'category': m.get('category') or {'chars': 'personaggi', 'hair': 'capelli', 'paints': 'maschere'}.get(folder, 'accessori'),
            'order': m.get('order', 50),
            'icon': m.get('icon', '✨'), 'hideHead': info['hideHead'], 'animated': info['hasUpdate'],
            'new': bool(m.get('new')),
        })
print(f'{len(items)} effetti')

# ── Miniature ────────────────────────────────────────────────────────────────
HARNESS = r'''<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/assets/vendor/three/three.module.js","three/addons/":"/assets/vendor/three/jsm/"}}</script>
<style>html,body{margin:0;background:#262a36}</style></head><body><script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const fm = await (await fetch('/assets/effects3d/facemesh.json')).json();
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(fm.pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(fm.uv, 2)); geo.setIndex(fm.idx); geo.computeVertexNormals();
const S = 320;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true }); renderer.setSize(S, S); renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2)); const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 10); scene.add(key);
const camera = new THREE.PerspectiveCamera(30, 1, 1, 300);
const head = new THREE.Group(); scene.add(head);
const skin = new THREE.MeshStandardMaterial({ color: 0x8a8f9c, roughness: .8 });
const face = new THREE.Mesh(geo, skin); head.add(face);
const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), skin); skull.scale.set(7.5, 9.0, 7.6); skull.position.set(0, 1.5, -3.8); head.add(skull);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 10, 32), skin); neck.position.set(0, -12, -1.5); head.add(neck);
const h = { THREE, GLTFLoader, BufferGeometryUtils, face: fm, lm: (i) => new THREE.Vector3(fm.pos[i*3], fm.pos[i*3+1], fm.pos[i*3+2]),
  ANCHORS: ANCHORS_JSON, mat: (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .6, metalness: 0 }, o)) };
window.__thumb = async (def) => {
  while (head.children.length > 3) { const o = head.children[head.children.length - 1]; head.remove(o); }
  face.visible = skull.visible = true; face.material = skin;
  let top = 12, bottom = -12;
  if (def.type === 'paint') {
    const mod = await import('/assets/effects3d/' + def.path + '?t=' + Date.now());
    const size = 1024; const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
    const uvh = { uv: (i) => [fm.uv[i*2] * size, (1 - fm.uv[i*2+1]) * size], ANCHORS: ANCHORS_JSON, size,
      poly: (ids) => { ctx.beginPath(); ids.forEach((i, k) => { const [x, y] = uvh.uv(i); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); } };
    Object.assign(uvh, CONTOURS_JSON);
    await mod.default(ctx, size, uvh);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2 })); head.add(m);
    top = 9.5; bottom = -9.5;
  } else {
    const mod = await import('/assets/effects3d/' + def.path + '?t=' + Date.now());
    const g = await mod.default(THREE, h); if (mod.update) mod.update(g, {}, 0.3, h); head.add(g);
    // gli occlusori dell'effetto (solo profondità) nell'app nascondono le parti dietro la testa vera;
    // qui c'è il manichino, che nasconde da solo: tenuti accesi coprirebbero il manichino stesso
    g.traverse(o => { if (o.isMesh) { const ms = [].concat(o.material || []); if (ms.length && ms.every(m => m.colorWrite === false)) o.visible = false; } });
    if (mod.hideHead) { face.visible = false; skull.visible = false; }
    // solo le parti che si vedono: niente occlusori (colorWrite false) né oggetti nascosti
    g.updateMatrixWorld(true); const box = new THREE.Box3();
    g.traverseVisible(o => { if (!o.isMesh || !o.geometry) return; const ms = [].concat(o.material || []); if (ms.length && ms.every(m => m.colorWrite === false || m.visible === false)) return;
      o.geometry.computeBoundingBox(); if (o.geometry.boundingBox) box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); });
    if (!box.isEmpty()) { top = Math.max(top, box.max.y); bottom = Math.min(bottom, box.min.y); }
    // la testa resta grande: cose che volano sopra o girano intorno escono un po' dal riquadro
    top = Math.min(top, 22); bottom = Math.max(bottom, -16);
  }
  // inquadra testa + effetto (le maschere più da vicino e quasi di fronte)
  const cy = (top + bottom) / 2, span = Math.max(top - bottom, def.type === 'paint' ? 19 : 24);
  const dist = span / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.08;
  camera.position.set(dist * (def.type === 'paint' ? 0.14 : 0.28), cy + dist * 0.12, dist); camera.lookAt(0, cy, 0);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};
window.__ready = true;
</script></body></html>'''
ANCHORS = { 'noseTip': 1, 'forehead': 10, 'chin': 152, 'earL': 234, 'earR': 454, 'eyeLOuter': 33, 'eyeROuter': 263, 'eyeLInner': 133, 'eyeRInner': 362,
    'lipTop': 13, 'lipBottom': 14, 'mouthL': 61, 'mouthR': 291, 'noseBridge': 168, 'browL': 105, 'browR': 334, 'cheekL': 50, 'cheekR': 280, 'templeL': 127, 'templeR': 356 }
CONTOURS = {
    'LIPS_OUTER': [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185],
    'LIPS_INNER': [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191],
    'EYE_L': [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246], 'EYE_R': [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466],
    'BROW_L': [70,63,105,66,107,55,65,52,53,46], 'BROW_R': [300,293,334,296,336,285,295,282,283,276],
    'FACE_OVAL': [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],
    'NOSE': [168,6,197,195,5,4,1,19,94,2], 'NOSE_L': [49,131,134,51,5], 'NOSE_R': [279,360,363,281,5] }
HARNESS = HARNESS.replace('ANCHORS_JSON', json.dumps(ANCHORS)).replace('CONTOURS_JSON', json.dumps(CONTOURS))

if not NO_THUMBS:
    from playwright.sync_api import sync_playwright
    from PIL import Image
    os.makedirs(os.path.join(FX, 'thumbs'), exist_ok=True)
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    class Srv(socketserver.TCPServer): allow_reuse_address = True
    srv = Srv(('127.0.0.1', 0), functools.partial(H, directory=PUB)); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = br.new_page(viewport={'width': 320, 'height': 320})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/__thumbs.html', lambda r: r.fulfill(status=200, content_type='text/html', body=HARNESS))
        pg.goto(f'http://127.0.0.1:{port}/__thumbs.html'); pg.wait_for_function('() => window.__ready', timeout=60000)
        for it in items:
            if ONLY and ONLY not in it['id']: continue
            try:
                data = pg.evaluate('(d) => window.__thumb(d)', it)
                im = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGBA')
                bg = Image.new('RGBA', im.size, (38, 42, 54, 255)); bg.alpha_composite(im)
                bg.convert('RGB').resize((160, 160), Image.LANCZOS).save(os.path.join(FX, 'thumbs', it['id'] + '.webp'), 'WEBP', quality=82)
                print('  thumb', it['id'])
            except Exception as e:
                print('  ERRORE miniatura', it['id'], str(e)[:200])
        br.close()
    srv.shutdown()
    for e in errs[:10]: print('  pagina:', e[:200])

# ── Catalogo ─────────────────────────────────────────────────────────────────
for it in items:
    it['thumb'] = f'/assets/effects3d/thumbs/{it["id"]}.webp' if os.path.exists(os.path.join(FX, 'thumbs', it['id'] + '.webp')) else None
sections = []
# "Novità": in testa al pannello, scelte in effects3d/featured.json (lista di id, in ordine)
fp = os.path.join(FX, 'featured.json')
featured = json.load(open(fp)) if os.path.exists(fp) else []
byid = { i['id']: i for i in items }
nov = [byid[f] for f in featured if f in byid] + [i for i in items if i['new'] and i['id'] not in featured]
missing_f = [f for f in featured if f not in byid]
if missing_f: print('  ⚠ featured.json: id inesistenti', missing_f)
if nov: sections.append({ 'id': 'novita', 'label': 'Novità', 'items': nov })
for cid, lab in SECTIONS:
    if cid == 'novita': continue
    its = sorted([i for i in items if i['category'] == cid], key=lambda i: (i['order'], i['label'].lower()))
    if its: sections.append({ 'id': cid, 'label': lab, 'items': its })
known = {c for c, _ in SECTIONS}
other = [i for i in items if i['category'] not in known]
if other: sections.append({ 'id': 'altri', 'label': 'Altri', 'items': other })
pub = lambda i: { k: i[k] for k in ('id', 'type', 'path', 'label', 'icon', 'thumb', 'hideHead') }
cat = { 'sections': [{ 'id': s['id'], 'label': s['label'], 'items': [pub(i) for i in s['items']] } for s in sections], 'byId': { i['id']: pub(i) for i in items } }
with open(os.path.join(FX, 'catalog.js'), 'w') as f:
    f.write('// Catalogo effetti viso 3D — GENERATO da tools/build-effects3d.py, non modificare a mano.\n')
    f.write('window.FaceEffects3D = ' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('catalog.js:', len(sections), 'sezioni')
# etichette per le traduzioni (chiave italiana → en/fr/de)
tr = {}
tp = os.path.join(FX, 'i18n.json')
if os.path.exists(tp): tr = json.load(open(tp))
labels = { i['label']: [i['labelEn'], i['labelFr'] or tr.get(i['label'], {}).get('fr') or i['labelEn'], i['labelDe'] or tr.get(i['label'], {}).get('de') or i['labelEn']] for i in items }
missing = [k for k in labels if k not in tr and not any(i['label'] == k and i['labelFr'] for i in items)]
if missing: print(f'  ⚠ {len(missing)} etichette senza fr/de in effects3d/i18n.json:', ', '.join(missing[:12]), '…' if len(missing) > 12 else '')
SECT_TR = { 'Novità': ['New', 'Nouveautés', 'Neu'], 'Personaggi': ['Characters', 'Personnages', 'Figuren'], 'Divertenti': ['Fun', 'Amusants', 'Lustig'],
    'Costumi': ['Costumes', 'Costumes', 'Kostüme'], 'Capelli': ['Hair', 'Cheveux', 'Haare'], 'Barba': ['Beard', 'Barbe', 'Bart'],
    'Accessori': ['Accessories', 'Accessoires', 'Accessoires'], 'Maschere': ['Face paint', 'Maquillages', 'Schminke'], 'Classici': ['Classic', 'Classiques', 'Klassisch'], 'Altri': ['Other', 'Autres', 'Weitere'] }
labels.update(SECT_TR)
with open(os.path.join(FX, 'labels.json'), 'w') as f: json.dump(labels, f, ensure_ascii=False, indent=1)
print('labels.json scritto (chiavi it → [en, fr, de]) — da aggiungere a i18n')
