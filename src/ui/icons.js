/**
 * Iconografía SVG personalizada diseñada a medida para Sendero Vivo 3D.
 * Evita emojis del sistema para garantizar consistencia visual, escalado nítido
 * y compatibilidad con modo Alto Contraste.
 */
const svgWrap = (inner, size = 18, extraClass = '') =>
  `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  brandEmblem: svgWrap(
    `<path d="M3 18.5L9.5 8.5L14 14.5L16.8 11L21 18.5" />
     <path d="M4.5 20.5C8.5 18 13.5 18 19.5 16.5" />
     <path d="M16 4.5C16 7 14.2 9 12 9C12 6.5 13.8 4.5 16 4.5Z" />`,
    22
  ),
  audioOn: svgWrap(
    `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
     <path d="M15.5 8.5a5 5 0 0 1 0 7" />
     <path d="M18.8 5.5a9.5 9.5 0 0 1 0 13" />`
  ),
  audioOff: svgWrap(
    `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
     <line x1="22" y1="9" x2="16" y2="15" />
     <line x1="16" y1="9" x2="22" y2="15" />`
  ),
  accessibility: svgWrap(
    `<circle cx="12" cy="5.2" r="1.8" />
     <path d="M5 9.5h14" />
     <path d="M12 9.5v4.5" />
     <path d="M9 20l3-6 3 6" />`
  ),
  document: svgWrap(
    `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
     <polyline points="14 3 14 8 19 8" />
     <line x1="9" y1="13" x2="15" y2="13" />
     <line x1="9" y1="17" x2="13" y2="17" />`
  ),
  story: svgWrap(
    `<path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H11v17H4.5A2.5 2.5 0 0 0 2 22z" />
     <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H13v17h6.5A2.5 2.5 0 0 1 22 22z" />`
  ),
  voice: svgWrap(
    `<rect x="9" y="3" width="6" height="11" rx="3" />
     <path d="M5 11a7 7 0 0 0 14 0" />
     <line x1="12" y1="18" x2="12" y2="21" />
     <line x1="8.5" y1="21" x2="15.5" y2="21" />`
  ),
  play: svgWrap(`<polygon points="7 5 19 12 7 19 7 5" />`),
  pause: svgWrap(
    `<rect x="6" y="5" width="4" height="14" rx="1" />
     <rect x="14" y="5" width="4" height="14" rx="1" />`
  ),
  stop: svgWrap(`<rect x="6" y="6" width="12" height="12" rx="2" />`),
  wheelchair: svgWrap(
    `<circle cx="10.5" cy="4.8" r="1.6" />
     <path d="M10.5 8.5v5.5h5l2.5 4.5" />
     <path d="M10.5 11h4" />
     <path d="M13.8 16.5A4.8 4.8 0 1 1 8.5 11.7" />`
  ),
  standing: svgWrap(
    `<circle cx="12" cy="4.8" r="1.8" />
     <path d="M12 8.5v6.5" />
     <path d="M8.5 11l3.5-2 3.5 2" />
     <path d="M9.5 21l2.5-6 2.5 6" />`
  ),
  contrast: svgWrap(
    `<circle cx="12" cy="12" r="8.5" />
     <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none" />`
  ),
  reducedMotion: svgWrap(
    `<path d="M4 12c2.5-3 5.5-3 8 0s5.5 3 8 0" />
     <path d="M4 17c2.5-2 5.5-2 8 0s5.5 2 8 0" />
     <circle cx="12" cy="6.5" r="2" />`
  ),
  volumeLow: svgWrap(
    `<polygon points="11 6 7 9.5 3.5 9.5 3.5 14.5 7 14.5 11 18 11 6" />
     <path d="M15.2 9.5a3.8 3.8 0 0 1 0 5" />`
  ),
  lookLeft: svgWrap(
    `<path d="M9 14L4 9l5-5" />
     <path d="M4 9h9a7 7 0 0 1 7 7v3" />`
  ),
  recenter: svgWrap(
    `<circle cx="12" cy="12" r="6.5" />
     <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
     <line x1="12" y1="2.5" x2="12" y2="5.5" />
     <line x1="12" y1="18.5" x2="12" y2="21.5" />
     <line x1="2.5" y1="12" x2="5.5" y2="12" />
     <line x1="18.5" y1="12" x2="21.5" y2="12" />`
  ),
  lookRight: svgWrap(
    `<path d="M15 14l5-5-5-5" />
     <path d="M20 9h-9a7 7 0 0 0-7 7v3" />`
  ),
  arrowLeft: svgWrap(
    `<line x1="19" y1="12" x2="5" y2="12" />
     <polyline points="11 6 5 12 11 18" />`
  ),
  arrowRight: svgWrap(
    `<line x1="5" y1="12" x2="19" y2="12" />
     <polyline points="13 6 19 12 13 18" />`
  ),
  trailForward: svgWrap(
    `<line x1="12" y1="19" x2="12" y2="5" />
     <polyline points="6 11 12 5 18 11" />`
  ),
  trailBack: svgWrap(
    `<line x1="12" y1="5" x2="12" y2="19" />
     <polyline points="6 13 12 19 18 13" />`
  ),
  close: svgWrap(
    `<line x1="6" y1="6" x2="18" y2="18" />
     <line x1="18" y1="6" x2="6" y2="18" />`
  )
};
