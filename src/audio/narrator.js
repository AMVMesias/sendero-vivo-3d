/**
 * Narrador accesible en español utilizando Web Speech API (speechSynthesis).
 * Diseñado para reducir carga visual en adultos mayores y facilitar el acceso
 * a los relatos comunitarios con velocidad regulable.
 */
export class AccessibleNarrator {
  constructor(onStateChange) {
    this.onStateChange = onStateChange || (() => {});
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.rate = 0.92;
    this.state = 'idle'; // 'idle' | 'speaking' | 'paused' | 'unsupported'
    this.preferredVoice = null;

    if (!this.isSupported) {
      this.state = 'unsupported';
    } else {
      this.loadVoice();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => this.loadVoice());
    }
  }

  loadVoice() {
    if (!this.isSupported) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    this.preferredVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('es-419')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('es-es')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('es')) ||
      null;
  }

  setState(nextState) {
    this.state = nextState;
    this.onStateChange(nextState);
  }

  setRate(rate) {
    this.rate = Math.max(0.7, Math.min(1.25, rate));
  }

  speakStation(station) {
    if (!this.isSupported) {
      this.setState('unsupported');
      return;
    }

    this.stop();

    const text = [
      `Estación ${station.number}: ${station.title}.`,
      `Relato de ${station.guideName}, ${station.guideRole}.`,
      ...station.storyParagraphs,
      `Nota intercultural: ${station.culturalNote}`
    ].join(' ');

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.preferredVoice?.lang || 'es-ES';
    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }
    utterance.rate = this.rate;
    utterance.pitch = 1.0;

    utterance.onstart = () => this.setState('speaking');
    utterance.onpause = () => this.setState('paused');
    utterance.onresume = () => this.setState('speaking');
    utterance.onend = () => this.setState('idle');
    utterance.onerror = () => this.setState('idle');

    window.speechSynthesis.speak(utterance);
  }

  togglePauseResume() {
    if (!this.isSupported) return;
    if (this.state === 'speaking') {
      window.speechSynthesis.pause();
      this.setState('paused');
    } else if (this.state === 'paused') {
      window.speechSynthesis.resume();
      this.setState('speaking');
    }
  }

  stop() {
    if (!this.isSupported) return;
    window.speechSynthesis.cancel();
    this.setState('idle');
  }
}
