/**
 * app.js — état applicatif, persistance et opérations transversales.
 *
 * Les vues ne touchent jamais au stockage : elles appellent les fonctions de
 * ce module, qui garantissent qu'un changement de domaine et son écriture sur
 * disque forment un tout. C'est aussi ici que l'on brancherait un serveur.
 */

import { createStore } from './core/store.js';
import * as storage from './core/storage.js';
import { setLocale, getIntlLocale } from './core/i18n.js';
import { setFormatLocale } from './core/format.js';
import { defaultConfig, mergeConfig, ORGANIZATION_KINDS } from './config/default.config.js';
import { buildDemoData } from './domain/seed.js';
import { toast } from './ui/feedback.js';

export const store = createStore({
  ready: false,
  config: defaultConfig,
  elections: [],
  directory: [],
  ui: {
    navOpen: false,
    role: 'organizer',
    filter: 'all',
    wizardStep: 1,
    draftId: null,
    liveSimulation: false,
  },
});

/* --- Persistance ----------------------------------------------------------- */

let saveTimer = null;
let saveFailed = false;

/** Écriture différée : une rafale de modifications ne produit qu'un seul appel. */
export function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { config, elections, directory } = store.get();
    const ok = storage.save({ config, elections, directory });
    if (!ok && !saveFailed) {
      saveFailed = true;
      toast("Sauvegarde impossible : espace de stockage saturé ou bloqué. Exportez vos données.", 'danger', { duration: 9000 });
    }
  }, 250);
}

/* --- Préférences ----------------------------------------------------------- */

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
  storage.prefs.setTheme(theme);
}

export function currentTheme() {
  return storage.prefs.getTheme();
}

export function applyLocale(code) {
  setLocale(code);
  setFormatLocale(getIntlLocale(), store.get().config.organization.timezone || undefined);
  storage.prefs.setLocale(code);
  store.refresh();
}

/* --- Amorçage -------------------------------------------------------------- */

export async function init() {
  applyTheme(storage.prefs.getTheme());

  const saved = storage.load();
  if (saved?.elections?.length) {
    const config = mergeConfig(defaultConfig, saved.config);
    store.update({
      ready: true, config, elections: saved.elections, directory: saved.directory || [],
    });
    applyLocale(storage.prefs.getLocale());
    return;
  }

  // Premier lancement : jeu de démonstration réellement joué par le moteur.
  const config = mergeConfig(defaultConfig, saved?.config);
  if (config.features.demoData) {
    const demo = await buildDemoData(config);
    const kind = ORGANIZATION_KINDS.find((k) => k.id === 'association');
    store.update({
      ready: true,
      config: mergeConfig(config, {
        organization: {
          name: config.organization.name || 'Club athlétique de Vaugirard',
          legalMention: config.organization.legalMention || kind.legal,
          chair: { role: 'La présidence', name: 'Sylvie Nguyen' },
          secretary: { role: 'Le trésorier', name: 'Hubert Lemoine' },
        },
        session: { actor: config.session.actor || 'Hubert Lemoine · trésorier' },
      }),
      elections: demo.elections,
      directory: demo.directory,
    });
  } else {
    store.update({ ready: true, config, elections: [], directory: [] });
  }
  applyLocale(storage.prefs.getLocale());
  persist();
}

/** Réinitialise l'instance : données locales effacées, démonstration régénérée. */
export async function resetAll({ withDemo = true } = {}) {
  storage.clear();
  const config = store.get().config;
  const demo = withDemo && config.features.demoData
    ? await buildDemoData(config)
    : { elections: [], directory: [] };
  store.update({ elections: demo.elections, directory: demo.directory });
  persist();
}

/* --- Accès aux scrutins ---------------------------------------------------- */

export function getElection(id) {
  return store.get().elections.find((e) => e.id === id) || null;
}

/** Remplace un scrutin et persiste. `next` peut être une fonction. */
export function setElection(id, next) {
  store.update((state) => ({
    elections: state.elections.map((election) => (
      election.id === id
        ? { ...(typeof next === 'function' ? next(election) : next), updatedAt: new Date().toISOString() }
        : election
    )),
  }));
  persist();
  return getElection(id);
}

/**
 * Met à jour un scrutin SANS provoquer de rendu. Réservé à la saisie au
 * kilomètre : re-rendre à chaque frappe déplacerait le curseur de l'utilisateur.
 * Les vues concernées rafraîchissent elles-mêmes le fragment d'écran utile.
 */
export function setElectionSilently(id, patch) {
  store.mutate((state) => ({
    elections: state.elections.map((election) => (
      election.id === id ? { ...election, ...patch } : election
    )),
  }));
  persist();
}

export function addElection(election) {
  store.update((state) => ({ elections: [election, ...state.elections] }));
  persist();
  return election;
}

export function removeElection(id) {
  store.update((state) => ({ elections: state.elections.filter((e) => e.id !== id) }));
  persist();
}

/**
 * Applique une opération du domaine (qui renvoie { ok, election, ... }) et
 * n'écrit qu'en cas de succès. Les échecs remontent tels quels à l'appelant,
 * qui décide du message : le domaine ne connaît pas l'interface.
 */
export async function applyOperation(id, operation) {
  const election = getElection(id);
  if (!election) return { ok: false, error: 'not-found' };
  const result = await operation(election);
  if (result.election) setElection(id, result.election);
  return result;
}

/* --- Réglages -------------------------------------------------------------- */

export function updateConfig(patch) {
  store.update((state) => ({ config: mergeConfig(state.config, patch) }));
  persist();
}

export function setUi(patch) {
  store.update((state) => ({ ui: { ...state.ui, ...patch } }));
}

/** Modifie l'état d'interface sans provoquer de rendu (saisie en cours). */
export function setUiSilently(patch) {
  store.mutate((state) => ({ ui: { ...state.ui, ...patch } }));
}

/* --- Import / export ------------------------------------------------------- */

export function exportAll() {
  const { config, elections, directory } = store.get();
  const payload = {
    format: 'quorum.export',
    version: storage.CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    config, elections, directory,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  storage.download(`quorum-${stamp}.json`, JSON.stringify(payload, null, 2));
}

export function exportElection(id) {
  const election = getElection(id);
  if (!election) return;
  storage.download(
    `${election.ref || 'scrutin'}.json`,
    JSON.stringify({ format: 'quorum.election', version: 1, election }, null, 2),
  );
}

/**
 * Importe un fichier exporté. La validation est volontairement stricte :
 * mieux vaut refuser un fichier douteux que corrompre un registre de votes.
 */
export async function importFile() {
  const picked = await storage.pickFile();
  if (!picked) return { ok: false, error: 'cancelled' };

  let data;
  try { data = JSON.parse(picked.text); } catch { return { ok: false, error: 'invalid-json' }; }

  if (data.format === 'quorum.election' && data.election?.id) {
    const exists = getElection(data.election.id);
    addElection(exists ? { ...data.election, id: `${data.election.id}_import` } : data.election);
    return { ok: true, kind: 'election', count: 1 };
  }

  if (data.format === 'quorum.export' && Array.isArray(data.elections)) {
    store.update({
      config: mergeConfig(defaultConfig, data.config),
      elections: data.elections,
      directory: data.directory || [],
    });
    persist();
    return { ok: true, kind: 'full', count: data.elections.length };
  }

  return { ok: false, error: 'unknown-format' };
}
