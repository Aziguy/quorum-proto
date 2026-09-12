/**
 * format.js — mise en forme locale des dates, nombres et durées.
 * Aucune dépendance : `Intl` est natif depuis longtemps dans tous les
 * navigateurs visés.
 */

let locale = 'fr-FR';
let timeZone;

export function setFormatLocale(nextLocale, nextTimeZone) {
  locale = nextLocale || 'fr-FR';
  timeZone = nextTimeZone || undefined;
}

export function getTimeZone() {
  return timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const DATE_STYLES = {
  short: { dateStyle: 'short' },
  long: { dateStyle: 'long' },
  datetime: { dateStyle: 'short', timeStyle: 'short' },
  full: { dateStyle: 'long', timeStyle: 'short' },
  time: { timeStyle: 'short' },
  seconds: { dateStyle: 'short', timeStyle: 'medium' },
};

export function formatDate(value, style = 'datetime') {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { ...DATE_STYLES[style], timeZone }).format(date);
}

export function formatNumber(value, options = {}) {
  return new Intl.NumberFormat(locale, options).format(value ?? 0);
}

/** Pourcentage arrondi à une décimale, sans décimale inutile. */
export function formatPercent(ratio, digits = 1) {
  if (!Number.isFinite(ratio)) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: digits,
  }).format(ratio);
}

/** Part d'un total, tolérante au total nul. */
export function share(part, total) {
  return total > 0 ? part / total : 0;
}

export function percentWidth(part, total) {
  return `${(share(part, total) * 100).toFixed(2)}%`;
}

/** Durée relative : « dans 4 jours », « il y a 2 heures ». */
export function formatRelative(value) {
  if (!value) return '—';
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return '—';
  const diffSeconds = Math.round((target - Date.now()) / 1000);
  const units = [
    ['year', 31536000], ['month', 2592000], ['day', 86400],
    ['hour', 3600], ['minute', 60], ['second', 1],
  ];
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === 'second') {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return '—';
}

/** Initiales d'un nom, pour les pastilles d'identité. */
export function initials(name) {
  return String(name || '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0].toUpperCase()).join('');
}

/** Convertit une saisie `datetime-local` en ISO, et réciproquement. */
export function toLocalInput(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
