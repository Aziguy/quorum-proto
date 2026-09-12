/**
 * components.js — briques d'interface réutilisables.
 *
 * Chaque fonction renvoie du HTML sûr (via le gabarit `html`). Les actions
 * passent par `data-act` : un seul écouteur, posé à la racine, les distribue
 * à la vue courante. Conséquence : aucune fuite d'écouteur au changement de
 * page, et un balisage qui reste inspectable tel quel.
 */

import { html, raw, esc, cx, attrs } from '../core/dom.js';
import { icon } from './icons.js';
import { formatPercent, formatNumber, share } from '../core/format.js';
import { PAGE_SIZES, pageWindow } from '../core/collection.js';
import { STATUS } from '../domain/schema.js';
import { t } from '../core/i18n.js';

/* --- Boutons --------------------------------------------------------------- */

export function btn({
  label, act, variant = 'secondary', size = '', iconName = '', iconAfter = false,
  disabled = false, full = false, href = '', type = 'button', data = {}, title = '',
  busy = false,
}) {
  const classes = cx('btn', `btn--${variant}`, size && `btn--${size}`, full && 'btn--full');
  const dataAttrs = attrs({
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])),
    'data-act': act || false,
    title: title || false,
  });
  const glyph = busy ? '<span class="btn__spinner"></span>' : (iconName ? icon(iconName) : '');
  const body = iconAfter
    ? html`${label}${raw(glyph)}`
    : html`${raw(glyph)}${label}`;

  if (href) {
    return html`<a class="${classes}" href="${href}" ${dataAttrs}>${body}</a>`;
  }
  return html`<button type="${type}" class="${classes}" ${dataAttrs}
    ${raw(disabled || busy ? 'disabled' : '')}>${body}</button>`;
}

/* --- Pastilles et états ---------------------------------------------------- */

/**
 * Les clés sont ici passées par variable : l'extracteur de tools/i18n-report.mjs
 * ne les voit donc pas. Elles sont listées pour les traducteurs —
 * status.draft, status.open, status.closed, status.archived.
 */
const STATUS_TONES = {
  [STATUS.DRAFT]: { tone: 'neutral', key: 'status.draft', label: 'Brouillon' },
  [STATUS.OPEN]: { tone: 'brand', key: 'status.open', label: 'En cours' },
  [STATUS.CLOSED]: { tone: 'seal', key: 'status.closed', label: 'Clos' },
  [STATUS.ARCHIVED]: { tone: 'neutral', key: 'status.archived', label: 'Archivé' },
};

export function statusBadge(status) {
  const entry = STATUS_TONES[status] || STATUS_TONES[STATUS.DRAFT];
  return html`<span class="badge badge--${entry.tone}">${t(entry.key, entry.label)}</span>`;
}

export function badge(label, tone = 'neutral') {
  return html`<span class="badge badge--${tone}">${label}</span>`;
}

/* --- Bandeaux -------------------------------------------------------------- */

const BANNER_GLYPH = { ok: '✓', warn: '!', danger: '×', brand: 'i', seal: '▪', neutral: 'i' };

export function banner({ tone = 'neutral', title = '', body = '', actions = '', glyph }) {
  return html`<div class="banner banner--${tone}">
    <span class="banner__icon">${glyph || BANNER_GLYPH[tone] || 'i'}</span>
    <div class="banner__body">
      ${title ? html`<strong>${title}</strong> ` : ''}${raw(typeof body === 'string' ? esc(body) : body.__raw)}
      ${actions ? html`<div class="banner__actions">${actions}</div>` : ''}
    </div>
  </div>`;
}

/* --- Cartes et en-têtes ---------------------------------------------------- */

export function card({ title = '', hint = '', body, modifier = '', id = '' }) {
  return html`<section class="${cx('card', modifier)}" ${raw(id ? `id="${esc(id)}"` : '')}>
    ${title ? html`<h2 class="card__title">${title}</h2>` : ''}
    ${hint ? html`<p class="card__hint">${hint}</p>` : ''}
    ${body}
  </section>`;
}

