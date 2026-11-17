import { STATIONS } from './data/stations.js';
import { NatureAudioEngine } from './audio/natureAudio.js';
import { AccessibleNarrator } from './audio/narrator.js';
import { TrailScene } from './scene/trailScene.js';
import { ICONS } from './ui/icons.js';

class SenderoVivoApp {
  constructor() {
    this.currentStationIndex = 0;
    this.isAutoTour = false;
    this.autoTourTimer = null;
    this.audioMuted = false;
    this.wheelchairMode = true;
    this.highContrast = false;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

    this.hydrateStaticIcons();
    this.elements = this.cacheElements();
    this.audio = new NatureAudioEngine();
    this.narrator = new AccessibleNarrator((state) => this.updateNarratorUI(state));

    this.scene = new TrailScene(this.elements.sceneContainer, STATIONS, {
      onStationClick: (index) => {
        this.stopAutoTour();
        this.selectStation(index);
      },
      onStationHover: (index) => this.updateTooltip(index),
      onProgressChange: (meters, nearestIndex, waterfallProximity) => {
        this.handleProgressUpdate(meters, nearestIndex, waterfallProximity);
      }
    });

    this.buildStationPills();
    this.bindEvents();
    this.applyReducedMotion(this.reducedMotion);
    // En pantallas de teléfono (vertical u horizontal), iniciar con el relato colapsado
    const isPhoneQuery = '(max-width: 768px), (max-height: 520px) and (max-width: 950px)';
    if (window.matchMedia?.(isPhoneQuery).matches) {
      this.setStoryExpanded(false);
    }
    this.selectStation(0, { announce: false });
  }

  hydrateStaticIcons() {
    document.querySelectorAll('[data-icon]').forEach((slot) => {
      const key = slot.getAttribute('data-icon');
      if (ICONS[key]) {
        slot.innerHTML = ICONS[key];
      }
    });
  }

  setButtonDisplay(button, iconKey, labelText) {
    const iconSlot = button.querySelector('.btn-icon');
    const labelSlot = button.querySelector('.btn-label');
    if (iconSlot && ICONS[iconKey]) {
      iconSlot.innerHTML = ICONS[iconKey];
    }
    if (labelSlot && labelText !== undefined) {
      labelSlot.textContent = labelText;
    }
  }

  cacheElements() {
    const get = (id) => document.getElementById(id);
    return {
      sceneContainer: get('scene-container'),
      liveAnnouncer: get('live-announcer'),
      btnToggleAudio: get('btn-toggle-audio'),
      btnToggleA11y: get('btn-toggle-a11y'),
      btnOpenLab: get('btn-open-lab'),
      btnToggleStory: get('btn-toggle-story'),
      trailDistanceBadge: get('trail-distance-badge'),
      storyCard: get('story-card'),
      stationNumberBadge: get('station-number-badge'),
      stationTerritoryTag: get('station-territory-tag'),
      stationTitle: get('station-title'),
      stationSubtitle: get('station-subtitle'),
      guideName: get('guide-name'),
      guideRole: get('guide-role'),
      btnNarrate: get('btn-narrate'),
      btnNarratePause: get('btn-narrate-pause'),
      btnNarrateStop: get('btn-narrate-stop'),
      stationParagraphs: get('station-paragraphs'),
      stationHighlights: get('station-highlights'),
      stationCulturalNote: get('station-cultural-note'),
      stationA11yNote: get('station-a11y-note'),
      a11yPanel: get('a11y-panel'),
      btnCloseA11y: get('btn-close-a11y'),
      btnEyeWheelchair: get('btn-eye-wheelchair'),
      btnEyeStanding: get('btn-eye-standing'),
      btnContrast: get('btn-contrast'),
      btnReducedMotion: get('btn-reduced-motion'),
      volumeSlider: get('volume-slider'),
      volumeValue: get('volume-value'),
      btnLookLeft: get('btn-look-left'),
      btnLookCenter: get('btn-look-center'),
      btnLookRight: get('btn-look-right'),
      btnStepBack: get('btn-step-back'),
      btnStepForward: get('btn-step-forward'),
      btnPrevStation: get('btn-prev-station'),
      btnNextStation: get('btn-next-station'),
      stationPills: get('station-pills'),
      btnAutoTour: get('btn-autotour'),
      btnQuickPerspective: get('btn-quick-perspective'),
      sceneTooltip: get('scene-tooltip'),
      welcomeModal: get('welcome-modal'),
      btnStartTour: get('btn-start-tour'),
      labModal: get('lab-modal'),
      btnCloseLab: get('btn-close-lab')
    };
  }

