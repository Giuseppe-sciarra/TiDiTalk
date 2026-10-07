'use strict';

/**
 * SoundManager
 * Genera suoni di notifica sintetici via AudioContext + TTS via SpeechSynthesis.
 * I suoni vengono creati al primo utilizzo (dopo interazione utente).
 */
class SoundManager {
  constructor() {
    this._ctx = null;
    this._muted = localStorage.getItem('tdmeet_sounds_muted') === 'true';
    this._ttsEnabled = localStorage.getItem('tdmeet_tts_enabled') === 'true';
    this._ttsVoice = null;
    this._initTTS();
  }

  _getCtx() {
    const desiredSink = window._tdmeetSpeakerId;

    // Se esiste già un context ma lo speakerId è cambiato, ricrea/aggiorna
    if (this._ctx && this._ctx._sinkId !== desiredSink) {
      // setSinkId su AudioContext è disponibile da Chrome 110+
      if (desiredSink && typeof this._ctx.setSinkId === 'function') {
        this._ctx.setSinkId(desiredSink).then(() => {
          this._ctx._sinkId = desiredSink;
        }).catch(() => {});
      }
    }

    if (!this._ctx) {
      try {
        // Chrome 110+: passa sinkId direttamente al costruttore
        if (desiredSink && window.AudioContext) {
          try {
            this._ctx = new AudioContext({ sinkId: desiredSink });
            this._ctx._sinkId = desiredSink;
            return this._ctx;
          } catch {
            // fallback sotto se il costruttore non accetta sinkId
          }
        }
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Applica dopo la creazione se possibile
        if (desiredSink && typeof this._ctx.setSinkId === 'function') {
          this._ctx.setSinkId(desiredSink).then(() => {
            this._ctx._sinkId = desiredSink;
          }).catch(() => {});
        }
      } catch { return null; }
    }
    return this._ctx;
  }

  get muted() { return this._muted; }
  get ttsEnabled() { return this._ttsEnabled; }

  toggleMute() {
    this._muted = !this._muted;
    localStorage.setItem('tdmeet_sounds_muted', this._muted);
    return this._muted;
  }

  toggleTTS() {
    this._ttsEnabled = !this._ttsEnabled;
    localStorage.setItem('tdmeet_tts_enabled', this._ttsEnabled);
    // Se disattivo, ferma eventuale speech in corso
    if (!this._ttsEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return this._ttsEnabled;
  }

  // ─── Suoni ──────────────────────────────────────────────────────────────

  /** Qualcuno entra nella stanza - ding ascendente */
  join() {
    this._play([
      { freq: 523.25, dur: 0.08, vol: 0.3 },
      { freq: 659.25, dur: 0.08, vol: 0.3 },
      { freq: 783.99, dur: 0.15, vol: 0.25 },
    ], 0.06);
  }

  /** Qualcuno esce - ding discendente */
  leave() {
    this._play([
      { freq: 659.25, dur: 0.08, vol: 0.2 },
      { freq: 523.25, dur: 0.12, vol: 0.15 },
    ], 0.05);
  }

  /** Nuovo messaggio chat */
  chat() {
    this._play([
      { freq: 880, dur: 0.06, vol: 0.25 },
      { freq: 1046.5, dur: 0.1, vol: 0.2 },
    ], 0.04);
  }

  /** Errore / azione non permessa */
  error() {
    this._play([
      { freq: 220, dur: 0.1, vol: 0.2 },
      { freq: 196, dur: 0.15, vol: 0.15 },
    ], 0.03);
  }

  /** Inizio registrazione */
  recStart() {
    this._play([
      { freq: 440, dur: 0.06, vol: 0.2 },
      { freq: 440, dur: 0.06, vol: 0.2, delay: 0.12 },
    ], 0.02);
  }

  /**
   * Suono per reazione emoji — usa file audio reali in /assets/sounds/
   */
  reaction(emoji) {
    if (this._muted) return;
    const fileMap = {
      '👍':  'ok',          // pollice su
      '❤️':  'heart',       // cuore
      '😂':  'laughs',      // risate
      '😮':  'woah',        // wow/sorpresa
      '👏':  'applause',    // applauso
      '🎉':  'congrats',    // festa/congratulazioni
      '🙂':  'smile',       // sorriso
      '💋':  'kiss',        // bacio
      '🚀':  'rocket',      // razzo
      '🎺':  'trombone',    // trombone (fail)
      '👎':  'boo',         // disapprovazione
      '✨':  'tinkerbell',  // magia
    };
    const fileName = fileMap[emoji] || 'ok';
    try {
      const audio = new Audio(`/assets/sounds/${fileName}.mp3`);
      audio.volume = 0.85;

      // Applica lo speaker selezionato se il browser lo supporta
      const spkId = window._tdmeetSpeakerId;
      if (spkId && typeof audio.setSinkId === 'function') {
        // setSinkId DEVE essere chiamato prima di play() su alcuni browser,
        // ma funziona anche dopo loadedmetadata
        audio.addEventListener('loadedmetadata', () => {
          audio.setSinkId(spkId).catch(() => {});
        }, { once: true });
      }

      audio.play().catch(err => {
        console.warn('[reaction sound]', err.message);
      });
    } catch (e) {
      console.warn('[reaction sound]', e);
    }
  }

  // ─── TTS ────────────────────────────────────────────────────────────────

  _initTTS() {
    if (!('speechSynthesis' in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Cerca una voce italiana, poi fallback a qualsiasi
      this._ttsVoice =
        voices.find(v => v.lang === I18n.locale && v.localService) ||
        voices.find(v => v.lang === I18n.locale) ||
        voices.find(v => v.lang.startsWith('it')) ||
        voices[0] || null;
    };
    pickVoice();
    // Chrome carica le voci async
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  /**
   * Legge un messaggio di chat. Prefissa con il nome di chi scrive.
   * Viene ignorato se TTS disabilitato o se è un messaggio proprio.
   */
  speak(text, speakerName = '') {
    if (!('speechSynthesis' in window)) {
      console.warn('[TTS] SpeechSynthesis non supportato dal browser');
      return;
    }
    if (!text || !text.trim()) return;

    try {
      // Cancella eventuali speech in coda per evitare accumuli
      window.speechSynthesis.cancel();

      // Se le voci non sono ancora state caricate, ripesca adesso
      if (!this._ttsVoice) this._initTTS();

      const prefix = speakerName ? `${speakerName} dice: ` : '';
      const utter = new SpeechSynthesisUtterance(prefix + text);
      utter.lang = I18n.locale;
      utter.rate = 1.05;
      utter.pitch = 1.0;
      utter.volume = 1.0;
      if (this._ttsVoice) utter.voice = this._ttsVoice;

      utter.onerror = (e) => console.warn('[TTS utterance error]', e);

      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('[TTS]', e);
    }
  }

  // ─── Utility ────────────────────────────────────────────────────────────

  _play(notes, gap = 0.05) {
    if (this._muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') ctx.resume();

    let t = ctx.currentTime + 0.01;
    notes.forEach((note) => {
      const delay = note.delay || 0;
      const start = t + delay;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = note.type || 'sine';
      osc.frequency.setValueAtTime(note.freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(note.vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + note.dur + 0.05);

      if (!note.delay) t += gap + note.dur;
    });
  }
}

window.SoundManager = SoundManager;
