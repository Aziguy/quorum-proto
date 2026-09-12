/**
 * storage.js — persistance locale, versionnée et réversible.
 *
 * Le prototype n'a pas de serveur : tout vit dans le navigateur. Deux
 * conséquences assumées, écrites noir sur blanc dans l'interface :
 *   1. les données ne quittent jamais le poste ;
 *   2. elles disparaissent avec le profil du navigateur — d'où l'export JSON,
 *      qui est le seul mécanisme de sauvegarde réel.
 *
 * Remplacer ce module par des appels HTTP suffit à brancher un vrai serveur :
 * c'est le seul point du code qui connaît l'existence de localStorage.
 */

const KEY = 'quorum.state.v1';
const THEME_KEY = 'quorum.theme';
const LOCALE_KEY = 'quorum.locale';

/** Accès défensif : le stockage peut être désactivé (navigation privée). */
function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export const prefs = {
  getTheme: () => safeGet(THEME_KEY) || 'system',
  setTheme: (value) => safeSet(THEME_KEY, value),
  getLocale: () => safeGet(LOCALE_KEY) || 'fr',
  setLocale: (value) => safeSet(LOCALE_KEY, value),
};

/** Migrations successives : chaque fonction fait passer d'une version à la suivante. */
const MIGRATIONS = [
  // (données v1) => données v2 — aucune pour l'instant, la forme est stable.
];

export const CURRENT_VERSION = MIGRATIONS.length + 1;

function migrate(data) {
  let result = data;
  let version = result.version || 1;
  while (version < CURRENT_VERSION) {
    result = MIGRATIONS[version - 1](result);
    version += 1;
    result.version = version;
  }
  return result;
}

export function load() {
  const rawValue = safeGet(KEY);
  if (!rawValue) return null;
  try {
    return migrate(JSON.parse(rawValue));
  } catch (error) {
    console.warn('Quorum : données locales illisibles, réinitialisation.', error);
    return null;
  }
}

/** Renvoie false si l'écriture échoue (quota dépassé, stockage bloqué). */
export function save(data) {
  return safeSet(KEY, JSON.stringify({ ...data, version: CURRENT_VERSION }));
}

export function clear() {
  try { localStorage.removeItem(KEY); return true; } catch { return false; }
}

/** Taille approximative occupée, pour l'écran Réglages. */
export function usedBytes() {
  return new Blob([safeGet(KEY) || '']).size;
}

/** Déclenche le téléchargement d'un fichier construit en mémoire. */
export function download(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Libère l'objet une fois le téléchargement amorcé.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Ouvre un sélecteur de fichier et renvoie le contenu texte. */
export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, text: String(reader.result) });
      reader.onerror = () => resolve(null);
      reader.readAsText(file, 'utf-8');
    });
    input.click();
  });
}