export function pageHead({ title, lead = '', actions = '', back = null, badgeHtml = '' }) {
  return html`
    ${back ? html`<a class="back-link" href="${back.href}">${raw(icon('chevronLeft'))}${back.label}</a>` : ''}
    <header class="page-head">
      <div class="page-head__text">
        ${badgeHtml ? html`<div class="row row--tight" style="margin-bottom:var(--s-2)">${badgeHtml}</div>` : ''}
        <h1 id="view-title" tabindex="-1">${title}</h1>
        ${lead ? html`<p>${lead}</p>` : ''}
      </div>
      ${actions ? html`<div class="page-head__actions no-print">${actions}</div>` : ''}
    </header>`;
}

/* --- Statistiques ---------------------------------------------------------- */

export function stat({ value, label, hint = '' }) {
  return html`<div class="stat">
    <div class="stat__value">${value}</div>
    <div class="stat__label">${label}</div>
    ${hint ? html`<div class="stat__hint">${hint}</div>` : ''}
  </div>`;
}

export function statGrid(items) {
  return html`<div class="grid grid--4">${items.map(stat)}</div>`;
}

/* --- Jauges ---------------------------------------------------------------- */

export function meter({ value, total, tone = '', large = false, label = '' }) {
  const ratio = Math.min(1, share(value, total));
  return html`<div class="${cx('meter', large && 'meter--lg')}"
    role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${total}"
    ${raw(label ? `aria-label="${esc(label)}"` : '')}>
    <div class="${cx('meter__fill', tone && `meter__fill--${tone}`)}" style="width:${(ratio * 100).toFixed(2)}%"></div>
  </div>`;
}

/**
 * Jauge de participation avec repère de quorum. Le repère est un trait, pas
 * une couleur : il reste lisible pour un daltonien et à la photocopie.
 */
export function quorumGauge({ reached, required, total, met }) {
  const markPosition = total > 0 ? Math.min(100, (required / total) * 100) : 0;
  return html`<div class="gauge">
    ${meter({ value: reached, total, tone: met ? 'ok' : '', large: true, label: 'Participation' })}
    ${required > 0 ? html`<span class="gauge__mark" style="left:${markPosition.toFixed(2)}%"
      data-label="Quorum : ${formatNumber(required)}"></span>` : ''}
    <div class="gauge__scale" style="${required > 0 ? 'margin-top:var(--s-6)' : ''}">
      <span>0</span><span>${formatNumber(total)}</span>
    </div>
  </div>`;
}

/* --- Contrôles de formulaire ----------------------------------------------- */

export function field({
  label, name, value = '', type = 'text', hint = '', error = '', optional = false,
  placeholder = '', act = 'setField', rows = 0, options = null, attributes = {},
}) {
  const id = `f_${name}`;
  const common = attrs({
    id, name, class: rows || options ? (options ? 'select' : 'textarea') : 'input',
    'data-act': act, 'data-name': name,
    placeholder: placeholder || false,
    'aria-invalid': error ? 'true' : false,
    'aria-describedby': hint || error ? `${id}_h` : false,
    ...attributes,
  });

  let control;
  if (options) {
    control = html`<select ${common}>${options.map((o) => html`
      <option value="${o.value}" ${raw(String(o.value) === String(value) ? 'selected' : '')}>${o.label}</option>`)}
    </select>`;
  } else if (rows) {
    control = html`<textarea ${common} rows="${rows}">${value}</textarea>`;
  } else {
    control = html`<input ${common} type="${type}" value="${value}">`;
  }

  return html`<div class="field">
    <label class="field__label" for="${id}">${label}${optional ? html` <span class="field__optional">— facultatif</span>` : ''}</label>
    ${control}
    ${error ? html`<p class="field__error" id="${id}_h">${raw(icon('alert', { size: 13 }))} ${error}</p>`
    : hint ? html`<p class="field__hint" id="${id}_h">${hint}</p>` : ''}
  </div>`;
}

