/* ═══════════════════════════════════════════════════════════════════════════
   1.8.9 — Cerca negli effetti 3D
   Una casella in cima alla scheda «Effetti 3D» del pannello Sfondi ed effetti:
   filtra mentre scrivi, in tutte le lingue dell'app (nome italiano, inglese,
   francese e tedesco) e anche per sezione («maschere», «costumi»…) o per
   «animali». Parole parziali vanno bene («gatt» trova gatti e gattini); più
   parole devono esserci tutte. Le «Novità» durante la ricerca si nascondono
   (sono doppioni delle altre sezioni). Esc o × svuotano la ricerca.
   Non tocca room.js: osserva #effects3dPickerGrid, che room.js riempie (e
   può riempire di nuovo, 1.8.6), e rifiltra quando cambia.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // «animali» in tutte le lingue → effetti che sono animali (inizio di parola, nomi it/en)
  const ANIMAL_Q = new Set(['animali', 'animale', 'animal', 'animals', 'animaux', 'tiere', 'tier', 'bestie', 'bestiole', 'animaletti', 'animaletto']);
  const ANIMAL_W = ['gatt', 'gattin', 'micin', 'cat', 'cats', 'kitten', 'kitty', 'cucciol', 'pupp', 'cagnol', 'cane', 'dog', 'tigr', 'tiger', 'leon', 'lion',
    'panda', 'pandin', 'volp', 'fox', 'koal', 'orsett', 'orso', 'bear', 'teddy', 'lup', 'wolf', 'porcell', 'maial', 'pig', 'piglet', 'pinguin', 'penguin',
    'civett', 'owl', 'gufo', 'unicorn', 'conigl', 'bunny', 'rabbit', 'cricet', 'hamster', 'ranocch', 'rana', 'frog', 'froggy', 'pulcin', 'chick',
    'paperell', 'duck', 'duckling', 'axolotl', 'cerbiat', 'fawn', 'deer', 'vitell', 'calf', 'cow', 'mucc', 'agnell', 'lamb', 'sheep', 'foca', 'seal',
    'lontr', 'otter', 'ricc', 'hedgehog', 'polp', 'octopus', 'bradip', 'sloth', 'topin', 'topolin', 'mouse', 'drag', 'procion', 'raccoon', 'carlin',
    'pug', 'shiba', 'golden', 'apina', 'bee', 'coccinell', 'ladybug', 'lumac', 'snail', 'uccell', 'bird', 'birdie', 'pipistrell', 'bats', 'renna',
    'reindeer', 'farfall', 'butterfl', 'monarc', 'scimm', 'monkey', 'giraff', 'giraffe', 'squal', 'shark', 'leopard', 'zebr', 'pappagall', 'parrot',
    'criceto', 'cube', 'yeti', 'werewolf', 'licantrop', 'tigre', 'gorilla', 'pecor', 'cervo', 'alce', 'koala', 'riccio', 'leoncin', 'lupett', 'tigrott'];
  let box = null, input = null, clearBtn = null, empty = null, grid = null, obs = null, q = '';
  const cache = new Map();

  function haystack(id) {
    if (cache.has(id)) return cache.get(id);
    const cat = window.FaceEffects3D || {};
    const it = cat.byId?.[id];
    const tr = window.APP_TRANSLATIONS || {};
    const parts = [];
    if (it) {
      parts.push(it.label); const t = tr[it.label]; if (t) parts.push(t.en, t.fr, t.de);
      const sec = (cat.sections || []).find(s => s.id !== 'novita' && s.items.some(x => x.id === id));
      if (sec) { parts.push(sec.label); const ts = tr[sec.label]; if (ts) parts.push(ts.en, ts.fr, ts.de); }
    }
    const words = norm(parts.join(' ')).split(' ').filter(Boolean);
    const h = { words, text: words.join(' '), animal: words.some(w => ANIMAL_W.some(a => w.startsWith(a))) };
    cache.set(id, h); return h;
  }

  function matches(id, toks) {
    const h = haystack(id);
    return toks.every(tok => {
      if (ANIMAL_Q.has(tok)) return h.animal;
      return h.words.some(w => w.startsWith(tok)) || (tok.length >= 4 && h.text.includes(tok));
    });
  }

  function apply() {
    if (!grid) return;
    const toks = norm(q).split(' ').filter(Boolean);
    const on = toks.length > 0;
    let shown = 0;
    // le sezioni sono coppie <h4 class="fx-h"> + <div class="fx-grid">; la prima griglia senza titolo ha «Nessuno»
    const kids = [...grid.children];
    const firstHead = kids.findIndex(k => k.classList.contains('fx-h'));
    const novitaFirst = (window.FaceEffects3D?.sections || [])[0]?.id === 'novita';
    kids.forEach((el, i) => {
      if (!el.classList.contains('fx-grid')) return;
      const head = kids[i - 1]?.classList.contains('fx-h') ? kids[i - 1] : null;
      const isNovita = novitaFirst && !!head && i - 1 === firstHead;
      let n = 0;
      el.querySelectorAll('.effect-btn').forEach(b => {
        const id = b.dataset.id;
        const ok = !on || (id && id !== 'none' && !isNovita && matches(id, toks));
        b.classList.toggle('fxs-hide', !ok);
        if (ok) n++;
      });
      const hideSec = on && n === 0;
      el.classList.toggle('fxs-hide', hideSec);
      if (head) head.classList.toggle('fxs-hide', hideSec);
      if (on) shown += n;
    });
    grid.querySelectorAll('.fx-hint').forEach(h => h.classList.toggle('fxs-hide', on));
    if (empty) empty.classList.toggle('hidden', !on || shown > 0);
    if (clearBtn) clearBtn.classList.toggle('hidden', !q);
    box?.classList.toggle('fxs-on', on);
  }

  function mount() {
    grid = document.getElementById('effects3dPickerGrid');
    if (!grid || box) return !!box;
    box = document.createElement('div');
    box.className = 'fxs-box';
    box.innerHTML = `<svg class="fxs-ico" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
      <input type="search" class="fxs-input" id="fx3dSearch" placeholder="Cerca un effetto" aria-label="Cerca un effetto" autocomplete="off" spellcheck="false" enterkeyhint="search">
      <button type="button" class="fxs-x hidden" aria-label="Svuota la ricerca" data-tip="Svuota la ricerca"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    empty = document.createElement('div');
    empty.className = 'fxs-empty hidden';
    empty.innerHTML = '<b>Nessun effetto trovato</b><span>Prova con un\'altra parola, per esempio «gatto», «cappello» o «animali».</span>';
    grid.parentNode.insertBefore(box, grid);
    grid.parentNode.insertBefore(empty, grid.nextSibling);
    input = box.querySelector('input'); clearBtn = box.querySelector('.fxs-x');
    input.addEventListener('input', () => { q = input.value; apply(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; q = ''; apply(); }
      if (e.key === 'Enter') { e.preventDefault(); grid.querySelector('.effect-btn:not(.fxs-hide)')?.focus(); }
    });
    clearBtn.addEventListener('click', () => { input.value = ''; q = ''; apply(); input.focus(); });
    // room.js riempie (o riempie di nuovo) la griglia: si rifiltra
    obs = new MutationObserver(() => { cache.clear(); apply(); });
    obs.observe(grid, { childList: true });
    apply();
    return true;
  }

  function init() {
    if (mount()) return;
    // il pannello si costruisce alla prima apertura: si aspetta la griglia
    const mo = new MutationObserver(() => { if (mount()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.TdtFxSearch = { set(v) { if (!mount() && !input) return; input.value = v || ''; q = input.value; apply(); }, get query() { return q; } };
})();
