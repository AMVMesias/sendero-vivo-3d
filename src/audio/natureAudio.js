/**
 * Generador procedural de paisaje sonoro natural mediante Web Audio API.
 * Produce brisa entre hojas, sonido de cascada modulado según proximidad y cantos suaves de aves,
 * evitando dependencia de archivos externos y respetando silencio o volumen regulable.
 */
export class NatureAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.waterGain = null;
    this.windGain = null;
    this.birdTimer = null;
    this.isMuted = false;
    this.volume = 0.55;
    this.waterProximity = 0.2;
    this.initialized = false;
  }

  /** Inicializa el contexto de audio tras una interacción del usuario. */
  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
    this.masterGain.connect(this.ctx.destination);

    const pinkNoiseBuffer = this.createPinkNoiseBuffer(4);

    this.setupWindLayer(pinkNoiseBuffer);
    this.setupWaterLayer(pinkNoiseBuffer);
    this.scheduleBirdChirp();

    this.initialized = true;
  }

  createPinkNoiseBuffer(seconds) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  setupWindLayer(buffer) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 0.7;

    // Modulación lenta de la brisa
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.38;

    source.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    source.start();
    lfo.start();
  }

  setupWaterLayer(buffer) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 920;
    filter.Q.value = 0.55;

    this.waterGain = this.ctx.createGain();
    this.waterGain.gain.value = this.computeWaterGain(this.waterProximity);

    source.connect(filter);
    filter.connect(this.waterGain);
    this.waterGain.connect(this.masterGain);

    source.start();
  }

  computeWaterGain(proximity) {
    return 0.04 + Math.max(0, Math.min(1, proximity)) * 0.42;
  }

  /** Actualiza suavemente la intensidad de la cascada según la estación activa. */
  setWaterProximity(proximity) {
    this.waterProximity = proximity;
    if (!this.initialized || !this.waterGain) return;
    this.waterGain.gain.setTargetAtTime(
      this.computeWaterGain(proximity),
      this.ctx.currentTime,
      0.6
    );
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (!this.initialized || !this.masterGain) return;
    const target = this.isMuted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (!this.initialized || !this.masterGain) return;
    const target = this.isMuted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }

  scheduleBirdChirp() {
    const delayMs = 3800 + Math.random() * 5200;
    this.birdTimer = window.setTimeout(() => {
      if (this.initialized && !this.isMuted && this.ctx.state === 'running') {
        this.playSoftBirdNote();
      }
      this.scheduleBirdChirp();
    }, delayMs);
  }

  playSoftBirdNote() {
    const now = this.ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 2);
    const baseFreq = 1650 + Math.random() * 650;

    for (let i = 0; i < notes; i++) {
      const start = now + i * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.14 + Math.random() * 0.1), start + 0.08);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.94, start + 0.13);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.032, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

      osc.connect(gain);
      if (panner) {
        panner.pan.value = (Math.random() * 1.4) - 0.7;
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        gain.connect(this.masterGain);
      }

      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  dispose() {
    if (this.birdTimer) {
      clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