/** Bouton radio ou case à cocher présenté comme une carte. */
export function choice({
  title, sub = '', aside = '', checked = false, act, data = {}, box = false, role = 'radio',
  disabled = false,
}) {
  const dataAttrs = attrs({
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])),
    'data-act': act,
  });
  return html`<button type="button" class="choice" role="${role}"
    aria-checked="${checked ? 'true' : 'false'}" ${dataAttrs} ${raw(disabled ? 'disabled' : '')}>
    <span class="${cx('choice__mark', box && 'choice__mark--box')}"></span>
    <span class="choice__body">
      <span class="choice__title">${title}</span>
      ${sub ? html`<span class="choice__sub" style="display:block">${sub}</span>` : ''}
    </span>
    ${aside ? html`<span class="choice__aside">${aside}</span>` : ''}
  </button>`;
}

export function switchRow({ title, sub = '', checked, act, data = {}, disabled = false }) {
  const dataAttrs = attrs({
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])),
    'data-act': act,
  });
  return html`<button type="button" class="switch" role="switch"
    aria-checked="${checked ? 'true' : 'false'}" ${dataAttrs} ${raw(disabled ? 'disabled' : '')}>
    <span class="switch__track"></span>
    <span class="choice__body">
      <span class="choice__title">${title}</span>
      ${sub ? html`<span class="choice__sub" style="display:block">${sub}</span>` : ''}
    </span>
  </button>`;
}

/** Groupe de bascule. `items` : [{ id, label }]. */
export function segmented({ items, value, act, label = '', data = {} }) {
  const extra = Object.entries(data).map(([k, v]) => `data-${esc(k)}="${esc(v)}"`).join(' ');
  return html`<div class="segmented" role="group" ${raw(label ? `aria-label="${esc(label)}"` : '')}>
    ${label ? html`<span class="segmented__label">${label}</span>` : ''}
    ${items.map((item) => html`<button type="button" class="segmented__btn"
      aria-pressed="${String(item.id) === String(value) ? 'true' : 'false'}"
      data-act="${act}" data-value="${item.id}" ${raw(extra)}>${item.label}</button>`)}
  </div>`;
}

export function stepperNumber({ value, act, min = 1, max = 99, label }) {
  return html`<div class="stepper-num">
    <span class="choice__sub">${label}</span>
    <button type="button" class="stepper-num__btn" data-act="${act}" data-delta="-1"
      aria-label="Diminuer" ${raw(value <= min ? 'disabled' : '')}>−</button>
    <span class="stepper-num__val" aria-live="polite">${value}</span>
    <button type="button" class="stepper-num__btn" data-act="${act}" data-delta="1"
      aria-label="Augmenter" ${raw(value >= max ? 'disabled' : '')}>+</button>
  </div>`;
}

/* --- Structures ------------------------------------------------------------ */

export function emptyState({ title, body, actions = '', iconName = 'ballotBox' }) {
  return html`<div class="empty">
    <div class="empty__icon">${raw(icon(iconName, { size: 20 }))}</div>
    <h2>${title}</h2>
    <p>${body}</p>
    ${actions ? html`<div class="row" style="justify-content:center">${actions}</div>` : ''}
  </div>`;
}

/**
 * `head` accepte une chaîne, du balisage, ou un objet { content, sort } —
 * cette dernière forme pose `aria-sort`, que les lecteurs d'écran annoncent.
 */
