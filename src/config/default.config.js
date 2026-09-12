/**
 * default.config.js — configuration d'instance.
 *
 * C'est le seul fichier qu'une association, une coopérative ou un lycée doit
 * ouvrir pour adapter Quorum à son cas. Rien ici n'est spécifique à une
 * organisation : les valeurs sont des défauts sains, pas des hypothèses.
 *
 * Les réglages modifiables depuis l'interface (écran Réglages) sont fusionnés
 * par-dessus ce fichier et conservés localement.
 */

export const defaultConfig = {
  app: {
    name: 'Quorum',
    tagline: 'Plateforme de vote',
    mark: 'Q',
    repository: 'https://github.com/Aziguy/quorum-proto',
    version: '1.0.0',
    license: 'AGPL-3.0-or-later',
  },

  /** Identité de l'instance. Vide par défaut : à renseigner à l'installation. */
  organization: {
    name: '',
    kind: 'association',      // association | cooperative | school | party | company | other
    legalMention: '',         // ex. « association loi 1901 »
    contactEmail: '',
    timezone: '',             // vide = fuseau du navigateur
    chair: { role: 'La présidence', name: '' },
    secretary: { role: 'Le secrétariat', name: '' },
  },

  /**
   * Modules activables. Désactiver un module retire son écran, sa navigation
   * et ses options d'assistant — sans laisser de bouton mort.
   */
  features: {
    proxies: true,        // pouvoirs / procurations
    colleges: true,       // collèges ou catégories de membres
    weighting: true,      // voix pondérées (parts sociales, tantièmes)
    candidacies: true,    // dépôt et validation de candidatures
    templates: true,      // modèles de scrutin réutilisables
    sessionMode: true,    // écran projeté en séance
    privacy: true,        // écran Données & RGPD
    audit: true,          // journal d'audit
    minutes: true,        // procès-verbal
    demoData: true,       // jeu de démonstration au premier lancement
  },

  /** Valeurs préremplies dans l'assistant de création. */
  defaults: {
    secret: true,
    majority: 'absolute',
    qualifiedRatio: { num: 2, den: 3 },
    blankPolicy: 'excluded',
    quorum: { enabled: true, mode: 'percent', value: 50, basis: 'voters' },
    proxiesEnabled: true,
    proxyLimit: 3,
    runoff: false,
    votingDurationDays: 7,
  },

  /** Durées de conservation affichées et appliquées à la purge (en jours). */
  retention: {
    contacts: 90,
    roster: 1825,
    ballots: 1825,
    audit: 1825,
  },

  /**
   * Vocabulaire. Une coopérative parle de « sociétaires », un lycée
   * d'« élèves ». Ces mots apparaissent dans les écrans et les exports.
   */
  vocabulary: {
    member: 'adhérent',
    members: 'adhérents',
    body: 'assemblée générale',
    unit: 'voix',
  },

  /** Rôle endossé au lancement, pour la démonstration des habilitations. */
  session: {
    role: 'organizer',
    actor: '',
  },
};

/** Formes d'organisation proposées à la configuration. */
export const ORGANIZATION_KINDS = [
  {
    id: 'association', label: 'Association', legal: 'association loi 1901',
    vocabulary: { member: 'adhérent', members: 'adhérents', body: 'assemblée générale', unit: 'voix' },
  },
  {
    id: 'cooperative', label: 'Coopérative', legal: 'société coopérative',
    vocabulary: { member: 'sociétaire', members: 'sociétaires', body: 'assemblée des sociétaires', unit: 'parts' },
  },
  {
    id: 'school', label: 'Établissement scolaire', legal: 'établissement scolaire',
    vocabulary: { member: 'élève', members: 'élèves', body: 'conseil', unit: 'voix' },
  },
  {
    id: 'party', label: 'Parti ou mouvement', legal: 'parti politique',
    vocabulary: { member: 'militant', members: 'militants', body: 'congrès', unit: 'voix' },
  },
  {
    id: 'company', label: 'Entreprise ou copropriété', legal: 'personne morale',
    vocabulary: { member: 'associé', members: 'associés', body: 'assemblée', unit: 'tantièmes' },
  },
  {
    id: 'other', label: 'Autre', legal: '',
    vocabulary: { member: 'membre', members: 'membres', body: 'assemblée', unit: 'voix' },
  },
];

/** Fusion profonde limitée aux objets simples — suffisant pour la configuration. */
export function mergeConfig(base, patch) {
  if (!patch) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeConfig(base[key] || {}, value)
      : value;
  }
  return out;
}
