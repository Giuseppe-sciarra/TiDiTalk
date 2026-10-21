#!/usr/bin/env python3
"""Genera public/assets/emoji/emoji-<lingua>.json per il selettore «+» delle reazioni.

Fonte: emojibase-data (MIT, https://emojibase.dev) — scaricare e scompattare il pacchetto npm:
    npm pack emojibase-data@16.0.3 && tar xzf emojibase-data-16.0.3.tgz
    python3 tools/build-emoji.py ./package
Si tengono solo le emoji fino alla versione 14 (le più nuove su molti computer non si vedono),
senza i «componenti» (tonalità, capelli). Per ognuna: emoji, gruppo, varianti di tonalità
(1..5, solo quelle a tonalità unica), nome e parole chiave nella lingua.
"""
import json, os, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else 'package'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'emoji')
os.makedirs(OUT, exist_ok=True)
MAXV = 14
GROUPS = [0, 1, 3, 4, 5, 6, 7, 8, 9]   # 2 = componenti: esclusi
MODS = ['1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF']

def tones(e):
    sk = e.get('skins') or []
    out = []
    for i, m in enumerate(MODS):
        # variante con UNA sola tonalità (tutte le persone uguali)
        cand = [s for s in sk if s['hexcode'].count('1F3F') >= 1 and all(p == m for p in s['hexcode'].split('-') if p in MODS)]
        if not cand: return None
        out.append(cand[0]['emoji'])
    return out

for lang in ['it', 'en', 'fr', 'de']:
    data = json.load(open(os.path.join(SRC, lang, 'data.json'), encoding='utf-8'))
    rows = []
    for e in sorted(data, key=lambda x: x.get('order', 1e9)):
        if e.get('group') not in GROUPS or e.get('version', 99) > MAXV or 'order' not in e: continue
        if e.get('group') == 9 and e.get('subgroup') == 99: continue   # bandiere di regioni (Scozia…): spesso non si vedono
        r = [e['emoji'], GROUPS.index(e['group']), e.get('label', ''), ' '.join(e.get('tags') or [])]
        t = tones(e)
        if t: r.append(t)
        rows.append(r)
    with open(os.path.join(OUT, f'emoji-{lang}.json'), 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
    print(lang, len(rows), os.path.getsize(os.path.join(OUT, f'emoji-{lang}.json')))