export function table({ head, rows, caption = '' }) {
  const headCell = (cell) => (cell && typeof cell === 'object' && 'content' in cell
    ? html`<th scope="col" aria-sort="${cell.sort}">${cell.content}</th>`
    : html`<th scope="col">${cell}</th>`);

  // tabindex + role : une zone qui défile doit être atteignable au clavier,
  // sinon ses colonnes de droite sont inaccessibles sans souris.
  return html`<div class="table-wrap" tabindex="0" role="region"
    ${raw(caption ? `aria-label="${esc(caption)}"` : '')}>
    <table class="table">
      ${caption ? html`<caption class="sr-only">${caption}</caption>` : ''}
      <thead><tr>${head.map(headCell)}</tr></thead>
      <tbody>${rows.map((row) => html`<tr>${row.map((cellValue) => html`<td>${cellValue}</td>`)}</tr>`)}</tbody>
    </table>
  </div>`;
}

export function keyValues(pairs) {
  return html`<dl class="kv">${pairs.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`;
}

/** Barre d'onglets d'un scrutin. `items` : [{ id, label, href, count }]. */
export function tabs({ items, active }) {
  return html`<nav class="segmented no-print" aria-label="Sections du scrutin" style="margin-bottom:var(--s-5)">
    ${items.map((item) => html`<a class="segmented__btn" href="${item.href}"
      aria-pressed="${item.id === active ? 'true' : 'false'}"
      ${raw(item.id === active ? 'aria-current="page"' : '')}>${item.label}${
  item.count !== undefined ? html` <span class="dim nums">${item.count}</span>` : ''}</a>`)}
  </nav>`;
}

/** Ligne de décompte : nom, voix, part, barre. */
export function tallyRow({ label, sublabel = '', votes, ratio, tone = '', note = '', elected = false }) {
  return html`<div class="tally-row" data-elected="${elected ? 'true' : 'false'}">
    <div class="tally-row__head">
      <span class="tally-row__name">${label}${elected ? html` ${raw(icon('check', { size: 14 }))}` : ''}
        ${sublabel ? html`<span class="choice__sub" style="display:block;font-weight:400">${sublabel}</span>` : ''}</span>
      <span class="tally-row__votes nums">${formatNumber(votes)}</span>
      <span class="tally-row__pct">${ratio === null ? '—' : formatPercent(ratio)}</span>
    </div>
    ${meter({ value: Math.max(0, ratio || 0) * 100, total: 100, tone })}
    ${note ? html`<p class="tally-row__note">${note}</p>` : ''}
  </div>`;
}

export function skeletonList(count = 3) {
  return html`<div class="stack">${Array.from({ length: count }, (_, i) => html`
    <div class="skeleton" style="animation-delay:${i * 0.15}s">
      <div class="skeleton__line" style="width:30%;margin-bottom:var(--s-3)"></div>
      <div class="skeleton__line" style="width:62%;height:1rem;margin-bottom:var(--s-2)"></div>
      <div class="skeleton__line" style="width:40%"></div>
    </div>`)}</div>`;
}

/* --- Recherche et pagination ------------------------------------------------
   Ces deux composants partagent un identifiant de liste (`list`) : plusieurs
   listes peuvent donc coexister sur un même écran sans se mélanger.
   Les actions correspondantes sont globales (src/main.js), aucune vue n'a
   besoin de les redéclarer.
   -------------------------------------------------------------------------- */

export function searchInput({
  list, value = '', placeholder = 'Rechercher…', label = 'Rechercher', width = '22rem',
}) {
  const id = `search_${list}`;
  return html`<div class="search-field" style="max-width:${width}">
    <label class="sr-only" for="${id}">${label}</label>
    <span class="search-field__icon" aria-hidden="true">${raw(icon('search', { size: 15 }))}</span>
    <input class="input search-field__input" id="${id}" type="search" value="${value}"
      placeholder="${placeholder}" data-act="listSearch" data-list="${list}"
      autocomplete="off" spellcheck="false">
    ${value ? html`<button type="button" class="search-field__clear" data-act="listClear"
      data-list="${list}" aria-label="Effacer la recherche">${raw(icon('close', { size: 13 }))}</button>` : ''}
  </div>`;
}

