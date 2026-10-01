'use strict';

/**
 * Whiteboard
 * Lavagna collaborativa condivisa in tempo reale tramite Socket.io.
 * Disegno a mano libera con colori, dimensioni pennello, undo, clear.
 */
class Whiteboard {
  constructor(socket) {
    this.socket   = socket;
    this.open     = false;
    this.canvas   = null;
    this.ctx      = null;
    this.drawing  = false;
    this.color    = '#2563eb';
    this.size     = 4;
    this.tool     = 'pen';  // 'pen' | 'eraser'
    this.strokes  = [];     // Storico locale per undo
    this.lastX    = 0;
    this.lastY    = 0;

    this._bindSocketEvents();
  }

  // ─── Socket events ──────────────────────────────────────────────────────────
  _bindSocketEvents() {
    this.socket.on('wbDraw', (stroke) => {
      this._drawStroke(stroke);
      this.strokes.push(stroke);
    });

    this.socket.on('wbClear', () => {
      this.strokes = [];
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._drawBackground();
      }
    });

    this.socket.on('wbSync', (strokes) => {
      this.strokes = strokes;
      this._redrawAll();
    });
  }

  // ─── Init canvas ────────────────────────────────────────────────────────────
  init(existingStrokes = []) {
    this.canvas = document.getElementById('wbCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this._resize();
    this._drawBackground();

    // Riproduce strokes ricevuti al join
    this.strokes = existingStrokes;
    this._redrawAll();

    // Bind mouse/touch
    this._bindDrawEvents();
    this._bindToolbar();
  }

  _resize() {
    const container = this.canvas.parentElement;
    this.canvas.width  = container.clientWidth;
    this.canvas.height = container.clientHeight;
  }

  _drawBackground() {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Griglia leggera
    this.ctx.strokeStyle = '#f0f0f0';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.canvas.width; x += 32) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += 32) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke();
    }
  }

  // ─── Disegno ────────────────────────────────────────────────────────────────
  _bindDrawEvents() {
    const canvas = this.canvas;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      if (e.touches) {
        return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
      }
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    let currentStroke = null;

    const startDraw = (e) => {
      e.preventDefault();
      this.drawing = true;
      const { x, y } = getPos(e);
      this.lastX = x; this.lastY = y;
      currentStroke = {
        color: this.tool === 'eraser' ? '#ffffff' : this.color,
        size:  this.tool === 'eraser' ? this.size * 4 : this.size,
        points: [{ x, y }],
      };
    };

    const draw = (e) => {
      if (!this.drawing || !currentStroke) return;
      e.preventDefault();
      const { x, y } = getPos(e);

      currentStroke.points.push({ x, y });

      // Disegna localmente
      this._drawSegment(this.lastX, this.lastY, x, y, currentStroke.color, currentStroke.size);
      this.lastX = x; this.lastY = y;

      // Trasmetti ogni N punti per non sovraccaricare
      if (currentStroke.points.length % 5 === 0) {
        const segStroke = {
          color: currentStroke.color,
          size: currentStroke.size,
          points: currentStroke.points.slice(-6), // ultimi 6 punti
          peerId: 'local',
        };
        this.socket.emit('wbDraw', segStroke);
      }
    };

    const endDraw = (e) => {
      if (!this.drawing || !currentStroke) return;
      this.drawing = false;

      // Invia stroke finale completo
      currentStroke.peerId = 'local';
      this.socket.emit('wbDraw', currentStroke);
      this.strokes.push(currentStroke);
      currentStroke = null;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);
  }

  _drawSegment(x1, y1, x2, y2, color, size) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  _drawStroke(stroke) {
    if (!this.ctx || !stroke.points?.length) return;
    const pts = stroke.points;
    if (pts.length === 1) {
      // Singolo punto
      this.ctx.beginPath();
      this.ctx.arc(pts[0].x, pts[0].y, stroke.size/2, 0, Math.PI*2);
      this.ctx.fillStyle = stroke.color;
      this.ctx.fill();
      return;
    }
    for (let i = 1; i < pts.length; i++) {
      this._drawSegment(pts[i-1].x, pts[i-1].y, pts[i].x, pts[i].y, stroke.color, stroke.size);
    }
  }

  _redrawAll() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawBackground();
    this.strokes.forEach(s => this._drawStroke(s));
  }

  // ─── Toolbar ────────────────────────────────────────────────────────────────
  _bindToolbar() {
    // Colori
    document.querySelectorAll('.wb-color').forEach(btn => {
      btn.addEventListener('click', () => {
        this.color = btn.dataset.color;
        this.tool  = 'pen';
        document.querySelectorAll('.wb-color').forEach(b => b.classList.remove('active'));
        document.getElementById('btnWbEraser')?.classList.remove('active');
        btn.classList.add('active');
      });
    });

    // Picker colore custom
    const colorPicker = document.getElementById('wbColorPicker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        this.color = e.target.value;
        this.tool = 'pen';
      });
    }

    // Dimensione pennello
    const sizeSlider = document.getElementById('wbSize');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', (e) => { this.size = parseInt(e.target.value); });
    }

    // Gomma
    document.getElementById('btnWbEraser')?.addEventListener('click', () => {
      this.tool = this.tool === 'eraser' ? 'pen' : 'eraser';
      document.getElementById('btnWbEraser').classList.toggle('active', this.tool === 'eraser');
    });

    // Undo
    document.getElementById('btnWbUndo')?.addEventListener('click', () => {
      this.socket.emit('wbUndo');
    });

    // Clear
    document.getElementById('btnWbClear')?.addEventListener('click', () => {
      if (confirm('Cancellare tutta la lavagna?')) {
        this.socket.emit('wbClear');
      }
    });

    // Export PNG
    document.getElementById('btnWbExport')?.addEventListener('click', () => {
      const a = document.createElement('a');
      a.download = `lavagna_${Date.now()}.png`;
      a.href = this.canvas.toDataURL('image/png');
      a.click();
    });
  }

  // ─── Toggle pannello ────────────────────────────────────────────────────────
  toggle() {
    this.open = !this.open;
    const panel = document.getElementById('whiteboardPanel');
    panel?.classList.toggle('hidden', !this.open);
    document.getElementById('btnWhiteboard')?.classList.toggle('active', this.open);
    if (this.open && !this.canvas) {
      setTimeout(() => this.init(this.strokes), 50);
    } else if (this.open) {
      this._resize();
      this._redrawAll();
    }
  }
}

window.Whiteboard = Whiteboard;
