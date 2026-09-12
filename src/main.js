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
import { store, init, setUi, applyTheme, currentTheme, applyLocale } from './app.js';
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

function paint() {
  const state = store.get();
  if (!state.ready) return;

  const view = activeView();
  const ctx = context();
  const body = asHtml(view.render(ctx));

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

  // Le focus ne se déplace qu'au changement de page : un simple re-rendu ne
  // doit pas arracher le focus à l'élément que l'utilisateur manipule.
  if (lastRenderedPath !== current.path) {
    lastRenderedPath = current.path;
    window.scrollTo({ top: 0 });
    const title = root.querySelector('#view-title') || root.querySelector('h1');
    if (title) title.focus({ preventScroll: true });
    view.mounted?.(ctx, root);
  }
}

/* --- Distribution des événements -------------------------------------------- */

/** Actions disponibles dans toutes les vues. */
const GLOBAL_ACTIONS = {
  toggleNav: () => setUi({ navOpen: !store.get().ui.navOpen }),
  closeNav: () => setUi({ navOpen: false }),

  cycleTheme() {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(currentTheme()) + 1) % order.length];
    applyTheme(next);
    store.refresh();
    toast(`Thème : ${{ system: 'système', light: 'clair', dark: 'sombre' }[next]}`);
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
};

function dispatch(event, type) {
  const el = event.target.closest?.('[data-act]');
  if (!el) return;
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