  buildStationPills() {
    this.elements.stationPills.innerHTML = '';
    STATIONS.forEach((station, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-compact';
      btn.setAttribute('role', 'tab');
      btn.textContent = `${station.number}. ${station.shortTitle}`;
      btn.addEventListener('click', () => {
        this.stopAutoTour();
        this.selectStation(idx);
      });
      this.elements.stationPills.appendChild(btn);
    });
  }

  bindEvents() {
    const el = this.elements;

    el.btnStartTour.addEventListener('click', () => {
      el.welcomeModal.hidden = true;
      this.audio.init();
      this.audio.setWaterProximity(STATIONS[this.currentStationIndex].waterProximity);
      this.announce('Recorrido iniciado en Estación 1: Mirador de la Neblina.');
    });

    el.btnOpenLab.addEventListener('click', () => {
      el.labModal.hidden = false;
    });

    el.btnCloseLab.addEventListener('click', () => {
      el.labModal.hidden = true;
    });

    el.btnToggleAudio.addEventListener('click', () => {
      this.audio.init();
      this.audioMuted = !this.audioMuted;
      this.audio.setMuted(this.audioMuted);
      el.btnToggleAudio.setAttribute('aria-pressed', String(!this.audioMuted));
      this.setButtonDisplay(
        el.btnToggleAudio,
        this.audioMuted ? 'audioOff' : 'audioOn',
        this.audioMuted ? 'Sonido silenciado' : 'Sonido natural'
      );
    });

    el.btnToggleA11y.addEventListener('click', () => {
      const willOpen = el.a11yPanel.hidden;
      el.a11yPanel.hidden = !willOpen;
      el.btnToggleA11y.setAttribute('aria-expanded', String(willOpen));
      if (willOpen && window.matchMedia?.('(max-width: 768px)').matches) {
        this.setStoryExpanded(false);
      }
    });

    el.btnCloseA11y.addEventListener('click', () => {
      el.a11yPanel.hidden = true;
      el.btnToggleA11y.setAttribute('aria-expanded', 'false');
    });

    el.btnToggleStory.addEventListener('click', () => {
      const currentlyHidden = el.storyCard.classList.contains('is-hidden');
      this.setStoryExpanded(currentlyHidden);
    });

    el.btnNarrate.addEventListener('click', () => {
      this.audio.init();
      this.narrator.speakStation(STATIONS[this.currentStationIndex]);
    });
    el.btnNarratePause.addEventListener('click', () => this.narrator.togglePauseResume());
    el.btnNarrateStop.addEventListener('click', () => this.narrator.stop());

    el.btnPrevStation.addEventListener('click', () => {
      this.stopAutoTour();
      const prev = (this.currentStationIndex - 1 + STATIONS.length) % STATIONS.length;
      this.selectStation(prev);
    });

    el.btnNextStation.addEventListener('click', () => {
      this.stopAutoTour();
      const next = (this.currentStationIndex + 1) % STATIONS.length;
      this.selectStation(next);
    });

    el.btnStepForward.addEventListener('click', () => {
      this.stopAutoTour();
      this.audio.init();
      this.scene.stepAlongTrail(0.045);
    });

    el.btnStepBack.addEventListener('click', () => {
      this.stopAutoTour();
      this.audio.init();
      this.scene.stepAlongTrail(-0.045);
    });

    el.btnAutoTour.addEventListener('click', () => {
      this.audio.init();
      if (this.isAutoTour) this.stopAutoTour();
      else this.startAutoTour();
    });

    el.btnLookLeft.addEventListener('click', () => this.scene.lookBy(0.42, 0));
    el.btnLookRight.addEventListener('click', () => this.scene.lookBy(-0.42, 0));
    el.btnLookCenter.addEventListener('click', () => this.scene.recenterLook());

    el.btnEyeWheelchair.addEventListener('click', () => this.setWheelchairMode(true));
    el.btnEyeStanding.addEventListener('click', () => this.setWheelchairMode(false));
    el.btnQuickPerspective.addEventListener('click', () => {
      this.setWheelchairMode(!this.wheelchairMode);
    });

    document.querySelectorAll('[data-font-scale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const scale = btn.getAttribute('data-font-scale');
        document.documentElement.style.setProperty('--font-scale', scale);
        document.querySelectorAll('[data-font-scale]').forEach((b) => b.classList.remove('btn-active'));
        btn.classList.add('btn-active');
      });
    });

    document.querySelectorAll('[data-speech-rate]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rate = parseFloat(btn.getAttribute('data-speech-rate'));
        this.narrator.setRate(rate);
        document.querySelectorAll('[data-speech-rate]').forEach((b) => b.classList.remove('btn-active'));
        btn.classList.add('btn-active');
      });
    });

    el.btnContrast.addEventListener('click', () => {
      this.highContrast = !this.highContrast;
      document.documentElement.setAttribute('data-contrast', this.highContrast ? 'high' : 'normal');
      el.btnContrast.setAttribute('aria-pressed', String(this.highContrast));
      el.btnContrast.classList.toggle('btn-active', this.highContrast);
    });

    el.btnReducedMotion.addEventListener('click', () => {
      this.applyReducedMotion(!this.reducedMotion);
    });

    el.volumeSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      el.volumeValue.textContent = `${val}%`;
      this.audio.setVolume(val / 100);
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const num = Number(e.key);
      if (num >= 1 && num <= STATIONS.length) {
        this.stopAutoTour();
        this.selectStation(num - 1);
      } else if (e.key === 'ArrowRight') {
        this.stopAutoTour();
        this.selectStation((this.currentStationIndex + 1) % STATIONS.length);
      } else if (e.key === 'ArrowLeft') {
        this.stopAutoTour();
        this.selectStation((this.currentStationIndex - 1 + STATIONS.length) % STATIONS.length);
      } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        this.stopAutoTour();
        this.scene.stepAlongTrail(0.035);
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        this.stopAutoTour();
        this.scene.stepAlongTrail(-0.035);
      } else if (e.key === 'Escape') {
        el.labModal.hidden = true;
        el.a11yPanel.hidden = true;
        el.btnToggleA11y.setAttribute('aria-expanded', 'false');
      }
    });
  }

  handleProgressUpdate(meters, nearestIndex, waterfallProximity) {
    if (this.elements?.trailDistanceBadge) {
      this.elements.trailDistanceBadge.textContent = `Tramo: ${meters} m / 250 m`;
    }
    this.audio.setWaterProximity(waterfallProximity);
    if (this.scene?.travelMode === 'free' && nearestIndex !== this.currentStationIndex) {
      this.renderStationContent(nearestIndex, { announce: false });
    }
  }

  selectStation(index, { announce = true } = {}) {
    if (index < 0 || index >= STATIONS.length) return;
    this.narrator.stop();
    this.scene.goToStation(index);
    this.audio.setWaterProximity(STATIONS[index].waterProximity);
    this.renderStationContent(index, { announce });
  }

  renderStationContent(index, { announce = true } = {}) {
    this.currentStationIndex = index;
    const station = STATIONS[index];
    const el = this.elements;

    el.stationNumberBadge.textContent = `Estación ${station.number} de ${STATIONS.length}`;
    el.stationTerritoryTag.textContent = station.territoryTag;
    el.stationTitle.textContent = station.title;
    el.stationSubtitle.textContent = station.subtitle;
    el.guideName.textContent = station.guideName;
    el.guideRole.textContent = station.guideRole;
    el.stationCulturalNote.textContent = station.culturalNote;
    el.stationA11yNote.textContent = station.accessibilityHighlight;

    el.stationParagraphs.innerHTML = '';
    station.storyParagraphs.forEach((pText) => {
      const p = document.createElement('p');
      p.textContent = pText;
      el.stationParagraphs.appendChild(p);
    });

    el.stationHighlights.innerHTML = '';
    station.highlights.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'highlight-chip';
      const strong = document.createElement('strong');
      strong.textContent = item.label;
      const span = document.createElement('span');
      span.textContent = item.detail;
      card.append(strong, span);
      el.stationHighlights.appendChild(card);
    });

    const pillButtons = el.stationPills.querySelectorAll('button');
    pillButtons.forEach((btn, idx) => {
      const active = idx === index;
      btn.classList.toggle('btn-active', active);
      btn.setAttribute('aria-selected', String(active));
      if (active) {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    if (announce) {
      this.announce(`Estación ${station.number}: ${station.title}. ${station.subtitle}`);
    }
  }

  setStoryExpanded(expanded) {
    const isExpanded = Boolean(expanded);
    const el = this.elements;
    el.storyCard.classList.toggle('is-hidden', !isExpanded);
    el.btnToggleStory.setAttribute('aria-expanded', String(isExpanded));
    this.setButtonDisplay(
      el.btnToggleStory,
      'story',
      isExpanded ? 'Ocultar relato' : 'Ver relato'
    );
    if (isExpanded && window.matchMedia?.('(max-width: 768px)').matches) {
      el.a11yPanel.hidden = true;
      el.btnToggleA11y.setAttribute('aria-expanded', 'false');
    }
  }

  setWheelchairMode(enabled) {
    this.wheelchairMode = Boolean(enabled);
    this.scene.setWheelchairMode(this.wheelchairMode);

    const el = this.elements;
    el.btnEyeWheelchair.classList.toggle('btn-active', this.wheelchairMode);
    el.btnEyeWheelchair.setAttribute('aria-pressed', String(this.wheelchairMode));
    el.btnEyeStanding.classList.toggle('btn-active', !this.wheelchairMode);
    el.btnEyeStanding.setAttribute('aria-pressed', String(!this.wheelchairMode));

    el.btnQuickPerspective.setAttribute('aria-pressed', String(this.wheelchairMode));
    this.setButtonDisplay(
      el.btnQuickPerspective,
      this.wheelchairMode ? 'wheelchair' : 'standing',
      this.wheelchairMode ? 'Vista 1,15 m' : 'Vista 1,65 m'
    );
    this.announce(
      this.wheelchairMode
        ? 'Perspectiva ajustada a altura de silla de ruedas (1,15 metros).'
        : 'Perspectiva ajustada a vista estándar de pie (1,65 metros).'
    );
  }

  applyReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
    document.documentElement.setAttribute('data-reduced-motion', String(this.reducedMotion));
    this.scene.setReducedMotion(this.reducedMotion);

    const btn = this.elements.btnReducedMotion;
    btn.classList.toggle('btn-active', this.reducedMotion);
    btn.setAttribute('aria-pressed', String(this.reducedMotion));
  }

  startAutoTour() {
    this.isAutoTour = true;
    this.elements.btnAutoTour.classList.add('btn-active');
    this.elements.btnAutoTour.setAttribute('aria-pressed', 'true');
    this.setButtonDisplay(this.elements.btnAutoTour, 'pause', 'Pausar paseo');
    this.announce('Paseo guiado automático activado.');

    this.autoTourTimer = window.setInterval(() => {
      const next = (this.currentStationIndex + 1) % STATIONS.length;
      this.selectStation(next);
    }, 10500);
  }

  stopAutoTour() {
    if (!this.isAutoTour) return;
    this.isAutoTour = false;
    if (this.autoTourTimer) {
      clearInterval(this.autoTourTimer);
      this.autoTourTimer = null;
    }
    this.elements.btnAutoTour.classList.remove('btn-active');
    this.elements.btnAutoTour.setAttribute('aria-pressed', 'false');
    this.setButtonDisplay(this.elements.btnAutoTour, 'play', 'Paseo guiado');
  }

  updateNarratorUI(state) {
    const el = this.elements;
    if (state === 'unsupported') {
      this.setButtonDisplay(el.btnNarrate, 'voice', 'Voz no disponible');
      el.btnNarrate.disabled = true;
      return;
    }

    const active = state === 'speaking' || state === 'paused';
    el.btnNarratePause.hidden = !active;
    el.btnNarrateStop.hidden = !active;
    this.setButtonDisplay(
      el.btnNarratePause,
      state === 'paused' ? 'play' : 'pause',
      state === 'paused' ? 'Reanudar voz' : 'Pausar voz'
    );
    this.setButtonDisplay(
      el.btnNarrate,
      state === 'speaking' ? 'audioOn' : 'voice',
      state === 'speaking' ? 'Narrando...' : 'Escuchar relato'
    );
  }

  updateTooltip(stationIndex) {
    const tooltip = this.elements.sceneTooltip;
    if (stationIndex === null || stationIndex === undefined) {
      tooltip.hidden = true;
      return;
    }
    const station = STATIONS[stationIndex];
    tooltip.textContent = `Ir a Estación ${station.number}: ${station.title}`;
    tooltip.hidden = false;
  }

  announce(message) {
    this.elements.liveAnnouncer.textContent = message;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new SenderoVivoApp();
});
