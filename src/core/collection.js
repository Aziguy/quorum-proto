/**
 * collection.js — recherche, tri et pagination.
 *
 * Fonctions pures, sans DOM ni état : une liste entre, une liste sort. Les
 * écrans n'ont donc pas à réinventer le filtrage, et le comportement reste
 * identique du corps électoral au journal d'audit.
 */

/**
 * Normalise pour la comparaison : minuscules, sans accent ni ponctuation.
 * Chercher « bénédicte » doit trouver « Benedicte », et inversement — un
 * trésorier ne saisit pas les accents d'une liste importée d'un tableur.
 */
export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@.\-]+/g, ' ')
    .trim();
}

/**
 * Filtre par recherche libre. Chaque terme doit apparaître quelque part dans
 * l'élément : « awa bienf » trouve Awa Diagne, membre bienfaiteur. Le ET entre
 * termes est plus utile que le OU — on affine une liste, on ne l'élargit pas.
 *
 * @param {Array} items
 * @param {string} query
 * @param {Array<(item) => string>} fields  accesseurs des champs interrogés
 */
export function search(items, query, fields) {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return items;

  return items.filter((item) => {
    const haystack = normalize(fields.map((field) => field(item) ?? '').join(' '));
    return terms.every((term) => haystack.includes(term));
  });
}

/** Tailles de page proposées. 25 tient dans un écran sans défilement excessif. */
export const PAGE_SIZES = [25, 50, 100, 250];

/**
 * Découpe une liste en pages. La page demandée est ramenée dans les bornes :
 * supprimer le dernier élément d'une page ne doit pas afficher un écran vide.
 */
export function paginate(items, { page = 1, size = 25 } = {}) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.round(page) || 1), pages);
  const start = (current - 1) * size;

  return {
    items: items.slice(start, start + size),
    page: current,
    pages,
    total,
    size,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
    hasPrevious: current > 1,
    hasNext: current < pages,
  };
}

/**
 * Suite de pages à afficher, avec des coupures quand il y en a beaucoup :
 * 1 … 7 8 [9] 10 11 … 42. Les coupures sont marquées par null.
 */
export function pageWindow(page, pages, span = 2) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const numbers = new Set([1, pages, page]);
  for (let offset = 1; offset <= span; offset += 1) {
    if (page - offset > 1) numbers.add(page - offset);
    if (page + offset < pages) numbers.add(page + offset);
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const out = [];
  let previous = 0;
  for (const number of sorted) {
    if (number - previous > 1) out.push(null);
    out.push(number);
    previous = number;
  }
  return out;
}

/**
 * Tri stable par accesseur. Les chaînes sont comparées selon la locale, pour
 * que « Étienne » se range après « Emma » et non en fin de liste.
 */
export function sortItems(items, accessor, direction = 'asc', locale = 'fr') {
  const factor = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const left = accessor(a);
    const right = accessor(b);
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    return String(left).localeCompare(String(right), locale, { numeric: true }) * factor;
  });
}
