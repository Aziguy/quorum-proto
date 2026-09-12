/**
 * dom.js — fabrication de balisage sûre et rendu.
 *
 * Principe : les vues renvoient une chaîne HTML construite avec le gabarit
 * balisé `html`. Toute valeur interpolée est échappée par défaut ; pour
 * insérer du balisage déjà construit, il faut le déclarer explicitement
 * avec `raw()`. Cette asymétrie est volontaire : l'injection devient un
 * acte conscient, jamais un oubli.
 */

const ESCAPES = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Échappe une valeur pour insertion dans du HTML ou un attribut. */
export function esc(value) {
  if (value === null || value === undefined || value === false) return '';
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Marque une chaîne comme déjà sûre : elle sera insérée telle quelle. */
export function raw(value) {
  return { __raw: value === null || value === undefined ? '' : String(value) };
}

function interpolate(value) {
  if (value === null || value === undefined || value === false || value === '') return '';
  if (Array.isArray(value)) return value.map(interpolate).join('');
  if (typeof value === 'object' && '__raw' in value) return value.__raw;
  return esc(value);
}

/** Gabarit balisé : html`<p>${texteUtilisateur}</p>` */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    out += interpolate(values[i]) + strings[i + 1];
  }
  return raw(out);
}

/** Rend une valeur `html` (ou une chaîne brute) dans un conteneur. */
export function render(container, content) {
  container.innerHTML = typeof content === 'string' ? content : interpolate(content);
}

/** Classes conditionnelles : cx('btn', isActive && 'btn--on') */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Attributs conditionnels : attrs({ disabled: true, 'data-id': 4 }) */
export function attrs(map) {
  const out = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === false || value === null || value === undefined) continue;
    if (value === true) out.push(esc(key));
    else out.push(`${esc(key)}="${esc(value)}"`);
  }
  return raw(out.join(' '));
}

/** Remonte depuis un élément jusqu'au premier ancêtre portant `selector`. */
export function closest(target, selector) {
  return target instanceof Element ? target.closest(selector) : null;
}

/** Déplace le focus sur le premier élément focalisable d'un conteneur. */
export function focusFirst(container) {
  const el = container.querySelector(
    '[autofocus], h1[tabindex], input:not([type="hidden"]), select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
  );
  if (el) el.focus({ preventScroll: true });
}

/** Annonce un message aux lecteurs d'écran sans perturber le focus. */
export function announce(message) {
  const region = document.getElementById('live-region');
  if (!region) return;
  region.textContent = '';
  // Le délai force la relecture même si le texte est identique au précédent.
  setTimeout(() => { region.textContent = message; }, 60);
}
