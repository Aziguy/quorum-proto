/**
 * router.js — routage par fragment d'URL (#/chemin).
 *
 * Le fragment est choisi délibérément : il fonctionne sur GitHub Pages, sur un
 * partage de fichiers et en ouverture directe du fichier local, sans la moindre
 * règle de réécriture côté serveur.
 *
 * Les motifs sont comparés segment par segment plutôt que par expression
 * régulière : "/scrutins/:id/suivi" se lit tel quel, et aucun caractère de
 * chemin n'a besoin d'être échappé.
 */

/** Découpe "/scrutins/:id/suivi" en segments et relève les paramètres. */
function compile(pattern) {
  const segments = pattern.split('/').filter(Boolean);
  return {
    segments,
    names: segments.filter((s) => s.startsWith(':')).map((s) => s.slice(1)),
  };
}

/** Renvoie les paramètres si le chemin correspond au motif, sinon null. */
function match(route, path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== route.segments.length) return null;

  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    const segment = route.segments[i];
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(parts[i]);
    } else if (segment !== parts[i]) {
      return null;
    }
  }
  return params;
}

export function createRouter(routes, { onChange }) {
  const compiled = routes.map((route) => ({ ...route, ...compile(route.path) }));

  function parse() {
    const hash = window.location.hash.slice(1) || '/';
    const [pathname, search = ''] = hash.split('?');
    const query = Object.fromEntries(new URLSearchParams(search));
    let path = pathname;
    try { path = decodeURI(pathname); } catch { /* chemin mal encodé : on le garde tel quel */ }

    for (const route of compiled) {
      const params = match(route, path);
      if (params) return { route, params, query, path };
    }
    return { route: null, params: {}, query, path };
  }

  function handle() { onChange(parse()); }

  return {
    start() {
      window.addEventListener('hashchange', handle);
      handle();
    },
    current: parse,
    /** Navigue ; `replace` évite d'empiler une entrée d'historique. */
    go(path, { replace = false } = {}) {
      const target = `#${path}`;
      if (window.location.hash === target) { handle(); return; }
      if (replace) window.location.replace(target);
      else window.location.hash = target;
    },
  };
}
