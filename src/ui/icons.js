/**
 * icons.js — pictogrammes en SVG inline.
 *
 * Tracés uniquement (pas d'aplats), épaisseur 1.6, héritage de `currentColor` :
 * un même pictogramme reste lisible en thème clair comme en thème sombre, et
 * dans un bouton coloré. Aucune police d'icônes, aucun réseau.
 */

const PATHS = {
  plus: '<path d="M8 3v10M3 8h10"/>',
  check: '<path d="M3 8.5l3.5 3.5L13 5"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  chevronLeft: '<path d="M10 3L5 8l5 5"/>',
  chevronRight: '<path d="M6 3l5 5-5 5"/>',
  chevronDown: '<path d="M3 6l5 5 5-5"/>',
  arrowRight: '<path d="M3 8h10M9 4l4 4-4 4"/>',
  arrowUp: '<path d="M8 13V3M4 7l4-4 4 4"/>',
  arrowDown: '<path d="M8 3v10M4 9l4 4 4-4"/>',
  menu: '<path d="M2 4h12M2 8h12M2 12h12"/>',
  list: '<path d="M5 4h9M5 8h9M5 12h9M2 4h.01M2 8h.01M2 12h.01"/>',
  users: '<circle cx="6" cy="6" r="2.4"/><path d="M2 13.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5"/><path d="M11 4.2a2.4 2.4 0 010 3.6M12.5 13.5c0-1.6-.6-2.6-1.5-3.2"/>',
  user: '<circle cx="8" cy="5.5" r="2.6"/><path d="M3 14c0-2.6 2.2-4.2 5-4.2s5 1.6 5 4.2"/>',
  ballotBox: '<rect x="2.5" y="6.5" width="11" height="7.5" rx="1.2"/><path d="M5.5 6.5V3.2a.7.7 0 01.7-.7h3.6a.7.7 0 01.7.7v3.3M6.5 9.5h3"/>',
  lock: '<rect x="3" y="7" width="10" height="7" rx="1.4"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>',
  seal: '<circle cx="8" cy="7" r="4"/><path d="M5.6 10.4L5 14l3-1.4L11 14l-.6-3.6"/>',
  shield: '<path d="M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4l5-2z"/>',
  scale: '<path d="M8 3v10M4.5 4.5h7M3 12h3M11 12h-3M4.5 4.8L3 12M11.5 4.8L13 12"/>',
  fileText: '<path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3M6 8h4M6 10.5h4"/>',
  clipboard: '<rect x="3.5" y="3" width="9" height="11" rx="1.2"/><path d="M6 3V2h4v1M6 7h4M6 10h2.5"/>',
  chart: '<path d="M2.5 13.5h11M5 11V7M8 11V4M11 11V9"/>',
  clock: '<circle cx="8" cy="8" r="5.8"/><path d="M8 4.6V8l2.3 1.6"/>',
  calendar: '<rect x="2.5" y="3.5" width="11" height="10" rx="1.2"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/>',
  mail: '<rect x="2" y="3.5" width="12" height="9" rx="1.2"/><path d="M2.4 4.6L8 8.8l5.6-4.2"/>',
  key: '<circle cx="5.5" cy="8" r="2.8"/><path d="M8.3 8H14M12 8v2.2M10.2 8v1.6"/>',
  search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2L14 14"/>',
  download: '<path d="M8 2.5v8M4.8 7.5L8 10.8l3.2-3.3M3 13.5h10"/>',
  upload: '<path d="M8 10.8V2.5M4.8 5.8L8 2.5l3.2 3.3M3 13.5h10"/>',
  printer: '<path d="M4.5 6V2.5h7V6"/><rect x="2.5" y="6" width="11" height="5" rx="1"/><path d="M4.5 9.5h7v4h-7z"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9M6.8 7v4M9.2 7v4"/>',
  settings: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7L3.6 3.6"/>',
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5L3.4 3.4"/>',
  moon: '<path d="M13 9.5A5.6 5.6 0 016.5 3a5.8 5.8 0 100 11 5.7 5.7 0 006.5-4.5z"/>',
  globe: '<circle cx="8" cy="8" r="5.8"/><path d="M2.2 8h11.6M8 2.2c1.6 1.7 2.4 3.7 2.4 5.8S9.6 12.1 8 13.8c-1.6-1.7-2.4-3.7-2.4-5.8S6.4 3.9 8 2.2z"/>',
  alert: '<path d="M8 2.8L14 13H2z"/><path d="M8 6.4v3M8 11.2h.01"/>',
  info: '<circle cx="8" cy="8" r="5.8"/><path d="M8 7.2v4M8 4.8h.01"/>',
  eyeOff: '<path d="M6.2 6.2a2.5 2.5 0 003.6 3.6"/><path d="M4 4.2C2.7 5.1 1.8 6.4 1.5 8c.8 2.6 3.3 4.4 6.5 4.4 1.1 0 2.1-.2 3-.6M11.4 11A6.9 6.9 0 0014.5 8c-.8-2.6-3.3-4.4-6.5-4.4-.7 0-1.3.1-1.9.2M2 2l12 12"/>',
  external: '<path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V13H3V4h3.5"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.2"/><path d="M3.5 10.5h-1V2.5h8v1"/>',
  refresh: '<path d="M13.5 8a5.5 5.5 0 11-1.8-4.1M13.5 2v3.5H10"/>',
  play: '<path d="M5 3.2l7 4.8-7 4.8z"/>',
  pause: '<path d="M6 3.5v9M10 3.5v9"/>',
  home: '<path d="M2.5 7L8 2.5 13.5 7v6.5h-11z"/><path d="M6.5 13.5v-4h3v4"/>',
};

/**
 * @param {string} name  clé de PATHS
 * @param {object} opts  { size, className, title } — `title` rend l'icône
 *                       accessible ; sans lui elle est décorative (aria-hidden).
 */
export function icon(name, { size = 16, className = '', title = '' } = {}) {
  const path = PATHS[name];
  if (!path) return '';
  const label = title
    ? `role="img" aria-label="${title.replace(/"/g, '&quot;')}"`
    : 'aria-hidden="true"';
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    class="${className}" ${label}>${path}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);