/**
 * Barre de pagination. Elle annonce d'abord *ce qui est affiché* — « 26 à 50
 * sur 412 » — avant les commandes : sans ce repère, changer de page revient à
 * naviguer à l'aveugle.
 */
export function pagination({
  list, page, pages, total, from, to, size,
  noun = 'éléments', nounOne, sizes = true,
}) {
  if (total === 0) return '';

  const pageButton = (number) => (number === null
    ? html`<span class="pager__gap" aria-hidden="true">…</span>`
    : html`<button type="button" class="pager__page" data-act="listPage"
        data-list="${list}" data-page="${number}"
        ${raw(number === page ? 'aria-current="page"' : '')}
        aria-label="Page ${number} sur ${pages}">${number}</button>`);

  return html`<nav class="pager" aria-label="Pagination">
    <p class="pager__count" role="status">
      <strong class="nums">${formatNumber(from)}</strong>–<strong class="nums">${formatNumber(to)}</strong>
      sur <strong class="nums">${formatNumber(total)}</strong> ${total === 1 ? (nounOne || noun) : noun}
    </p>

    ${pages > 1 ? html`<div class="pager__controls">
      <button type="button" class="pager__step" data-act="listPage" data-list="${list}"
        data-page="${page - 1}" aria-label="Page précédente"
        ${raw(page <= 1 ? 'disabled' : '')}>${raw(icon('chevronLeft', { size: 14 }))}</button>
      ${pageWindow(page, pages).map(pageButton)}
      <button type="button" class="pager__step" data-act="listPage" data-list="${list}"
        data-page="${page + 1}" aria-label="Page suivante"
        ${raw(page >= pages ? 'disabled' : '')}>${raw(icon('chevronRight', { size: 14 }))}</button>
    </div>` : ''}

    ${sizes && total > PAGE_SIZES[0] ? html`<div class="pager__size">
      <label class="sr-only" for="size_${list}">Éléments par page</label>
      <select class="select" id="size_${list}" data-act="listSize" data-list="${list}">
        ${PAGE_SIZES.map((option) => html`<option value="${option}"
          ${raw(option === size ? 'selected' : '')}>${option} par page</option>`)}
      </select>
    </div>` : ''}
  </nav>`;
}

/** Message affiché quand une recherche ne donne rien — avec la sortie. */
export function noResults({ list, query, noun = 'résultat' }) {
  return html`<div class="empty" style="padding:var(--s-7) var(--s-5)">
    <p style="margin:0 0 var(--s-3)">Aucun ${noun} pour « <strong>${query}</strong> ».</p>
    ${btn({ label: 'Effacer la recherche', act: 'listClear', data: { list }, size: 'sm' })}
  </div>`;
}

/**
 * En-tête de colonne triable. Le sens du tri est porté par `aria-sort`, lu par
 * les lecteurs d'écran, et doublé d'une flèche pour les autres.
 */
export function sortHeader({ list, column, label, state, align = 'left' }) {
  const active = state.sort === column;
  const direction = active ? state.direction : null;
  const arrow = !active ? '' : icon(direction === 'asc' ? 'arrowUp' : 'arrowDown', { size: 12 });
  return html`<button type="button" class="sort-header" data-act="listSort"
    data-list="${list}" data-sort="${column}"
    style="justify-content:${align === 'right' ? 'flex-end' : 'flex-start'}"
    aria-label="Trier par ${label}${active ? (direction === 'asc' ? ', ordre croissant' : ', ordre décroissant') : ''}">
    ${label}${raw(arrow)}
  </button>`;
}

/** Valeur d'`aria-sort` à poser sur le `<th>` correspondant. */
export function ariaSort(state, column) {
  if (state.sort !== column) return 'none';
  return state.direction === 'asc' ? 'ascending' : 'descending';
}
