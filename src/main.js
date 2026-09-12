/**
 * main.js — point d'entrée : routage, rendu, distribution des événements.
 *
 * Une seule boucle : une route change ou l'état change → la vue est rendue.
 * Un seul écouteur par type d'événement, posé à la racine, qui distribue à la
 * vue courante via `data-act`. Il n'y a donc rien à nettoyer au changement de
 * page, et aucun écouteur ne survit à la vue qui l'a créé.
 */

import { createRouter } from './core/router.js';
import { render } from './core/dom.js';
import {
  store, init, setUi, setList, listState, applyTheme, currentTheme, applyLocale,
} from './app.js';
import { header, navigation } from './shell.js';
import { getLocale, LOCALES } from './core/i18n.js';
import { toast } from './ui/feedback.js';

import dashboard from './views/dashboard.js';
import wizard from './views/wizard.js';
import monitor from './views/monitor.js';
import results from './views/results.js';
import minutes from './views/minutes.js';
import electorate from './views/electorate.js';
import proxies from './views/proxies.js';
import candidacies from './views/candidacies.js';
import auditView from './views/audit.js';
import pollingStation from './views/polling-station.js';
import session from './views/session.js';
import voter from './views/voter.js';
import templates from './views/templates.js';
import roles from './views/roles.js';
import privacy from './views/privacy.js';
import settings from './views/settings.js';
import about from './views/about.js';
import notFound from './views/not-found.js';

const ROUTES = [
  { path: '/', view: dashboard },
  { path: '/scrutins', view: dashboard },
  { path: '/scrutins/nouveau', view: wizard },
  { path: '/scrutins/:id/assistant', view: wizard },
  { path: '/scrutins/:id/suivi', view: monitor },
  { path: '/scrutins/:id/resultats', view: results },
  { path: '/scrutins/:id/pv', view: minutes },
  { path: '/scrutins/:id/electeurs', view: electorate },
  { path: '/scrutins/:id/pouvoirs', view: proxies },
  { path: '/scrutins/:id/candidatures', view: candidacies },
  { path: '/scrutins/:id/journal', view: auditView },
  { path: '/scrutins/:id/urne', view: pollingStation },
  { path: '/scrutins/:id/seance', view: session },
  { path: '/vote', view: voter },
  { path: '/vote/:eid', view: voter },
  { path: '/vote/:eid/:token', view: voter },
  { path: '/modeles', view: templates },
  { path: '/roles', view: roles },
  { path: '/donnees', view: privacy },
  { path: '/reglages', view: settings },
  { path: '/a-propos', view: about },
];

const root = document.getElementById('app');
let current = { route: null, params: {}, query: {}, path: '/' };
let lastRenderedPath = null;

function context() {
  const state = store.get();
  return {
    state,
    config: state.config,
    ui: state.ui,
    elections: state.elections,
    params: current.params,
    query: current.query,
    path: current.path,
    go: (to, options) => router.go(to, options),
  };
}

function activeView() {
  return current.route?.view || notFound;
}

function asHtml(value) {
  return typeof value === 'string' ? value : value.__raw;
}

/* --- Rendu ------------------------------------------------------------------ */

/**
 * Un re-rendu remplace tout le contenu : l'élément qui avait le focus
 * disparaît. Sans ces deux fonctions, taper dans un champ de recherche
 * perdrait le focus au premier caractère — le filtrage étant, lui, immédiat.
 */
function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.id || !root.contains(el)) return null;
  const isText = typeof el.selectionStart === 'number';
  return { id: el.id, start: isText ? el.selectionStart : null, end: isText ? el.selectionEnd : null };
}

function restoreFocus(snapshot) {
  if (!snapshot) return false;
  const el = root.querySelector(`#${CSS.escape(snapshot.id)}`);
  if (!el) return false;
  el.focus({ preventScroll: true });
  if (snapshot.start !== null && typeof el.setSelectionRange === 'function') {
    // Certains types de champ refusent la sélection : l'échec est sans effet.
    try { el.setSelectionRange(snapshot.start, snapshot.end); } catch { /* ignoré */ }
  }
  return true;
}

function paint() {
  const state = store.get();
  if (!state.ready) return;

  const view = activeView();
  const ctx = context();
  const body = asHtml(view.render(ctx));
  const focused = captureFocus();

  if (view.layout === 'bare') {
    root.className = '';
    root.innerHTML = body;
  } else {
    root.className = 'app';
    root.innerHTML = `${asHtml(header(state))}
      <div class="app-body">
        ${asHtml(navigation(state, current.path))}
        ${state.ui.navOpen ? '<div class="nav-scrim" data-act="closeNav"></div>' : ''}
        <main class="app-main" id="main" tabindex="-1">${body}</main>
      </div>`;
  }
  root.removeAttribute('aria-busy');
  const restored = restoreFocus(focused);

  // Le focus ne se déplace qu'au changement de page, et jamais s'il vient
  // d'être rendu à l'élément que l'utilisateur manipulait.
  if (lastRenderedPath !== current.path && !restored) {
    lastRenderedPath = current.path;
    window.scrollTo({ top: 0 });
    const title = root.querySelector('#view-title') || root.querySelector('h1');
    if (title) title.focus({ preventScroll: true });
    view.mounted?.(ctx, root);
  }
}

/* --- Distribution des événements -------------------------------------------- */

const THEME_LABELS = { system: 'système', light: 'clair', dark: 'sombre' };

/** Actions disponibles dans toutes les vues. */
const GLOBAL_ACTIONS = {
  toggleNav: () => setUi({ navOpen: !store.get().ui.navOpen }),
  closeNav: () => setUi({ navOpen: false }),

  cycleTheme() {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(currentTheme()) + 1) % order.length];
    applyTheme(next);
    store.refresh();
    toast(`Thème : ${THEME_LABELS[next]}`);
  },

  cycleLocale() {
    const codes = Object.keys(LOCALES);
    const next = codes[(codes.indexOf(getLocale()) + 1) % codes.length];
    applyLocale(next);
    toast(LOCALES[next].label);
  },

  setRole(ctx, { el }) {
    setUi({ role: el.value });
    toast(`Rôle endossé : ${el.options[el.selectedIndex].text}`);
  },

  /* --- Listes : recherche, pagination, tri ---------------------------------
     Déclarées une fois ici, elles servent toutes les vues. Une liste est
     identifiée par `data-list` ; plusieurs peuvent donc coexister sur un écran.
     Toute modification du filtre ramène à la première page : rester en page 7
     d'un résultat qui n'en compte plus que 2 afficherait un écran vide.
     ---------------------------------------------------------------------- */
  listSearch: (ctx, { el }) => setList(el.dataset.list, { q: el.value, page: 1 }),
  listClear: (ctx, { data }) => setList(data.list, { q: '', page: 1 }),
  listPage: (ctx, { data }) => setList(data.list, { page: Number(data.page) }),
  listSize: (ctx, { el }) => setList(el.dataset.list, { size: Number(el.value), page: 1 }),

  /** Un clic sur la colonne déjà triée inverse le sens. */
  listSort(ctx, { data }) {
    const state = listState(data.list);
    const sameColumn = state.sort === data.sort;
    setList(data.list, {
      sort: data.sort,
      direction: sameColumn && state.direction === 'asc' ? 'desc' : 'asc',
      page: 1,
    });
  },
};

/**
 * Contrôles qui gèrent eux-mêmes le clic. Les intercepter reviendrait à
 * empêcher l'ouverture d'une liste déroulante ou le placement du curseur —
 * et le re-rendu qui suivrait remplacerait l'élément sous le doigt.
 * Ces éléments sont servis par les événements `change` et `input`.
 */
const SELF_HANDLED = new Set(['SELECT', 'INPUT', 'TEXTAREA', 'OPTION']);

function dispatch(event, type) {
  const el = event.target.closest?.('[data-act]');
  if (!el) return;
  if (type === 'click' && SELF_HANDLED.has(el.tagName)) return;
  const name = el.dataset.act;
  const view = activeView();
  const handler = view.actions?.[name] || GLOBAL_ACTIONS[name];
  if (!handler) return;

  // Un lien conserve sa navigation native ; seuls les boutons sont interceptés.
  if (el.tagName !== 'A') event.preventDefault();

  Promise.resolve(handler(context(), { el, event, data: { ...el.dataset }, type }))
    .catch((error) => {
      console.error('Quorum : action en échec', name, error);
      toast('Cette action a échoué. Le détail figure dans la console.', 'danger');
    });
}

document.addEventListener('click', (event) => dispatch(event, 'click'));
document.addEventListener('input', (event) => {
  if (event.target.matches('input, textarea')) dispatch(event, 'input');
});
document.addEventListener('change', (event) => {
  if (event.target.matches('select, input[type="checkbox"], input[type="radio"], input[type="date"], input[type="datetime-local"]')) {
    dispatch(event, 'change');
  }
});
document.addEventListener('submit', (event) => {
  if (event.target.matches('form[data-act]')) { event.preventDefault(); dispatch(event, 'submit'); }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && store.get().ui.navOpen) setUi({ navOpen: false });
});

/* --- Démarrage --------------------------------------------------------------- */

const router = createRouter(ROUTES, {
  onChange(match) {
    current = match;
    if (store.get().ui.navOpen) setUi({ navOpen: false });
    paint();
  },
});

store.subscribe(paint);

init()
  .then(() => router.start())
  .catch((error) => {
    console.error('Quorum : démarrage impossible', error);
    root.innerHTML = `<div class="view"><div class="banner banner--danger">
      <span class="banner__icon">×</span>
      <div class="banner__body"><strong>Démarrage impossible.</strong>
      Ouvrez la console du navigateur pour le détail, ou videz le stockage local de ce site.</div>
    </div></div>`;
  });

export { router };
